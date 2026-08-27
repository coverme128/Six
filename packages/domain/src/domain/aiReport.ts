// @ts-nocheck
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildLiuyaoReport, buildMeihuaReport } from "./reportBuilder.js";
import { resolveFindingExplanation, resolveRelationships, resolveTopicRoleContext } from "./presentation/interpretationAssets.js";
import { buildLiuyaoProductResultFacts, judgmentFactsSignature } from "./presentation/productResultFacts.js";

export const AI_SCHEMA_VERSION = "AI_REPORT_V1";
export const LIUYAO_PROMPT_VERSION = "liuyao-report-v8";
export const MEIHUA_PROMPT_VERSION = "meihua-report-v1";

const OUTCOME_LABELS = new Set(["FAVORABLE", "MIXED", "CAUTIOUS", "UNCLEAR"]);
const PUBLIC_AI_DISCLAIMER = "本报告用于传统文化研究与个人决策复盘，不承诺现实结果，也不替代医疗、法律、财务或其他专业意见。";
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

export function redactQuestionForAI(question = "") {
  return String(question)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, "[已隐藏邮箱]")
    .replace(/(?<!\d)(?:\+?86[- ]?)?1[3-9]\d{9}(?!\d)/gu, "[已隐藏手机号]")
    .replace(/(?<!\d)\d{17}[\dX](?!\d)/giu, "[已隐藏证件号]")
    .trim();
}

function plainGroundingValue(value, fieldName = null) {
  if (typeof value === "string") {
    const grounded = value
      .replace(/同支日\s*\/\s*月|同支日或月份|同支日月/gu, "后续条件更匹配的观察时段")
      .replace(/回头生/gu, "变化后得到支持")
      .replace(/处于空亡(?:状态|阶段|时段)?/gu, "呈现出回应信号尚未稳定的状态")
      .replace(/空亡状态/gu, "回应信号尚未稳定")
      .replace(/空亡/gu, "信号尚未稳定")
      .replace(/月建/gu, "当前阶段的外部环境")
      .replace(/日辰/gu, "近期条件")
      .replace(/[子丑寅卯辰巳午未申酉戌亥]与[子丑寅卯辰巳午未申酉戌亥]同气/gu, "当前条件相互呼应")
      .replace(/[子丑寅卯辰巳午未申酉戌亥]生扶[子丑寅卯辰巳午未申酉戌亥]/gu, "当前条件提供支持")
      .replace(/[子丑寅卯辰巳午未申酉戌亥]生[子丑寅卯辰巳午未申酉戌亥]，自身有泄气/gu, "一方提供支持，但自身投入也会增加")
      .replace(/[子丑寅卯辰巳午未申酉戌亥]克[子丑寅卯辰巳午未申酉戌亥]，需要主动耗力/gu, "存在制约，需要额外投入")
      .replace(/[子丑寅卯辰巳午未申酉戌亥]泄于[子丑寅卯辰巳午未申酉戌亥]/gu, "变化后力量有所分散");
    if (fieldName === "professionalRole" || fieldName === "professionalBasis") {
      return grounded.replace(/\s*[（(]?[A-Z][A-Z0-9_]{3,}[）)]?/gu, "").trim();
    }
    return grounded
      .replace(/世应/gu, "双方")
      .replace(/世爻/gu, "你的状态与投入")
      .replace(/应爻/gu, "对方或项目方的回应")
      .replace(/官鬼/gu, "岗位与项目责任")
      .replace(/父母爻/gu, "合同与正式流程")
      .replace(/妻财/gu, "收益与现实资源")
      .replace(/兄弟爻/gu, "同级关系与资源消耗");
  }
  if (Array.isArray(value)) return value.map((item) => plainGroundingValue(item, fieldName));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, plainGroundingValue(nested, key)]));
  }
  return value;
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
    chartFactIds: ["chart:original_hexagram", "chart:changed_hexagram", "chart:moving_lines", "chart:world_response", "chart:line_facts"],
    originalHexagram: chart.originalHexagram.name_zh,
    changedHexagram: chart.changedHexagram.name_zh,
    originalHexagramCode: chart.originalHexagram.code,
    changedHexagramCode: chart.changedHexagram.code,
    movingLines: chart.movingLines,
    worldLine: chart.worldResponse.worldLine,
    responseLine: chart.worldResponse.responseLine,
    methodCode: chart.methodCode,
    yongshen: chart.topic ? { topic: chart.topic, subtype: chart.subtype } : null,
    lineFacts: (chart.lines ?? []).map((line) => ({
      position: line.position,
      yinYang: line.originalBit === "1" ? "阳" : "阴",
      moving: Boolean(line.moving),
      sixRelationName: line.sixRelationName,
      branchName: line.branchName,
      elementName: line.elementName,
      isWorld: Boolean(line.isWorld),
      isResponse: Boolean(line.isResponse),
      signalStable: !line.isVoid,
      monthInfluence: line.monthInfluence?.text ?? null,
      dayInfluence: line.dayInfluence?.text ?? null,
      changed: line.moving ? {
        sixRelationName: line.changed?.sixRelationName ?? null,
        branchName: line.changed?.branchName ?? null,
        elementName: line.changed?.elementName ?? null,
        influence: line.changed?.returnInfluence?.text ?? null,
      } : null,
    })),
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
      question: redactQuestionForAI(chart.question),
      questionDigest: questionDigest(chart.question),
      topicCode: chart.topic ?? null,
      subtypeCode: chart.subtype ?? null,
      language,
      privacy: {
        purpose: "generate the current report explanation",
        directIdentifiersRedacted: true,
        instruction: "do not infer, reproduce, or request personal identifiers",
      },
    },
    chartFacts: type === "liuyao" ? liuyaoChartFacts(chart) : meihuaChartFacts(chart),
    calendarFacts: calendarFacts(chart),
    aggregatedEvidence: aggregateEvidence(result, type),
    matchedRuleFindings,
    productResultFactsVersion: productResultFacts?.productFactsVersion ?? null,
    questionProfile: productResultFacts?.questionProfile ?? null,
    topicLens: productResultFacts?.topicLens ?? null,
    evidenceGraph: productResultFacts?.evidenceGraph ?? null,
    overallAssessmentFacts: productResultFacts?.overallAssessmentFacts ?? null,
    yongshenSelectionFacts: productResultFacts?.yongshenSelectionFacts ?? null,
    conflictResolutionFacts: productResultFacts?.conflictResolutionFacts ?? null,
    decisionSupportFacts: productResultFacts?.decisionSupportFacts ?? null,
    decisionFacts: productResultFacts?.decisionFacts ?? null,
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
    questionProfile: input.questionProfile,
    topicLens: input.topicLens,
    overallAssessmentFacts: input.overallAssessmentFacts,
    conflictResolutionFacts: input.conflictResolutionFacts,
    decisionSupportFacts: input.decisionSupportFacts,
    decisionFacts: input.decisionFacts,
    evidenceGraph: input.evidenceGraph,
    timingExplanationFacts: input.timingExplanationFacts,
    actionGuidanceFacts: input.actionGuidanceFacts,
    deterministicJudgmentSignature: input.deterministicJudgmentSignature,
    resolvedFindings: input.resolvedFindings,
    resolvedRelationships: input.resolvedRelationships,
    resolvedTopicRoles: input.resolvedTopicRoles,
    versions: input.versions,
    questionDigest: input.questionContext.questionDigest,
    lineFacts: input.chartFacts.lineFacts,
  });
  return input;
}

