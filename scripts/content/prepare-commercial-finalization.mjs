#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const rootDir = process.cwd();
const catalogPath = resolve(rootDir, "content/content-growth/content-entries.json");
const document = JSON.parse(readFileSync(catalogPath, "utf8"));
const internalCase = /^B0[56]-CASE-/u;

function shouldRestoreReviewRequired(item) {
  if (item.body?.sourceBatch === "B03") return ["TUTORIAL", "KNOWLEDGE"].includes(item.contentType);
  if (["B04", "B05"].includes(item.body?.sourceBatch)) return ["TUTORIAL", "KNOWLEDGE", "FAQ"].includes(item.contentType);
  return false;
}

let internalOnly = 0;
let reviewRequired = 0;
for (const item of document.items) {
  if (internalCase.test(item.contentId)) {
    item.reviewStatus = "INTERNAL_ONLY";
    item.publishedAt = null;
    item.seoMetadata = { ...(item.seoMetadata ?? {}), index: false, follow: false };
    item.body = {
      ...(item.body ?? {}),
      commercialDisposition: "NOT_FOR_COMMERCIAL_FINALIZATION_YET",
      internalOnlyReason: "Teaching case lacks a traceable deterministic engine fixture."
    };
    internalOnly += 1;
    continue;
  }
  if (shouldRestoreReviewRequired(item)) {
    item.reviewStatus = "REVIEW_REQUIRED";
    item.publishedAt = null;
    item.seoMetadata = { ...(item.seoMetadata ?? {}), index: false, follow: false };
    reviewRequired += 1;
  }
}

document.generatedAt = new Date().toISOString();
document.publicationPolicy = {
  sourceOfTruth: "RUNTIME_DATABASE_CONTENT_STATUS",
  automaticPromotion: "FROZEN",
  publicRule: "PUBLISHED_AND_LIUYAO_ONLY"
};
writeFileSync(catalogPath, `${JSON.stringify(document, null, 2)}\n`);

const byStatus = Object.fromEntries(
  [...new Set(document.items.map((item) => item.reviewStatus))]
    .sort()
    .map((status) => [status, document.items.filter((item) => item.reviewStatus === status).length])
);
console.log(JSON.stringify({ ok: true, catalogPath, internalOnly, reviewRequired, byStatus }, null, 2));
