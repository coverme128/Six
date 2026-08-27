import assert from "node:assert/strict";
import test from "node:test";

import { createLiuyaoChart } from "@six/domain/liuyao";
import { createMeihuaChart } from "@six/domain/meihua";
import { buildLiuyaoReport, buildMeihuaReport } from "@six/domain/report-builder";
import { buildExperienceBundle } from "@six/domain/presentation";
import { deduplicateSignals } from "@six/domain/presentation";
import { PAGE_EXPERIENCE_CONTRACTS, PAGE_STATE_CONTRACT } from "@six/domain/presentation";
import { TERMINOLOGY_REGISTRY } from "@six/domain/presentation";
import { formatRelationship, formatStatus } from "@six/domain/presentation";
import { judgmentFactsSignature } from "@six/domain/presentation";
import { LIUYAO_VISUAL_REGISTRY, LIUYAO_VISUAL_SYSTEM_VERSION } from "@six/domain/presentation";

function liuyaoResult() {
  const result = createLiuyaoChart({
    question: "体验层是否能看懂？",
    topic: "career",
    subtype: "job_search",
    values: [7, 8, 9, 7, 8, 6],
    calendar: { timezone: "Asia/Shanghai" },
  });
  result.narrativeReport = buildLiuyaoReport(result);
  return result;
}

function meihuaResult() {
  const result = createMeihuaChart({
    question: "梅花体验层是否能看懂？",
    methodCode: "MEIHUA_TWO_NUMBER_V1",
    number_a: 7,
    number_b: 12,
  });
  result.narrativeReport = buildMeihuaReport(result);
  return result;
}

function staticPartnershipResult() {
  const result = createLiuyaoChart({
    question: "朋友做政务系统，邀请我加入，我是否应该加入？",
    topic: "business",
    subtype: "partnership",
    values: [8, 7, 7, 8, 8, 8],
    calendar: { instantUtc: "2026-08-27T07:27:31Z", timezone: "Asia/Shanghai" },
  });
  result.narrativeReport = buildLiuyaoReport(result);
  return result;
}

function confirmedProjectCooperationResult() {
  const result = createLiuyaoChart({
    question: "朋友做政务系统，邀请我加入，我是否应该加入？",
    topic: "business",
    subtype: "partnership",
    values: [8, 7, 7, 8, 8, 8],
    questionProfile: { joinMode: "PROJECT_COOPERATION" },
    calendar: { instantUtc: "2026-08-27T07:27:31Z", timezone: "Asia/Shanghai" },
  });
  result.narrativeReport = buildLiuyaoReport(result);
  return result;
}

test("Experience bundle builds guided and professional viewmodels without admin leakage", () => {
  const bundle = buildExperienceBundle({ result: liuyaoResult(), type: "liuyao" });
  assert.equal(bundle.experienceVersion, "EXPERIENCE_ORCHESTRATION_V1");
  assert.equal(bundle.productResultFacts.productFactsVersion, "LIUYAO_PRODUCT_RESULT_FACTS_V2");
  assert.ok(judgmentFactsSignature(bundle.productResultFacts)?.overallState);
  assert.ok(bundle.guidedViewModel.overallAssessment?.label);
  assert.ok(bundle.guidedViewModel.directAnswer);
  assert.equal(bundle.guidedViewModel.decisionSupport?.scenario, "JOB_SEARCH");
  assert.ok(bundle.guidedViewModel.decisionSupport?.dimensions.length >= 4);
  assert.ok(bundle.guidedViewModel.decisionSupport?.proceedConditions.length >= 2);
  assert.ok(bundle.guidedViewModel.decisionSupport?.holdConditions.length >= 2);
  assert.equal(bundle.guidedViewModel.decisionSupport?.actionTimeline.length, 3);
  assert.ok(bundle.guidedViewModel.headline);
  assert.ok(bundle.guidedViewModel.nextActions.length >= 3);
  assert.ok(bundle.professionalViewModel.chartSummary.title);
  assert.ok(bundle.professionalViewModel.auditChain?.overallAssessment?.patternName);
  assert.ok(bundle.professionalViewModel.auditChain?.evidenceResolution?.summary);
  assert.ok(bundle.professionalViewModel.auditChain?.timing);
  assert.equal(bundle.adminViewModel, undefined);
  assert.equal(bundle.pageExperience.visualHierarchy.Admin, undefined);
  const publicText = JSON.stringify({ guided: bundle.guidedViewModel, professional: bundle.professionalViewModel });
  for (const forbidden of [
    "AI_REPORT_V1",
    "OPENAI_LIVE",
    "promptVersion",
    "requestId",
    "ruleFindingId",
    "subject_state",
    "Candidate window",
    "officer_ghost",
    "CORE_V1_REPORT_TEMPLATE_LIGHT",
    "月建关系作为时间环境证据",
    "日辰关系作为短期压力",
  ]) {
    assert.ok(!publicText.includes(forbidden), forbidden);
  }
  assert.match(bundle.guidedViewModel.timingHint, /不是保证日期/u);
  assert.ok(bundle.professionalViewModel.knowledgeRefs.every((item) => /卦$/u.test(item.title)));
});

