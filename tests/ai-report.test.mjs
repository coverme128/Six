import assert from "node:assert/strict";
import test from "node:test";

import {
  AIReportValidationError,
  MockAIReportProvider,
  buildAIReportInput,
  createAnonymousAILimiter,
  generateGroundedAIReport,
  validateAIReport,
  validateAIReportSchema,
} from "../src/domain/aiReport.mjs";
import { createLiuyaoChart } from "../src/domain/liuyaoEngine.mjs";
import { createMeihuaChart } from "../src/domain/meihuaEngine.mjs";
import { buildLiuyaoReport, buildMeihuaReport } from "../src/domain/reportBuilder.mjs";

const ROOT = process.cwd();

function liuyaoResult() {
  const result = createLiuyaoChart({
    question: "P2 AI 报告是否可信？",
    topic: "career",
    subtype: "job_search",
    values: [7, 8, 9, 7, 8, 6],
    calendar: { instantUtc: "2026-07-21T01:00:00Z", timezone: "Asia/Shanghai" },
  }, ROOT);
  result.narrativeReport = buildLiuyaoReport(result);
  return result;
}

function meihuaResult() {
  const result = createMeihuaChart({
    question: "梅花 AI 报告是否可信？",
    methodCode: "MEIHUA_TWO_NUMBER_V1",
    number_a: 7,
    number_b: 12,
  }, ROOT);
  result.narrativeReport = buildMeihuaReport(result);
  return result;
}

async function validOutput(input) {
  return new MockAIReportProvider({ mode: "success" }).generateReport(input);
}

test("AIReportInput contains only grounded chart, calendar and matched evidence facts", () => {
  const input = buildAIReportInput({ result: liuyaoResult(), type: "liuyao" });
  assert.equal(input.reportType, "LIUYAO");
  assert.equal(input.versions.calendarProvider, "lunar-javascript");
  assert.equal(input.versions.aiSchemaVersion, "AI_REPORT_V1");
  assert.ok(input.questionContext.questionDigest.sha256);
  assert.ok(!("candidateRulePool" in input));
  assert.ok(input.matchedRuleFindings.every((finding) => finding.id.startsWith("rule:")));
});

test("valid AI output passes schema, fidelity and safety validation", async () => {
  const input = buildAIReportInput({ result: liuyaoResult(), type: "liuyao" });
  const output = await validOutput(input);
  const validated = validateAIReport(output, input);
  assert.equal(validated.schemaVersion, "AI_REPORT_V1");
});

test("schema validator rejects missing field, illegal enum and illegal evidenceRef", async () => {
  const input = buildAIReportInput({ result: liuyaoResult(), type: "liuyao" });
  const output = await validOutput(input);

  const missing = structuredClone(output);
  delete missing.summary;
  assert.throws(() => validateAIReportSchema(missing, input), /summary/u);

  const badEnum = structuredClone(output);
  badEnum.outcomeTrend.label = "CERTAIN";
  assert.throws(() => validateAIReportSchema(badEnum, input), /outcomeTrend/u);

  const badRef = structuredClone(output);
  badRef.supportingFactors[0].evidenceRefs = ["rule:NOT_MATCHED"];
  assert.throws(() => validateAIReportSchema(badRef, input), /unknown evidence/u);
});

test("fidelity validator rejects changed chart facts and unhit or review rules", async () => {
  const input = buildAIReportInput({ result: liuyaoResult(), type: "liuyao" });
  const output = await validOutput(input);

  const changedOriginal = structuredClone(output);
  changedOriginal.factClaims.originalHexagram = "乾";
  assert.throws(() => validateAIReport(changedOriginal, input), /Original hexagram changed/u);

  const changedTarget = structuredClone(output);
  changedTarget.factClaims.changedHexagram = "坤";
  assert.throws(() => validateAIReport(changedTarget, input), /Changed hexagram changed/u);

  const reviewRef = structuredClone(output);
  reviewRef.supportingFactors[0].evidenceRefs = ["rule:REVIEW_REQUIRED_FAKE"];
  assert.throws(() => validateAIReport(reviewRef, input), /unknown evidence|non-public/u);
});

test("timing validator rejects created exact dates and guaranteed timing language", async () => {
  const input = buildAIReportInput({ result: liuyaoResult(), type: "liuyao" });
  const output = await validOutput(input);

  const exactDate = structuredClone(output);
  exactDate.timingWindows[0].text = "会在 2026-08-01 兑现。";
  assert.throws(() => validateAIReport(exactDate, input), /guaranteed|unsafe|certain|over-certain/u);

  const guaranteed = structuredClone(output);
  guaranteed.timingWindows[0].text = "该候选窗口必定兑现。";
  assert.throws(() => validateAIReport(guaranteed, input), /guaranteed language/u);
});

test("type isolation rejects Liuyao reports with Meihua-only fields and Meihua reports with Liuyao-only fields", async () => {
  const liuyaoInput = buildAIReportInput({ result: liuyaoResult(), type: "liuyao" });
  const liuyaoOutput = await validOutput(liuyaoInput);
  liuyaoOutput.currentSituation = "这里混入体卦和用卦。";
  assert.throws(() => validateAIReport(liuyaoOutput, liuyaoInput), /Meihua-only/u);

  const meihuaInput = buildAIReportInput({ result: meihuaResult(), type: "meihua" });
  const meihuaOutput = await validOutput(meihuaInput);
  meihuaOutput.currentSituation = "这里混入纳甲、六亲、六神和世爻。";
  assert.throws(() => validateAIReport(meihuaOutput, meihuaInput), /Liuyao-only/u);
});

test("provider failures and invalid outputs always fall back to deterministic report", async () => {
  for (const mode of ["throw", "empty", "invalid_json", "bad_fact", "bad_ref", "unsafe"]) {
    const result = liuyaoResult();
    const bundle = await generateGroundedAIReport({ result, type: "liuyao", provider: new MockAIReportProvider({ mode }) });
    assert.equal(bundle.validationStatus, "FALLBACK", mode);
    assert.equal(bundle.fallbackUsed, true, mode);
    assert.ok(bundle.deterministicReport, mode);
  }
});

test("valid AI report can be saved and reused for the same report", async () => {
  const result = liuyaoResult();
  const first = await generateGroundedAIReport({ result, type: "liuyao", provider: new MockAIReportProvider({ mode: "success" }) });
  assert.equal(first.validationStatus, "VALID");
  assert.equal(first.reportSource, "OPENAI_LIVE");
  assert.ok(Number.isFinite(first.latencyMs));
  result.aiReportBundle = first;
  const second = await generateGroundedAIReport({ result, type: "liuyao", provider: new MockAIReportProvider({ mode: "throw" }) });
  assert.equal(second.reused, true);
  assert.equal(second.validationStatus, "VALID");
  assert.equal(second.reportSource, "CACHE_REUSE");
});

test("anonymous AI limiter enforces device and IP short-window limits", () => {
  const limiter = createAnonymousAILimiter({ maxPerIp: 2, maxPerDevice: 1, windowMs: 1000, now: () => 1 });
  limiter.assertAllowed({ ip: "1.1.1.1", deviceId: "a" });
  assert.throws(() => limiter.assertAllowed({ ip: "1.1.1.1", deviceId: "a" }), AIReportValidationError);
  limiter.assertAllowed({ ip: "1.1.1.1", deviceId: "b" });
  assert.throws(() => limiter.assertAllowed({ ip: "1.1.1.1", deviceId: "c" }), AIReportValidationError);
});
