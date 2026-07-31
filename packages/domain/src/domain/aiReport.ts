// @ts-nocheck
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildLiuyaoReport, buildMeihuaReport } from "./reportBuilder.js";
import { resolveFindingExplanation, resolveRelationships, resolveTopicRoleContext } from "./presentation/interpretationAssets.js";
import { buildLiuyaoProductResultFacts, judgmentFactsSignature } from "./presentation/productResultFacts.js";

export const AI_SCHEMA_VERSION = "AI_REPORT_V1";
export const LIUYAO_PROMPT_VERSION = "liuyao-report-v1";
export const MEIHUA_PROMPT_VERSION = "meihua-report-v1";

const OUTCOME_LABELS = new Set(["FAVORABLE", "MIXED", "CAUTIOUS", "UNCLEAR"]);
const DIMENSION_MAP = Object.freeze({
  subject_state: "subjectState",
  target_state: "targetState",
  supporting_forces: "supportingForces",
  blocking_forces: "blockingForces",
  change_direction: "changeDirection",
  timing_state: "timingState",
});
const FORBIDDEN_OUTPUT_KEYS = new Set([
  "guaranteed_success",
  "guaranteed_failure",
  "exact_probability",
  "certain_date",
  "medical_diagnosis",
  "legal_conclusion",
  "selectedYongshen",
  "overallState",
  "baseState",
  "dynamicDirection",
  "conflictState",
  "dominantFindingRefs",
  "timingPrecision",
]);
const FORBIDDEN_TEXT_PATTERNS = [
  /保证成功|保证失败|必然成功|必然失败/u,
  /确诊|诊断为|停止治疗|处方/u,
  /稳赚|确定回报率|全部资金/u,
  /\b\d{4}-\d{1,2}-\d{1,2}\b/u,
  /\d{4}年\d{1,2}月\d{1,2}日/u,
];

export class AIReportValidationError extends Error {
  code: string;
  details: any;

  constructor(code, message, details = undefined) {
    super(message);
    this.name = "AIReportValidationError";
    this.code = code;
    this.details = details;
  }
}

function estimateTokens(value) {
  return Math.ceil(JSON.stringify(value ?? "").length / 4);
}

function assertValid(condition, code, message, details = undefined) {
  if (!condition) throw new AIReportValidationError(code, message, details);
}

