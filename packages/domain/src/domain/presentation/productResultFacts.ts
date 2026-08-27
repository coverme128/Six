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

const HARMONY_PAIRS = new Map([
  ["zi", "chou"], ["chou", "zi"],
  ["yin", "hai"], ["hai", "yin"],
  ["mao", "xu"], ["xu", "mao"],
  ["chen", "you"], ["you", "chen"],
  ["si", "shen"], ["shen", "si"],
  ["wu", "wei"], ["wei", "wu"],
]);

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
      polarity: finding.polarity ?? null,
      summary: finding.summary ?? "",
      inputFacts: finding.input_facts ?? {},
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

function lineSignalState(lines = [], chart) {
  if (!lines.length) return "UNCLEAR";
  let support = 0;
  let risk = 0;
  for (const line of lines) {
    for (const influence of [line.monthInfluence, line.dayInfluence].filter(Boolean)) {
      if (influence.isSame || influence.effect === "generates") support += 1;
      if (influence.isClash || ["controls", "drains", "resists"].includes(influence.effect)) risk += 1;
    }
    if (HARMONY_PAIRS.get(line.branch) === chart?.calendar?.monthBranch) support += 1;
    if (HARMONY_PAIRS.get(line.branch) === chart?.calendar?.dayBranch) support += 1;
    if (line.isVoid) risk += 2;
    if (line.changed?.returnInfluence?.code === "return_generate") support += 2;
    if (["return_control", "outward_drain", "outward_control"].includes(line.changed?.returnInfluence?.code)) risk += 2;
  }
  if (support && risk) return "MIXED";
  if (support) return "SUPPORT";
  if (risk) return "RISK";
  return "OBSERVE";
}

function evidenceRefsForLines(resolvedFindingFacts, lines) {
  const positions = new Set(lines.map((line) => line.position));
  return resolvedFindingFacts
    .filter((item) => {
      const facts = item.inputFacts ?? {};
      return positions.has(facts.linePosition)
        || positions.has(facts.sourceLine)
        || positions.has(facts.targetLine)
        || [facts.linePositions, facts.originLinePositions, facts.tabooLinePositions, facts.targetLinePositions]
          .some((items) => Array.isArray(items) && items.some((position) => positions.has(position)))
        || (Array.isArray(facts.roles) && facts.roles.some((role) => (role.linePositions ?? []).some((position) => positions.has(position))));
    })
    .map((item) => item.findingRef)
    .filter(Boolean)
    .slice(0, 4);
}

function dimensionSummary(label, state) {
  if (state === "SUPPORT") return `${label}已有可利用的支持或启动信号，适合继续用现实行动验证。`;
  if (state === "RISK") return `${label}当前存在明显制约，未核实前不宜据此扩大投入。`;
  if (state === "MIXED") return `${label}有推进条件，也有尚未解决的风险，需要把关键条件逐项说清。`;
  if (state === "OBSERVE") return `${label}暂时没有形成单向信号，应以实际回复、文件或行动继续核对。`;
  return `${label}缺少足够直接的盘面信息，不单独据此下结论。`;
}

function decisionDimension({ code, label, lines, resolvedFindingFacts, chart }) {
  const state = lineSignalState(lines, chart);
  return {
    code,
    label,
    state,
    summary: dimensionSummary(label, state),
    linePositions: lines.map((line) => line.position),
    evidenceRefs: evidenceRefsForLines(resolvedFindingFacts, lines),
  };
}

function generalDecisionCopy(overallState) {
  if (overallState === "FAVORABLE") return "当前可以继续推进，但要先把会改变决定的关键条件核实清楚。";
  if (overallState === "CAUTIOUS") return "当前更适合先降低投入并补齐条件，主要阻碍没有变化前不宜仓促决定。";
  if (overallState === "TRANSITIONAL" || overallState === "MIXED") return "可以继续了解并小步验证，但暂不适合只凭单一有利信号直接重投入。";
  return "当前信息还不足以支持一次性决定，先补齐现实证据再判断是否推进。";
}