test("Liuyao visualization bundle registers P0 and P1 visuals with same-ViewModel static export", () => {
  const bundle = buildExperienceBundle({ result: liuyaoResult(), type: "liuyao" });
  const visualization = bundle.visualization;
  assert.equal(LIUYAO_VISUAL_SYSTEM_VERSION, "LIUYAO_VISUAL_SYSTEM_V1");
  assert.equal(LIUYAO_VISUAL_REGISTRY.length, 14);
  assert.equal(visualization.visualSystemVersion, "LIUYAO_VISUAL_SYSTEM_V1");
  assert.equal(visualization.packageStatus, "DATA_IMPORTED");
  assert.equal(visualization.p0VisualIds.length, 10);
  assert.deepEqual(visualization.p0VisualIds, [
    "VIS-LY-001",
    "VIS-LY-002",
    "VIS-LY-003",
    "VIS-LY-004",
    "VIS-LY-005",
    "VIS-LY-006",
    "VIS-LY-007",
    "VIS-LY-008",
    "VIS-LY-009",
    "VIS-LY-010",
  ]);
  assert.deepEqual(visualization.p1VisualIds, ["VIS-LY-011", "VIS-LY-012", "VIS-LY-013", "VIS-LY-014"]);
  assert.equal(visualization.readiness, "P0_P1_READY_WITH_STATIC_EXPORT");
  assert.equal(visualization.staticExport.status, "IMPLEMENTED_SAME_VIEWMODEL_SVG_PRINT_PDF");
  assert.ok(visualization.contextMapping.staticExport.includes("VIS-LY-011"));
  assert.ok(visualization.contextMapping.staticExport.includes("VIS-LY-014"));
  const board = visualization.viewModels["VIS-LY-001"];
  assert.equal(board.noRecompute, true);
  assert.equal(board.readingOrder, "top_to_bottom_display");
  assert.equal(board.castingOrder, "bottom_to_top_source");
  assert.equal(board.lines[0].position, 6);
  assert.equal(board.lines.at(-1).position, 1);
  assert.ok(board.lines.some((line) => line.isWorld));
  assert.ok(board.lines.some((line) => line.isResponse));
  assert.ok(visualization.viewModels["VIS-LY-004"].roles.length >= 1);
  const strengthMatrix = visualization.viewModels["VIS-LY-007"];
  assert.equal(strengthMatrix.mode, "qualitative_no_score");
  assert.equal(strengthMatrix.lineStates.length, 6);
  assert.ok(strengthMatrix.lineStates.every((line) => line.monthInfluence?.effect && line.dayInfluence?.effect));
  assert.ok(strengthMatrix.lineStates.some((line) => line.isWorld));
  assert.ok(strengthMatrix.lineStates.some((line) => line.isResponse));
  assert.ok(Array.isArray(visualization.viewModels["VIS-LY-011"].actions));
  assert.ok(Array.isArray(visualization.viewModels["VIS-LY-014"].steps));
});

