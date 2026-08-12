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

test("Experience bundle builds guided and professional viewmodels without admin leakage", () => {
  const bundle = buildExperienceBundle({ result: liuyaoResult(), type: "liuyao" });
  assert.equal(bundle.experienceVersion, "EXPERIENCE_ORCHESTRATION_V1");
  assert.equal(bundle.productResultFacts.productFactsVersion, "LIUYAO_PRODUCT_RESULT_FACTS_V1");
  assert.ok(judgmentFactsSignature(bundle.productResultFacts)?.overallState);
  assert.ok(bundle.guidedViewModel.overallAssessment?.label);
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

test("Liuyao visualization bundle registers P0 visuals from presentation facts without export overclaim", () => {
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
  assert.equal(visualization.staticExport.status, "DESIGN_READY_IMPLEMENTATION_PENDING");
  const board = visualization.viewModels["VIS-LY-001"];
  assert.equal(board.noRecompute, true);
  assert.equal(board.readingOrder, "top_to_bottom_display");
  assert.equal(board.castingOrder, "bottom_to_top_source");
  assert.equal(board.lines[0].position, 6);
  assert.equal(board.lines.at(-1).position, 1);
  assert.ok(board.lines.some((line) => line.isWorld));
  assert.ok(board.lines.some((line) => line.isResponse));
  assert.ok(visualization.viewModels["VIS-LY-004"].roles.length >= 1);
  assert.equal(visualization.viewModels["VIS-LY-007"].mode, "qualitative_no_score");
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