function buildJobSearchDecisionFacts({ chart, resolvedFindingFacts, overallAssessmentFacts }) {
  const byRelation = (relation) => chart.lines.filter((line) => line.sixRelation === relation);
  const world = chart.lines.filter((line) => line.isWorld);
  const response = chart.lines.filter((line) => line.isResponse);
  const projectIntent = /项目|合作|参与|合伙|政务系统/u.test(chart.question ?? "");
  const dimensions = [
    decisionDimension({ code: "OPPORTUNITY", label: projectIntent ? "机会是否真实" : "岗位机会", lines: byRelation("officer_ghost"), resolvedFindingFacts, chart }),
    decisionDimension({ code: "EXTERNAL_COMMITMENT", label: projectIntent ? "项目方是否落实" : "招聘方是否落实", lines: response, resolvedFindingFacts, chart }),
    decisionDimension({ code: "WRITTEN_TERMS", label: projectIntent ? "职责与交付边界" : "书面条件与流程", lines: byRelation("parent"), resolvedFindingFacts, chart }),
    decisionDimension({ code: "RETURN", label: projectIntent ? "投入与回报" : "薪资与实际回报", lines: byRelation("wealth"), resolvedFindingFacts, chart }),
    decisionDimension({ code: "CAPACITY", label: "你的承受能力", lines: world, resolvedFindingFacts, chart }),
  ];
  const state = overallAssessmentFacts.overallState;
  let directAnswer;
  if (projectIntent) {
    directAnswer = state === "FAVORABLE"
      ? "可以继续推进这个机会，但应先把职责、资源、验收方式和回报写清，再决定投入程度。"
      : state === "CAUTIOUS"
        ? "可以保留沟通，但暂不适合在职责、资源和回报尚未落实时重投入。"
        : state === "TRANSITIONAL" || state === "MIXED"
          ? "可以继续了解并小步验证，但不建议只凭“像是机会”就直接重投入。"
          : "可以先做低成本验证，但目前不足以支持直接承诺长期或高强度投入。";
  } else {
    directAnswer = state === "FAVORABLE"
      ? "可以开始推进求职，但应在职责、薪资和书面 Offer 明确后再完成切换。"
      : state === "CAUTIOUS"
        ? "可以先了解和投递，但不建议在岗位条件尚未明确时仓促切换。"
        : state === "TRANSITIONAL" || state === "MIXED"
          ? "可以开始找并小步验证，但不建议只凭机会感就离开现有安排。"
          : "可以先通过投递和沟通验证市场，但目前不足以支持一次性切换。";
  }
  return {
    scenarioCode: "JOB_SEARCH",
    scenarioLabel: projectIntent ? "项目机会" : "求职与工作机会",
    directAnswer,
    decisionMode: "CONDITIONAL_PROCEED",
    dimensions,
    proceedConditions: projectIntent
      ? ["职责、交付物和验收标准形成明确约定。", "项目方能够提供必要权限、资源和持续投入。", "时间成本、责任上限和回报方式在可承受范围内。"]
      : ["岗位职责、汇报关系和试用要求已经明确。", "薪资、入职时间和书面 Offer 达到你的底线。", "招聘方的承诺已经转成文件、排期或实际行动。"],
    holdConditions: projectIntent
      ? ["只有口头机会，没有明确负责人、资源或验收标准。", "需要先重投入，回报和责任边界却仍然模糊。"]
      : ["只有口头承诺，岗位职责或薪资仍然模糊。", "需要先放弃现有安排，对方却没有可核验的书面条件。"],
    actionTimeline: [
      { phase: "现在", action: projectIntent ? "用一次小范围任务验证协作、资源和决策效率。" : "开始投递和沟通，用真实反馈验证机会质量。" },
      { phase: "条件明确时", action: projectIntent ? "逐项核对职责、交付、权限、回报和风险承担。" : "逐项核对职责、薪资、汇报关系、试用和入职安排。" },
      { phase: "作决定前", action: projectIntent ? "确认最坏情况下的时间和责任成本仍可承受。" : "书面条件达到底线后，再决定是否离开现有安排。" },
    ],
    scopeNote: projectIntent
      ? "本次按项目机会理解，重点判断机会是否真实、项目方是否落实，以及投入边界是否清楚。"
      : "本次按求职与工作机会理解，重点判断是否值得开始找，以及满足什么条件后再切换。",
  };
}

function plainMovingImpact(code) {
  if (code === "return_generate") return "变化后的条件反过来形成支持";
  if (code === "return_control") return "变化后的条件反过来形成压力";
  if (code === "outward_drain") return "原有力量向后续条件分散";
  if (code === "outward_control") return "原有条件需要主动处理变化中的制约";
  if (code === "return_same") return "变化前后仍处在相近的作用方向";
  return "变化方向需要结合现实进展继续核对";
}

function jobRoleMeaning(relation, projectIntent) {
  const copy = {
    officer_ghost: projectIntent ? "项目机会、责任与约束" : "岗位机会、职责与工作压力",
    parent: projectIntent ? "合作约定、交付与手续" : "简历、书面 Offer、合同与流程",
    wealth: projectIntent ? "投入回报与可得资源" : "薪资与实际回报",
    sibling: "竞争、同级关系与资源消耗",
    child: "产出、表达与可验证结果",
  };
  return copy[relation] ?? "本次问题中的相关条件";
}

