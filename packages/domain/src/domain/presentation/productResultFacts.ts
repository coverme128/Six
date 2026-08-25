// @ts-nocheck
import { readJson } from "../dataStore.js";
import { formatMethod } from "./terminologyFormatter.js";
import { resolveFindingExplanation, resolveRelationships, resolveTopicRoleContext } from "./interpretationAssets.js";

export const LIUYAO_PRODUCT_RESULT_FACTS_VERSION = "LIUYAO_PRODUCT_RESULT_FACTS_V1";
export const LIUYAO_ASSESSMENT_VERSION = "LIUYAO_ASSESSMENT_RUNTIME_CLOSURE_V1";
const AI_SCHEMA_VERSION = "AI_REPORT_V1";

const PRODUCT_RUNTIME_PATH = "data/liuyao/product-closure-runtime.json";
const INTERPRETATION_MANIFEST_PATH = "data/liuyao/interpretation-assets/manifest.json";
const FINDING_BINDINGS_PATH = "data/liuyao/rule-finding-bindings.json";
const RELATIONSHIP_BINDINGS_PATH = "data/liuyao/relationship-bindings.json";
const TOPIC_BINDINGS_PATH = "data/liuyao/question-topic-bindings.json";
const TIMING_RULES_PATH = "data/production/core-v1-timing-rules.json";
const RULE_PROFILE_PATH = "data/production/core-v1-rule-profile.json";

const DIMENSION_LABELS = {
  subject_state: "主体状态",
  target_state: "目标状态",
  supporting_forces: "支持力量",
  blocking_forces: "阻碍力量",
  change_direction: "变化方向",
  timing_state: "时间状态",
};

const BASE_STATE_LABELS = {
  SUPPORTED: "基础条件有承托",
  PRESSURED: "基础条件有压力",
  MIXED: "基础条件有利有阻",
  UNCLEAR: "基础条件暂不明朗",
};

const DYNAMIC_LABELS = {
  CHANGING: "已有变化动力",
  STATIC_OR_UNCLEAR: "变化动力不突出",
};

function evidenceRef(finding) {
  return finding?.id ?? (finding?.rule_code ? `rule:${finding.rule_code}` : "finding:unknown");
}

function firstText(...values) {
  return values.find((value) => typeof value === "string" && value.trim()) ?? "";
}

function publicLine(line) {
  return {
    position: line.position,
    value: line.sum,
    yinYang: line.originalBit === "1" ? "阳" : "阴",
    moving: Boolean(line.moving),
    sixSpiritName: line.sixSpiritName,
    sixRelationName: line.sixRelationName,
    branchName: line.branchName,
    elementName: line.elementName,
    isWorld: Boolean(line.isWorld),
    isResponse: Boolean(line.isResponse),
    isVoid: Boolean(line.isVoid),
    monthText: line.monthInfluence?.text,
    dayText: line.dayInfluence?.text,
    changedText: line.changed?.returnInfluence?.text,
  };
}

function findingFacts(result, chart, rootDir) {
  const findings = result.report?.evidence ?? result.findings ?? [];
  return findings.map((finding, index) => {
    const resolved = resolveFindingExplanation(finding, chart, rootDir);
    return {
      findingRef: evidenceRef(finding),
      sourceIndex: index,
      ruleCode: finding.rule_code ?? finding.code ?? null,
      ruleType: finding.rule_type ?? null,
      ruleVersion: finding.rule_version ?? null,
      dimension: finding.dimension ?? "target_state",
      evidenceKind: finding.evidence_kind ?? "symbolism",
      outputRole: finding.output_role ?? "FACT",
      summary: finding.summary ?? "",
      resolvedMeaning: {
        bindingStatus: resolved.bindingStatus,
        assetId: resolved.assetId,
        displayName: resolved.displayName,
        practicalMeaning: resolved.practicalMeaning,
        direction: resolved.direction,
        priority: resolved.defaultPriority,
        limitations: resolved.limitations ?? [],
      },
    };
  });
}

function groupEvidence(resolvedFindingFacts) {
  const groups = new Map();
  for (const item of resolvedFindingFacts) {
    const code = item.dimension ?? "target_state";
    const group = groups.get(code) ?? {
      dimension: code,
      label: DIMENSION_LABELS[code] ?? code,
      findingRefs: [],
      primaryFindingRef: null,
      count: 0,
    };
    group.findingRefs.push(item.findingRef);
    group.primaryFindingRef ??= item.findingRef;
    group.count += 1;
    groups.set(code, group);
  }
  return [...groups.values()];
}

function relevantFindings(resolvedFindingFacts, dimension) {
  return resolvedFindingFacts.filter((item) => item.dimension === dimension);
}