function liuyaoProviderFindings(input) {
  return input.matchedRuleFindings
    .filter((item) => item.ruleType !== "yongshen")
    .map(({ id: _id, findingId: _findingId, ruleCode: _ruleCode, ...item }, index) => ({
      ...item,
      id: `evidence:${index + 1}`,
    }));
}

function liuyaoProviderEvidenceRefs(input) {
  return new Set([
    ...(input.chartFacts.chartFactIds ?? []),
    ...(input.calendarFacts?.calendarFactIds ?? []),
    ...liuyaoProviderFindings(input).map((item) => item.id),
    ...input.timingCandidates.map((item) => item.id),
    ...input.knowledgeReferences.map((item) => item.id),
  ]);
}

export function buildAIProviderPayload(input) {
  const { reportId: _reportId, inputHash: _inputHash, ...payload } = input;
  if (input.reportType === "LIUYAO") {
    return {
      reportType: input.reportType,
      interpretationContract: {
        mode: "QUESTION_FIRST",
        instruction: "直接理解用户原始问题，再把完整六爻事实转译为针对该问题的解释。不得沿用与问题无关的预设场景文案。",
        immutableFacts: "排盘、历法、六亲、世应、动变和规则命中事实不可改写或重新计算。",
        semanticResponsibility: "现实对象、问题意图、六亲在本题中的含义和行动建议由模型根据原始问题组织。",
      },
      questionContext: {
        question: input.questionContext.question,
        language: input.questionContext.language,
        privacy: input.questionContext.privacy,
      },
      chartFacts: {
        ...input.chartFacts,
        yongshen: null,
      },
      calendarFacts: input.calendarFacts,
      matchedRuleFindings: liuyaoProviderFindings(input),
      resolvedRelationships: input.resolvedRelationships.map(({ relationId: _relationId, bindingStatus: _bindingStatus, ...item }) => item),
      timingCandidates: input.timingCandidates,
      knowledgeReferences: input.knowledgeReferences,
      safetyBoundaries: {
        prohibitedClaims: input.decisionFacts?.prohibitedClaims ?? [],
        realityNotVerified: true,
        noGuaranteedOutcome: true,
      },
      versions: input.versions,
      allowedEvidenceRefs: [...liuyaoProviderEvidenceRefs(input)],
    };
  }
  return plainGroundingValue({
    ...payload,
    questionContext: {
      question: input.questionContext.question,
      topicCode: input.questionContext.topicCode,
      subtypeCode: input.questionContext.subtypeCode,
      language: input.questionContext.language,
      privacy: input.questionContext.privacy,
    },
    allowedEvidenceRefs: [...allowedEvidenceRefs(input)],
  });
}

function liuyaoResponseFormat(input) {
  const evidenceRef = { type: "string", enum: [...liuyaoProviderEvidenceRefs(input)] };
  const timingRef = { type: "string", enum: input.timingCandidates.map((item) => item.id) };
  const factor = {
    type: "object",
    additionalProperties: false,
    required: ["text", "evidenceRefs"],
    properties: {
      text: { type: "string" },
      evidenceRefs: { type: "array", minItems: 1, items: evidenceRef },
    },
  };
  const keyJudgment = {
    type: "object",
    additionalProperties: false,
    required: ["title", "professionalBasis", "plainInterpretation", "decisionImpact", "evidenceRefs"],
    properties: {
      title: { type: "string" },
      professionalBasis: { type: "string" },
      plainInterpretation: { type: "string" },
      decisionImpact: { type: "string" },
      evidenceRefs: { type: "array", minItems: 1, items: evidenceRef },
    },
  };
  const balanceItem = {
    type: "object",
    additionalProperties: false,
    required: ["gain", "cost"],
    properties: {
      gain: { type: "string" },
      cost: { type: "string" },
    },
  };
  const actionItem = {
    type: "object",
    additionalProperties: false,
    required: ["text", "evidenceRefs"],
    properties: {
      text: { type: "string" },
      evidenceRefs: { type: "array", minItems: 1, items: evidenceRef },
    },
  };
  return {
    type: "json_schema",
    name: "liuyao_report",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["schemaVersion", "factClaims", "questionResponse", "hexagramReading", "keyJudgments", "decisionBalance", "actionPlan", "timingWindows", "finalTakeaway", "limitations", "disclaimer"],
      properties: {
        schemaVersion: { type: "string", enum: [AI_SCHEMA_VERSION] },
        factClaims: {
          type: "object",
          additionalProperties: false,
          required: ["originalHexagram", "changedHexagram", "movingLines", "worldLine", "responseLine", "monthBuild", "dayChen", "xunKong"],
          properties: {
            originalHexagram: { type: "string", const: input.chartFacts.originalHexagram },
            changedHexagram: { type: "string", const: input.chartFacts.changedHexagram },
            movingLines: { type: "array", const: input.chartFacts.movingLines, items: { type: "number" } },
            worldLine: { type: "number", const: input.chartFacts.worldLine },
            responseLine: { type: "number", const: input.chartFacts.responseLine },
            monthBuild: { type: "string", const: input.calendarFacts?.monthBuild },
            dayChen: { type: "string", const: input.calendarFacts?.dayChen },
            xunKong: { type: "array", const: input.calendarFacts?.xunKong ?? [], items: { type: "string" } },
          },
        },
        questionResponse: {
          type: "object",
          additionalProperties: false,
          required: ["focus", "directAnswer", "scopeNote", "evidenceRefs"],
          properties: {
            focus: { type: "string" },
            directAnswer: { type: "string" },
            scopeNote: { type: "string" },
            evidenceRefs: { type: "array", minItems: 1, items: evidenceRef },
          },
        },
        hexagramReading: {
          type: "object",
          additionalProperties: false,
          required: ["original", "moving", "changed", "synthesis"],
          properties: {
            original: { type: "string" },
            moving: { type: "string" },
            changed: { type: "string" },
            synthesis: { type: "string" },
          },
        },
        keyJudgments: { type: "array", minItems: 3, maxItems: 5, items: keyJudgment },
        decisionBalance: { type: "array", maxItems: 4, items: balanceItem },
        actionPlan: {
          type: "object",
          additionalProperties: false,
          required: ["now", "beforeDecision", "avoid"],
          properties: {
            now: { type: "array", minItems: 1, maxItems: 3, items: actionItem },
            beforeDecision: { type: "array", minItems: 1, maxItems: 3, items: actionItem },
            avoid: { type: "array", minItems: 1, maxItems: 3, items: actionItem },
          },
        },
        timingWindows: {
          type: "array",
          maxItems: 2,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["text", "candidateRef"],
            properties: {
              text: { type: "string", description: "Conditional candidate observation window only. Must say 候选观察窗口、仍需结合现实变化复核、不代表结果已经确定. Never use 一定、必定、保证、exact dates, or invented durations." },
              candidateRef: timingRef,
            },
          },
        },
        finalTakeaway: { type: "string" },
        limitations: { type: "array", items: { type: "string" } },
        disclaimer: { type: "string" },
      },
    },
  };
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

