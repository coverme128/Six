import { createLiuyaoChart } from "@six/domain/liuyao";
import { buildLiuyaoReport } from "@six/domain/report-builder";
import { generateGroundedAIReport, providerFromEnv, questionDigest } from "@six/domain/ai-report";

const ROOT = process.cwd();

const ALL_CASES = [
  { caseId: "LY_CAREER_JOB", type: "liuyao", input: { question: "合成案例：求职推进是否顺利？", topic: "career", subtype: "job_search", values: [7, 8, 9, 7, 8, 6], calendar: { instantUtc: "2026-07-21T01:00:00Z", timezone: "Asia/Shanghai" } } },
  { caseId: "LY_JOB_DECISION", type: "liuyao", input: { question: "2026 年我是否应该找工作？", topic: "career", subtype: "job_search", values: [7, 8, 9, 7, 8, 6], calendar: { instantUtc: "2026-08-27T01:00:00Z", timezone: "Asia/Shanghai" } } },
  { caseId: "LY_WEALTH_COLLECTION", type: "liuyao", input: { question: "合成案例：回款推进是否顺利？", topic: "wealth", subtype: "payment_collection", values: [9, 8, 7, 8, 7, 6], calendar: { instantUtc: "2026-03-05T14:00:00Z", timezone: "Asia/Shanghai" } } },
  { caseId: "LY_RELATIONSHIP", type: "liuyao", input: { question: "合成案例：关系沟通是否可缓和？", topic: "relationship", subtype: "reconciliation", values: [7, 7, 8, 9, 8, 7], calendar: { instantUtc: "2026-10-08T03:00:00Z", timezone: "Asia/Shanghai" } } },
  { caseId: "LY_MIXED_SUPPORT_BLOCK", type: "liuyao", input: { question: "合成案例：项目推进支持与阻碍如何？", topic: "business", subtype: "project_delivery", values: [8, 9, 8, 7, 6, 7], calendar: { instantUtc: "2026-02-04T00:10:00Z", timezone: "Asia/Shanghai" } } },
  { caseId: "LY_PROJECT_JOIN", type: "liuyao", input: { question: "朋友做政务系统，邀请我加入，我是否应该加入？", topic: "business", subtype: "partnership", questionProfile: { joinMode: "PROJECT_COOPERATION" }, values: [8, 7, 7, 8, 8, 8], calendar: { instantUtc: "2026-08-27T07:27:31Z", timezone: "Asia/Shanghai" } } },
  { caseId: "LY_QUESTION_FIRST_COMPANY", type: "liuyao", input: { question: "今年是否适合成立公司，自己当股东？", topic: "career", subtype: "job_search", values: [8, 7, 7, 8, 8, 8], calendar: { instantUtc: "2026-08-27T07:27:31Z", timezone: "Asia/Shanghai" } } },
  { caseId: "LY_TIMING_CANDIDATE", type: "liuyao", input: { question: "合成案例：近期是否有可观察窗口？", topic: "travel", subtype: "trip", values: [9, 7, 8, 9, 7, 8], calendar: { instantUtc: "2026-12-07T04:00:00Z", timezone: "Asia/Shanghai" } } },
];
const requestedCase = process.env.AI_SMOKE_CASE;
const CASES = requestedCase ? ALL_CASES.filter((item) => item.caseId === requestedCase) : ALL_CASES;
if (!CASES.length) throw new Error(`Unknown AI_SMOKE_CASE: ${requestedCase}`);

function makeResult(item) {
  if (item.type === "liuyao") {
    const result = createLiuyaoChart(item.input, ROOT);
    result.narrativeReport = buildLiuyaoReport(result);
    return result;
  }
  throw new Error(`Unsupported smoke type: ${item.type}`);
}

function tokenUsage(bundle) {
  return bundle.tokenUsage ?? {};
}

const selectedProvider = process.env.AI_PROVIDER ?? (process.env.DEEPSEEK_API_KEY ? "deepseek" : "openai");
const providerKey = selectedProvider === "deepseek" ? process.env.DEEPSEEK_API_KEY : process.env.OPENAI_API_KEY;
if (!providerKey) {
  console.log(JSON.stringify({
    status: "skipped",
    reason: `${selectedProvider.toUpperCase()} API key is not configured`,
    cases: CASES.length,
  }, null, 2));
  process.exit(0);
}

const provider = providerFromEnv({ rootDir: ROOT });
const expectedSource = provider.provider === "deepseek" ? "DEEPSEEK_LIVE" : "OPENAI_LIVE";

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
    success: bundle.validationStatus === "VALID" && bundle.reportSource === expectedSource,
    schemaValid: bundle.validationStatus === "VALID",
    fidelityValid: bundle.validationStatus === "VALID",
    safetyValid: bundle.validationStatus === "VALID",
    fallbackUsed: bundle.fallbackUsed,
    attemptCount: bundle.attemptCount ?? 1,
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
  retrySuccess: results.filter((item) => item.success && item.attemptCount > 1).length,
  fallback: results.filter((item) => item.fallbackUsed).length,
  averageLatencyMs: Math.round(results.reduce((sum, item) => sum + item.latencyMs, 0) / results.length),
  schemaFailures: results.filter((item) => !item.schemaValid).length,
  fidelityFailures: results.filter((item) => !item.fidelityValid).length,
  safetyFailures: results.filter((item) => !item.safetyValid).length,
};
console.log(JSON.stringify({ summary }, null, 2));
if (summary.status !== "passed") process.exit(1);