function buildControlledHexagramChain(chart, decisionFacts) {
  const projectIntent = decisionFacts.scenarioCode === "JOB_SEARCH" && decisionFacts.scenarioLabel === "项目机会";
  const moving = chart.lines.filter((line) => line.moving).map((line) => {
    const source = decisionFacts.scenarioCode === "JOB_SEARCH" ? jobRoleMeaning(line.sixRelation, projectIntent) : `${line.sixRelationName}对应的事项`;
    const target = decisionFacts.scenarioCode === "JOB_SEARCH" ? jobRoleMeaning(line.changed?.sixRelation, projectIntent) : `${line.changed?.sixRelationName ?? "后续"}对应的事项`;
    return `第 ${line.position} 爻对应${source}，变化后更多落到${target}，${plainMovingImpact(line.changed?.returnInfluence?.code)}。`;
  });
  const primaryDimension = decisionFacts.dimensions?.[0];
  return {
    original: `本卦“${chart.originalHexagram?.name_zh}”记录当前起点。就本次问题而言，${primaryDimension?.summary ?? "需要先核对核心事项的现实条件。"}`,
    moving: moving.length ? moving.join("") : "本盘没有动爻，当前更适合观察已有条件是否出现实质变化。",
    changed: `变卦“${chart.changedHexagram?.name_zh}”记录上述变化发生后的观察结构，不单独代表成功或失败。重点核对：${decisionFacts.proceedConditions?.[0] ?? "关键条件是否已经落实。"}`,
    synthesis: `${decisionFacts.directAnswer} ${decisionFacts.holdConditions?.[0] ?? "主要承诺仍未落实时，先不要扩大投入。"}`,
  };
}

function buildDecisionSupportFacts({ chart, topicRoleContext, resolvedFindingFacts, overallAssessmentFacts }) {
  const mappingCode = `${chart.topic}:${chart.subtype}`;
  const jobSearchMappings = new Set(["career:job_search", "career:interview", "career:offer", "career:job_change"]);
  const base = jobSearchMappings.has(mappingCode)
    ? buildJobSearchDecisionFacts({ chart, resolvedFindingFacts, overallAssessmentFacts })
    : {
        scenarioCode: chart.topic?.toUpperCase?.() ?? "GENERAL",
        scenarioLabel: topicRoleContext.displayName,
        directAnswer: generalDecisionCopy(overallAssessmentFacts.overallState),
        decisionMode: overallAssessmentFacts.overallState === "CAUTIOUS" ? "HOLD_AND_VERIFY" : "CONDITIONAL_PROCEED",
        dimensions: topicRoleContext.roles.slice(0, 4).map((role, index) => decisionDimension({
          code: `ROLE_${index + 1}`,
          label: String(role.practicalMeaning ?? role.label).replace(/[。；]+$/u, ""),
          lines: (role.lines ?? []).map((line) => chart.lines[line.position - 1]).filter(Boolean),
          resolvedFindingFacts,
          chart,
        })),
        proceedConditions: ["关键参与者给出明确回复或实际行动。", "责任、资源和时间边界能够被核验。"],
        holdConditions: ["主要承诺仍停留在口头或推测。", "关键风险没有对应的缓解方案。"],
        actionTimeline: [
          { phase: "现在", action: "先验证最能改变决定的一项现实条件。" },
          { phase: "出现新信息时", action: "对照报告中的支持与阻碍，确认哪一项已经实质变化。" },
          { phase: "作决定前", action: "检查责任、资源和可承受边界是否都已明确。" },
        ],
        scopeNote: `本次按${topicRoleContext.displayName}理解，重点判断现在是否适合推进，以及哪些现实条件会改变决定。`,
      };
  base.hexagramChain = buildControlledHexagramChain(chart, base);
  return {
    decisionSupportVersion: "LIUYAO_DECISION_SUPPORT_V1",
    mappingCode,
    ...base,
    boundary: "这是基于当前排盘事实形成的条件化决策支持，不替代现实调查或专业意见。",
  };
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
  const decisionSupportFacts = buildDecisionSupportFacts({ chart, topicRoleContext, resolvedFindingFacts, overallAssessmentFacts });
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
    decisionSupportFacts,
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
    decisionAnswer: productFacts.decisionSupportFacts?.directAnswer,
    decisionMode: productFacts.decisionSupportFacts?.decisionMode,
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
