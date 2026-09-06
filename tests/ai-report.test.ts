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

function staticPartnershipResult() {
  const result = createLiuyaoChart({
    question: "朋友做政务系统，邀请我加入，我是否应该加入？",
    topic: "business",
    subtype: "partnership",
    values: [8, 7, 7, 8, 8, 8],
    calendar: { instantUtc: "2026-08-27T07:27:31Z", timezone: "Asia/Shanghai" },
  }, ROOT);
  result.narrativeReport = buildLiuyaoReport(result);
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
  assert.equal(input.productResultFactsVersion, "LIUYAO_PRODUCT_RESULT_FACTS_V2");
  assert.equal(input.questionProfile.profileVersion, "LIUYAO_QUESTION_PROFILE_V1");
  assert.equal(input.topicLens.lensVersion, "LIUYAO_TOPIC_LENS_V1");
  assert.equal(input.evidenceGraph.graphVersion, "LIUYAO_EVIDENCE_GRAPH_V1");
  assert.equal(input.decisionFacts.decisionFactsVersion, "LIUYAO_DECISION_FACTS_V1");
  assert.ok(input.overallAssessmentFacts.overallState);
  assert.ok(input.conflictResolutionFacts.conflictState);
  assert.ok(input.actionGuidanceFacts.items.length > 0);
  assert.ok(input.decisionSupportFacts.directAnswer);
  assert.equal(input.decisionSupportFacts.scenarioCode, "JOB_SEARCH");
  assert.equal(input.chartFacts.lineFacts.length, 6);
  assert.ok(input.chartFacts.lineFacts.some((line) => line.moving));
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
  assert.equal(payload.versions.promptVersion, "liuyao-report-v9");
  assert.equal(payload.chartFacts.lineFacts.length, 6);
  assert.equal(payload.interpretationContract.mode, "QUESTION_FIRST");
  assert.equal(payload.questionContext.question, "P2 AI 报告是否可信？");
  assert.equal(payload.questionContext.topicCode, undefined);
  assert.equal(payload.decisionFacts, undefined);
  assert.ok(payload.allowedEvidenceRefs.length > 0);
  assert.ok(payload.matchedRuleFindings.every((finding) => finding.ruleType !== "yongshen"));
  assert.ok(payload.matchedRuleFindings.every((finding) => /^evidence:\d+$/u.test(finding.id)));
  assert.ok(payload.matchedRuleFindings.every((finding) => finding.ruleCode === undefined));
  assert.ok(payload.chartFacts.lineFacts.every((line) => !String(line.sixRelationName).includes("岗位与项目责任")));
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
  assert.match(validated.questionResponse.focus, /P2 AI 报告是否可信/u);
  assert.match(validated.hexagramReading.original, new RegExp(input.chartFacts.originalHexagram, "u"));
  assert.ok(validated.keyJudgments.length >= 3);
  assert.ok(validated.actionPlan.now.length >= 1);
});

test("schema validator rejects missing field, illegal enum and illegal evidenceRef", async () => {
  const input = buildAIReportInput({ result: liuyaoResult(), type: "liuyao" });
  const output = await validOutput(input);

  const missing = structuredClone(output);
  delete missing.finalTakeaway;
  assert.throws(() => validateAIReportSchema(missing, input), /finalTakeaway/u);

  const missingActions = structuredClone(output);
  missingActions.actionPlan.now = [];
  assert.throws(() => validateAIReportSchema(missingActions, input), /actionPlan.now/u);

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

  const inventedOperatingPeriod = await validOutput(input);
  inventedOperatingPeriod.actionPlan.now[0].text = "确认资金足以支撑至少一年的运营。";
  assert.throws(() => validateAIPlainLanguage(inventedOperatingPeriod), /quantified operating/u);

  const internalCode = await validOutput(input);
  internalCode.actionPlan.now[0].text = "根据 RESPONSE_GENERATES_WORLD 继续推进。";
  assert.throws(() => validateAIPlainLanguage(internalCode), /internal evidence/u);
});

test("question-first interpretation separates terminology quality from blocking safety gates", async () => {
  const input = buildAIReportInput({ result: liuyaoResult(), type: "liuyao" });
  const output = await validOutput(input);
  output.hexagramReading.original = "世爻表示本次观察中的主体位置，不能据此断言你的现实状况。";
  output.keyJudgments[0].plainInterpretation = "空亡是传统盘面状态，不证明合同没有落实，应核对书面约定。";
  const warnings: any[] = [];
  assert.doesNotThrow(() => validateAIPlainLanguage(output, { questionFirst: true, warnings }));
  assert.equal(warnings[0].code, "READABILITY_TERMINOLOGY");
  output.actionPlan.now[0].text = "一周后一定落实。";
  assert.throws(() => validateAIPlainLanguage(output, { questionFirst: true }), /unsupported time interval/u);
});

