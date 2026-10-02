import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";

const base = process.env.AI_SMOKE_API_BASE ?? "http://127.0.0.1:4100/api/v1";
const headers = { "content-type": "application/json", "x-six-workspace": randomBytes(32).toString("hex") };
async function post(path: string, input: unknown) {
  const response = await fetch(`${base}${path}`, { method: "POST", headers, body: JSON.stringify(input) });
  const body = await response.json();
  assert.ok(response.ok, `${path}: ${body.code ?? response.status} ${body.message ?? ""}`);
  return body;
}
async function get(path: string) {
  const response = await fetch(`${base}${path}`, { headers });
  assert.ok(response.ok);
  return response.json();
}

const cases = [
  { question: "2026年我是否应该找工作？", route: "career:job_search", status: "RESOLVED" },
  { question: "今年是否适合成立公司，自己当股东并负责经营？", route: "business:partnership", status: "RESOLVED" },
  { question: "朋友让我加入他的政务系统项目，适合吗？", status: "CLARIFY" },
  { question: "朋友让我加入他的政务系统项目，适合吗？", clarification: "加入身份还没确定，想先了解不同方式的区别。", status: "BRANCHED" },
  { question: "今年适合找工作吗？另外我的感情会怎样？", status: "SPLIT" },
  { question: "今年适合找工作吗？另外我的感情会怎样？", clarification: "这次只问找工作。", status: "RESOLVED", route: "career:job_search" },
  { question: "我准备和朋友一起经营公司，担心收益和朋友关系，是否适合成为合伙人？", route: "business:partnership", status: "RESOLVED" },
  { question: "我不是找工作，而是考虑出资成为股东，不参与经营，适合吗？", route: "wealth:income", status: "RESOLVED" },
];
const results: any[] = [];
for (const item of cases) {
  const started = Date.now();
  const response = await post("/liuyao/questions/understand", item);
  const understanding = response.understanding;
  results.push({ question: item.question, clarification: item.clarification, understanding, latencyMs: Date.now() - started });
  console.log(JSON.stringify(results.at(-1)));
  assert.equal(understanding.status, item.status);
  if (item.route) assert.equal(understanding.route, item.route);
}

const question = cases[1].question;
const prepared = await post("/liuyao/questions/understand", { question });
const created = await post("/liuyao/charts", {
  requestId: randomUUID(),
  question, topic: "career", subtype: "job_search", understandingToken: prepared.understandingToken,
  values: [8, 7, 7, 8, 8, 8], calendar: { instantUtc: "2026-09-06T06:00:00.000Z", timezone: "Asia/Shanghai" },
});
assert.equal(created.persistence, "prisma");
const before = await get(`/reports/${created.id}`);
assert.equal(before.result.chart.topic, "business");
const ai = await post(`/reports/${created.id}/ai`, {});
assert.equal(ai.aiReportBundle.aiProvider, "deepseek");
assert.equal(ai.aiReportBundle.validationStatus, "VALID", ai.aiReportBundle.failureCode);
assert.doesNotMatch(JSON.stringify(ai.aiReportBundle.aiReport), /投递简历|招聘方|书面\s*[Oo]ffer|开始投递/);
const correction = "更正：我只出资，不参与日常经营，想判断是否适合被动入股。";
const understood = await post("/liuyao/questions/understand", { question, clarification: correction });
await post(`/reports/${created.id}/understanding`, { clarification: correction, understandingToken: understood.understandingToken, revision: 1 });
const revised = await get(`/reports/${created.id}`);
assert.equal(revised.result.chart.topic, "wealth");
assert.deepEqual(revised.result.chart.lines, before.result.chart.lines);
assert.deepEqual(revised.result.chart.calendar, before.result.chart.calendar);
assert.equal(revised.chartHash, before.chartHash);
assert.equal(revised.result.interpretationHistory.length, 1);
assert.equal(revised.result.interpretationHistory[0].aiReportBundle.validationStatus, "VALID");
const updatedAI = await post(`/reports/${created.id}/ai`, {});
assert.equal(updatedAI.aiReportBundle.validationStatus, "VALID", updatedAI.aiReportBundle.failureCode);
const cached = await post(`/reports/${created.id}/ai`, {});
assert.equal(cached.aiReportBundle.reportSource, "CACHE_REUSE");
const output = { testedAt: new Date().toISOString(), results, reportId: created.id, persistence: created.persistence, castUnchanged: true, originalAnswer: ai.aiReportBundle.aiReport.questionResponse.directAnswer, revisedAnswer: updatedAI.aiReportBundle.aiReport.questionResponse.directAnswer, revision: 2, aiSource: updatedAI.aiReportBundle.reportSource, cacheReused: true };
writeFileSync("docs/audit/question-understanding-live-smoke.json", JSON.stringify(output, null, 2) + "\n");
console.log(JSON.stringify(output));