function matchAssessmentPattern({ runtime, hasSupport, hasBlock, hasMoving }) {
  const patterns = runtime.assessmentPatterns ?? [];
  if (hasSupport && hasBlock && hasMoving) return patterns.find((item) => item.patternId === "LYX_ASSESS_TRANSITIONAL_MIXED");
  if (hasSupport && hasBlock) return patterns.find((item) => item.patternId === "LYX_ASSESS_MIXED");
  if (hasSupport) return patterns.find((item) => item.patternId === "LYX_ASSESS_FAVORABLE_WITH_SUPPORT");
  if (hasBlock) return patterns.find((item) => item.patternId === "LYX_ASSESS_CAUTIOUS_WITH_BLOCK");
  return patterns.find((item) => item.patternId === "LYX_ASSESS_UNCLEAR");
}

function conflictFacts({ runtime, support, block, resolvedFindingFacts }) {
  const policy = (runtime.conflictPolicies ?? []).find((item) => support.length && block.length
    ? item.policyId === "LYX_CONFLICT_SUPPORT_AND_BLOCK_COEXIST_V1"
    : item.policyId === "LYX_CONFLICT_SINGLE_DIRECTION_V1");
  const dominant = [
    support[0]?.findingRef,
    block[0]?.findingRef,
    resolvedFindingFacts.find((item) => item.evidenceKind === "direct_target_fact")?.findingRef,
  ].filter(Boolean);
  return {
    conflictPolicyId: policy?.policyId ?? "LYX_CONFLICT_SINGLE_DIRECTION_V1",
    conflictState: support.length && block.length ? "UNRESOLVED" : "NONE",
    supportFindingRefs: support.map((item) => item.findingRef),
    blockingFindingRefs: block.map((item) => item.findingRef),
    dominantFindingRefs: [...new Set(dominant)].slice(0, 4),
    resolutionSummary: support.length && block.length
      ? "支持与阻碍同时保留；总体判断不会被折算成单一加减分，而是按证据类别、直接性与变化状态说明。"
      : "当前未形成支持与阻碍的直接冲突，仍保留限制说明。",
  };
}

function buildOverallAssessment({ chart, runtime, resolvedFindingFacts, conflictResolutionFacts }) {
  const support = relevantFindings(resolvedFindingFacts, "supporting_forces");
  const block = relevantFindings(resolvedFindingFacts, "blocking_forces");
  const moving = relevantFindings(resolvedFindingFacts, "change_direction");
  const pattern = matchAssessmentPattern({
    runtime,
    hasSupport: support.length > 0,
    hasBlock: block.length > 0,
    hasMoving: moving.length > 0 || (chart.movingLines ?? []).length > 0,
  });
  const baseState = pattern?.baseState ?? "UNCLEAR";
  const dynamicDirection = (moving.length > 0 || (chart.movingLines ?? []).length > 0) ? "CHANGING" : "STATIC_OR_UNCLEAR";
  const overallState = pattern?.overallState ?? "UNCLEAR";
  const title = `${pattern?.displayName ?? "暂不明朗"}：${chart.originalHexagram?.name_zh ?? "-"} → ${chart.changedHexagram?.name_zh ?? "-"}`;
  return {
    assessmentVersion: LIUYAO_ASSESSMENT_VERSION,
    patternId: pattern?.patternId ?? "LYX_ASSESS_UNCLEAR",
    patternName: pattern?.displayName ?? "暂不明朗",
    overallState,
    baseState,
    baseStateText: BASE_STATE_LABELS[baseState] ?? BASE_STATE_LABELS.UNCLEAR,
    dynamicDirection,
    dynamicDirectionText: DYNAMIC_LABELS[dynamicDirection] ?? DYNAMIC_LABELS.STATIC_OR_UNCLEAR,
    conflictState: conflictResolutionFacts.conflictState,
    headline: title,
    summary: pattern?.summary ?? "当前公开证据不足以形成清晰方向。",
    dominantFindingRefs: conflictResolutionFacts.dominantFindingRefs,
    basis: [
      support[0]?.resolvedMeaning?.practicalMeaning ?? support[0]?.summary,
      block[0]?.resolvedMeaning?.practicalMeaning ?? block[0]?.summary,
      moving[0]?.summary,
    ].filter(Boolean),
    algorithmBoundary: "综合判断采用判断模式与冲突裁决，不使用简单的支持减阻碍计分。",
  };
}

