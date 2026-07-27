import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import {
  CONTENT_SCHEMA_VERSION,
  ContentPackageImporter,
  ContentQAValidator,
  FileBasedContentRepository,
  HybridContentRepository,
  buildSEOMetadata,
  normalizeContentEntry,
  reportContentRecommendations,
  robotsTxt,
  sitemapXml,
  validateContentEntry,
} from "../src/domain/contentFramework.mjs";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function validEntry(overrides = {}) {
  return normalizeContentEntry({
    schemaVersion: CONTENT_SCHEMA_VERSION,
    contentId: "content:one",
    contentType: "KNOWLEDGE",
    title: "Demo Content",
    slug: "demo-content",
    canonicalPath: "/knowledge/demo-content",
    summary: "A safe demo content entry.",
    body: { blocks: [] },
    domain: "liuyao",
    category: "demo",
    audience: "BEGINNER",
    funnelStage: "EDUCATION",
    searchIntent: "INFORMATIONAL",
    difficulty: "BEGINNER",
    primaryKeyword: "demo content",
    primaryConversion: "VIEW_KNOWLEDGE",
    analyticsEvents: ["content_viewed"],
    seoMetadata: { title: "Demo Content", description: "A safe demo content entry.", canonicalPath: "/knowledge/demo-content", index: true },
    reviewStatus: "PUBLICATION_READY",
    contentVersion: "1.0.0",
    ...overrides,
  });
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function makePackage({ entries, checksumTamper = false }) {
  const root = mkdtempSync(join(tmpdir(), "six-content-package-"));
  const importDir = join(root, "import");
  mkdirSync(importDir, { recursive: true });
  const content = `${JSON.stringify({ items: entries }, null, 2)}\n`;
  writeFileSync(join(importDir, "content-entries.json"), content);
  writeJson(join(importDir, "content-import-manifest.json"), {
    packageVersion: "test",
    schemaVersion: CONTENT_SCHEMA_VERSION,
    files: [{ path: "content-entries.json", kind: "contentEntries", sha256: checksumTamper ? "bad" : sha256(content) }],
  });
  return root;
}

test("CONTENT_SCHEMA_V1 accepts valid entries and rejects unsafe publication states", () => {
  assert.deepEqual(validateContentEntry(validEntry()), []);
  const badStatus = validEntry({ contentId: "content:bad-status", slug: "bad-status", canonicalPath: "/knowledge/bad-status", reviewStatus: "PUBLISHED" });
  assert.ok(validateContentEntry(badStatus).some((error) => error.code === "CONTENT_STATUS_INVALID"));
  const unsafe = validEntry({ contentId: "content:unsafe", slug: "unsafe", canonicalPath: "/knowledge/unsafe", summary: "保证成功。" });
  assert.ok(validateContentEntry(unsafe).some((error) => error.code === "CONTENT_SAFETY_LANGUAGE"));
});

test("ContentQAValidator rejects duplicate slug and canonical path", () => {
  const first = validEntry();
  const second = validEntry({ contentId: "content:two" });
  const qa = new ContentQAValidator({ entries: [first, second] }).validate();
  assert.equal(qa.ok, false);
  assert.ok(qa.errors.some((error) => error.code === "CONTENT_DUPLICATE_SLUG"));
  assert.ok(qa.errors.some((error) => error.code === "CONTENT_DUPLICATE_CANONICALPATH"));
});

test("ContentPackageImporter validates checksums, dry-runs without writing and applies only PUBLICATION_READY", () => {
  const ready = validEntry();
  const demo = validEntry({ contentId: "content:demo", slug: "demo-only", canonicalPath: "/knowledge/demo-only", reviewStatus: "DEMO_ONLY", seoMetadata: { index: false } });
  const packageDir = makePackage({ entries: [ready, demo] });
  const root = mkdtempSync(join(tmpdir(), "six-content-target-"));
  try {
    const importer = new ContentPackageImporter({ rootDir: root, targetDir: "content" });
    const dryRun = importer.dryRun(packageDir);
    assert.equal(dryRun.ok, true);
    assert.equal(dryRun.wouldWrite, false);
    assert.equal(dryRun.publicEntries, 1);
    const applied = importer.apply(packageDir);
    assert.equal(applied.applied, true);
    const repository = new FileBasedContentRepository({ rootDir: root, contentDir: "content" });
    assert.equal(repository.list().length, 1);
    assert.equal(repository.getById("content:one").contentId, "content:one");
  } finally {
    rmSync(packageDir, { recursive: true, force: true });
    rmSync(root, { recursive: true, force: true });
  }
});

test("ContentPackageImporter fails tampered checksums before apply", () => {
  const packageDir = makePackage({ entries: [validEntry()], checksumTamper: true });
  const root = mkdtempSync(join(tmpdir(), "six-content-target-"));
  try {
    const result = new ContentPackageImporter({ rootDir: root, targetDir: "content" }).apply(packageDir);
    assert.equal(result.applied, false);
    assert.ok(result.errors.some((error) => error.code === "CONTENT_PACKAGE_CHECKSUM"));
  } finally {
    rmSync(packageDir, { recursive: true, force: true });
    rmSync(root, { recursive: true, force: true });
  }
});

test("SEO helpers keep drafts out of sitemap and staging robots blocks indexing", () => {
  const ready = validEntry();
  const draft = validEntry({ contentId: "content:draft", slug: "draft", canonicalPath: "/knowledge/draft", reviewStatus: "DRAFT", seoMetadata: { index: true } });
  assert.equal(buildSEOMetadata(draft).index, false);
  const sitemap = sitemapXml([ready, draft], { baseUrl: "https://beta.example.test" });
  assert.match(sitemap, /\/knowledge\/demo-content/u);
  assert.doesNotMatch(sitemap, /\/knowledge\/draft/u);
  assert.match(robotsTxt({ appEnv: "staging" }), /Disallow: \//u);
  assert.match(robotsTxt({ appEnv: "beta" }), /Disallow: \/reports\//u);
});

test("Report recommendations use real references and do not invent dead links", () => {
  const repository = new HybridContentRepository({ includePreview: true });
  const result = {
    chart: { id: "r1" },
    narrativeReport: { sections: [{ knowledgeIds: ["liuyao-yongshen"] }] },
    report: { evidence: [] },
  };
  const recommendations = reportContentRecommendations({ report: { type: "liuyao", result }, repository });
  assert.ok(recommendations.items.length > 0);
  assert.ok(recommendations.items.every((item) => item.url.startsWith("/")));
  assert.ok(recommendations.items.every((item, index, arr) => arr.findIndex((candidate) => candidate.contentId === item.contentId) === index));
});