test("Ambiguous join question stays static and asks for the missing identity before deciding", () => {
  const bundle = buildExperienceBundle({ result: staticPartnershipResult(), type: "liuyao" });
  const publicText = JSON.stringify(bundle);

  assert.deepEqual(bundle.productResultFacts.chartFacts.movingLines, []);
  assert.equal(bundle.productResultFacts.overallAssessmentFacts.dynamicDirection, "STATIC_OR_UNCLEAR");
  assert.notEqual(bundle.productResultFacts.overallAssessmentFacts.overallState, "TRANSITIONAL");
  assert.equal(bundle.guidedViewModel.decisionSupport.scenario, "BUSINESS_PARTNERSHIP");
  assert.equal(bundle.guidedViewModel.decisionSupport.dimensions.length, 4);
  assert.equal(bundle.productResultFacts.questionProfile.clarificationRequired, true);
  assert.equal(bundle.productResultFacts.topicLens.status, "BRANCHED");
  assert.equal(bundle.productResultFacts.decisionFacts.status, "BRANCHED_ASSESSMENT");
  assert.match(bundle.guidedViewModel.directAnswer, /先明确你准备以什么身份加入/u);
  assert.equal(bundle.guidedViewModel.questionClarification.required, true);
  assert.doesNotMatch(publicText, /对方.{0,8}明显制约/u);
  assert.match(publicText, /项目责任、规则与执行压力/u);
  assert.match(bundle.guidedViewModel.decisionSupport.hexagramChain.changed, /静卦，没有变卦/u);
  assert.doesNotMatch(publicText, /第 - 爻发动|正在进入变化过程|已有变化动力/u);
  assert.ok(!bundle.contentExplanationSnippets.some((item) => item.category === "DYNAMICS"));
});

test("Confirmed project cooperation uses compound evidence instead of generic role polarity", () => {
  const bundle = buildExperienceBundle({ result: confirmedProjectCooperationResult(), type: "liuyao" });
  const nodes = bundle.productResultFacts.evidenceGraph.decisionNodes;

  assert.equal(bundle.productResultFacts.questionProfile.joinMode, "PROJECT_COOPERATION");
  assert.equal(bundle.productResultFacts.topicLens.activeLabel, "项目合作");
  assert.equal(bundle.productResultFacts.decisionFacts.status, "READY");
  assert.match(bundle.guidedViewModel.directAnswer, /小范围验证|暂不建议直接加入/u);
  assert.equal(bundle.guidedViewModel.questionClarification, null);
  assert.deepEqual(nodes.find((item) => item.id === "evidence:CONTRACT_SUPPORTED_BUT_UNSETTLED")?.factRefs, ["line:2", "line:5"]);
  assert.match(nodes.find((item) => item.id === "evidence:RESPONSIBILITY_AND_RULE_PRESSURE_ACTIVE")?.meaning ?? "", /政府项目责任/u);
  assert.match(nodes.find((item) => item.id === "evidence:SELF_INPUT_FEEDS_RESPONSIBILITY")?.meaning ?? "", /先投入能力、时间或资源/u);
  assert.match(nodes.find((item) => item.id === "evidence:STATIC_CHART")?.meaning ?? "", /没有动爻/u);
  assert.ok(bundle.professionalViewModel.evidenceGroups.risks.every((item) => item.evidenceKind === "综合证据"));
});

test("Liuyao scene selection drives automatic observation focus without user yongshen confirmation", () => {
  const result = createLiuyaoChart({
    question: "这笔收入能否顺利到账？",
    topic: "wealth",
    subtype: "income",
    values: [7, 8, 9, 7, 8, 6],
    calendar: { timezone: "Asia/Shanghai" },
  });
  result.narrativeReport = buildLiuyaoReport(result);
  const bundle = buildExperienceBundle({ result, type: "liuyao" });
  const publicText = JSON.stringify({ guided: bundle.guidedViewModel, professional: bundle.professionalViewModel });

  assert.match(bundle.guidedViewModel.observationFocus.summary, /妻财/u);
  assert.match(bundle.guidedViewModel.observationFocus.summary, /世爻/u);
  assert.match(bundle.guidedViewModel.summary, /第 \d+ 爻/u);
  assert.ok(!bundle.guidedViewModel.summary.includes("时间环境对事情有一定承托"));
  assert.ok(!bundle.guidedViewModel.summary.includes("短期节奏里有扰动"));
  assert.ok(!publicText.includes("job_search"));
  assert.ok(!publicText.includes("officer_ghost"));
  assert.ok(!publicText.includes("请确认用神"));
});

