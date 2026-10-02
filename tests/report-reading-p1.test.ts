import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolveReportEvidence } from "../apps/web/app/lib/report-evidence";
import type { LiuyaoChartViewModel } from "../apps/web/app/lib/api";
import { buildAIReportInput, buildAIProviderPayload } from "@six/domain/ai-report";
import { createLiuyaoChart } from "@six/domain/liuyao";

const chart: LiuyaoChartViewModel = { type: "liuyao", originalHexagram: "升", changedHexagram: "升", movingLines: [], worldLine: 4, responseLine: 1, lines: Array.from({ length: 6 }, (_, i) => ({ position: i + 1 })) };
test("every v9 numeric evidence reference maps to the exact live-provider input finding", () => {
  const result = createLiuyaoChart({ question: "是否适合接受工作？", topic: "career", subtype: "job_search", values: [7, 8, 9, 7, 8, 6], calendar: { instantUtc: "2026-07-21T01:00:00Z", timezone: "Asia/Shanghai" } }, process.cwd());
  for (const profile of [undefined, { profileVersion: "LIUYAO_QUESTION_PROFILE_V2" }]) {
    result.chart.questionProfile = profile;
    const payload = buildAIProviderPayload(buildAIReportInput({ result, type: "liuyao" }));
    for (const finding of payload.matchedRuleFindings) {
      const resolved = resolveReportEvidence([finding.id], chart, { result, aiReportBundle: { promptVersion: "liuyao-report-v9" } });
      assert.deepEqual(resolved.unresolved, [], finding.id);
      assert.equal(resolved.sources[0].text, finding.summary, finding.id);
    }
  }
});
test("unknown prompt versions must not guess numeric evidence mapping", () => {
  assert.deepEqual(resolveReportEvidence(["evidence:1"], chart, { result: { report: { evidence: [{ summary: "test" }] } }, aiReportBundle: { promptVersion: "future" } }).unresolved, ["evidence:1"]);
});
test("static chart references never invent changed or moving lines", () => {
  const result = resolveReportEvidence(["chart:changed_hexagram", "chart:moving_lines"], chart, null);
  assert.deepEqual(result.lines, []);
  assert.equal(result.sources[0].text, "静卦，无变卦");
  assert.deepEqual(result.unresolved, []);
});
test("world/response references highlight only stored positions, unknown IDs stay unresolved", () => {
  const result = resolveReportEvidence(["chart:world_response", "chart:world_response", "rule:line_6"], chart, null);
  assert.deepEqual(result.lines, [4, 1]);
  assert.equal(result.sources.length, 1);
  assert.deepEqual(result.unresolved, ["rule:line_6"]);
});
test("a rule shared by multiple findings retains every referenced line", () => {
  const result = resolveReportEvidence(["rule:VOID"], chart, { result: { findings: [
    { id: "a", rule_code: "VOID", summary: "二爻空", input_facts: { linePosition: 2 } },
    { id: "b", rule_code: "VOID", summary: "五爻空", input_facts: { linePosition: 5 } },
  ] } });
  assert.deepEqual(result.lines, [2, 5]);
  assert.equal(result.sources[0].text, "二爻空；五爻空");
  assert.equal(result.sources[0].kind, "规则解释");
});
test("composite evidence uses stored fact refs, not numbers in prose", () => {
  const result = resolveReportEvidence(["evidence:contract"], chart, { experience: { productResultFacts: { evidenceGraph: { nodes: [
    { id: "evidence:contract", ruleId: "CONTRACT", meaning: "需核对六项条件", factRefs: ["line:2", "line:5", "line:99"] },
  ] } } } });
  assert.deepEqual(result.lines, [2, 5]);
  assert.deepEqual(result.unresolved, []);
});
test("calendar and timing references are displayed without guessed line links", () => {
  const result = resolveReportEvidence(["calendar:month_build", "timing:1"], chart, { result: {
    chart: { calendar: { monthBuild: { branchName: "申" } } }, timingCandidates: [{ window: "后续丑日", limitation: "非保证日期" }],
  } });
  assert.deepEqual(result.lines, []);
  assert.equal(result.sources[0].text, "申");
  assert.match(result.sources[1].text, /非保证日期/);
});
test("legacy void-branch text and modern arrays both resolve without breaking other evidence", () => {
  for (const value of ["寅卯", ["寅", "卯"]]) {
    const result = resolveReportEvidence(["calendar:xun_kong", "missing:ref"], chart, { result: { chart: { calendar: { xun: { voidBranchNames: value } } } } });
    assert.match(result.sources[0].text, /寅/);
    assert.deepEqual(result.unresolved, ["missing:ref"]);
  }
});
test("report is answer-first with actions before detailed reasoning, and no duplicate takeaway", () => {
  const source = readFileSync("apps/web/app/reports/[id]/ReportDetailClient.tsx", "utf8");
  assert.ok(source.indexOf('className="report-overview"') < source.indexOf('id="report-chart"'));
  assert.ok(source.indexOf('id="action-plan-title"') < source.indexOf('id="key-judgments-title"'));
  assert.doesNotMatch(source, /className="ai-final-takeaway"/);
  for (const target of ["ai-plain-language", "report-chart", "professional-evidence"]) assert.ok(source.includes(`href="#${target}"`));
});
test("cast entry separates user intents and exposes no duplicate digital method", () => {
  const source = readFileSync("apps/web/app/SixApiDemo.tsx", "utf8");
  assert.match(source, /switchLiuyaoCastMode\("coins"\); moveToStep\("cast-step"\); }}>自己逐爻摇/);
  assert.match(source, /switchLiuyaoCastMode\("manual"\); moveToStep\("cast-step"\); }}>录入已有卦/);
  assert.doesNotMatch(source, /onClick=\{\(\) => switchLiuyaoCastMode\("digitalCoins"\)\}/);
  assert.match(source, /正在排盘并保存报告/);
  assert.match(source, /requestId: castId/);
});
