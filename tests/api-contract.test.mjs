import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const serverSource = readFileSync("src/server.mjs", "utf8");
const contract = JSON.parse(readFileSync("schemas/public-api-contract.json", "utf8"));
const routePatterns = new Map([
  ["/api/v1/reports/:id", String.raw`^\/api\/v1\/reports\/([^/]+)$`],
  ["/api/v1/reports/:id/ai", String.raw`^\/api\/v1\/reports\/([^/]+)\/ai$`],
  ["/api/content/:id/related", String.raw`^\/api\/content\/([^/]+)\/related$`],
  ["/api/content/:type/:slug", String.raw`^\/api\/content\/([^/]+)\/([^/]+)$`],
  ["/api/content-preview/:id", String.raw`^\/api\/content-preview\/([^/]+)$`],
  ["/api/learning-paths/:id", String.raw`^\/api\/learning-paths\/([^/]+)$`],
  ["/api/reports/:id/content-recommendations", String.raw`^\/api\/reports\/([^/]+)\/content-recommendations$`],
]);

test("P3-A lite API contract routes are implemented", () => {
  for (const route of contract.routes) {
    if (routePatterns.has(route.path)) {
      assert.ok(serverSource.includes(routePatterns.get(route.path)), route.path);
    } else {
      assert.ok(serverSource.includes(`url.pathname === "${route.path}"`), route.path);
    }
  }
});

test("P3-A error responses keep the public error shape", () => {
  for (const key of contract.errorShape.required) {
    assert.ok(serverSource.includes(key), key);
  }
});

test("internal status does not expose secrets or prompt bodies", () => {
  const statusBlock = serverSource.slice(serverSource.indexOf('url.pathname === "/internal/status"'), serverSource.indexOf('url.pathname === "/api/metadata"'));
  assert.ok(!statusBlock.includes("OPENAI_API_KEY"));
  assert.ok(!statusBlock.includes("promptFor"));
  assert.ok(!statusBlock.includes("question:"));
});
