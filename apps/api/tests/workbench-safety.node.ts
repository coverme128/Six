import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { NestFactory } from "@nestjs/core";
import { randomUUID } from "node:crypto";
import { ApiModule } from "../src/module.js";
import { PublicExceptionFilter } from "../src/common/public-exception.filter.js";
import { ReportStoreService } from "../src/reports/report-store.service.js";
import { AiReportService } from "../src/ai/ai-report.service.js";
import { workspaceOwner } from "../src/reports/workspace-access.js";
import { originalCastInstant } from "../../web/app/lib/cast-time.js";

test("original local time is explicit, timezone-correct, and never guesses DST", () => {
  assert.equal(originalCastInstant("2026-08-27T09:30", "Asia/Shanghai"), "2026-08-27T01:30:00.000Z");
  assert.equal(originalCastInstant("2026-08-27T09:30", "UTC"), "2026-08-27T09:30:00.000Z");
  assert.throws(() => originalCastInstant("", "Asia/Shanghai"));
  assert.throws(() => originalCastInstant("2026-02-30T09:30", "Asia/Shanghai"));
  assert.throws(() => originalCastInstant("2026-03-08T02:30", "America/New_York"));
  assert.throws(() => originalCastInstant("2025-11-02T01:30", "America/New_York"));
  assert.throws(() => originalCastInstant("2099-01-01T00:00", "UTC"));
});

test("workspace isolation, immutable retries, and AI-unavailable chart capture through HTTP", async (t) => {
  const oldDatabase = process.env.DATABASE_URL;
  const oldAI = process.env.AI_PROVIDER;
  delete process.env.DATABASE_URL;
  process.env.AI_PROVIDER = "disabled";
  const app = await NestFactory.create(ApiModule, { logger: false });
  app.setGlobalPrefix("api/v1");
  app.useGlobalFilters(new PublicExceptionFilter());
  await app.listen(0, "127.0.0.1");
  t.after(async () => { await app.close(); if (oldDatabase === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = oldDatabase; if (oldAI === undefined) delete process.env.AI_PROVIDER; else process.env.AI_PROVIDER = oldAI; });
  const base = `${await app.getUrl()}/api/v1`;
  const a = "a".repeat(64), b = "b".repeat(64);
  async function request(path: string, token?: string, method = "GET", body?: unknown) {
    const response = await fetch(base + path, { method, headers: { "content-type": "application/json", ...(token ? { "x-six-workspace": token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() };
  }
  const payload = { question: "这份软件开发工作适合接受吗？", requestId: randomUUID(), deferUnderstanding: true, values: [7,8,9,7,8,6], calendar: { instantUtc: "2026-08-27T01:30:00.000Z", timezone: "Asia/Shanghai" } };
  assert.equal((await request("/reports")).status, 401);
  assert.equal((await request("/liuyao/questions/understand", a, "POST", { question: payload.question })).status, 503);
  const first = await request("/liuyao/charts", a, "POST", payload);
  assert.equal(first.status, 201);
  const id = first.body.id;
  const second = await request("/liuyao/charts", b, "POST", payload);
  assert.equal(second.status, 201);
  assert.notEqual(second.body.id, id);
  const retries = await Promise.all(Array.from({ length: 3 }, () => request("/liuyao/charts", a, "POST", payload)));
  assert.ok(retries.every((r) => r.status === 201 && r.body.id === id));
  assert.equal((await request("/reports", a)).body.items.length, 1);
  assert.equal((await request("/reports", b)).body.items.length, 1);
  assert.equal((await request("/liuyao/charts", a, "POST", { ...payload, values: [8,8,8,7,7,7] })).status, 409);
  assert.equal((await request("/liuyao/charts", a, "POST", { ...payload, calendar: { timezone: "Asia/Shanghai" } })).status, 400);
  for (const suffix of ["", "/experience", "/export", "/internal-presentation"]) assert.equal((await request(`/reports/${id}${suffix}`, b)).status, 404);
  for (const suffix of ["/ai", "/ai/jobs", "/understanding"]) assert.equal((await request(`/reports/${id}${suffix}`, b, "POST", {})).status, 404);
  assert.equal((await request(`/reports/${id}`, b, "DELETE")).status, 404);
  const own = await request(`/reports/${id}`, a);
  assert.equal(own.body.ownerId, undefined);
  assert.equal(own.body.result.chart.calendar.instantUtc, payload.calendar.instantUtc);
  assert.equal(own.body.aiReportBundle, undefined);
  assert.equal(own.body.result.pendingQuestion.status, "PENDING");
  const ai = app.get(AiReportService);
  const received: any[] = [];
  t.mock.method(ai, "generateForReport", async (_id: string, options: unknown) => { received.push(options); return {}; });
  await request(`/reports/${id}/ai`, a, "POST", { deviceId: "anonymous-web" });
  await request(`/reports/${second.body.id}/ai`, b, "POST", { deviceId: "anonymous-web" });
  assert.equal(received[0].deviceId, workspaceOwner(a));
  assert.equal(received[1].deviceId, workspaceOwner(b));
  const store = app.get(ReportStoreService);
  await store.save({ ...await store.find(id), id: "legacy-unowned", ownerId: null } as any);
  assert.equal((await request("/reports/legacy-unowned", a)).status, 404);
  assert.equal((await request("/reports", a, "DELETE")).body.deleted, 1);
  assert.equal((await request(`/reports/${second.body.id}`, b)).status, 200);
  assert.ok(await store.find("legacy-unowned"));
  const oldEnvironment = process.env.APP_ENV;
  process.env.APP_ENV = "production";
  try {
    const failed = await request("/liuyao/charts", a, "POST", { ...payload, requestId: randomUUID() });
    assert.equal(failed.status, 503);
    assert.equal(failed.body.code, "REPORT_STORAGE_UNAVAILABLE");
  } finally { if (oldEnvironment === undefined) delete process.env.APP_ENV; else process.env.APP_ENV = oldEnvironment; }
});
