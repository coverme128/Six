import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const example = JSON.parse(readFileSync("apps/web/app/example/report.json", "utf8"));

test("public example is explicitly a synthetic question with a live model response", () => {
  assert.equal(example.provenance.kind, "SYNTHETIC_QUESTION_LIVE_MODEL");
  assert.equal(example.provenance.provider, "deepseek");
  assert.equal(example.question, "今年是否适合成立公司，自己当股东并负责经营？");
  assert.match(example.clarification, /只出资/);
  assert.ok(example.interpretation.questionResponse.directAnswer);
  assert.doesNotMatch(JSON.stringify(example), /sk-[a-zA-Z0-9]{16,}|localhost:|127\.0\.0\.1/);
});

test("public example chart matches the live interpretation's copied chart facts", () => {
  const board = example.visualization.viewModels["VIS-LY-001"];
  const claims = example.interpretation.factClaims;
  assert.equal(board.originalHexagram, claims.originalHexagram);
  assert.deepEqual(board.movingLines, claims.movingLines);
  assert.equal(board.worldLine, claims.worldLine);
  assert.equal(board.responseLine, claims.responseLine);
  assert.deepEqual(board.lines.map((item: any) => item.position).sort(), [1, 2, 3, 4, 5, 6]);
  assert.equal(board.changedHexagram, null);
});

test("home starts with the working form and exposes a stable complete example", () => {
  const page = readFileSync("apps/web/app/page.tsx", "utf8");
  assert.ok(page.indexOf("<SixApiDemo") < page.indexOf('className="home-report-sample"'));
  assert.doesNotMatch(page, /product-hero|home-report-proof|事实已核对/);
  assert.match(page, /href="\/example"/);
  const full = readFileSync("apps/web/app/example/page.tsx", "utf8");
  for (const part of ["keyJudgments", "actionPlan", "decisionBalance", "limitations", "LiuyaoVisualSystemPanel"]) assert.ok(full.includes(part));
});

test("six visible scene shortcuts do not become mandatory report classification", () => {
  const source = readFileSync("apps/web/app/SixApiDemo.tsx", "utf8");
  for (const label of ["感情关系", "工作事业", "合作创业", "财务收支", "学业考试", "生活事务"]) assert.ok(source.includes(`label: "${label}"`));
  assert.ok(source.indexOf('className="home-scenes"') < source.indexOf('id="question-input"'));
  assert.match(source, /aria-pressed=\{activeScene === item.id\}/);
  assert.match(source, /hidden=\{!activeScene\}/);
  const payload = source.match(/const payload = [^\n]*LiuyaoChartRequestSchema.parse\(\{([\s\S]*?)\n    \}\);/)?.[1];
  assert.ok(payload);
  assert.doesNotMatch(payload, /scenarioId|activeScene|topic:|subtype:/);
  assert.match(payload, /understandingToken/);
});