function canonicalizeLiveControlledFields(raw, input) {
  const output = parseModelOutput(raw);
  if (output.questionResponse && input.decisionSupportFacts?.scopeNote && !output.questionResponse.scopeNote?.trim()) {
    output.questionResponse.scopeNote = input.decisionSupportFacts.scopeNote;
  }
  output.timingWindows = input.timingCandidates.slice(0, 2).map((candidate) => ({
    text: "后续阶段仅作为候选观察窗口，仍需结合现实变化复核，不代表结果已经确定。",
    candidateRef: candidate.id,
  })).slice(0, 1);
  if (input.reportType === "LIUYAO" && (input.chartFacts.movingLines ?? []).length === 0 && output.hexagramReading) {
    output.hexagramReading.changed = input.decisionSupportFacts?.hexagramChain?.changed
      ?? "这是静卦，没有变卦；后续只观察现实条件是否发生实质变化。";
  }
  return output;
}

function textBlob(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

const MEIHUA_ONLY_OUTPUT_MARKERS = [
  { marker: "体卦", pattern: /体卦/u },
  { marker: "梅花易数", pattern: /梅花易数/u },
  { marker: "梅花外应", pattern: /梅花外应/u },
  { marker: "体用关系", pattern: /体用关系/u },
  { marker: "梅花体用", pattern: /梅花.{0,4}体用/u },
  { marker: "bodyTrigram", pattern: /bodyTrigram/u },
  { marker: "useTrigram", pattern: /useTrigram/u },
];

function findMeihuaOnlyOutputMarkers(value, path = "$", matches = []) {
  if (typeof value === "string") {
    for (const item of MEIHUA_ONLY_OUTPUT_MARKERS) {
      if (item.pattern.test(value)) matches.push({ marker: item.marker, path });
    }
    return matches;
  }
  if (!value || typeof value !== "object") return matches;
  for (const [key, nested] of Object.entries(value)) {
    const nestedPath = `${path}.${key}`;
    if (key === "用卦") matches.push({ marker: "用卦字段", path: nestedPath });
    for (const item of MEIHUA_ONLY_OUTPUT_MARKERS) {
      if (item.pattern.test(key)) matches.push({ marker: item.marker, path: nestedPath });
    }
    findMeihuaOnlyOutputMarkers(nested, nestedPath, matches);
  }
  return matches;
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
  refs.push(...(output.questionResponse?.evidenceRefs ?? []));
  for (const item of [...(output.supportingFactors ?? []), ...(output.blockingFactors ?? [])]) {
    refs.push(...item.evidenceRefs);
  }
  for (const item of output.keyElements ?? []) {
    if (typeof item === "object" && Array.isArray(item.evidenceRefs)) refs.push(...item.evidenceRefs);
  }
  for (const item of output.evidenceSummary ?? []) {
    assertValid(item && typeof item.text === "string" && item.text.trim().length > 0, "SCHEMA_FIELD_MISSING", "evidence summary text is required.");
    assertValid(Array.isArray(item.evidenceRefs), "SCHEMA_FIELD_MISSING", "evidence summary refs must be an array.");
  }
  for (const item of output.keyJudgments ?? []) {
    if (Array.isArray(item.evidenceRefs)) refs.push(...item.evidenceRefs);
  }
  for (const group of Object.values(output.actionPlan ?? {})) {
    for (const item of group ?? []) {
      if (Array.isArray(item.evidenceRefs)) refs.push(...item.evidenceRefs);
    }
  }
  for (const item of output.evidenceSummary ?? []) {
    if (typeof item === "object" && Array.isArray(item.evidenceRefs)) refs.push(...item.evidenceRefs);
  }
  for (const item of output.actionSuggestions ?? []) {
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
    ...(input.evidenceGraph?.nodes ?? []).map((item) => item.id),
    ...(input.reportType === "LIUYAO" ? liuyaoProviderEvidenceRefs(input) : []),
  ]);
}

function aiOutcomeLabel(overallState) {
  if (overallState === "TRANSITIONAL") return "MIXED";
  if (OUTCOME_LABELS.has(overallState)) return overallState;
  return "UNCLEAR";
}

function exceedsCommitmentBoundary(text = "") {
  const withoutNegatedCommitment = String(text).replace(
    /(?:暂不|不建议|不适合|不宜|不要|不能).{0,18}(?:直接加入|立即全职|马上重投入|重投入|投入全部(?:资源|资金)?)/gu,
    "",
  );
  return /(?:建议|适合|可以).{0,12}(?:直接加入|立即全职|马上重投入|重投入|投入全部(?:资源|资金)?)/u.test(withoutNegatedCommitment);
}

