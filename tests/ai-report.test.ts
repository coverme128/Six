import assert from "node:assert/strict";
import test from "node:test";

import {
  AIReportValidationError,
  DeepSeekReportProvider,
  MockAIReportProvider,
  buildAIProviderPayload,
  buildAIReportInput,
  createAnonymousAILimiter,
  generateGroundedAIReport,
  redactQuestionForAI,
  validateAIReport,
  validateAIPlainLanguage,
  validateAIReportSchema,
} from "@six/domain/ai-report";
import { createLiuyaoChart } from "@six/domain/liuyao";
import { createMeihuaChart } from "@six/domain/meihua";
import { buildExperienceBundle, judgmentFactsSignature } from "@six/domain/presentation";
import { buildLiuyaoReport, buildMeihuaReport } from "@six/domain/report-builder";

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
  assert.equal(input.productResultFactsVersion, "LIUYAO_PRODUCT_RESULT_FACTS_V1");
  assert.ok(input.overallAssessmentFacts.overallState);
  assert.ok(input.conflictResolutionFacts.conflictState);
  assert.ok(input.actionGuidanceFacts.items.length > 0);
  assert.ok(input.deterministicJudgmentSignature.overallState);
  assert.ok(!("candidateRulePool" in input));
  assert.ok(input.matchedRuleFindings.every((finding) => finding.id.startsWith("rule:")));
});

test("DeepSeek provider uses the official Responses endpoint and minimizes provider payload", () => {
  const provider = new DeepSeekReportProvider({ apiKey: "test-key", rootDir: ROOT });
  assert.equal(provider.provider, "deepseek");
  assert.equal(provider.model, "deepseek-v4-flash");
  assert.equal(provider.endpoint, "https://api.deepseek.com/responses");

  const input = buildAIReportInput({ result: liuyaoResult(), type: "liuyao" });
  const payload = buildAIProviderPayload(input);
  assert.equal(payload.reportId, undefined);
  assert.equal(payload.inputHash, undefined);
  assert.equal(payload.questionContext.questionDigest, undefined);
  assert.equal(payload.versions.promptVersion, "liuyao-report-v2");
  assert.doesNotMatch(JSON.stringify(payload), /空亡|回头生|月建|日辰|同支日/u);
});

test("AI question redaction removes common direct identifiers before provider use", () => {
  const redacted = redactQuestionForAI("联系 13800138000，邮箱 user@example.com，证件 11010519491231002X");
  assert.equal(redacted, "联系 [已隐藏手机号]，邮箱 [已隐藏邮箱]，证件 [已隐藏证件号]");
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

  const cautious = structuredClone(output);
  cautious.timingWindows[0].text = "该窗口不一定出现明显变化，需要继续观察。";
  assert.doesNotThrow(() => validateAIReport(cautious, input));
});

test("plain-language validator rejects unexplained jargon and invented review intervals", async () => {
  const input = buildAIReportInput({ result: liuyaoResult(), type: "liuyao" });
  const jargon = await validOutput(input);
  jargon.currentSituation = "对方目前处于空亡状态。";
  assert.throws(() => validateAIPlainLanguage(jargon), /professional terminology/u);

  const inventedTiming = await validOutput(input);
  inventedTiming.actionSuggestions = ["一周后重新评估。", "观察现实变化。"];
  assert.throws(() => validateAIPlainLanguage(inventedTiming), /unsupported time interval/u);
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
    assert.equal(bundle.productStatus, "PARTIAL_AI_UNAVAILABLE", mode);
    assert.equal(bundle.fallbackUsed, true, mode);
    assert.ok(bundle.deterministicReport, mode);
    assert.ok(bundle.deterministicJudgmentSignature, mode);
  }
});

test("live providers retry one validation failure before deterministic fallback", async () => {
  const result = liuyaoResult();
  const provider = new MockAIReportProvider({ mode: "success" });
  const generateValid = provider.generateReport.bind(provider);
  let calls = 0;
  provider.provider = "deepseek";
  provider.generateReport = async (input) => {
    calls += 1;
    const output = await generateValid(input);
    if (calls === 1) output.factClaims.originalHexagram = "乾";
    return output;
  };
  const bundle = await generateGroundedAIReport({ result, type: "liuyao", provider });
  assert.equal(bundle.validationStatus, "VALID");
  assert.equal(bundle.attemptCount, 2);
  assert.equal(calls, 2);
});

test("live provider output translates known technical terms before public display", async () => {
  const result = liuyaoResult();
  const provider = new MockAIReportProvider({ mode: "success" });
  const generateValid = provider.generateReport.bind(provider);
  provider.provider = "deepseek";
  provider.generateReport = async (input) => {
    const output = await generateValid(input);
    output.currentSituation = "对方目前处于空亡状态，后续可看同支日/月。";
    return output;
  };
  const bundle = await generateGroundedAIReport({ result, type: "liuyao", provider });
  assert.equal(bundle.validationStatus, "VALID");
  assert.equal(bundle.attemptCount, 1);
  assert.doesNotMatch(bundle.aiReport.currentSituation, /空亡|同支日/u);
});

test("DETERMINISTIC_ASSESSMENT_FIDELITY keeps AI ON and OFF judgment facts identical", async () => {
  const result = liuyaoResult();
  const aiOffExperience = buildExperienceBundle({ result, type: "liuyao" });
  const aiOffSignature = judgmentFactsSignature(aiOffExperience.productResultFacts);

  const validBundle = await generateGroundedAIReport({ result, type: "liuyao", provider: new MockAIReportProvider({ mode: "success" }) });
  const aiOnExperience = buildExperienceBundle({
    result: { ...result, aiReportBundle: validBundle, productResultFacts: aiOffExperience.productResultFacts },
    type: "liuyao",
  });
  assert.deepEqual(judgmentFactsSignature(aiOnExperience.productResultFacts), aiOffSignature);

  const fallbackBundle = await generateGroundedAIReport({ result, type: "liuyao", provider: new MockAIReportProvider({ mode: "throw" }) });
  const fallbackExperience = buildExperienceBundle({
    result: { ...result, aiReportBundle: fallbackBundle, productResultFacts: aiOffExperience.productResultFacts },
    type: "liuyao",
  });
  assert.deepEqual(judgmentFactsSignature(fallbackExperience.productResultFacts), aiOffSignature);
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