test("Relationship scene adds user-facing guidance without changing formal assessment facts", () => {
  const result = createLiuyaoChart({
    question: "未来三个月，这段关系是否适合继续推进？",
    topic: "relationship",
    subtype: "relationship_stability",
    values: [8, 6, 8, 6, 9, 8],
    calendar: { timezone: "Asia/Shanghai" },
  });
  result.narrativeReport = buildLiuyaoReport(result);
  const bundle = buildExperienceBundle({ result, type: "liuyao" });
  const guidance = bundle.guidedViewModel.scenarioGuidance;

  assert.equal(guidance.scenario, "RELATIONSHIP");
  assert.match(guidance.headline, /这段关系/u);
  assert.ok(guidance.decisionFocus);
  assert.ok(guidance.selfSignal.summary);
  assert.ok(guidance.otherSignal.summary);
  assert.deepEqual(
    guidance.nextSteps,
    bundle.productResultFacts.actionGuidanceFacts.items.slice(0, 3),
  );
  assert.equal(
    bundle.guidedViewModel.overallAssessment.state,
    bundle.productResultFacts.overallAssessmentFacts.overallState,
  );
});

test("Admin viewmodel is only present when explicitly requested", () => {
  const bundle = buildExperienceBundle({ result: liuyaoResult(), type: "liuyao", includeAdmin: true });
  assert.ok(bundle.adminViewModel.rawFacts.chart);
  assert.ok(bundle.adminViewModel.sourceVersions);
  assert.ok(bundle.pageExperience.visualHierarchy.Admin.includes("rawFacts"));
});

test("Meihua facts share the same presentation contract", () => {
  const bundle = buildExperienceBundle({ result: meihuaResult(), type: "meihua" });
  assert.equal(bundle.guidedViewModel.reportType, "梅花");
  assert.ok(bundle.professionalViewModel.chartSummary.mutualHexagram);
  assert.ok(bundle.professionalViewModel.chartSummary.bodyTrigram);
});

test("Evidence deduplicator merges repeated signals without deleting child evidence", () => {
  const items = deduplicateSignals([
    { title: "外部支持明显", text: "外部支持明显", polarity: "SUPPORT", dimension: "supporting_forces", sourceRef: "a" },
    { title: "外部支持明显。", text: "外部支持明显。", polarity: "SUPPORT", dimension: "supporting_forces", sourceRef: "b" },
  ]);
  assert.equal(items.length, 1);
  assert.equal(items[0].mergedCount, 2);
  assert.deepEqual(items[0].sourceRefs, ["a", "b"]);
});

test("Terminology formatter maps product statuses and relationships to user language", () => {
  assert.equal(formatStatus("MIXED"), "有利有阻");
  assert.equal(formatRelationship("body_controls_use"), "体克用");
  assert.equal(formatStatus("NOT_REAL"), "状态待确认");
  const allowedCategories = new Set(["method", "chart", "liuyao", "calendar", "relationship", "meihua", "status"]);
  for (const entry of Object.values(TERMINOLOGY_REGISTRY)) {
    assert.ok(allowedCategories.has(entry.category), entry.internalCode);
    assert.match(entry.priority, /^P[0-3]$/u, entry.internalCode);
    assert.ok(entry.unknownFallback);
  }
});

test("Key product pages and states have formal experience contracts", () => {
  for (const state of [
    "INITIAL",
    "LOADING",
    "PARSING",
    "NEEDS_CONFIRMATION",
    "PROCESSING",
    "PARTIAL",
    "COMPLETED",
    "EMPTY",
    "LOCKED",
    "UNAUTHORIZED",
    "FORBIDDEN",
    "FAILED",
    "EXPIRED",
    "ARCHIVED",
    "NOT_FOUND",
    "DELETED",
  ]) {
    assert.ok(PAGE_STATE_CONTRACT[state].message);
    assert.ok(PAGE_STATE_CONTRACT[state].primaryAction);
  }
  for (const pageId of ["casting.liuyao", "casting.meihua", "report.detail", "history", "content.knowledge", "content.tutorial"]) {
    const contract = PAGE_EXPERIENCE_CONTRACTS[pageId];
    assert.equal(contract.pageId, pageId);
    assert.ok(contract.pageGoal);
    assert.ok(contract.primaryQuestion);
    assert.ok(contract.primaryAction);
    assert.ok(contract.visualHierarchy.L1.length > 0);
  }
});
