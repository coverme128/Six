import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const catalog = JSON.parse(readFileSync(resolve(root, "content/content-growth/content-entries.json"), "utf8"));
const faqs = catalog.items.filter((item: any) => item.contentType === "FAQ");

test("Batch 03 keeps all FAQ IDs while canonicalizing public intent", () => {
  assert.equal(faqs.length, 170);
  const decisions = faqs.reduce<Record<string, number>>((result, item: any) => {
    const decision = item.body?.commercialDecision?.decision;
    result[decision] = (result[decision] ?? 0) + 1;
    return result;
  }, {});
  assert.deepEqual(decisions, { REWRITE: 161, MERGE: 8, INTERNAL_ONLY: 1 });
  assert.ok(faqs.filter((item: any) => item.body.commercialDecision.decision === "MERGE").every((item: any) => item.reviewStatus === "INTERNAL_ONLY" && item.body.canonicalPath));
});

test("Batch 03 imports user-readable answers behind review gates", () => {
  const rewritten = faqs.filter((item: any) => item.body?.commercialDecision?.decision === "REWRITE");
  assert.equal(rewritten.length, 161);
  assert.ok(rewritten.every((item: any) => item.reviewStatus === "REVIEW_REQUIRED" && item.seoMetadata.index === false));
  assert.ok(rewritten.every((item: any) => item.body.shortAnswer.length >= 20 && item.body.fullAnswer.length >= 100));
  assert.ok(rewritten.every((item: any) => item.body.answerParagraphs.length >= 1));
  assert.ok(rewritten.every((item: any) => item.body.repositoryReview.status === "REVIEW_REQUIRED"));
});

test("Batch 03 aliases are searchable from their canonical FAQ", () => {
  const byId = new Map(faqs.map((item: any) => [item.contentId, item]));
  for (const source of faqs.filter((item: any) => item.body?.commercialDecision?.decision === "MERGE")) {
    const canonical = byId.get(source.body.commercialDecision.mergeTarget);
    assert.ok(canonical);
    assert.ok(canonical.secondaryKeywords.includes(source.title), `${source.contentId} alias`);
    assert.ok(canonical.body.queryVariants.includes(source.title), `${source.contentId} query variant`);
  }
});

test("Batch 03 imported FAQ bodies exclude Meihua-only and engineering terms", () => {
  const rewritten = faqs.filter((item: any) => item.body?.commercialDecision?.decision === "REWRITE");
  const meihuaOnly = /((?<!具)体卦|(?<!利)(?<!使)用卦|体用|互卦|外应|梅花(?:易数|起卦|时间起卦))/u;
  const engineering = /(Question Topic|Role Mapping|Yongshen|Shi \/ Ying|Six Relation|Presenter|Fact 来源|CORE_V1|ProductResultFacts|DivinationResultFacts|Stable ID|Registry|Rule ID)/u;
  assert.equal(rewritten.filter((item: any) => meihuaOnly.test(JSON.stringify(item.body))).length, 0);
  assert.equal(rewritten.filter((item: any) => engineering.test(`${item.body.question} ${item.body.shortAnswer} ${item.body.fullAnswer}`)).length, 0);
});

test("runtime seed demotes rewritten and canonicalized content instead of preserving stale publication", () => {
  const seed = readFileSync(resolve(root, "packages/database/src/seed.ts"), "utf8");
  assert.match(seed, /requiresRuntimeDemotion/u);
  assert.match(seed, /publishedAt:\s*null/u);
  assert.match(seed, /\["MERGE", "REMOVE", "INTERNAL_ONLY"\]/u);
});
