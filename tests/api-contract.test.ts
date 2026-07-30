import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const contract = JSON.parse(readFileSync("schemas/public-api-contract.json", "utf8"));

const sources = [
  "apps/api/src/main.ts",
  "apps/api/src/services/health.controller.ts",
  "apps/api/src/services/metadata.controller.ts",
  "apps/api/src/divination/divination.controller.ts",
  "apps/api/src/reports/reports.controller.ts",
  "apps/api/src/content/content.controller.ts",
  "apps/api/src/settings/settings.controller.ts",
  "apps/api/src/common/public-exception.filter.ts",
].map((path) => readFileSync(path, "utf8")).join("\n");

function routeExists(path) {
  const local = path.replace(/^\/api\/v1\/?/u, "");
  if (["health", "ready"].includes(local)) return sources.includes(`@Get("/${local}")`);
  if (sources.includes(`"${local}"`) || sources.includes(`'${local}'`)) return true;
  const [controller, ...rest] = local.split("/");
  const methodRoute = rest.join("/");
  const hasController = sources.includes(`@Controller("${controller}")`) || sources.includes("@Controller()");
  if (!methodRoute) return hasController && (sources.includes("@Get()") || sources.includes("@Post()") || sources.includes("@Put()"));
  return hasController && (
    sources.includes(`"${methodRoute}"`) ||
    sources.includes(`'${methodRoute}'`)
  );
}

test("Nest API contract routes are implemented in the new architecture", () => {
  assert.ok(sources.includes('app.setGlobalPrefix("api/v1")'));
  for (const route of contract.routes) {
    assert.ok(routeExists(route.path), `${route.method} ${route.path}`);
  }
});

test("public error responses keep code, message and traceId", () => {
  assert.ok(sources.includes("PublicExceptionFilter"));
  for (const key of contract.errorShape.required) {
    assert.ok(sources.includes(key), key);
  }
});

test("API source does not expose provider secrets in public responses", () => {
  const publicResponseSource = sources.replace(/process\.env\.OPENAI_API_KEY/gu, "OPENAI_API_KEY_CONFIG_READ");
  assert.ok(!publicResponseSource.includes("OPENAI_API_KEY"));
  assert.ok(!publicResponseSource.includes("promptFor(input)"));
});

test("internal presentation and public export stay separated", () => {
  const reportsController = readFileSync("apps/api/src/reports/reports.controller.ts", "utf8");
  assert.ok(reportsController.includes("assertInternalAccess(token)"));
  assert.ok(reportsController.includes("ForbiddenException"));
  assert.ok(reportsController.includes("INTERNAL_PRESENTATION_TOKEN"));

  const exportBody = reportsController.slice(reportsController.indexOf("function publicReportExport"), reportsController.indexOf("function publicChartView"));
  assert.ok(exportBody.includes("PUBLIC_REPORT_EXPORT_V1"));
  assert.ok(exportBody.includes("chartViewModel"));
  assert.ok(!exportBody.includes("result: report.result"));
  assert.ok(!exportBody.includes("narrativeReport: report.narrativeReport"));
});