test("type isolation rejects Liuyao reports with Meihua-only fields and Meihua reports with Liuyao-only fields", async () => {
  const liuyaoInput = buildAIReportInput({ result: liuyaoResult(), type: "liuyao" });
  const liuyaoOutput = await validOutput(liuyaoInput);
  liuyaoOutput.currentSituation = "这里混入体卦和用卦。";
  assert.throws(() => validateAIReport(liuyaoOutput, liuyaoInput), /Meihua-only/u);

  const ordinaryLiuyaoOutput = await validOutput(liuyaoInput);
  ordinaryLiuyaoOutput.currentSituation = "使用卦象时仍应核对现实条件。";
  assert.doesNotThrow(() => validateAIReport(ordinaryLiuyaoOutput, liuyaoInput));

  for (const ordinaryText of ["运用卦象理解当前变化。", "利用卦象辅助分析。", "用卦名理解只是解释背景。"]) {
    const ordinaryOutput = await validOutput(liuyaoInput);
    ordinaryOutput.currentSituation = ordinaryText;
    assert.doesNotThrow(() => validateAIReport(ordinaryOutput, liuyaoInput), ordinaryText);
  }

  const structuredContamination = await validOutput(liuyaoInput);
  structuredContamination.useTrigram = "坤";
  assert.throws(
    () => validateAIReport(structuredContamination, liuyaoInput),
    (error) => error.code === "TYPE_CONTAMINATION" && error.details?.matches?.some((item) => item.marker === "useTrigram" && item.path === "$.useTrigram"),
  );

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

test("live providers retry an incomplete structured response", async () => {
  const result = liuyaoResult();
  const provider = new MockAIReportProvider({ mode: "success" });
  const generateValid = provider.generateReport.bind(provider);
  let calls = 0;
  provider.provider = "deepseek";
  provider.generateReport = async (input) => {
    calls += 1;
    if (calls === 1) throw new AIReportValidationError("PROVIDER_INCOMPLETE", "response incomplete");
    return generateValid(input);
  };
  const bundle = await generateGroundedAIReport({ result, type: "liuyao", provider });
  assert.equal(bundle.validationStatus, "VALID");
  assert.equal(bundle.attemptCount, 2);
});

test("valid live provider wording is preserved while timing stays deterministically controlled", async () => {
  const result = liuyaoResult();
  const provider = new MockAIReportProvider({ mode: "success" });
  const generateValid = provider.generateReport.bind(provider);
  provider.provider = "deepseek";
  provider.generateReport = async (input) => {
    const output = await generateValid(input);
    output.questionResponse.directAnswer = "可以先核实机会质量，再用小范围行动验证是否值得继续投入。";
    output.hexagramReading.original = `本卦“${input.chartFacts.originalHexagram}”说明当前条件需要结合本题角色综合判断。`;
    const ref = input.decisionFacts.allowedFindingRefs[0];
    output.actionSuggestions = [
      { text: "先核对最能改变决定的现实条件。", evidenceRefs: [ref] },
      { text: "条件明确后再决定投入程度。", evidenceRefs: [ref] },
    ];
    output.timingWindows[0].text = "这个时间必定兑现。";
    return output;
  };
  const bundle = await generateGroundedAIReport({ result, type: "liuyao", provider });
  assert.equal(bundle.validationStatus, "VALID");
  assert.equal(bundle.attemptCount, 1);
  assert.equal(bundle.aiReport.questionResponse.directAnswer, "可以先核实机会质量，再用小范围行动验证是否值得继续投入。");
  assert.match(bundle.aiReport.hexagramReading.original, /结合本题角色综合判断/u);
  assert.equal(bundle.aiReport.actionSuggestions[0].text, "先核对最能改变决定的现实条件。");
  assert.match(bundle.aiReport.timingWindows[0].text, /候选观察窗口/u);
  assert.doesNotMatch(bundle.aiReport.timingWindows[0].text, /一定|必定|保证/u);
});

test("live provider cannot exceed DecisionFacts commitment boundary", async () => {
  const result = liuyaoResult();
  const provider = new MockAIReportProvider({ mode: "success" });
  const generateValid = provider.generateReport.bind(provider);
  provider.provider = "deepseek";
  provider.generateReport = async (input) => {
    const output = await generateValid(input);
    output.questionResponse.directAnswer = "适合立刻投入全部资源。";
    return output;
  };
  const bundle = await generateGroundedAIReport({ result, type: "liuyao", provider });
  assert.equal(bundle.validationStatus, "FALLBACK");
  assert.equal(bundle.attemptCount, 3);
  assert.equal(bundle.failureCode, "DECISION_DIRECTION_INVALID");
});

test("conditional boundary validator accepts explicit negation of direct commitment", async () => {
  const input = buildAIReportInput({ result: liuyaoResult(), type: "liuyao" });
  const output = await validOutput(input);
  output.questionResponse.directAnswer = "可以继续了解，但暂不建议直接加入；先核实条件再做小范围验证。";
  assert.doesNotThrow(() => validateAIReport(output, input));
});

test("static Liuyao output cannot claim moving lines or a coming transition", async () => {
  const result = staticPartnershipResult();
  const provider = new MockAIReportProvider({ mode: "success" });
  const generateValid = provider.generateReport.bind(provider);
  let calls = 0;
  provider.provider = "deepseek";
  provider.generateReport = async (input) => {
    calls += 1;
    const output = await generateValid(input);
    if (calls === 1) {
      output.currentSituation = "整体处于变化前夜。";
      output.outcomeTrend.text = "动爻提示事情正在进入变化过程。";
    }
    return output;
  };

  const bundle = await generateGroundedAIReport({ result, type: "liuyao", provider });
  const text = JSON.stringify(bundle.aiReport);
  assert.equal(bundle.validationStatus, "VALID");
  assert.equal(bundle.attemptCount, 2);
  assert.match(bundle.aiReport.questionResponse.directAnswer, /身份/u);
  assert.match(bundle.aiReport.hexagramReading.changed, /没有新增的动变方向/u);
  assert.doesNotMatch(text, /变化前夜|动爻提示事情|正在进入变化过程|第 - 爻发动|已有变化动力/u);
});

test("live provider may add conventional hexagram context without changing chart facts", async () => {
  const result = staticPartnershipResult();
  const provider = new MockAIReportProvider({ mode: "success" });
  const generateValid = provider.generateReport.bind(provider);
  let calls = 0;
  provider.provider = "deepseek";
  provider.generateReport = async (input) => {
    calls += 1;
    const output = await generateValid(input);
    output.hexagramReading.original = "升卦六爻安静，传统解读强调循序推进；本次仍以具体爻位事实为判断依据。";
    return output;
  };
  const bundle = await generateGroundedAIReport({ result, type: "liuyao", provider });
  assert.equal(bundle.validationStatus, "VALID");
  assert.equal(bundle.attemptCount, 1);
  assert.match(bundle.aiReport.hexagramReading.original, /传统解读/u);
});

test("professional basis preserves Liuyao terms but removes internal rule codes", async () => {
  const result = liuyaoResult();
  const provider = new MockAIReportProvider({ mode: "success" });
  const generateValid = provider.generateReport.bind(provider);
  provider.provider = "deepseek";
  provider.generateReport = async (input) => {
    const output = await generateValid(input);
    output.keyJudgments[0].professionalBasis = "四爻官鬼午火发动，午火生戌土，属于化泄（RESPONSE_GENERATES_WORLD）。";
    return output;
  };
  const bundle = await generateGroundedAIReport({ result, type: "liuyao", provider });
  assert.equal(bundle.validationStatus, "VALID");
  assert.match(bundle.aiReport.keyJudgments[0].professionalBasis, /官鬼|化泄/u);
  assert.doesNotMatch(bundle.aiReport.keyJudgments[0].professionalBasis, /RESPONSE_GENERATES_WORLD/u);
});

test("live provider output translates known technical terms before public display", async () => {
  const result = liuyaoResult();
  const provider = new MockAIReportProvider({ mode: "success" });
  const generateValid = provider.generateReport.bind(provider);
  provider.provider = "deepseek";
  provider.generateReport = async (input) => {
    const output = await generateValid(input);
    output.currentSituation = "世爻需要主动投入，应爻目前处于空亡状态，官鬼与父母爻仍需核对，后续可看同支日/月。";
    return output;
  };
  const bundle = await generateGroundedAIReport({ result, type: "liuyao", provider });
  assert.equal(bundle.validationStatus, "VALID");
  assert.equal(bundle.attemptCount, 1);
  assert.doesNotMatch(bundle.aiReport.currentSituation, /空亡|同支日|世爻|应爻|官鬼|父母爻/u);
  assert.match(bundle.aiReport.currentSituation, /你的状态与投入|对方或项目方的回应|岗位与项目责任|合同与正式流程/u);
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
  const provider = new MockAIReportProvider({ mode: "success" });
  const first = await generateGroundedAIReport({ result, type: "liuyao", provider });
  assert.equal(first.validationStatus, "VALID");
  assert.equal(first.reportSource, "TEST_FIXTURE");
  assert.ok(Number.isFinite(first.latencyMs));
  result.aiReportBundle = first;
  const second = await generateGroundedAIReport({ result, type: "liuyao", provider });
  assert.equal(second.reused, true);
  assert.equal(second.validationStatus, "VALID");
  assert.equal(second.reportSource, "CACHE_REUSE");

  const providerChanged = await generateGroundedAIReport({ result, type: "liuyao", provider: new MockAIReportProvider({ mode: "throw" }) });
  assert.equal(providerChanged.reused, undefined);
  assert.equal(providerChanged.validationStatus, "FALLBACK");
});

test("anonymous AI limiter enforces device and IP short-window limits", () => {
  const limiter = createAnonymousAILimiter({ maxPerIp: 2, maxPerDevice: 1, windowMs: 1000, now: () => 1 });
  limiter.assertAllowed({ ip: "1.1.1.1", deviceId: "a" });
  assert.throws(() => limiter.assertAllowed({ ip: "1.1.1.1", deviceId: "a" }), AIReportValidationError);
  limiter.assertAllowed({ ip: "1.1.1.1", deviceId: "b" });
  assert.throws(() => limiter.assertAllowed({ ip: "1.1.1.1", deviceId: "c" }), AIReportValidationError);
});