export function validateAIReportSchema(raw, input) {
  const output = parseModelOutput(raw);
  assertValid(output.schemaVersion === AI_SCHEMA_VERSION, "SCHEMA_VERSION_INVALID", "AI schemaVersion is invalid.");
  for (const key of collectOutputKeys(output)) {
    assertValid(!FORBIDDEN_OUTPUT_KEYS.has(key), "FORBIDDEN_FIELD", "AI output contains a forbidden field.", { key });
  }
  assertValid(typeof output.disclaimer === "string" && output.disclaimer.trim().length > 0, "SCHEMA_FIELD_MISSING", "AI output missing disclaimer.");
  assertValid(output.factClaims && typeof output.factClaims === "object", "SCHEMA_FIELD_MISSING", "AI output missing factClaims.");
  if (input.reportType === "LIUYAO") {
    assertValid(output.questionResponse && typeof output.questionResponse === "object", "SCHEMA_FIELD_MISSING", "AI output missing questionResponse.");
    assertValid(output.hexagramReading && typeof output.hexagramReading === "object", "SCHEMA_FIELD_MISSING", "AI output missing hexagramReading.");
    for (const key of ["focus", "directAnswer", "scopeNote"]) {
      assertValid(typeof output.questionResponse[key] === "string" && output.questionResponse[key].trim().length > 0, "SCHEMA_FIELD_MISSING", `questionResponse.${key} is required.`);
    }
    assertValid(Array.isArray(output.questionResponse.evidenceRefs) && output.questionResponse.evidenceRefs.length > 0, "EVIDENCE_REF_MISSING", "questionResponse evidenceRefs are required.");
    for (const key of ["original", "moving", "changed", "synthesis"]) {
      assertValid(typeof output.hexagramReading[key] === "string" && output.hexagramReading[key].trim().length > 0, "SCHEMA_FIELD_MISSING", `hexagramReading.${key} is required.`);
    }
    assertValid(Array.isArray(output.keyJudgments) && output.keyJudgments.length >= 3, "SCHEMA_FIELD_MISSING", "keyJudgments must include at least three items.");
    for (const item of output.keyJudgments) {
      for (const key of ["title", "professionalBasis", "plainInterpretation", "decisionImpact"]) {
        assertValid(typeof item[key] === "string" && item[key].trim().length > 0, "SCHEMA_FIELD_MISSING", `keyJudgments.${key} is required.`);
      }
      assertValid(Array.isArray(item.evidenceRefs) && item.evidenceRefs.length > 0, "EVIDENCE_REF_MISSING", "key judgment evidenceRefs are required.");
    }
    assertValid(Array.isArray(output.decisionBalance), "SCHEMA_FIELD_MISSING", "decisionBalance must be an array.");
    for (const item of output.decisionBalance) {
      for (const key of ["gain", "cost"]) {
        assertValid(typeof item[key] === "string" && item[key].trim().length > 0, "SCHEMA_FIELD_MISSING", `decisionBalance.${key} is required.`);
      }
    }
    assertValid(output.actionPlan && typeof output.actionPlan === "object", "SCHEMA_FIELD_MISSING", "actionPlan is required.");
    for (const key of ["now", "beforeDecision", "avoid"]) {
      assertValid(Array.isArray(output.actionPlan[key]) && output.actionPlan[key].length > 0, "SCHEMA_FIELD_MISSING", `actionPlan.${key} is required.`);
      for (const item of output.actionPlan[key]) {
        assertValid(typeof item.text === "string" && item.text.trim().length > 0, "SCHEMA_FIELD_MISSING", `actionPlan.${key} text is required.`);
        assertValid(Array.isArray(item.evidenceRefs) && item.evidenceRefs.length > 0, "EVIDENCE_REF_MISSING", `actionPlan.${key} evidenceRefs are required.`);
      }
    }
    assertValid(typeof output.finalTakeaway === "string" && output.finalTakeaway.trim().length > 0, "SCHEMA_FIELD_MISSING", "finalTakeaway is required.");
  } else {
    for (const key of ["summary", "currentSituation", "changeDirection"]) {
      assertValid(typeof output[key] === "string" && output[key].trim().length > 0, "SCHEMA_FIELD_MISSING", `AI output missing ${key}.`);
    }
    assertValid(Array.isArray(output.supportingFactors), "SCHEMA_FIELD_MISSING", "supportingFactors must be an array.");
    assertValid(Array.isArray(output.blockingFactors), "SCHEMA_FIELD_MISSING", "blockingFactors must be an array.");
    assertValid(output.outcomeTrend && OUTCOME_LABELS.has(output.outcomeTrend.label), "SCHEMA_ENUM_INVALID", "outcomeTrend.label is invalid.");
    assertValid(typeof output.outcomeTrend.text === "string", "SCHEMA_FIELD_MISSING", "outcomeTrend.text is required.");
    assertValid(Array.isArray(output.actionSuggestions), "SCHEMA_FIELD_MISSING", "actionSuggestions must be an array.");
    assertValid(Array.isArray(output.evidenceSummary) && output.evidenceSummary.length > 0, "EVIDENCE_REF_MISSING", "evidenceSummary must include at least one reason.");
  }
  assertValid(Array.isArray(output.timingWindows), "SCHEMA_FIELD_MISSING", "timingWindows must be an array.");
  for (const item of output.actionSuggestions ?? []) {
    if (input.reportType === "LIUYAO") {
      assertValid(item && typeof item.text === "string" && item.text.trim().length > 0, "SCHEMA_FIELD_MISSING", "action suggestion text is required.");
      assertValid(Array.isArray(item.evidenceRefs) && item.evidenceRefs.length > 0, "EVIDENCE_REF_MISSING", "action suggestion evidenceRefs are required.");
    } else {
      assertValid(typeof item === "string" && item.trim().length > 0, "SCHEMA_FIELD_MISSING", "action suggestion is required.");
    }
  }
  assertValid(Array.isArray(output.limitations), "SCHEMA_FIELD_MISSING", "limitations must be an array.");

  for (const item of [...(output.supportingFactors ?? []), ...(output.blockingFactors ?? [])]) {
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
    const meihuaOnlyMarkers = findMeihuaOnlyOutputMarkers(output).slice(0, 8);
    assertValid(meihuaOnlyMarkers.length === 0, "TYPE_CONTAMINATION", "Liuyao report contains Meihua-only fields.", { matches: meihuaOnlyMarkers });
    const text = textBlob(output);
    if ((input.chartFacts.movingLines ?? []).length === 0) {
      assertValid(
        !/第\s*-\s*爻发动|动爻提示事情|正在进入变化过程|整体处于变化前夜|已有变化动力|本卦与变卦同为/u.test(text),
        "STATIC_CHART_CONTRADICTION",
        "Static Liuyao report contains moving-line claims.",
      );
    }
    const directAnswer = output.questionResponse?.directAnswer ?? "";
    if (input.questionProfile?.clarificationRequired) {
      assertValid(/身份|入职|合伙|项目合作|投资|顾问|明确/u.test(directAnswer), "QUESTION_CLARIFICATION_MISSING", "Ambiguous question must surface clarification or branches.");
    }
    if (["CONDITIONAL_PROCEED", "CLARIFY_THEN_PROCEED"].includes(input.decisionFacts?.stance)) {
      assertValid(!exceedsCommitmentBoundary(directAnswer), "DECISION_DIRECTION_INVALID", "AI answer exceeds the allowed decision boundary.");
      assertValid(/先|暂不|条件|明确|核实|验证|有限|小范围/u.test(directAnswer), "DECISION_CONDITION_MISSING", "Conditional decision answer must state a condition or verification step.");
    }
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
    assertValid(!/(?<!不)保证|(?<!不)必定|(?<!不)一定/u.test(item.text), "TIMING_CERTAINTY_INVALID", "AI timing text uses guaranteed language.");
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

export function validateAIPlainLanguage(output) {
  const visibleTextItems = (items = []) => items.map((item) => typeof item === "string" ? item : item?.text ?? "");
  const ordinaryLanguageText = textBlob({
    questionResponse: output.questionResponse ? {
      focus: output.questionResponse.focus,
      directAnswer: output.questionResponse.directAnswer,
      scopeNote: output.questionResponse.scopeNote,
    } : null,
    hexagramReading: output.hexagramReading,
    keyElements: (output.keyElements ?? []).map((item) => ({ title: item.title, impact: item.impact, observe: item.observe })),
    realityChecks: output.realityChecks,
    summary: output.summary,
    currentSituation: output.currentSituation,
    supportingFactors: visibleTextItems(output.supportingFactors),
    blockingFactors: visibleTextItems(output.blockingFactors),
    changeDirection: output.changeDirection,
    outcomeTrend: output.outcomeTrend?.text,
    timingWindows: visibleTextItems(output.timingWindows),
    actionSuggestions: visibleTextItems(output.actionSuggestions),
    evidenceSummary: visibleTextItems(output.evidenceSummary),
    limitations: output.limitations,
    keyJudgments: (output.keyJudgments ?? []).map((item) => ({
      title: item.title,
      plainInterpretation: item.plainInterpretation,
      decisionImpact: item.decisionImpact,
    })),
    decisionBalance: output.decisionBalance,
    actionPlan: output.actionPlan ? {
      now: visibleTextItems(output.actionPlan.now),
      beforeDecision: visibleTextItems(output.actionPlan.beforeDecision),
      avoid: visibleTextItems(output.actionPlan.avoid),
    } : null,
    finalTakeaway: output.finalTakeaway,
  });
  assertValid(!/空亡|回头生|月建|日辰|同支日|同支月|世爻|应爻|官鬼|父母爻|妻财|兄弟爻/u.test(ordinaryLanguageText), "PLAIN_LANGUAGE_INVALID", "AI explanation contains unexplained professional terminology.");
  assertValid(!/\b[A-Z][A-Z0-9_]{4,}\b/u.test(ordinaryLanguageText), "PLAIN_LANGUAGE_INVALID", "AI explanation exposes an internal evidence or rule code.");
  assertValid(!/[子丑寅卯辰巳午未申酉戌亥]支(?:窗口|日|月)/u.test(ordinaryLanguageText), "PLAIN_LANGUAGE_INVALID", "AI explanation exposes an unexplained earthly-branch timing label.");
  const actionAndChecks = textBlob({ actionSuggestions: output.actionSuggestions, realityChecks: output.realityChecks, actionPlan: output.actionPlan });
  assertValid(!/[一二三四五六七八九十两\d]+\s*(?:天|周|个月|月)\s*后/u.test(actionAndChecks), "ACTION_TIMING_INVENTED", "AI action suggestions contain an unsupported time interval.");
  assertValid(!/(?:至少|最多|不少于|不超过)\s*[一二三四五六七八九十两\d]+\s*(?:天|周|个月|月|年)/u.test(actionAndChecks), "ACTION_TIMING_INVENTED", "AI action suggestions invent a quantified operating or preparation period.");
  return true;
}

export function validateAIReport(raw, input) {
  const output = validateAIReportSchema(raw, input);
  validateAIReportFidelity(output, input);
  validateAIReportSafety(output);
  return output;
}

function deterministicDecisionAnswer(input, overall) {
  if (input.decisionSupportFacts?.directAnswer) return input.decisionSupportFacts.directAnswer;
  const state = overall?.overallState;
  if (state === "FAVORABLE") return "当前可以继续推进，但仍要先核对关键条件，不把有利信号当成结果承诺。";
  if (state === "CAUTIOUS") return "当前更适合先补条件和降低投入，等主要阻碍出现实质变化后再决定是否推进。";
  if (state === "TRANSITIONAL" || state === "MIXED") return "可以继续了解并小步验证，但暂不适合只凭“像是机会”就直接重投入。";
  return "当前信息不足以支持一次性决定，先补齐对方承诺、责任边界和现实资源。";
}

function roleObservation(label = "") {
  if (label.includes("官鬼")) return "核对机会是否已经转成明确的职责、验收标准和风险边界。";
  if (label.includes("父母")) return "核对书面约定、合同手续、交付范围和信息是否完整。";
  if (label.includes("世爻")) return "观察自己能否稳定承担时间、压力和持续投入，而不是只看一时情绪。";
  if (label.includes("应爻")) return "观察对方是否给出明确资源、权限、时间安排和持续行动。";
  return "把这个因素转成可以从沟通、文件或行动中核实的现实信号。";
}

function contextualRoleTitle(input, role) {
  const question = input.questionContext?.question ?? "";
  const label = role?.label ?? role?.professionalRole ?? "";
  const isProject = /项目|合作|参与|合伙|政务系统/u.test(question);
  if (isProject && label.includes("官鬼")) return "项目机会、责任和约束";
  if (isProject && label.includes("父母")) return "合作约定、交付范围和手续";
  if (isProject && label.includes("世爻")) return "你的投入能力与承受边界";
  if (isProject && label.includes("应爻")) return "朋友及项目方的实际回应";
  return String(role?.practicalMeaning ?? role?.meaning ?? label ?? "关键因素").replace(/[。；]+$/u, "");
}

function contextualFactorText(input, kind, fallback) {
  const question = input.questionContext?.question ?? "";
  if (/项目|合作|参与|合伙|政务系统/u.test(question)) {
    return kind === "support"
      ? "你并非完全缺乏参与基础，这个项目值得继续了解和小步验证，但还不能据此判断已经适合重投入。"
      : "外部回应和合作条件仍会消耗资源，需要先把职责、交付、权限和投入边界说清楚。";
  }
  return fallback;
}

function roleLine(input, role) {
  const positions = [
    ...(role?.linePositions ?? []),
    ...(role?.lines ?? []).map((line) => line.position),
  ];
  return (input.chartFacts?.lineFacts ?? []).find((line) => positions.includes(line.position));
}

function deterministicKeyElements(input, support, blocking) {
  const roles = input.resolvedTopicRoles?.roles ?? [];
  const fallbackRefs = [support?.id, blocking?.id, "chart:line_facts"].filter(Boolean);
  const elements = roles.slice(0, 4).map((role, index) => {
    const line = roleLine(input, role);
    const influenceParts = [...new Set(plainGroundingValue([
      line?.monthInfluence,
      line?.dayInfluence,
      line?.changed?.influence,
    ].filter(Boolean)).filter(Boolean))];
    const influence = influenceParts.join("；");
    const ref = role.label?.includes("世爻") || role.label?.includes("应爻")
      ? "chart:world_response"
      : line?.moving ? "chart:moving_lines" : fallbackRefs[index % fallbackRefs.length] ?? "chart:line_facts";
    return {
      title: contextualRoleTitle(input, role),
      professionalRole: role.label ?? role.professionalRole ?? "盘面角色",
      impact: influence || `这个角色用于理解${role.practicalMeaning ?? role.meaning ?? "本次问题中的关键条件"}，不能单独等同于吉凶。`,
      observe: roleObservation(role.label),
      evidenceRefs: [ref],
    };
  });
  if (elements.length >= 2) return elements;
  return [
    {
      title: "你能主动调整的条件",
      professionalRole: "主体位置",
      impact: "报告会优先区分你能控制的投入与外部条件。",
      observe: "确认自己的时间、资源和承受边界。",
      evidenceRefs: ["chart:world_response"],
    },
    {
      title: "外部回应与事情进展",
      professionalRole: "相对方位置",
      impact: "外部回应是否稳定，会影响这件事能否继续推进。",
      observe: "以对方明确回复和实际行动为准。",
      evidenceRefs: ["chart:world_response"],
    },
  ];
}

function deterministicRealityChecks(input) {
  const roles = input.resolvedTopicRoles?.roles ?? [];
  const checks = roles.slice(0, 3).map((role) => ({
    title: contextualRoleTitle(input, role),
    check: roleObservation(role.label),
    signal: "以明确回复、书面约定、已投入资源或实际行动为准。",
  }));
  if (checks.length >= 2) return checks;
  return [
    { title: "对方承诺", check: "确认对方给出的资源、权限和时间安排是否具体。", signal: "以明确回复或已发生的行动为准。" },
    { title: "投入边界", check: "确认自己需要承担的时间、成本和责任上限。", signal: "以可接受的最小投入方案为准。" },
  ];
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
    const graphNodes = input.evidenceGraph?.nodes ?? [];
    const scopedDecisionNodes = (input.decisionFacts?.allowedFindingRefs ?? [])
      .map((id) => graphNodes.find((node) => node.id === id))
      .filter(Boolean);
    const graphSupport = scopedDecisionNodes.find((node) => node.category === "SUPPORT" || node.category === "MIXED");
    const graphBlocking = scopedDecisionNodes.find((node) => node.category === "RISK" || node.category === "MIXED");
    const support = graphSupport ?? input.aggregatedEvidence.supportingForces[0] ?? input.matchedRuleFindings[0];
    const blocking = graphBlocking ?? input.aggregatedEvidence.blockingForces[0] ?? input.matchedRuleFindings[1] ?? support;
    const overall = input.overallAssessmentFacts;
    const actions = input.decisionSupportFacts?.actionTimeline?.map((item) => item.action)
      ?? input.actionGuidanceFacts?.items
      ?? ["先处理可验证的阻碍条件。", "把报告作为辅助参考，不替代现实决策。"];
    const topic = input.resolvedTopicRoles?.displayName ?? input.questionContext?.topicCode ?? "当前问题";
    const moving = (input.chartFacts?.lineFacts ?? []).filter((line) => line.moving);
    const movingText = moving.length
      ? moving.map((line) => `第 ${line.position} 爻从“${line.sixRelationName ?? "当前角色"}”发生变化${line.changed?.sixRelationName ? `，转向“${line.changed.sixRelationName}”` : ""}`).join("；")
      : "本次没有明显动爻，变化方向需要更多现实信号确认";
    const supportText = contextualFactorText(input, "support", plainGroundingValue(
      support?.meaning
      ?? input.resolvedFindings?.find((item) => item.evidenceRef === support?.id)?.practicalMeaning
      ?? support?.summary
      ?? "当前存在可利用的支持条件。",
    ));
    const blockingText = contextualFactorText(input, "blocking", plainGroundingValue(
      blocking?.meaning
      ?? input.resolvedFindings?.find((item) => item.evidenceRef === blocking?.id)?.practicalMeaning
      ?? blocking?.summary
      ?? "当前也存在需要先处理的制约条件。",
    ));
    const liuyaoExplanation = input.reportType === "LIUYAO" ? {
      questionResponse: {
        focus: input.questionContext?.question || "本次具体问题",
        directAnswer: deterministicDecisionAnswer(input, overall),
        scopeNote: input.decisionSupportFacts?.scopeNote ?? `本次按“${topic}”理解。${input.resolvedTopicRoles?.clarificationTriggers?.[0] ?? "如果实际决定与该口径不同，应先重新确认问题重点。"}`,
        evidenceRefs: [support?.id, blocking?.id].filter(Boolean),
      },
      hexagramReading: input.decisionSupportFacts?.hexagramChain ? { ...input.decisionSupportFacts.hexagramChain } : {
        original: `本卦“${input.chartFacts.originalHexagram}”是这次判断的当前起点。它不单独代表适合或不适合，需要结合本次问题中的关键角色一起看。`,
        moving: `${movingText}。这说明变化来自具体环节，不应只把卦名变化理解成简单的好坏转换。`,
        changed: `变卦“${input.chartFacts.changedHexagram}”表示上述变化发生后需要继续观察的结构，不代表结果已经发生。`,
        synthesis: `从“${input.chartFacts.originalHexagram}”到“${input.chartFacts.changedHexagram}”，重点是核实动爻对应的现实变化是否真正出现。`,
      },
      keyElements: deterministicKeyElements(input, support, blocking),
      realityChecks: deterministicRealityChecks(input),
    } : {};
    const deterministicElements = input.reportType === "LIUYAO" ? deterministicKeyElements(input, support, blocking) : [];
    const actionRef = support?.id ?? blocking?.id ?? "chart:line_facts";
    const decisionReport = input.reportType === "LIUYAO" ? {
      keyJudgments: [...deterministicElements, {
        title: "综合判断需要同时看支持与限制",
        professionalRole: "综合证据",
        impact: "单一盘面信号不能替代完整判断。",
        observe: "优先核实最能改变决定的现实条件。",
        evidenceRefs: [actionRef],
      }].slice(0, 3).map((item) => ({
        title: item.title,
        professionalBasis: item.professionalRole,
        plainInterpretation: item.impact,
        decisionImpact: item.observe,
        evidenceRefs: item.evidenceRefs,
      })),
      decisionBalance: [],
      actionPlan: {
        now: [{ text: actions[0] ?? "先核实最关键的现实条件。", evidenceRefs: [actionRef] }],
        beforeDecision: [{ text: actions[1] ?? "在作出重要承诺前确认条件已经落实。", evidenceRefs: [actionRef] }],
        avoid: [{ text: "避免只根据单一有利或不利信号作出不可逆决定。", evidenceRefs: [actionRef] }],
      },
      finalTakeaway: deterministicDecisionAnswer(input, overall),
    } : {};
    return {
      schemaVersion: AI_SCHEMA_VERSION,
      factClaims,
      ...liuyaoExplanation,
      ...decisionReport,
      summary: overall?.summary ?? `${input.chartFacts.originalHexagram}之${input.chartFacts.changedHexagram}，以已命中的证据谨慎判断。`,
      currentSituation: overall?.baseStateText ?? "当前解读只基于排盘事实、CAL_STD_V1 历法事实和已命中的公开证据。",
      supportingFactors: support ? [{ text: supportText, evidenceRefs: [support.id] }] : [],
      blockingFactors: blocking ? [{ text: blockingText, evidenceRefs: [blocking.id] }] : [],
      changeDirection: overall?.dynamicDirectionText ?? "变化方向以动爻、体用或已列证据为准，不作保证性判断。",
      outcomeTrend: { label: aiOutcomeLabel(overall?.overallState), text: overall?.headline ?? "支持与阻碍需要并看，结果仍取决于现实行动和后续条件。" },
      timingWindows: timing ? [{ text: "当前只提供候选观察窗口，仍需结合现实变化复核。", candidateRef: timing.id }] : [],
      actionSuggestions: input.reportType === "LIUYAO"
        ? actions.map((text, index) => ({
            text,
            evidenceRefs: [scopedDecisionNodes[index % Math.max(scopedDecisionNodes.length, 1)]?.id ?? support?.id ?? blocking?.id].filter(Boolean),
          }))
        : actions,
      evidenceSummary: support ? [{ text: supportText, evidenceRefs: [support.id] }] : [],
      limitations: ["盘面只能整理当前条件和变化线索，最终是否适合仍要由现实投入、合作边界和对方行动验证。"],
      disclaimer: "本报告仅供参考，不构成医疗、法律或投资建议。",
    };
  }
}

export class OpenAIReportProvider {
  constructor({ apiKey = process.env.OPENAI_API_KEY, model = process.env.AI_MODEL ?? "gpt-4.1-mini", timeoutMs = Number(process.env.AI_TIMEOUT_MS ?? 15000), maxOutputTokens = Number(process.env.AI_MAX_OUTPUT_TOKENS ?? 1400), rootDir = process.cwd(), endpoint = "https://api.openai.com/v1/responses", provider = "openai" } = {}) {
    this.provider = provider;
    this.model = model;
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
    this.maxOutputTokens = maxOutputTokens;
    this.rootDir = rootDir;
    this.endpoint = endpoint;
  }

  promptFor(input) {
    const file = input.reportType === "LIUYAO" ? "prompts/liuyao-report-v7.md" : "prompts/meihua-report-v1.md";
    return readFileSync(resolve(this.rootDir, file), "utf8");
  }

  async generateReport(input) {
    if (!this.apiKey) throw new AIReportValidationError("PROVIDER_UNAVAILABLE", "AI provider API key is not configured.");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          instructions: this.promptFor(input),
          input: JSON.stringify(buildAIProviderPayload(input)),
          max_output_tokens: this.maxOutputTokens,
          temperature: 0.2,
          ...(this.provider === "deepseek" ? {
            reasoning: { effort: "none" },
            text: { format: input.reportType === "LIUYAO" ? liuyaoResponseFormat(input) : { type: "json_object" } },
          } : {}),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new AIReportValidationError("PROVIDER_FAILED", "AI provider failed.", { status: response.status, code: body?.error?.code });
      if (body.status === "incomplete") throw new AIReportValidationError("PROVIDER_INCOMPLETE", "AI provider response was incomplete.", { reason: body.incomplete_details?.reason });
      const messageText = body.output
        ?.filter((item) => item.type === "message")
        .flatMap((item) => item.content ?? [])
        .filter((part) => part.type === "output_text")
        .map((part) => part.text)
        .filter(Boolean)
        .join("\n");
      return {
        __providerPayload: true,
        content: messageText || body.output_text,
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

export class DeepSeekReportProvider extends OpenAIReportProvider {
  constructor({ apiKey = process.env.DEEPSEEK_API_KEY, model = process.env.AI_MODEL ?? "deepseek-v4-flash", timeoutMs = Number(process.env.AI_TIMEOUT_MS ?? 30000), maxOutputTokens = Number(process.env.AI_MAX_OUTPUT_TOKENS ?? 3200), rootDir = process.cwd(), baseUrl = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com" } = {}) {
    super({
      apiKey,
      model,
      timeoutMs,
      maxOutputTokens,
      rootDir,
      endpoint: `${String(baseUrl).replace(/\/$/u, "")}/responses`,
      provider: "deepseek",
    });
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

class UnavailableAIReportProvider {
  provider = "unavailable";
  model = "not-configured";

  async generateReport() {
    throw new AIReportValidationError("PROVIDER_UNAVAILABLE", "A live AI provider is not configured.");
  }
}

export function providerFromEnv({ rootDir = process.cwd() }: { rootDir?: string } = {}): any {
  const provider = process.env.AI_PROVIDER ?? (process.env.DEEPSEEK_API_KEY ? "deepseek" : process.env.OPENAI_API_KEY ? "openai" : "disabled");
  if (provider === "openai") return new OpenAIReportProvider({ rootDir });
  if (provider === "deepseek") return new DeepSeekReportProvider({ rootDir });
  return new UnavailableAIReportProvider();
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
  if (
    result.aiReportBundle?.validationStatus === "VALID"
    && result.aiReportBundle?.aiSchemaVersion === AI_SCHEMA_VERSION
    && result.aiReportBundle?.promptVersion === (type === "liuyao" ? LIUYAO_PROMPT_VERSION : MEIHUA_PROMPT_VERSION)
    && result.aiReportBundle?.aiProvider === provider.provider
    && result.aiReportBundle?.aiModel === provider.model
  ) return { ...result.aiReportBundle, reportSource: "CACHE_REUSE", reused: true };
  const input = buildAIReportInput({ result, type, language });
  const cacheKey = `${input.reportId}:${input.inputHash}:${provider.provider}:${provider.model}`;
  if (inFlight.has(cacheKey)) return inFlight.get(cacheKey);
  const run = (async () => {
    const startedAt = Date.now();
    const maxAttempts = provider.provider === "deepseek" || provider.provider === "openai" ? 3 : 1;
    const retryableValidationCodes = new Set(["EMPTY_RESPONSE", "INVALID_RESPONSE", "JSON_PARSE_FAILED", "PROVIDER_INCOMPLETE", "SCHEMA_VERSION_INVALID", "SCHEMA_FIELD_MISSING", "SCHEMA_ENUM_INVALID", "EVIDENCE_REF_MISSING", "EVIDENCE_REF_INVALID", "FACT_MISMATCH", "RULE_NOT_MATCHED", "RULE_NOT_ALLOWED", "TIMING_REF_INVALID", "TIMING_LIMIT_EXCEEDED", "TIMING_CERTAINTY_INVALID", "SAFETY_INVALID", "TYPE_CONTAMINATION", "PLAIN_LANGUAGE_INVALID", "ACTION_TIMING_INVENTED", "STATIC_CHART_CONTRADICTION", "UNSUPPORTED_HEXAGRAM_SYMBOLISM", "QUESTION_CLARIFICATION_MISSING", "DECISION_DIRECTION_INVALID", "DECISION_CONDITION_MISSING"]);
    const accumulatedUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    let attemptCount = 0;
    try {
      for (attemptCount = 1; attemptCount <= maxAttempts; attemptCount += 1) {
        try {
          const raw = await provider.generateReport(input);
          const providerPayload = raw?.__providerPayload ? raw : null;
          if (providerPayload?.tokenUsage) {
            accumulatedUsage.inputTokens += Number(providerPayload.tokenUsage.inputTokens ?? 0);
            accumulatedUsage.outputTokens += Number(providerPayload.tokenUsage.outputTokens ?? 0);
            accumulatedUsage.totalTokens += Number(providerPayload.tokenUsage.totalTokens ?? 0);
          }
          const isLiveProvider = provider.provider === "deepseek" || provider.provider === "openai";
          const modelOutput = providerPayload ? providerPayload.content : raw;
          const groundedOutput = isLiveProvider ? canonicalizeLiveControlledFields(modelOutput, input) : modelOutput;
          const validatedOutput = validateAIReport(groundedOutput, input);
          const output = isLiveProvider
            ? plainGroundingValue(validatedOutput)
            : validatedOutput;
          if (isLiveProvider) validateAIPlainLanguage(output);
          output.disclaimer = PUBLIC_AI_DISCLAIMER;
          return {
            aiReport: output,
            aiSchemaVersion: AI_SCHEMA_VERSION,
            aiProvider: provider.provider,
            aiModel: provider.model,
            promptVersion: input.versions.promptVersion,
            generatedAt: new Date().toISOString(),
            latencyMs: Date.now() - startedAt,
            tokenUsage: accumulatedUsage.totalTokens > 0 ? accumulatedUsage : {
              inputTokenEstimate: estimateTokens(input),
              outputTokenEstimate: estimateTokens(output),
            },
            reportSource: provider.provider === "deepseek" ? "DEEPSEEK_LIVE" : provider.provider === "openai" ? "OPENAI_LIVE" : "TEST_FIXTURE",
            validationStatus: "VALID",
            fallbackUsed: false,
            attemptCount,
            inputHash: input.inputHash,
            requestId: randomUUID(),
          };
        } catch (err) {
          if (process.env.AI_DEBUG_VALIDATION === "1" && err instanceof AIReportValidationError) {
            console.error(JSON.stringify({ attempt: attemptCount, validationCode: err.code, details: err.details ?? null }));
          }
          if (attemptCount < maxAttempts && err instanceof AIReportValidationError && retryableValidationCodes.has(err.code)) continue;
          throw err;
        }
      }
    } catch (err) {
      const bundle = fallbackBundle({ result, type, input, reason: err, provider: provider.provider, model: provider.model });
      bundle.latencyMs = Date.now() - startedAt;
      bundle.attemptCount = attemptCount;
      if (accumulatedUsage.totalTokens > 0) bundle.tokenUsage = accumulatedUsage;
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
