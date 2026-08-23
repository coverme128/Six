import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = process.cwd();

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(root, path), "utf8")) as T;
}

test("Batch 07 distribution assets retain exact counts and resolved routes", () => {
  const manifest = readJson<any>("data/content-growth/distribution/manifest.json");
  const social = readJson<any[]>("data/content-growth/distribution/social.json");
  const summaries = readJson<any[]>("data/content-growth/distribution/summaries.json");
  const collections = readJson<any[]>("data/content-growth/distribution/collections.json");
  const videos = readJson<any[]>("data/content-growth/distribution/videos.json");

  assert.equal(manifest.status, "COMPLETE");
  assert.deepEqual(manifest.counts, {
    socialContent: 72,
    socialCards: 72,
    articleSummaryCards: 24,
    collections: 12,
    collectionCovers: 12,
    shortVideoScripts: 50,
    shortVideoCovers: 50,
    shortVideoStoryboards: 50,
    batch07NewVisuals: 16,
    batch07NewVideos: 6,
  });
  assert.ok(Object.values(manifest.integrity).every(Boolean));

  const socialCounts = Object.fromEntries([...new Set(social.map((item) => item.content_type))].map((type) => [type, social.filter((item) => item.content_type === type).length]));
  assert.deepEqual(socialCounts, {
    KNOWLEDGE_EXPLANATION: 24,
    REAL_WORLD_DECISION: 18,
    TRUST_AI: 12,
    REPORT_READING: 10,
    TEACHING_CASE: 8,
  });
  assert.ok(social.every((item) => item.source_content?.every((source: any) => source.route.startsWith("/content/"))));
  assert.ok(summaries.every((item) => item.route.startsWith("/content/") && item.reuse_status === "PUBLIC"));
  assert.equal(collections.reduce((count, item) => count + item.recommended_content.length, 0), 36);
  assert.ok(collections.every((item) => item.recommended_content.every((source: any) => source.route.startsWith("/content/"))));
  assert.ok(collections.every((item) => item.cover_path === `/content-growth/distribution/collection-cover/${item.collection_id}.svg`));
  for (const collection of collections) {
    const cover = readFileSync(resolve(root, `apps/web/public${collection.cover_path}`), "utf8");
    assert.match(cover, /data-asset-class="learning-collection-cover"/u);
    assert.match(cover, new RegExp(collection.title, "u"));
    assert.match(cover, /推荐学习顺序/u);
  }

  const batch07Videos = videos.filter((item) => item.source_batch === "BATCH_07");
  assert.equal(batch07Videos.length, 6);
  for (const video of batch07Videos) {
    assert.equal(video.scene_list.length, 4);
    assert.ok(video.scene_list.every((scene: any) => scene.duration && scene.content));
    assert.ok(video.article_content.length > 0);
    assert.equal(video.status, "ASSET_READY_LOCAL");
    const storyboard = readFileSync(resolve(root, `apps/web/public/content-growth/distribution/video-storyboard/${video.video_id}.html`), "utf8");
    assert.doesNotMatch(storyboard, />undefined</u);
    assert.match(storyboard, /安全边界/u);
    assert.match(storyboard, new RegExp(video.scene_list[0].content, "u"));
  }
});

test("Batch 07 adds one Learn Hub and no editorial content types", () => {
  const catalog = readJson<{ items: any[] }>("content/content-growth/content-entries.json");
  const batch07Entries = catalog.items.filter((item) => item.body?.sourceBatch === "B07");

  assert.equal(batch07Entries.length, 1);
  assert.equal(batch07Entries[0]?.contentId, "LIUYAO_LEARN_HUB");
  assert.equal(batch07Entries[0]?.contentType, "LEARNING_PATH");
  assert.equal(batch07Entries.filter((item) => ["TUTORIAL", "KNOWLEDGE", "FAQ"].includes(item.contentType)).length, 0);
});