function hashJson(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function questionDigest(question = "") {
  return {
    length: String(question).length,
    sha256: createHash("sha256").update(String(question)).digest("hex").slice(0, 16),
  };
}

function evidenceRefForFinding(finding) {
  return finding.rule_code ? `rule:${finding.rule_code}` : `finding:${finding.id}`;
}

function findingForAI(finding) {
  return {
    id: evidenceRefForFinding(finding),
    findingId: finding.id,
    ruleCode: finding.rule_code,
    ruleType: finding.rule_type,
    ruleVersion: finding.rule_version,
    outputRole: finding.output_role,
    dimension: finding.dimension,
    summary: finding.summary,
    evidenceKind: finding.evidence_kind,
  };
}

function meihuaEvidenceForAI(item) {
  return {
    id: `meihua:${item.code}`,
    findingId: `meihua:${item.code}`,
    ruleCode: item.code,
    ruleType: "meihua_fact",
    ruleVersion: "1.0.0",
    outputRole: "FACT",
    dimension: "target_state",
    summary: `${item.label}: ${item.value}`,
    evidenceKind: "symbolism",
  };
}

function aggregateEvidence(result, type) {
  const output = {
    subjectState: [],
    targetState: [],
    supportingForces: [],
    blockingForces: [],
    changeDirection: [],
    timingState: [],
  };
  if (type === "liuyao") {
    for (const [code, findings] of Object.entries(result.report?.dimensions ?? {})) {
      output[DIMENSION_MAP[code]] = findings.map(findingForAI);
    }
  } else {
    output.targetState = (result.report?.evidence ?? []).map(meihuaEvidenceForAI);
  }
  return output;
}

function timingCandidatesForAI(result) {
  return (result.timingCandidates ?? []).slice(0, 5).map((candidate, index) => ({
    id: `timing:${index + 1}`,
    window: candidate.window,
    granularity: candidate.granularity,
    rank: candidate.rank,
    evidence: candidate.evidence ?? [],
    limitation: candidate.limitation,
  }));
}

function knowledgeReferences(result) {
  const refs = new Map();
  for (const section of result.narrativeReport?.sections ?? []) {
    for (const id of section.knowledgeIds ?? []) {
      refs.set(`knowledge:${id}`, { id: `knowledge:${id}`, code: id, sourceSection: section.code });
    }
  }
  return [...refs.values()];
}

function liuyaoChartFacts(chart) {
  return {
    chartFactIds: ["chart:original_hexagram", "chart:changed_hexagram", "chart:moving_lines", "chart:world_response"],
    originalHexagram: chart.originalHexagram.name_zh,
    changedHexagram: chart.changedHexagram.name_zh,
    originalHexagramCode: chart.originalHexagram.code,
    changedHexagramCode: chart.changedHexagram.code,
    movingLines: chart.movingLines,
    worldLine: chart.worldResponse.worldLine,
    responseLine: chart.worldResponse.responseLine,
    methodCode: chart.methodCode,
    yongshen: chart.topic ? { topic: chart.topic, subtype: chart.subtype } : null,
  };
}

function meihuaChartFacts(chart) {
  return {
    chartFactIds: ["chart:original_hexagram", "chart:mutual_hexagram", "chart:changed_hexagram", "chart:moving_line", "chart:body_use"],
    originalHexagram: chart.originalHexagram.name_zh,
    mutualHexagram: chart.mutualHexagram.name_zh,
    changedHexagram: chart.changedHexagram.name_zh,
    originalHexagramCode: chart.originalHexagram.code,
    mutualHexagramCode: chart.mutualHexagram.code,
    changedHexagramCode: chart.changedHexagram.code,
    movingLine: chart.movingLine,
    bodyTrigram: chart.bodyTrigram.name_zh,
    useTrigram: chart.useTrigram.name_zh,
    bodyUseRelation: chart.bodyUseRelation?.meaning_zh ?? chart.bodyUseRelation?.code ?? null,
    methodCode: chart.methodCode,
  };
}

function calendarFacts(chart) {
  if (!chart.calendar) return null;
  return {
    calendarFactIds: ["calendar:month_build", "calendar:day_chen", "calendar:xun_kong"],
    calendarPolicy: chart.calendar.policyVersion,
    calendarProvider: chart.calendar.calendarProvider,
    calendarVersion: chart.calendar.calendarVersion,
    timezone: chart.calendar.timezone,
    yearPillar: chart.calendar.yearPillar,
    monthPillar: chart.calendar.monthPillar,
    dayPillar: chart.calendar.dayPillar,
    hourPillar: chart.calendar.hourPillar,
    monthBuild: chart.calendar.monthBuild?.branch,
    monthBuildName: chart.calendar.monthBuild?.branchName,
    dayChen: chart.calendar.dayChen?.branch,
    dayChenName: chart.calendar.dayChen?.branchName,
    xun: chart.calendar.xun?.name,
    xunKong: chart.calendar.xun?.voidBranches?.map((item) => item.branch) ?? [],
    xunKongNames: chart.calendar.xun?.voidBranchNames,
  };
}

function resolvedSemanticsForAI(result, type) {
  if (type !== "liuyao") {
    return {
      resolvedFindings: [],
      resolvedRelationships: [],
      resolvedTopicRoles: null,
    };
  }
  const chart = result.chart;
  const findings = result.report?.evidence ?? [];
  return {
    resolvedFindings: findings.map((finding) => {
      const resolved = resolveFindingExplanation(finding, chart);
      return {
        evidenceRef: finding.rule_code ? `rule:${finding.rule_code}` : finding.id,
        bindingStatus: resolved.bindingStatus,
        assetId: resolved.assetId,
        displayName: resolved.displayName,
        practicalMeaning: resolved.practicalMeaning,
        direction: resolved.direction,
        priority: resolved.defaultPriority,
        limitations: resolved.limitations ?? [],
      };
    }),
    resolvedRelationships: resolveRelationships(chart).map((item) => ({
      relationId: item.relationId,
      bindingStatus: item.bindingStatus,
      title: item.title,
      professionalMeaning: item.professionalMeaning,
      guidedMeaning: item.guidedMeaning,
      direction: item.direction,
      priority: item.defaultPriority,
      limitation: item.limitation,
      linePosition: item.linePosition,
    })),
    resolvedTopicRoles: resolveTopicRoleContext(chart),
  };
}

export function buildAIReportInput({ result, type, language = "zh-CN" }) {
  const chart = result.chart;
  const narrativeReport = result.narrativeReport ?? (type === "liuyao" ? buildLiuyaoReport(result) : buildMeihuaReport(result));
  const productResultFacts = type === "liuyao"
    ? (result.productResultFacts ?? buildLiuyaoProductResultFacts({ result }))
    : null;
  const matchedRuleFindings = type === "liuyao"
    ? (result.report?.evidence ?? []).map(findingForAI)
    : (result.report?.evidence ?? []).map(meihuaEvidenceForAI);
  const resolvedSemantics = resolvedSemanticsForAI(result, type);
  const input = {
    reportId: chart.id,
    reportType: type === "liuyao" ? "LIUYAO" : "MEIHUA",
    questionContext: {
      question: chart.question,
      questionDigest: questionDigest(chart.question),
      topicCode: chart.topic ?? null,
      subtypeCode: chart.subtype ?? null,
      language,
      privacy: "question used only for current report generation; do not retain or reuse for training/content",
    },
    chartFacts: type === "liuyao" ? liuyaoChartFacts(chart) : meihuaChartFacts(chart),
    calendarFacts: calendarFacts(chart),
    aggregatedEvidence: aggregateEvidence(result, type),
    matchedRuleFindings,
    productResultFactsVersion: productResultFacts?.productFactsVersion ?? null,
    overallAssessmentFacts: productResultFacts?.overallAssessmentFacts ?? null,
    yongshenSelectionFacts: productResultFacts?.yongshenSelectionFacts ?? null,
    conflictResolutionFacts: productResultFacts?.conflictResolutionFacts ?? null,
    timingExplanationFacts: productResultFacts?.timingExplanationFacts ?? [],
    actionGuidanceFacts: productResultFacts?.actionGuidanceFacts ?? null,
    deterministicJudgmentSignature: productResultFacts ? judgmentFactsSignature(productResultFacts) : null,
    resolvedFindings: resolvedSemantics.resolvedFindings,
    resolvedRelationships: resolvedSemantics.resolvedRelationships,
    resolvedTopicRoles: resolvedSemantics.resolvedTopicRoles,
    timingCandidates: timingCandidatesForAI(result),
    knowledgeReferences: knowledgeReferences({ ...result, narrativeReport }),
    versions: {
      engineVersion: result.engineVersions,
      calendarProvider: chart.calendar?.calendarProvider ?? chart.calendar?.provider?.name ?? null,
      calendarVersion: chart.calendar?.calendarVersion ?? chart.calendar?.policyVersion ?? null,
      ruleProfileVersion: result.engineVersions?.rules ?? "LIUYAO_CORE_V1",
      knowledgeVersion: "knowledge-v1.2",
      promptVersion: type === "liuyao" ? LIUYAO_PROMPT_VERSION : MEIHUA_PROMPT_VERSION,
      aiSchemaVersion: AI_SCHEMA_VERSION,
    },
  };
  input.inputHash = hashJson({
    reportId: input.reportId,
    reportType: input.reportType,
    chartFacts: input.chartFacts,
    calendarFacts: input.calendarFacts,
    matchedRuleFindings: input.matchedRuleFindings,
    timingCandidates: input.timingCandidates,
    overallAssessmentFacts: input.overallAssessmentFacts,
    conflictResolutionFacts: input.conflictResolutionFacts,
    timingExplanationFacts: input.timingExplanationFacts,
    actionGuidanceFacts: input.actionGuidanceFacts,
    deterministicJudgmentSignature: input.deterministicJudgmentSignature,
    resolvedFindings: input.resolvedFindings,
    resolvedRelationships: input.resolvedRelationships,
    resolvedTopicRoles: input.resolvedTopicRoles,
    versions: input.versions,
    questionDigest: input.questionContext.questionDigest,
  });
  return input;
}

function parseModelOutput(raw) {
  if (!raw) throw new AIReportValidationError("EMPTY_RESPONSE", "AI provider returned an empty response.");
  if (typeof raw === "object" && !Array.isArray(raw)) return raw;
  if (typeof raw !== "string") throw new AIReportValidationError("INVALID_RESPONSE", "AI response must be an object or JSON string.");
  const trimmed = raw.trim().replace(/^```json\s*/u, "").replace(/^```\s*/u, "").replace(/\s*```$/u, "");
  try {
    return JSON.parse(trimmed);
  } catch (err) {
    throw new AIReportValidationError("JSON_PARSE_FAILED", "AI response is not valid JSON.", { reason: err.message });
  }
}

function textBlob(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function collectOutputKeys(value, out = []) {
  if (!value || typeof value !== "object") return out;
  for (const [key, nested] of Object.entries(value)) {
    out.push(key);
    collectOutputKeys(nested, out);
  }
  return out;
}

function evidenceRefsFromOutput(output) {
  const refs = [];
  for (const item of [...output.supportingFactors, ...output.blockingFactors]) {
    refs.push(...item.evidenceRefs);
  }
  for (const item of output.evidenceSummary) {
    if (typeof item === "object" && Array.isArray(item.evidenceRefs)) refs.push(...item.evidenceRefs);
  }
  return refs;
}

function allowedEvidenceRefs(input) {
  return new Set([
    ...(input.chartFacts.chartFactIds ?? []),
    ...(input.calendarFacts?.calendarFactIds ?? []),
    ...input.matchedRuleFindings.map((item) => item.id),
    ...input.timingCandidates.map((item) => item.id),
    ...input.knowledgeReferences.map((item) => item.id),
  ]);
}

function aiOutcomeLabel(overallState) {
  if (overallState === "TRANSITIONAL") return "MIXED";
  if (OUTCOME_LABELS.has(overallState)) return overallState;
  return "UNCLEAR";
}

export function validateAIReportSchema(raw, input) {
  const output = parseModelOutput(raw);
  assertValid(output.schemaVersion === AI_SCHEMA_VERSION, "SCHEMA_VERSION_INVALID", "AI schemaVersion is invalid.");
  for (const key of collectOutputKeys(output)) {
    assertValid(!FORBIDDEN_OUTPUT_KEYS.has(key), "FORBIDDEN_FIELD", "AI output contains a forbidden field.", { key });
  }
  for (const key of ["summary", "currentSituation", "changeDirection", "disclaimer"]) {
    assertValid(typeof output[key] === "string" && output[key].trim().length > 0, "SCHEMA_FIELD_MISSING", `AI output missing ${key}.`);
  }
  assertValid(output.factClaims && typeof output.factClaims === "object", "SCHEMA_FIELD_MISSING", "AI output missing factClaims.");
  assertValid(Array.isArray(output.supportingFactors), "SCHEMA_FIELD_MISSING", "supportingFactors must be an array.");
  assertValid(Array.isArray(output.blockingFactors), "SCHEMA_FIELD_MISSING", "blockingFactors must be an array.");
  assertValid(output.outcomeTrend && OUTCOME_LABELS.has(output.outcomeTrend.label), "SCHEMA_ENUM_INVALID", "outcomeTrend.label is invalid.");
  assertValid(typeof output.outcomeTrend.text === "string", "SCHEMA_FIELD_MISSING", "outcomeTrend.text is required.");
  assertValid(Array.isArray(output.timingWindows), "SCHEMA_FIELD_MISSING", "timingWindows must be an array.");
  assertValid(Array.isArray(output.actionSuggestions), "SCHEMA_FIELD_MISSING", "actionSuggestions must be an array.");
  assertValid(Array.isArray(output.evidenceSummary), "SCHEMA_FIELD_MISSING", "evidenceSummary must be an array.");
  assertValid(Array.isArray(output.limitations), "SCHEMA_FIELD_MISSING", "limitations must be an array.");

  for (const item of [...output.supportingFactors, ...output.blockingFactors]) {
    assertValid(typeof item.text === "string" && item.text.trim().length > 0, "SCHEMA_FIELD_MISSING", "factor text is required.");
    assertValid(Array.isArray(item.evidenceRefs) && item.evidenceRefs.length > 0, "EVIDENCE_REF_MISSING", "factor evidenceRefs are required.");
  }

  const allowed = allowedEvidenceRefs(input);
  for (const ref of evidenceRefsFromOutput(output)) {
    assertValid(allowed.has(ref), "EVIDENCE_REF_INVALID", "AI output references unknown evidence.", { ref });
  }
  for (const item of output.timingWindows) {
    assertValid(typeof item.text === "string", "SCHEMA_FIELD_MISSING", "timing text is required.");
    assertValid(typeof item.candidateRef === "string", "TIMING_REF_INVALID", "timing candidateRef is required.");
    assertValid(allowed.has(item.candidateRef), "TIMING_REF_INVALID", "AI output references unknown timing candidate.", { candidateRef: item.candidateRef });
  }

  return output;
}

export function validateAIReportFidelity(output, input) {
  const claims = output.factClaims;
  if (input.reportType === "LIUYAO") {
    assertValid(claims.originalHexagram === input.chartFacts.originalHexagram, "FACT_MISMATCH", "Original hexagram changed.");
    assertValid(claims.changedHexagram === input.chartFacts.changedHexagram, "FACT_MISMATCH", "Changed hexagram changed.");
    assertValid(JSON.stringify(claims.movingLines ?? []) === JSON.stringify(input.chartFacts.movingLines), "FACT_MISMATCH", "Moving lines changed.");
    assertValid(claims.worldLine === input.chartFacts.worldLine, "FACT_MISMATCH", "World line changed.");
    assertValid(claims.responseLine === input.chartFacts.responseLine, "FACT_MISMATCH", "Response line changed.");
    assertValid(claims.monthBuild === input.calendarFacts?.monthBuild, "FACT_MISMATCH", "Month build changed.");
    assertValid(claims.dayChen === input.calendarFacts?.dayChen, "FACT_MISMATCH", "Day chen changed.");
    assertValid(JSON.stringify(claims.xunKong ?? []) === JSON.stringify(input.calendarFacts?.xunKong ?? []), "FACT_MISMATCH", "Xun-kong changed.");
    const text = textBlob(output);
    assertValid(!/体卦|用卦|外应|bodyTrigram|useTrigram/u.test(text), "TYPE_CONTAMINATION", "Liuyao report contains Meihua-only fields.");
  } else {
    assertValid(claims.originalHexagram === input.chartFacts.originalHexagram, "FACT_MISMATCH", "Original hexagram changed.");
    assertValid(claims.mutualHexagram === input.chartFacts.mutualHexagram, "FACT_MISMATCH", "Mutual hexagram changed.");
    assertValid(claims.changedHexagram === input.chartFacts.changedHexagram, "FACT_MISMATCH", "Changed hexagram changed.");
    assertValid(claims.movingLine === input.chartFacts.movingLine, "FACT_MISMATCH", "Moving line changed.");
    assertValid(claims.bodyTrigram === input.chartFacts.bodyTrigram, "FACT_MISMATCH", "Body trigram changed.");
    assertValid(claims.useTrigram === input.chartFacts.useTrigram, "FACT_MISMATCH", "Use trigram changed.");
    const text = textBlob(output);
    assertValid(!/纳甲|六亲|六神|世爻|应爻|worldLine|responseLine|sixSpirit|sixRelation/u.test(text), "TYPE_CONTAMINATION", "Meihua report contains Liuyao-only fields.");
  }

  const matchedCodes = new Set(input.matchedRuleFindings.map((item) => item.ruleCode));
  for (const ref of evidenceRefsFromOutput(output)) {
    if (ref.startsWith("rule:")) {
      const code = ref.slice("rule:".length);
      assertValid(matchedCodes.has(code), "RULE_NOT_MATCHED", "AI output references an unhit rule.", { code });
    }
    assertValid(!/ADVANCED|REVIEW_REQUIRED|REVIEW/u.test(ref), "RULE_NOT_ALLOWED", "AI output references a non-public rule.", { ref });
  }

  assertValid(output.timingWindows.length <= 5, "TIMING_LIMIT_EXCEEDED", "AI output exposes too many timing windows.");
  const candidateTexts = new Map(input.timingCandidates.map((candidate) => [candidate.id, candidate.window]));
  for (const item of output.timingWindows) {
    assertValid(candidateTexts.has(item.candidateRef), "TIMING_REF_INVALID", "AI timing candidate is not from input.", item);
    assertValid(!/保证|必定|一定|兑现/u.test(item.text), "TIMING_CERTAINTY_INVALID", "AI timing text uses guaranteed language.");
  }
  return true;
}

export function validateAIReportSafety(output) {
  const text = textBlob(output);
  for (const pattern of FORBIDDEN_TEXT_PATTERNS) {
    assertValid(!pattern.test(text), "SAFETY_INVALID", "AI output contains unsafe or over-certain language.", { pattern: String(pattern) });
  }
  return true;
}

export function validateAIReport(raw, input) {
  const output = validateAIReportSchema(raw, input);
  validateAIReportFidelity(output, input);
  validateAIReportSafety(output);
  return output;
}

export class DeterministicReportProvider {
  constructor({ mode = "fallback" } = {}) {
    this.provider = "deterministic";
    this.model = mode;
  }

  async generateReport(input) {
    const timing = input.timingCandidates[0];
    const factClaims = input.reportType === "LIUYAO"
      ? {
          originalHexagram: input.chartFacts.originalHexagram,
          changedHexagram: input.chartFacts.changedHexagram,
          movingLines: input.chartFacts.movingLines,
          worldLine: input.chartFacts.worldLine,
          responseLine: input.chartFacts.responseLine,
          monthBuild: input.calendarFacts?.monthBuild,
          dayChen: input.calendarFacts?.dayChen,
          xunKong: input.calendarFacts?.xunKong ?? [],
        }
      : {
          originalHexagram: input.chartFacts.originalHexagram,
          mutualHexagram: input.chartFacts.mutualHexagram,
          changedHexagram: input.chartFacts.changedHexagram,
          movingLine: input.chartFacts.movingLine,
          bodyTrigram: input.chartFacts.bodyTrigram,
          useTrigram: input.chartFacts.useTrigram,
          bodyUseRelation: input.chartFacts.bodyUseRelation,
        };
    const support = input.aggregatedEvidence.supportingForces[0] ?? input.matchedRuleFindings[0];
    const blocking = input.aggregatedEvidence.blockingForces[0] ?? input.matchedRuleFindings[1] ?? support;
    const overall = input.overallAssessmentFacts;
    const actions = input.actionGuidanceFacts?.items ?? ["先处理可验证的阻碍条件。", "把报告作为辅助参考，不替代现实决策。"];
    return {
      schemaVersion: AI_SCHEMA_VERSION,
      factClaims,
      summary: overall?.summary ?? `${input.chartFacts.originalHexagram}之${input.chartFacts.changedHexagram}，以已命中的证据谨慎判断。`,
      currentSituation: overall?.baseStateText ?? "当前解读只基于排盘事实、CAL_STD_V1 历法事实和已命中的公开证据。",
      supportingFactors: support ? [{ text: support.summary, evidenceRefs: [support.id] }] : [],
      blockingFactors: blocking ? [{ text: blocking.summary, evidenceRefs: [blocking.id] }] : [],
      changeDirection: overall?.dynamicDirectionText ?? "变化方向以动爻、体用或已列证据为准，不作保证性判断。",
      outcomeTrend: { label: aiOutcomeLabel(overall?.overallState), text: overall?.headline ?? "支持与阻碍需要并看，结果仍取决于现实行动和后续条件。" },
      timingWindows: timing ? [{ text: `${timing.window} 仅作为候选窗口。`, candidateRef: timing.id }] : [],
      actionSuggestions: actions,
      evidenceSummary: support ? [{ text: "核心证据来自已命中规则。", evidenceRefs: [support.id] }] : [],
      limitations: ["这是传统文化解释，不承诺结果。"],
      disclaimer: "本报告仅供参考，不构成医疗、法律或投资建议。",
    };
  }
}

export class OpenAIReportProvider {
  constructor({ apiKey = process.env.OPENAI_API_KEY, model = process.env.AI_MODEL ?? "gpt-4.1-mini", timeoutMs = Number(process.env.AI_TIMEOUT_MS ?? 15000), maxOutputTokens = Number(process.env.AI_MAX_OUTPUT_TOKENS ?? 1400), rootDir = process.cwd() } = {}) {
    this.provider = "openai";
    this.model = model;
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
    this.maxOutputTokens = maxOutputTokens;
    this.rootDir = rootDir;
  }

  promptFor(input) {
    const file = input.reportType === "LIUYAO" ? "prompts/liuyao-report-v1.md" : "prompts/meihua-report-v1.md";
    return readFileSync(resolve(this.rootDir, file), "utf8");
  }

  async generateReport(input) {
    if (!this.apiKey) throw new AIReportValidationError("PROVIDER_UNAVAILABLE", "OPENAI_API_KEY is not configured.");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          instructions: this.promptFor(input),
          input: JSON.stringify(input),
          max_output_tokens: this.maxOutputTokens,
          temperature: 0.2,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new AIReportValidationError("PROVIDER_FAILED", "OpenAI provider failed.", { status: response.status, code: body?.error?.code });
      return {
        __providerPayload: true,
        content: body.output_text ?? body.output?.flatMap((item) => item.content ?? []).map((part) => part.text).filter(Boolean).join("\n"),
        tokenUsage: body.usage ? {
          inputTokens: body.usage.input_tokens,
          outputTokens: body.usage.output_tokens,
          totalTokens: body.usage.total_tokens,
        } : null,
      };
    } catch (err) {
      if (err.name === "AbortError") throw new AIReportValidationError("PROVIDER_TIMEOUT", "AI provider timed out.");
      if (err instanceof AIReportValidationError) throw err;
      throw new AIReportValidationError("PROVIDER_FAILED", "AI provider request failed.", { reason: err.message });
    } finally {
      clearTimeout(timer);
    }
  }
}

export class MockAIReportProvider extends DeterministicReportProvider {
  constructor({ mode = "success", delayMs = 0 } = {}) {
    super({ mode });
    this.provider = "mock";
    this.model = mode;
    this.mode = mode;
    this.delayMs = delayMs;
  }

  async generateReport(input) {
    if (this.delayMs) await new Promise((resolveDelay) => setTimeout(resolveDelay, this.delayMs));
    if (this.mode === "throw") throw new Error("mock provider failure");
    if (this.mode === "empty") return "";
    if (this.mode === "invalid_json") return "{not json";
    const output = await super.generateReport(input);
    if (this.mode === "bad_fact") output.factClaims.originalHexagram = "乾";
    if (this.mode === "bad_ref") output.supportingFactors[0].evidenceRefs = ["rule:NOT_MATCHED"];
    if (this.mode === "unsafe") output.summary = "保证成功";
    return output;
  }
}

export function providerFromEnv({ rootDir = process.cwd(), mockMode }: { rootDir?: string; mockMode?: string } = {}): any {
  if (mockMode) return new MockAIReportProvider({ mode: mockMode, delayMs: mockMode === "slow_success" ? 500 : 0 });
  const provider = process.env.AI_PROVIDER ?? (process.env.OPENAI_API_KEY ? "openai" : "deterministic");
  if (provider === "openai") return new OpenAIReportProvider({ rootDir });
  if (provider === "mock_success") return new MockAIReportProvider({ mode: "success" });
  if (provider === "mock_failure") return new MockAIReportProvider({ mode: "throw" });
  return new DeterministicReportProvider();
}

function fallbackBundle({ result, type, input, reason, provider, model }) {
  return {
    aiReport: null,
    aiSchemaVersion: AI_SCHEMA_VERSION,
    aiProvider: provider ?? "deterministic",
    aiModel: model ?? "fallback",
    promptVersion: input.versions.promptVersion,
    generatedAt: new Date().toISOString(),
    latencyMs: 0,
    tokenUsage: { inputTokenEstimate: estimateTokens(input), outputTokens: 0 },
    reportSource: "DETERMINISTIC_FALLBACK",
    validationStatus: "FALLBACK",
    productStatus: "PARTIAL_AI_UNAVAILABLE",
    fallbackUsed: true,
    failureCode: reason?.code ?? "UNKNOWN_AI_FAILURE",
    deterministicReport: result.narrativeReport ?? (type === "liuyao" ? buildLiuyaoReport(result) : buildMeihuaReport(result)),
    deterministicJudgmentSignature: input.deterministicJudgmentSignature,
  };
}

const inFlight = new Map();

export async function generateGroundedAIReport({ result, type, provider = providerFromEnv(), language = "zh-CN" }) {
  if (result.aiReportBundle?.validationStatus === "VALID") return { ...result.aiReportBundle, reportSource: "CACHE_REUSE", reused: true };
  const input = buildAIReportInput({ result, type, language });
  const cacheKey = `${input.reportId}:${input.inputHash}:${provider.provider}:${provider.model}`;
  if (inFlight.has(cacheKey)) return inFlight.get(cacheKey);
  const run = (async () => {
    const startedAt = Date.now();
    try {
      const raw = await provider.generateReport(input);
      const providerPayload = raw?.__providerPayload ? raw : null;
      const output = validateAIReport(providerPayload ? providerPayload.content : raw, input);
      const latencyMs = Date.now() - startedAt;
      return {
        aiReport: output,
        aiSchemaVersion: AI_SCHEMA_VERSION,
        aiProvider: provider.provider,
        aiModel: provider.model,
        promptVersion: input.versions.promptVersion,
        generatedAt: new Date().toISOString(),
        latencyMs,
        tokenUsage: providerPayload?.tokenUsage ?? {
          inputTokenEstimate: estimateTokens(input),
          outputTokenEstimate: estimateTokens(output),
        },
        reportSource: provider.provider === "openai" ? "OPENAI_LIVE" : "OPENAI_LIVE",
        validationStatus: "VALID",
        fallbackUsed: false,
        inputHash: input.inputHash,
        requestId: randomUUID(),
      };
    } catch (err) {
      const bundle = fallbackBundle({ result, type, input, reason: err, provider: provider.provider, model: provider.model });
      bundle.latencyMs = Date.now() - startedAt;
      return bundle;
    } finally {
      inFlight.delete(cacheKey);
    }
  })();
  inFlight.set(cacheKey, run);
  return run;
}

export function createAnonymousAILimiter({ maxPerIp = 100, maxPerDevice = 20, windowMs = 60 * 60 * 1000, now = () => Date.now() } = {}) {
  const ipHits = new Map();
  const deviceHits = new Map();
  function bucketFor(map, key) {
    const current = now();
    return (map.get(key) ?? []).filter((time) => current - time < windowMs);
  }
  function allowed(map, key, limit) {
    return bucketFor(map, key).length < limit;
  }
  function commit(map, key) {
    const current = now();
    const bucket = bucketFor(map, key);
    bucket.push(current);
    map.set(key, bucket);
  }
  return {
    assertAllowed({ ip = "unknown", deviceId = "unknown" } = {}) {
      assertValid(allowed(ipHits, ip, maxPerIp), "AI_RATE_LIMITED", "IP AI rate limit exceeded.");
      assertValid(allowed(deviceHits, deviceId, maxPerDevice), "AI_RATE_LIMITED", "Device AI rate limit exceeded.");
      commit(ipHits, ip);
      commit(deviceHits, deviceId);
    },
  };
}