function actionGuidanceFacts(runtime, overallAssessmentFacts) {
  const guidance = (runtime.actionGuidance ?? []).find((item) => item.state === overallAssessmentFacts.overallState)
    ?? (runtime.actionGuidance ?? []).find((item) => item.state === "UNCLEAR");
  return {
    guidanceVersion: runtime.version,
    sourceState: overallAssessmentFacts.overallState,
    items: guidance?.items ?? ["把报告作为辅助参考，不替代现实决策。"],
    boundary: "建议关注只指出观察和复核方向，不替用户做现实决定。",
  };
}

function timingExplanationFacts(result, runtime) {
  return (result.timingCandidates ?? []).slice(0, 5).map((candidate, index) => {
    const evidence = Array.isArray(candidate.evidence) ? candidate.evidence : [];
    const policyRef = candidate.rule_code ?? evidence[0] ?? `timing:${index + 1}`;
    const fallbackLimitation = runtime.timingPolicy?.defaultLimitation ?? "时间窗口只代表候选观察期，不代表保证日期。";
    const limitation = firstText(candidate.limitation);
    return {
      candidateRef: `timing:${index + 1}`,
      policyRef,
      window: candidate.window,
      granularity: candidate.granularity,
      rank: candidate.rank ?? index + 1,
      explanation: `${candidate.window}可作为观察窗口；这不是保证日期，仍需结合现实进展复核。`,
      limitation: /Candidate window|guaranteed date/u.test(limitation) ? fallbackLimitation : (limitation || fallbackLimitation),
      precision: Array.isArray(candidate.granularity) ? candidate.granularity.join("/") : candidate.granularity,
      provenanceReady: Boolean(policyRef),
    };
  });
}

function versionSnapshot({ result, chart, runtime, rootDir }) {
  const manifest = readJson(INTERPRETATION_MANIFEST_PATH, rootDir);
  const findingBindings = readJson(FINDING_BINDINGS_PATH, rootDir);
  const relationshipBindings = readJson(RELATIONSHIP_BINDINGS_PATH, rootDir);
  const topicBindings = readJson(TOPIC_BINDINGS_PATH, rootDir);
  const timingRules = readJson(TIMING_RULES_PATH, rootDir);
  const ruleProfile = readJson(RULE_PROFILE_PATH, rootDir);
  return {
    calendarVersion: chart.calendar?.calendarVersion ?? chart.calendar?.policyVersion ?? null,
    calendarPolicyVersion: chart.calendar?.policyVersion ?? null,
    ruleProfileVersion: result.engineVersions?.rules ?? ruleProfile.version,
    findingRegistryVersion: manifest.version,
    relationshipRegistryVersion: manifest.version,
    topicRoleRegistryVersion: manifest.version,
    findingBindingVersion: findingBindings.version,
    relationshipBindingVersion: relationshipBindings.version,
    topicBindingVersion: topicBindings.version,
    assessmentPatternRegistryVersion: runtime.version,
    conflictResolutionRegistryVersion: runtime.version,
    actionGuidanceRegistryVersion: runtime.version,
    timingPolicyVersion: timingRules.version,
    assessmentVersion: LIUYAO_ASSESSMENT_VERSION,
    aiReportSchemaVersion: AI_SCHEMA_VERSION,
    productFactsVersion: LIUYAO_PRODUCT_RESULT_FACTS_VERSION,
  };
}

function knowledgeReferences(chart) {
  return [
    chart.originalHexagram?.code ? { id: chart.originalHexagram.code, title: `${chart.originalHexagram.name_zh}卦` } : null,
    chart.changedHexagram?.code && chart.changedHexagram.code !== chart.originalHexagram?.code
      ? { id: chart.changedHexagram.code, title: `${chart.changedHexagram.name_zh}卦` }
      : null,
  ].filter(Boolean);
}

