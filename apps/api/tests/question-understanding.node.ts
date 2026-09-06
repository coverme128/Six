import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { LiuyaoChartRequestSchema } from "@six/shared";
import { QuestionUnderstandingService } from "../src/ai/question-understanding.service.js";
import { AiReportService } from "../src/ai/ai-report.service.js";
import { createLiuyaoChart } from "@six/domain/liuyao";
import { buildAIReportInput, buildAIProviderPayload } from "@six/domain/ai-report";

const resolved = { status: "RESOLVED", primaryIntent: "是否成立公司并参与经营", decisionObject: "创业与股权参与", summary: "是否适合成立公司并参与经营", route: "business:partnership", joinMode: "PARTNERSHIP", secondaryConcerns: ["收益"], timeHorizon: "今年", clarificationQuestion: "", options: [], uncertainty: "" };

function liveTransport(t: any, output: unknown = resolved) {
  const previous = { provider: process.env.AI_PROVIDER, key: process.env.DEEPSEEK_API_KEY };
  process.env.AI_PROVIDER = "deepseek";
  process.env.DEEPSEEK_API_KEY = "test-only-credential";
  t.after(() => {
    if (previous.provider === undefined) delete process.env.AI_PROVIDER; else process.env.AI_PROVIDER = previous.provider;
    if (previous.key === undefined) delete process.env.DEEPSEEK_API_KEY; else process.env.DEEPSEEK_API_KEY = previous.key;
  });
  const requests: any[] = [];
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    requests.push(JSON.parse(String(init.body)));
    return new Response(JSON.stringify({ output_text: JSON.stringify(output) }), { status: 200 });
  });
  return requests;
}

test("missing route does not become job search", () => {
  const request = LiuyaoChartRequestSchema.parse({ question: "是否成立公司" });
  assert.equal(request.topic, undefined);
  const result = createLiuyaoChart({ question: request.question, values: [8, 7, 7, 8, 8, 8] });
  assert.equal(result.chart.topic, "general");
});

test("question understanding uses real-provider transport and redacts both inputs", async (t) => {
  const requests = liveTransport(t);
  const service = new QuestionUnderstandingService();
  await service.understand({ question: "成立公司，联系13812345678", clarification: "邮箱test@example.com" });
  assert.equal(requests.length, 1);
  assert.doesNotMatch(requests[0].input, /13812345678|test@example.com/);
  assert.match(requests[0].instructions, /BEFORE interpretation/);
});

test("signed understanding is bound to exact question and clarification", async (t) => {
  const requests = liveTransport(t);
  const service = new QuestionUnderstandingService();
  const source = { question: "今年成立公司适合吗", clarification: "参与经营" };
  const prepared = await service.understand(source);
  const result = await service.resolve({ ...source, understandingToken: prepared.understandingToken });
  assert.equal(requests.length, 1);
  assert.equal(result.topic, "business");
  await service.resolve({ ...source, clarification: "只投资", understandingToken: prepared.understandingToken });
  assert.equal(requests.length, 2);
  await service.resolve({ ...source, understandingToken: prepared.understandingToken + "tampered" });
  assert.equal(requests.length, 3);
});

test("independent questions cannot produce one merged report", async (t) => {
  liveTransport(t, { ...resolved, status: "SPLIT", clarificationQuestion: "这次先问哪件事？", options: ["求职", "感情"] });
  const service = new QuestionUnderstandingService();
  await assert.rejects(service.resolve({ question: "工作和感情怎么样" }), (error: any) => error.getResponse().code === "QUESTION_CLARIFICATION_REQUIRED");
});

test("provider unavailable never fabricates classification", async (t) => {
  liveTransport(t);
  process.env.AI_PROVIDER = "disabled";
  await assert.rejects(new QuestionUnderstandingService().understand({ question: "是否创业" }), (error: any) => error.getResponse().code === "QUESTION_PROVIDER_UNAVAILABLE");
});

test("ignored focus selection is retried with correction feedback, never silently accepted", async (t) => {
  const requests = liveTransport(t, { ...resolved, status: "SPLIT", clarificationQuestion: "先问什么？", options: ["求职", "感情"] });
  await assert.rejects(new QuestionUnderstandingService().resolve({ question: "工作和感情怎么样", clarification: "这次只问工作" }), (error: any) => error.getResponse().code === "QUESTION_UNDERSTANDING_FAILED");
  assert.equal(requests.length, 2);
  assert.match(requests[1].input, /correctionRequest/);
});

test("explicitly undecided answer does not enter a repeated clarification loop", async (t) => {
  liveTransport(t, { ...resolved, status: "CLARIFY", clarificationQuestion: "加入身份是什么？", options: ["入职", "合伙", "还没确定"] });
  const result = await new QuestionUnderstandingService().resolve({ question: "朋友让我加入", clarification: "身份还没确定" });
  assert.equal(result.questionProfile.status, "BRANCHED");
  assert.equal(result.topic, "general");
  assert.equal(result.questionProfile.joinMode, "UNCLARIFIED");
});

test("v2 AI input includes full findings, clarification and uncertainty", async (t) => {
  liveTransport(t);
  const understanding = await new QuestionUnderstandingService().resolve({ question: "今年是否成立公司", clarification: "我负责经营" });
  const result = createLiuyaoChart({ question: "今年是否成立公司", ...understanding, values: [8, 7, 7, 8, 8, 8] });
  const input = buildAIReportInput({ result, type: "liuyao" });
  const payload = buildAIProviderPayload(input);
  assert.equal(payload.questionContext.clarification, "我负责经营");
  assert.equal(payload.questionUnderstanding.route, "business:partnership");
  assert.equal(input.matchedRuleFindings.length, result.findings.length);
  assert.equal(payload.chartFacts.lineFacts.length, 6);
  assert.ok(payload.matchedRuleFindings.some((item: any) => item.inputFacts));
});

test("correcting interpretation preserves original chart and prior answer, rejects stale writes", async (t) => {
  liveTransport(t, { ...resolved, route: "wealth:income", joinMode: "INVESTMENT" });
  const result: any = createLiuyaoChart({ question: "是否成立公司", topic: "business", subtype: "partnership", values: [8, 7, 7, 8, 8, 8], calendar: { instantUtc: "2026-09-06T06:00:00Z" } });
  const originalLines = structuredClone(result.chart.lines);
  const originalCalendar = structuredClone(result.chart.calendar);
  let record: any = { id: result.chart.id, type: "liuyao", question: result.chart.question, chartHash: result.chart.chartHash, result, aiReportBundle: { aiReport: { questionResponse: { directAnswer: "此前的答案" } } } };
  // PostgreSQL JSONB changes key order; this must not look like an engine change.
  const reorder = (value: any): any => Array.isArray(value) ? value.map(reorder) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, reorder(value[key])])) : value;
  record.result.chart.lines = reorder(record.result.chart.lines);
  const store = { find: async () => record, save: async (next: any) => (record = next) };
  const service = new AiReportService(store as any, new QuestionUnderstandingService());
  await service.reviseForReport(record.id, { clarification: "仅投资，不经营", revision: 1 });
  assert.deepEqual(record.result.chart.lines, originalLines);
  assert.deepEqual(record.result.chart.calendar, originalCalendar);
  assert.equal(record.result.chart.topic, "wealth");
  assert.equal(record.result.interpretationHistory[0].aiReportBundle.aiReport.questionResponse.directAnswer, "此前的答案");
  assert.equal(record.aiReportBundle, null);
  await assert.rejects(service.reviseForReport(record.id, { clarification: "再次补充", revision: 1 }), (error: any) => error.getResponse().code === "REPORT_CHANGED");
});
