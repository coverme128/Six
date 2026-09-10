import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const readJson = <T>(path: string) => JSON.parse(readFileSync(resolve(root, path), "utf8")) as T;

test("Batch 02 imports all rewrites as structured, review-gated content", () => {
  const catalog = readJson<{ items: any[] }>("content/content-growth/content-entries.json");
  const nodes = readJson<any[]>("data/content/knowledge-nodes-v1.2.json");
  const glossary = readJson<{ items: any[] }>("data/content/glossary.json");
  const trigrams = readJson<{ items: any[] }>("data/core/trigrams.json");
  const hexagrams = readJson<{ items: any[] }>("data/core/hexagrams-64.json");
  const rewritten = [
    ...catalog.items.filter((item) => /^B0[1-4]-KC-/u.test(item.contentId)).map((item) => item.body),
    ...nodes.filter((item) => item.commercial_decision?.decision === "REWRITE").map((item) => item.commercial_content),
    ...glossary.items.filter((item) => item.commercial_decision?.decision === "REWRITE").map((item) => item.commercial_content),
    ...trigrams.items.map((item) => item.commercial_content),
    ...hexagrams.items.map((item) => item.commercial_content),
  ];

  assert.equal(rewritten.length, 228);
  assert.ok(rewritten.every((body) => body.repositoryReview?.status === "REVIEW_REQUIRED"));
  assert.ok(rewritten.every((body) => body.sections.length >= 7));
  assert.ok(rewritten.every((body) => body.sections.every((section: any) => section.body && section.blocks?.length)));
});

test("Batch 02 preserves all canonicalization and visibility decisions", () => {
  const sources = [
    ...readJson<any[]>("data/content/knowledge-nodes-v1.2.json"),
    ...readJson<{ items: any[] }>("data/content/glossary.json").items,
    ...readJson<{ items: any[] }>("data/core/trigrams.json").items,
    ...readJson<{ items: any[] }>("data/core/hexagrams-64.json").items,
  ];
  const counts = sources.reduce<Record<string, number>>((result, item) => {
    const decision = item.commercial_decision?.decision;
    if (decision) result[decision] = (result[decision] ?? 0) + 1;
    return result;
  }, {});

  assert.deepEqual(counts, { REWRITE: 88, MERGE: 49, INTERNAL_ONLY: 6, REMOVE: 15 });
  assert.ok(sources.filter((item) => item.commercial_decision?.decision === "MERGE").every((item) => item.commercial_decision.merge_target));
  assert.ok(sources.filter((item) => item.commercial_decision?.decision === "REMOVE").every((item) => /梅花|六爻公共/u.test(item.commercial_decision.reason)));
});

test("Batch 02 keeps Meihua-only material out of rewritten public bodies", () => {
  const catalog = readJson<{ items: any[] }>("content/content-growth/content-entries.json");
  const rewritten = catalog.items.filter((item) => /^B0[1-4]-KC-/u.test(item.contentId));
  const meihuaOnly = /((?<!具)体卦|(?<!利)(?<!使)用卦|体用|互卦|外应|梅花(?:易数|起卦|时间起卦))/u;

  assert.equal(rewritten.filter((item) => meihuaOnly.test(JSON.stringify(item.body))).length, 0);
  assert.ok(rewritten.every((item) => item.reviewStatus === "REVIEW_REQUIRED" && item.seoMetadata.index === false));
});