test("Batch 00 through 07 keep their declared content boundaries", () => {
  const catalog = readJson<{ items: any[] }>("content/content-growth/content-entries.json");
  const expected: Record<string, { total: number; publicationReady: number; demoOnly: number }> = {
    B00: { total: 0, publicationReady: 0, demoOnly: 0 },
    B01: { total: 78, publicationReady: 78, demoOnly: 0 },
    B02: { total: 93, publicationReady: 93, demoOnly: 0 },
    B03: { total: 88, publicationReady: 88, demoOnly: 0 },
    B04: { total: 95, publicationReady: 95, demoOnly: 0 },
    B05: { total: 72, publicationReady: 60, demoOnly: 12 },
    B06: { total: 12, publicationReady: 0, demoOnly: 12 },
    B07: { total: 1, publicationReady: 1, demoOnly: 0 },
  };
  const batchFor = (item: any) => item.contentId === "LIUYAO_LEARN_HUB" ? "B07" : /^B0[1-6]-/u.exec(item.contentId)?.[0].slice(0, 3);

  for (const [batch, counts] of Object.entries(expected)) {
    const entries = catalog.items.filter((item) => batchFor(item) === batch);
    assert.equal(entries.length, counts.total, `${batch} total`);
    assert.equal(entries.filter((item) => item.reviewStatus === "PUBLICATION_READY").length, counts.publicationReady, `${batch} publication ready`);
    assert.equal(entries.filter((item) => item.reviewStatus === "DEMO_ONLY").length, counts.demoOnly, `${batch} demo only`);
  }
  assert.equal(catalog.items.filter((item) => item.contentId.startsWith("B05-CASE-")).length, 12);
  assert.equal(catalog.items.filter((item) => item.contentId.startsWith("B06-CASE-")).length, 12);
});

test("all 68 visuals remain semantic and Batch 07 contributes 16 product assets", () => {
  const audit = readJson<any>("data/liuyao/visual-system/integration/content-growth-68-svg-production-audit.json");
  const batch07Assets = audit.assets.filter((item: any) => item.visualAssetId.startsWith("B07-VIS-"));

  assert.equal(audit.total, 68);
  assert.ok(Object.values(audit.checks).every(Boolean));
  assert.equal(batch07Assets.length, 16);
  assert.ok(batch07Assets.every((item: any) => item.sourceRegistry === "Batch 07 visual-asset-registry.json" && item.labelCount >= 2));
  assert.ok(batch07Assets.every((item: any) => existsSync(resolve(root, `apps/web/public${item.publicPath}`))));

  const map = readFileSync(resolve(root, "apps/web/public/content-growth/visuals/B07-VIS-01.svg"), "utf8");
  for (const label of ["起卦", "排盘", "角色", "状态", "变化", "证据", "时间", "行动"]) assert.match(map, new RegExp(label, "u"));
  const repeatReading = readFileSync(resolve(root, "apps/web/public/content-growth/visuals/B01-VIS-04.svg"), "utf8");
  for (const label of ["重复起卦", "解释冲突", "条件变化后再评估"]) assert.match(repeatReading, new RegExp(label, "u"));

  const catalog = readJson<{ items: any[] }>("content/content-growth/content-entries.json");
  const productRefs = new Set(catalog.items.flatMap((item) => item.body?.productIntegration?.visual_asset_refs ?? []));
  assert.equal(productRefs.size, 68);
  assert.ok(audit.assets.every((item: any) => productRefs.has(item.visualAssetId)));
});

test("every declared non-video visual layer has final local files", () => {
  const editorial = readJson<any>("data/liuyao/visual-system/editorial/generated/final-asset-manifest.json");
  const nonVideoEditorial = editorial.assets.filter((item: any) => item.id !== "ED-LY-007");
  const editorialVariants = nonVideoEditorial.flatMap((item: any) => item.variants);

  assert.equal(nonVideoEditorial.length, 9);
  assert.equal(editorialVariants.length, 22);
  assert.ok(editorialVariants.every((variant: any) => existsSync(resolve(root, `apps/web/public${variant.path}`))));

  const countSvg = (path: string) => readdirSync(resolve(root, path)).filter((file) => file.endsWith(".svg")).length;
  assert.equal(countSvg("apps/web/public/content-growth/visuals"), 68);
  assert.equal(countSvg("apps/web/public/content-growth/distribution/social"), 72);
  assert.equal(countSvg("apps/web/public/content-growth/distribution/summary"), 24);
  assert.equal(countSvg("apps/web/public/content-growth/distribution/collection-cover"), 12);
  assert.equal(countSvg("apps/web/public/liuyao-visual-system/reference-svg"), 14);
  assert.equal(countSvg("apps/web/public/liuyao-visual-system/topics"), 10);
  assert.equal(countSvg("apps/web/public/liuyao-visual-system/product"), 2);
  for (const file of ["topic-property-checkpoints.svg", "topic-legal-boundary.svg", "topic-health-observation.svg", "topic-goods-search.svg"]) {
    assert.ok(existsSync(resolve(root, `apps/web/public/liuyao-visual-system/topics/${file}`)));
  }
});
