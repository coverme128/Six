import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";

// Only publish the synthetic question created by the live smoke test, never a user's report.
const audit = JSON.parse(readFileSync("docs/audit/question-understanding-live-smoke.json", "utf8"));
const response = await fetch(`http://127.0.0.1:4100/api/v1/reports/${encodeURIComponent(audit.reportId)}/experience`);
assert.ok(response.ok);
const report = await response.json();
const sourceResponse = await fetch(`http://127.0.0.1:4100/api/v1/reports/${encodeURIComponent(audit.reportId)}`);
assert.ok(sourceResponse.ok);
const source = await sourceResponse.json();
assert.equal(source.question, "今年是否适合成立公司，自己当股东并负责经营？");
assert.equal(report.aiReportBundle.validationStatus, "VALID");
assert.equal(report.aiReportBundle.aiProvider, "deepseek");
assert.ok(report.experience.visualization);
const example = {
  provenance: { kind: "SYNTHETIC_QUESTION_LIVE_MODEL", generatedAt: report.aiReportBundle.generatedAt, promptVersion: report.aiReportBundle.promptVersion, provider: report.aiReportBundle.aiProvider },
  question: source.question,
  clarification: report.questionUnderstanding.clarification,
  understanding: report.questionUnderstanding.summary,
  visualization: report.experience.visualization,
  interpretation: report.aiReportBundle.aiReport,
};
mkdirSync("apps/web/app/example", { recursive: true });
writeFileSync("apps/web/app/example/report.json", JSON.stringify(example, null, 2) + "\n");
console.log(JSON.stringify({ exported: "apps/web/app/example/report.json", provenance: example.provenance }));