export function buildLiuyaoProductResultFacts({ result, presentationFacts = null, rootDir = process.cwd() }) {
  const chart = result.chart;
  const runtime = readJson(PRODUCT_RUNTIME_PATH, rootDir);
  const topicRoleContext = resolveTopicRoleContext(chart, rootDir);
  const resolvedFindingFacts = findingFacts(result, chart, rootDir);
  const support = relevantFindings(resolvedFindingFacts, "supporting_forces");
  const block = relevantFindings(resolvedFindingFacts, "blocking_forces");
  const conflictResolutionFacts = conflictFacts({ runtime, support, block, resolvedFindingFacts });
  const overallAssessmentFacts = buildOverallAssessment({ chart, runtime, resolvedFindingFacts, conflictResolutionFacts });
  const timingFacts = timingExplanationFacts(result, runtime);
  return {
    productFactsVersion: LIUYAO_PRODUCT_RESULT_FACTS_VERSION,
    reportIdentity: {
      reportId: chart.id,
      reportType: "LIUYAO",
      chartHash: chart.chartHash,
      generatedAt: new Date().toISOString(),
      state: "COMPLETED",
    },
    questionContext: {
      question: chart.question ?? "",
      topicCode: chart.topic,
      subtypeCode: chart.subtype,
      mappingCode: `${chart.topic}:${chart.subtype}`,
      topicDisplayName: topicRoleContext.displayName,
      topicBindingStatus: topicRoleContext.bindingStatus,
    },
    calendarFacts: {
      policyVersion: chart.calendar?.policyVersion,
      provider: chart.calendar?.calendarProvider,
      calendarVersion: chart.calendar?.calendarVersion,
      timezone: chart.calendar?.timezone,
      yearPillar: chart.calendar?.yearPillar,
      monthPillar: chart.calendar?.monthPillar,
      dayPillar: chart.calendar?.dayPillar,
      hourPillar: chart.calendar?.hourPillar,
      monthBuildName: chart.calendar?.monthBuild?.branchName,
      dayChenName: chart.calendar?.dayChen?.branchName,
      xunKongNames: chart.calendar?.xun?.voidBranchNames ?? [],
    },
    chartFacts: {
      method: formatMethod(chart.methodCode, "liuyao"),
      originalHexagram: chart.originalHexagram?.name_zh,
      changedHexagram: chart.changedHexagram?.name_zh,
      movingLines: chart.movingLines ?? [],
      worldLine: chart.worldResponse?.worldLine,
      responseLine: chart.worldResponse?.responseLine,
    },
    yongshenSelectionFacts: {
      topic: topicRoleContext.displayName,
      selectionSource: chart.observationFocus?.selectionSource ?? "system_default",
      selectedRoles: topicRoleContext.roles.map((role) => ({
        label: role.label,
        professionalMeaning: role.professionalRole,
        practicalMeaning: role.practicalMeaning,
        importance: role.importance,
        linePositions: (role.lines ?? []).map((line) => line.position),
      })),
      explanation: topicRoleContext.summary,
      limitations: topicRoleContext.safetyNotes,
      clarificationTriggers: topicRoleContext.clarificationTriggers,
    },
    lineAssessmentFacts: (chart.lines ?? []).map(publicLine),
    resolvedFindingFacts,
    resolvedRelationshipFacts: resolveRelationships(chart, rootDir).map((item, index) => ({
      relationshipRef: `relationship:${index + 1}`,
      relationId: item.relationId,
      bindingStatus: item.bindingStatus,
      title: item.title,
      professionalMeaning: item.professionalMeaning,
      guidedMeaning: item.guidedMeaning,
      linePosition: item.linePosition,
      limitation: item.limitation,
    })),
    evidenceGroupingFacts: groupEvidence(resolvedFindingFacts),
    conflictResolutionFacts,
    overallAssessmentFacts,
    timingExplanationFacts: timingFacts,
    actionGuidanceFacts: actionGuidanceFacts(runtime, overallAssessmentFacts),
    knowledgeReferences: knowledgeReferences(chart),
    versionSnapshot: versionSnapshot({ result, chart, runtime, rootDir }),
    qaRuntime: {
      assessmentPatternsLoaded: (runtime.assessmentPatterns ?? []).length > 0,
      conflictPoliciesLoaded: (runtime.conflictPolicies ?? []).length > 0,
      actionGuidanceLoaded: (runtime.actionGuidance ?? []).length > 0,
      overallAssessmentRuntimeEnabled: true,
      deterministicFallbackEnabled: true,
      noPureScoreAssessment: true,
    },
    presentationFacts,
  };
}

export function isLiuyaoProductResultFacts(value) {
  return value?.productFactsVersion === LIUYAO_PRODUCT_RESULT_FACTS_VERSION;
}

export function productPresentationFacts(value) {
  return isLiuyaoProductResultFacts(value) ? value.presentationFacts : value;
}

export function judgmentFactsSignature(productFacts) {
  if (!isLiuyaoProductResultFacts(productFacts)) return null;
  return {
    selectedYongshen: productFacts.yongshenSelectionFacts,
    overallState: productFacts.overallAssessmentFacts.overallState,
    baseState: productFacts.overallAssessmentFacts.baseState,
    dynamicDirection: productFacts.overallAssessmentFacts.dynamicDirection,
    conflictState: productFacts.conflictResolutionFacts.conflictState,
    dominantFindingRefs: productFacts.overallAssessmentFacts.dominantFindingRefs,
    timingWindows: productFacts.timingExplanationFacts.map((item) => ({
      candidateRef: item.candidateRef,
      policyRef: item.policyRef,
      window: item.window,
      precision: item.precision,
    })),
  };
}
