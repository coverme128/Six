import { createLiuyaoChart } from "../../src/domain/liuyaoEngine.mjs";
import { createMeihuaChart } from "../../src/domain/meihuaEngine.mjs";
import { buildLiuyaoReport, buildMeihuaReport } from "../../src/domain/reportBuilder.mjs";
import { OpenAIReportProvider, generateGroundedAIReport, questionDigest } from "../../src/domain/aiReport.mjs";

const ROOT = process.cwd();

const CASES = [
  { caseId: "LY_CAREER_JOB", type: "liuyao", input: { question: "合成案例：求职推进是否顺利？", topic: "career", subtype: "job_search", values: [7, 8, 9, 7, 8, 6], calendar: { instantUtc: "2026-07-21T01:00:00Z", timezone: "Asia/Shanghai" } } },
  { caseId: "LY_WEALTH_COLLECTION", type: "liuyao", input: { question: "合成案例：回款推进是否顺利？", topic: "wealth", subtype: "payment_collection", values: [9, 8, 7, 8, 7, 6], calendar: { instantUtc: "2026-03-05T14:00:00Z", timezone: "Asia/Shanghai" } } },
  { caseId: "LY_RELATIONSHIP", type: "liuyao", input: { question: "合成案例：关系沟通是否可缓和？", topic: "relationship", subtype: "reconciliation", values: [7, 7, 8, 9, 8, 7], calendar: { instantUtc: "2026-10-08T03:00:00Z", timezone: "Asia/Shanghai" } } },
  { caseId: "LY_MIXED_SUPPORT_BLOCK", type: "liuyao", input: { question: "合成案例：项目推进支持与阻碍如何？", topic: "business", subtype: "project_delivery", values: [8, 9, 8, 7, 6, 7], calendar: { instantUtc: "2026-02-04T00:10:00Z", timezone: "Asia/Shanghai" } } },
  { caseId: "LY_TIMING_CANDIDATE", type: "liuyao", input: { question: "合成案例：近期是否有可观察窗口？", topic: "travel", subtype: "trip", values: [9, 7, 8, 9, 7, 8], calendar: { instantUtc: "2026-12-07T04:00:00Z", timezone: "Asia/Shanghai" } } },
  { caseId: "MH_TWO_NUMBER", type: "meihua", input: { question: "合成案例：两数起卦观察态势。", methodCode: "MEIHUA_TWO_NUMBER_V1", number_a: 7, number_b: 12 } },
  { caseId: "MH_THREE_NUMBER", type: "meihua", input: { question: "合成案例：三数起卦观察态势。", methodCode: "MEIHUA_THREE_NUMBER_V1", number_a: 6, number_b: 11, number_c: 5 } },
  { caseId: "MH_TIME", type: "meihua", input: { question: "合成案例：时间起卦观察态势。", methodCode: "MEIHUA_TIME_LUNAR_BRANCH_V1", year_branch_ordinal: 7, lunar_month: 6, lunar_day: 18, hour_branch_ordinal: 6 } },
];

function makeResult(item) {
  if (item.type === "liuyao") {
    const result = createLiuyaoChart(item.input, ROOT);
    result.narrativeReport = buildLiuyaoReport(result);
    return result;
  }
  const result = createMeihuaChart(item.input, ROOT);
  result.narrativeReport = buildMeihuaReport(result);
  return result;
}

function tokenUsage(bundle) {
  return bundle.tokenUsage ?? {};
}

if (!process.env.OPENAI_API_KEY) {
  console.log(JSON.stringify({
    status: "skipped",
    reason: "OPENAI_API_KEY is not configured",
    cases: CASES.length,
  }, null, 2));
  process.exit(0);
}

const provider = new OpenAIReportProvider({
  rootDir: ROOT,
  model: process.env.AI_MODEL,
  timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 20000),
  maxOutputTokens: Number(process.env.AI_MAX_OUTPUT_TOKENS ?? 1600),
});

const results = [];
for (const item of CASES) {
  const result = makeResult(item);
  const started = Date.now();
  const bundle = await generateGroundedAIReport({ result, type: item.type, provider });
  const usage = tokenUsage(bundle);
  const row = {
    caseId: item.caseId,
    reportType: item.type,
    provider: bundle.aiProvider,
    model: bundle.aiModel,
    reportSource: bundle.reportSource,
    success: bundle.validationStatus === "VALID" && bundle.reportSource === "OPENAI_LIVE",
    schemaValid: bundle.validationStatus === "VALID",
    fidelityValid: bundle.validationStatus === "VALID",
    safetyValid: bundle.validationStatus === "VALID",
    fallbackUsed: bundle.fallbackUsed,
    latencyMs: bundle.latencyMs ?? Date.now() - started,
    inputTokenEstimate: usage.inputTokenEstimate,
    outputTokenUsage: usage.outputTokens ?? usage.outputTokenEstimate,
    totalTokenUsage: usage.totalTokens,
    errorCode: bundle.failureCode ?? null,
    question: questionDigest(item.input.question),
  };
  results.push(row);
  console.log(JSON.stringify(row));
}

const summary = {
  status: results.every((item) => item.success) ? "passed" : "failed",
  cases: results.length,
  firstSuccess: results.filter((item) => item.success).length,
  retrySuccess: 0,
  fallback: results.filter((item) => item.fallbackUsed).length,
  averageLatencyMs: Math.round(results.reduce((sum, item) => sum + item.latencyMs, 0) / results.length),
  schemaFailures: results.filter((item) => !item.schemaValid).length,
  fidelityFailures: results.filter((item) => !item.fidelityValid).length,
  safetyFailures: results.filter((item) => !item.safetyValid).length,
};
console.log(JSON.stringify({ summary }, null, 2));
if (summary.status !== "passed") process.exit(1);
