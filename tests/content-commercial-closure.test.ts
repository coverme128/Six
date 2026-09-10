import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { HybridContentRepository } from "@six/domain/content-framework";

const root = resolve(import.meta.dirname, "..");
const readJson = <T>(path: string) => JSON.parse(readFileSync(resolve(root, path), "utf8")) as T;
const policyRoot = "data/content-commercialization/release-closure-v1";

test("Batch 04 installs complete unified governance registries", () => {
  const decisions = readJson<any[]>(`${policyRoot}/unified-content-decision-registry.json`);
  const canonical = readJson<string[]>(`${policyRoot}/canonical-content-id-registry.json`);
  const graph = readJson<any[]>(`${policyRoot}/content-graph.json`);
  const counts = decisions.reduce<Record<string, number>>((result, item) => {
    result[item.decision] = (result[item.decision] ?? 0) + 1;
    return result;
  }, {});
  assert.equal(decisions.length, 536);
  assert.equal(canonical.length, 457);
  assert.equal(graph.length, 1193);
  assert.deepEqual(counts, { REWRITE: 457, MERGE: 57, REMOVE: 15, INTERNAL_ONLY: 7 });
});

test("all 536 closure records map to runtime content without exposing aliases", () => {
  const entries = new HybridContentRepository({ rootDir: root, includePreview: true }).loadEntries();
  const governed = entries.filter((item: any) => item.body?.commercialClosure);
  assert.equal(governed.length, 536);
  assert.equal(governed.filter((item: any) => item.body.commercialClosure.decision === "REWRITE").length, 457);
  assert.ok(governed.filter((item: any) => ["MERGE", "REMOVE", "INTERNAL_ONLY"].includes(item.body.commercialClosure.decision)).every((item: any) => ["INTERNAL_ONLY", "DEFERRED"].includes(item.reviewStatus)));
});

test("Learn Hub, topics and collections follow the commercial IA", () => {
  const catalog = readJson<{ items: any[] }>("content/content-growth/content-entries.json");
  const hub = catalog.items.find((item) => item.contentId === "LIUYAO_LEARN_HUB");
  const topics = readJson<any[]>(`${policyRoot}/topic-landing-policy.json`);
  const collections = readJson<any[]>(`${policyRoot}/collection-policy.json`);
  const nav = readFileSync(resolve(root, "apps/web/app/content/ContentSectionNav.tsx"), "utf8");
  assert.deepEqual(hub.body.primaryNavigation.map((item: any) => item.id), ["START", "REAL_WORLD", "DEEP_LEARN"]);
  assert.equal(topics.filter((item) => item.navigation_state === "SUPPORTED_SECONDARY_LANDING").length, 6);
  assert.ok(collections.every((item) => item.top_level_navigation === false && item.minimum_public_items === 3));
  assert.doesNotMatch(nav, /label: "学习合集"/u);
});

test("public search implementation ranks aliases and searches body text", () => {
  const controller = readFileSync(resolve(root, "apps/api/src/content/content.controller.ts"), "utf8");
  assert.match(controller, /searchableBodyStrings/u);
  assert.match(controller, /aliases\.includes\(needle\).*return 90/su);
  assert.match(controller, /body\.includes\(needle\).*return 25/su);
  assert.match(controller, /commercialClosure\?\.decision/u);
});

test("Batch 04 does not promote production publication state", () => {
  const audit = readJson<any>("reports/content/commercial-finalization-batch-04-closure-import.json");
  assert.equal(audit.unified_decision_coverage, "536/536");
  assert.equal(audit.production_promotion_performed, false);
  assert.equal(audit.repository_release_status, "LIUYAO_CONTENT_COMMERCIAL_READY_WITH_BLOCKERS");
  assert.equal(audit.legacy_public_internal_language_demoted.length, 36);
});
