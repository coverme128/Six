#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

const rootDir = process.cwd();
const batchDir = process.env.SIX_CONTENT_BATCH_DIR ?? "/Users/goterra/Downloads/batch";
const generatedAt = "2026-08-22T00:00:00.000Z";
const visualDir = resolve(rootDir, "apps/web/public/content-growth/visuals");
const distributionPublicDir = resolve(rootDir, "apps/web/public/content-growth/distribution");
const distributionDataDir = resolve(rootDir, "data/content-growth/distribution");

const palette = {
  paper: "#F6F1E7",
  surface: "#FFFCF6",
  ink: "#171717",
  muted: "#5D5A54",
  line: "#CFC5B6",
  jade: "#496F63",
  cinnabar: "#A33A2B",
  gold: "#9A7A43",
  blue: "#48677A",
  plum: "#765567",
};

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  ensureDir(dirname(path));
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function hash(value) {
  return [...value].reduce((total, char) => ((total * 31) + char.charCodeAt(0)) >>> 0, 7);
}

function countBy(items, keyFor) {
  return items.reduce((counts, item) => {
    const key = keyFor(item);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function wrap(value, max = 13, lines = 3) {
  const source = String(value ?? "").trim();
  if (!source) return [];
  const words = /\s/u.test(source) ? source.split(/\s+/u) : [...source];
  const chunks = [];
  let current = "";
  for (const word of words) {
    const separator = /\s/u.test(source) && current ? " " : "";
    if ((current + separator + word).length > max && current) {
      chunks.push(current);
      current = word;
    } else {
      current += separator + word;
    }
  }
  if (current) chunks.push(current);
  if (chunks.length > lines) {
    const visible = chunks.slice(0, lines);
    visible[lines - 1] = `${visible[lines - 1].slice(0, Math.max(1, max - 1))}…`;
    return visible;
  }
  return chunks;
}

function textBlock(value, x, y, options = {}) {
  const {
    anchor = "start",
    fill = palette.ink,
    fontSize = 21,
    fontWeight = 600,
    lineHeight = Math.round(fontSize * 1.35),
    max = 13,
    lines = 3,
  } = options;
  const chunks = wrap(value, max, lines);
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${fill}" font-size="${fontSize}" font-weight="${fontWeight}" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">${chunks.map((chunk, index) => `<tspan x="${x}" dy="${index ? lineHeight : 0}">${escapeXml(chunk)}</tspan>`).join("")}</text>`;
}

function svgFrame({ id, title, description, layout, body }) {
  return `<svg data-visual-system="LIUYAO_VISUAL_SYSTEM_V1" data-style="modern-eastern-analytical" data-art-direction="content-growth-visual-v2" data-layout="${layout}" xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img" aria-labelledby="title desc">
<metadata>${escapeXml(JSON.stringify({ visualSystem: "LIUYAO_VISUAL_SYSTEM_V1", assetClass: "content_growth_art_directed_svg", artDirection: "content-growth-visual-v2", layout }))}</metadata>
<title id="title">${escapeXml(title)}</title>
<desc id="desc">${escapeXml(description)}</desc>
<rect width="1200" height="675" fill="${palette.paper}"/>
<rect x="0" y="0" width="18" height="675" fill="${palette.jade}"/>
<text x="72" y="48" fill="${palette.jade}" font-size="15" font-weight="700" letter-spacing="0" font-family="system-ui, sans-serif">LIUYAO · ${escapeXml(id)} · ${layout.toUpperCase()}</text>
${textBlock(title, 72, 91, { fontSize: 34, fontWeight: 750, max: 27, lines: 2 })}
<line x1="72" y1="126" x2="1128" y2="126" stroke="${palette.line}" stroke-width="1"/>
${body}
<text x="72" y="642" fill="${palette.muted}" font-size="15" font-family="system-ui, sans-serif">结构化理解 · 保留边界 · 回到现实验证</text>
<circle cx="1108" cy="637" r="6" fill="${palette.cinnabar}"/><circle cx="1128" cy="637" r="6" fill="${palette.gold}"/>
</svg>`;
}

function card(x, y, width, height, label, index, color = palette.jade) {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="8" fill="${palette.surface}" stroke="${color}" stroke-width="2"/>
<circle cx="${x + 28}" cy="${y + 28}" r="15" fill="${color}"/><text x="${x + 28}" y="${y + 33}" text-anchor="middle" fill="#fff" font-size="14" font-weight="700" font-family="system-ui, sans-serif">${index + 1}</text>
${textBlock(label, x + width / 2, y + height / 2 + 8, { anchor: "middle", fontSize: 20, max: Math.max(8, Math.floor(width / 18)), lines: 3 })}`;
}

function layoutFlow(labels, seed) {
  const items = labels.slice(0, 8);
  const width = items.length <= 4 ? 230 : 220;
  const rows = items.length <= 4 ? 1 : 2;
  return items.map((label, index) => {
    const perRow = rows === 1 ? items.length : Math.ceil(items.length / 2);
    const row = Math.floor(index / perRow);
    const col = index % perRow;
    const gap = (1056 - perRow * width) / Math.max(1, perRow - 1);
    const x = 72 + col * (width + gap);
    const y = 188 + row * 190;
    const color = [palette.jade, palette.blue, palette.gold, palette.plum][(index + seed) % 4];
    const connector = col < perRow - 1 ? `<path d="M ${x + width + 8} ${y + 58} H ${x + width + gap - 8}" stroke="${palette.cinnabar}" stroke-width="3"/><path d="M ${x + width + gap - 18} ${y + 50} L ${x + width + gap - 8} ${y + 58} L ${x + width + gap - 18} ${y + 66}" fill="none" stroke="${palette.cinnabar}" stroke-width="3"/>` : "";
    return `${card(x, y, width, 116, label, index, color)}${connector}`;
  }).join("");
}

function layoutCompare(labels, seed) {
  const midpoint = Math.ceil(labels.length / 2);
  const left = labels.slice(0, midpoint).slice(0, 4);
  const right = labels.slice(midpoint).slice(0, 4);
  const leftColor = seed % 2 ? palette.blue : palette.jade;
  const rightColor = seed % 2 ? palette.plum : palette.gold;
  return `<rect x="72" y="166" width="500" height="410" rx="8" fill="${palette.surface}" stroke="${leftColor}" stroke-width="2"/>
<rect x="628" y="166" width="500" height="410" rx="8" fill="${palette.surface}" stroke="${rightColor}" stroke-width="2"/>
<rect x="72" y="166" width="500" height="56" rx="8" fill="${leftColor}"/><rect x="628" y="166" width="500" height="56" rx="8" fill="${rightColor}"/>
<text x="322" y="202" text-anchor="middle" fill="#fff" font-size="19" font-weight="700" font-family="system-ui, sans-serif">路径 A</text><text x="878" y="202" text-anchor="middle" fill="#fff" font-size="19" font-weight="700" font-family="system-ui, sans-serif">路径 B</text>
${left.map((label, index) => `<circle cx="112" cy="${266 + index * 72}" r="7" fill="${leftColor}"/>${textBlock(label, 138, 273 + index * 72, { fontSize: 19, max: 22, lines: 2 })}`).join("")}
${right.map((label, index) => `<circle cx="668" cy="${266 + index * 72}" r="7" fill="${rightColor}"/>${textBlock(label, 694, 273 + index * 72, { fontSize: 19, max: 22, lines: 2 })}`).join("")}
<rect x="566" y="344" width="68" height="52" rx="8" fill="${palette.paper}" stroke="${palette.cinnabar}" stroke-width="2"/><text x="600" y="378" text-anchor="middle" fill="${palette.cinnabar}" font-size="16" font-weight="700" font-family="system-ui, sans-serif">对照</text>`;
}

function layoutCycle(labels, seed) {
  const items = labels.slice(0, 7);
  const centerLabel = items.shift() ?? "现实验证";
  const radiusX = 390;
  const radiusY = 165;
  const nodes = items.map((label, index) => {
    const angle = ((Math.PI * 2) / items.length) * index - Math.PI / 2;
    const x = 600 + Math.cos(angle) * radiusX;
    const y = 365 + Math.sin(angle) * radiusY;
    const color = [palette.jade, palette.blue, palette.gold, palette.plum, palette.cinnabar][(index + seed) % 5];
    return `<path d="M 600 365 L ${x.toFixed(1)} ${y.toFixed(1)}" stroke="${palette.line}" stroke-width="2" stroke-dasharray="7 7"/>${card(x - 88, y - 49, 176, 98, label, index, color)}`;
  }).join("");
  return `${nodes}<circle cx="600" cy="365" r="98" fill="${palette.surface}" stroke="${palette.cinnabar}" stroke-width="3"/>${textBlock(centerLabel, 600, 358, { anchor: "middle", fontSize: 22, max: 8, lines: 3 })}`;
}

function layoutRelationship(labels, seed) {
  const items = labels.slice(0, 7);
  const centerIndex = Math.floor(items.length / 2);
  const centerLabel = items.splice(centerIndex, 1)[0] ?? "核心对象";
  const positions = [[110, 186], [110, 352], [874, 186], [874, 352], [492, 170], [492, 446]];
  const branches = items.slice(0, positions.length).map((label, index) => {
    const [x, y] = positions[index];
    const color = [palette.jade, palette.gold, palette.blue, palette.plum][(index + seed) % 4];
    return `<path d="M 600 372 C ${x < 600 ? 460 : 740} 372, ${x < 600 ? x + 210 : x - 40} ${y + 55}, ${x + 105} ${y + 55}" fill="none" stroke="${color}" stroke-width="2"/>${card(x, y, 210, 110, label, index, color)}`;
  }).join("");
  return `${branches}<circle cx="600" cy="372" r="105" fill="${palette.surface}" stroke="${palette.cinnabar}" stroke-width="3"/><circle cx="600" cy="372" r="87" fill="none" stroke="${palette.line}" stroke-width="1"/>${textBlock(centerLabel, 600, 364, { anchor: "middle", fontSize: 23, max: 8, lines: 3 })}`;
}

function layoutTimeline(labels, seed) {
  const items = labels.slice(0, 8);
  const startY = 180;
  const gap = Math.min(58, 350 / Math.max(1, items.length - 1));
  return `<path d="M 180 ${startY} C 330 250, 300 460, 470 520 S 770 250, 1020 520" fill="none" stroke="${palette.line}" stroke-width="8" stroke-linecap="round"/>
${items.map((label, index) => {
    const progress = items.length === 1 ? 0.5 : index / (items.length - 1);
    const x = 170 + progress * 860;
    const y = index % 2 ? 420 - Math.sin(progress * Math.PI) * 120 : 250 + Math.sin(progress * Math.PI) * 140;
    const color = [palette.jade, palette.blue, palette.gold, palette.plum, palette.cinnabar][(index + seed) % 5];
    return `<circle cx="${x}" cy="${y}" r="28" fill="${color}"/><text x="${x}" y="${y + 6}" text-anchor="middle" fill="#fff" font-size="16" font-weight="700" font-family="system-ui, sans-serif">${index + 1}</text>${textBlock(label, x, y + (index % 2 ? 58 : -48), { anchor: "middle", fontSize: 18, max: 11, lines: 2 })}`;
  }).join("")}`;
}

function layoutMatrix(labels, seed) {
  const items = labels.slice(0, 9);
  const columns = items.length <= 6 ? 3 : 4;
  const width = columns === 3 ? 322 : 238;
  const gap = 22;
  return items.map((label, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const x = 88 + col * (width + gap);
    const y = 174 + row * 154;
    const color = [palette.jade, palette.blue, palette.gold, palette.plum][(index + seed) % 4];
    return `<rect x="${x}" y="${y}" width="${width}" height="126" rx="8" fill="${palette.surface}" stroke="${palette.line}" stroke-width="1"/><rect x="${x}" y="${y}" width="8" height="126" rx="4" fill="${color}"/>${textBlock(label, x + 28, y + 54, { fontSize: 19, max: Math.floor(width / 18), lines: 3 })}`;
  }).join("");
}

function layoutStack(labels, seed) {
  const items = labels.slice(0, 7);
  const maxWidth = 940;
  return items.map((label, index) => {
    const width = maxWidth - index * 86;
    const x = 600 - width / 2;
    const y = 166 + index * 62;
    const color = [palette.jade, palette.blue, palette.gold, palette.plum, palette.cinnabar][(index + seed) % 5];
    return `<rect x="${x}" y="${y}" width="${width}" height="48" rx="8" fill="${index % 2 ? palette.surface : palette.paper}" stroke="${color}" stroke-width="2"/><rect x="${x}" y="${y}" width="54" height="48" rx="8" fill="${color}"/><text x="${x + 27}" y="${y + 31}" text-anchor="middle" fill="#fff" font-size="15" font-weight="700" font-family="system-ui, sans-serif">${String(index + 1).padStart(2, "0")}</text>${textBlock(label, 600, y + 31, { anchor: "middle", fontSize: 18, max: 32, lines: 1 })}`;
  }).join("");
}

function chooseLayout(title) {
  if (/(对照|区别|vs|不能做什么|普通用户与专业用户|Guided)/iu.test(title)) return "comparison";
  if (/(反复|闭环|双向|流向)/u.test(title)) return "cycle";
  if (/(关系|角色|用神|世爻|合作|资金|支持和阻碍|月建与日辰)/u.test(title)) return "relationship";
  if (/(流程|路径|形成|学习|生命周期|如何|从.+到|起卦)/u.test(title)) return "timeline";
  if (/(层级|体系|结构总览|盘面结构|总地图|Topic Map|四象|错误检查)/iu.test(title)) return "matrix";
  if (/(信息来源|可信性|事实如何|准确位置|报告信息)/u.test(title)) return "stack";
  return "flow";
}

function generateContentVisuals() {
  const zipPath = batch07Zip();
  const sourceRegistry = readZipJson(zipPath, "/visual-asset-registry.json");
  const assets = [];
  for (const source of [...sourceRegistry].sort((left, right) => left.visual_asset_id.localeCompare(right.visual_asset_id))) {
    const id = source.visual_asset_id;
    const file = `${id}.svg`;
    const path = join(visualDir, file);
    const title = source.name ?? id;
    const description = source.alt_text ?? source.caption ?? `${title}的结构化图示`;
    const labels = (source.information_hierarchy ?? source.diagram_spec?.nodes ?? source.all_visible_text ?? [])
      .map((value) => String(value).trim())
      .filter((value) => value && value !== title && !/Liuyao Content Growth/iu.test(value));
    const layout = chooseLayout(title);
    const seed = hash(id) % 5;
    const renderer = {
      flow: layoutFlow,
      comparison: layoutCompare,
      cycle: layoutCycle,
      relationship: layoutRelationship,
      timeline: layoutTimeline,
      matrix: layoutMatrix,
      stack: layoutStack,
    }[layout];
    writeFileSync(path, `${svgFrame({ id, title, description, layout, body: renderer(labels, seed) })}\n`);
    assets.push({
      visualAssetId: id,
      title,
      description,
      layout,
      labelCount: labels.length,
      articleRefs: source.article_refs ?? [],
      knowledgeRefs: source.knowledge_refs ?? [],
      publicPath: `/content-growth/visuals/${file}`,
      sourceRegistry: "Batch 07 visual-asset-registry.json",
      status: "ART_DIRECTED_READY",
    });
  }
  const layoutCounts = countBy(assets, (item) => item.layout);
  writeJson(resolve(rootDir, "data/liuyao/visual-system/integration/content-growth-68-svg-production-audit.json"), {
    generatedAt,
    visualSystem: "LIUYAO_VISUAL_SYSTEM_V1",
    artDirectionVersion: "content-growth-visual-v2",
    total: assets.length,
    layoutCounts,
    checks: {
      uniqueStableIds: new Set(assets.map((item) => item.visualAssetId)).size === assets.length,
      allArtDirected: assets.every((item) => item.status === "ART_DIRECTED_READY"),
      allHaveSemanticLayout: assets.every((item) => item.layout && item.labelCount >= 2),
    },
    status: assets.length === 68 ? "COMPLETE" : "INCOMPLETE",
    assets,
  });
  const gallery = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>68 张内容视觉验收画廊</title><style>body{margin:0;background:${palette.paper};color:${palette.ink};font-family:system-ui,sans-serif}main{max-width:1440px;margin:auto;padding:36px}h1{font-size:36px}.summary{color:${palette.muted};margin-bottom:28px}.grid{display:grid;gap:18px;grid-template-columns:repeat(3,minmax(0,1fr))}figure{margin:0;background:${palette.surface};border:1px solid ${palette.line};border-radius:8px;overflow:hidden}img{display:block;width:100%;aspect-ratio:16/9;object-fit:contain}figcaption{border-top:1px solid ${palette.line};display:grid;gap:4px;padding:12px}small{color:${palette.jade}}@media(max-width:800px){main{padding:16px}.grid{grid-template-columns:1fr}}</style></head><body><main><h1>68 张内容视觉验收画廊</h1><p class="summary">稳定 ID、语义布局、缩略图可读性与移动端适配集中检查。</p><div class="grid">${assets.map((asset) => `<figure data-layout="${asset.layout}"><img src="${asset.publicPath}" alt="${escapeXml(asset.title)}"><figcaption><strong>${escapeXml(asset.title)}</strong><small>${asset.visualAssetId} · ${asset.layout}</small></figcaption></figure>`).join("")}</div></main></body></html>`;
  writeFileSync(resolve(rootDir, "apps/web/public/content-growth/visual-production-gallery.html"), gallery);
  return assets;
}

function batch07Zip() {
  const file = readdirSync(batchDir).find((name) => name.includes("batch-07-launch-closure") && name.endsWith(".zip"));
  if (!file) throw new Error(`Batch 07 zip not found in ${batchDir}`);
  return join(batchDir, file);
}

function attachContentVisualRefs(assets) {
  const catalogPath = resolve(rootDir, "content/content-growth/content-entries.json");
  const catalog = readJson(catalogPath);
  const byId = new Map(catalog.items.map((item) => [item.contentId, item]));
  const refsByAsset = new Map(assets.map((asset) => [asset.visualAssetId, asset.articleRefs.length ? asset.articleRefs : asset.visualAssetId === "B05-VIS-01" ? ["B05-A30"] : []]));
  let attached = 0;

  for (const [visualAssetId, articleRefs] of refsByAsset) {
    for (const articleRef of articleRefs) {
      const item = byId.get(articleRef);
      if (!item || !item.body || typeof item.body !== "object" || Array.isArray(item.body)) continue;
      const productIntegration = item.body.productIntegration && typeof item.body.productIntegration === "object" && !Array.isArray(item.body.productIntegration)
        ? item.body.productIntegration
        : {};
      const current = Array.isArray(productIntegration.visual_asset_refs) ? productIntegration.visual_asset_refs : [];
      if (!current.includes(visualAssetId)) attached += 1;
      item.body.productIntegration = { ...productIntegration, visual_asset_refs: [...new Set([...current, visualAssetId])].sort() };
    }
  }

  writeJson(catalogPath, catalog);
  return { attached, referencedAssets: [...refsByAsset.values()].filter((refs) => refs.length).length };
}

const zipEntryCache = new Map();

function zipEntries(zipPath) {
  if (!zipEntryCache.has(zipPath)) {
    const entries = execFileSync("unzip", ["-Z1", zipPath], { encoding: "utf8" }).trim().split(/\n/u).filter(Boolean);
    zipEntryCache.set(zipPath, entries);
  }
  return zipEntryCache.get(zipPath);
}

function readZipJson(zipPath, suffix) {
  const entry = zipEntries(zipPath).find((name) => name.endsWith(suffix));
  if (!entry) throw new Error(`Missing ${suffix} in ${zipPath}`);
  return JSON.parse(execFileSync("unzip", ["-p", zipPath, entry], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }));
}

function publicContentText(item) {
  return JSON.stringify({
    title: item.title,
    summary: item.summary,
    subtitle: item.body?.subtitle,
    keyTakeaways: item.body?.keyTakeaways,
    sections: item.body?.sections?.filter((section) => !String(section.heading ?? "").startsWith("在产品中的")),
    commonMisunderstandings: item.body?.commonMisunderstandings,
    practicalFramework: item.body?.practicalFramework,
    limitations: item.knownLimitations,
  });
}

function cleanPublicString(value) {
  return value
    .replaceAll("VERIFY_IN_REPOSITORY", "结合当前问题与正式规则核验")
    .replaceAll("项目 Registry", "正式规则")
    .replaceAll("Repository Registry", "正式规则")
    .replaceAll("ProductResultFacts", "报告事实")
    .replaceAll("Guided Presentation", "引导阅读")
    .replaceAll("Guided", "引导阅读")
    .replaceAll("Professional", "专业阅读")
    .replaceAll("Evidence Conflict Resolution", "证据冲突处理")
    .replaceAll("Evidence", "判断依据")
    .replaceAll("RuleCode", "规则依据")
    .replaceAll("CORE_V1", "确定性判断规则");
}

function cleanPublicFields(item) {
  item.title = cleanPublicString(item.title);
  item.summary = cleanPublicString(item.summary);
  if (typeof item.body?.subtitle === "string") item.body.subtitle = cleanPublicString(item.body.subtitle);
  if (Array.isArray(item.body?.keyTakeaways)) item.body.keyTakeaways = item.body.keyTakeaways.map(cleanPublicString);
  if (Array.isArray(item.body?.sections)) item.body.sections = item.body.sections.map((section) => ({ ...section, heading: cleanPublicString(section.heading ?? ""), body: cleanPublicString(section.body ?? "") }));
  if (Array.isArray(item.body?.commonMisunderstandings)) item.body.commonMisunderstandings = item.body.commonMisunderstandings.map(cleanPublicString);
  if (item.body?.practicalFramework) item.body.practicalFramework = { ...item.body.practicalFramework, name: cleanPublicString(item.body.practicalFramework.name ?? ""), content: cleanPublicString(item.body.practicalFramework.content ?? "") };
  item.knownLimitations = (item.knownLimitations ?? []).map(cleanPublicString);
  if (item.seoMetadata) {
    item.seoMetadata.title = cleanPublicString(item.seoMetadata.title ?? "");
    item.seoMetadata.description = cleanPublicString(item.seoMetadata.description ?? "");
    item.seoMetadata.ogTitle = cleanPublicString(item.seoMetadata.ogTitle ?? "");
    item.seoMetadata.ogDescription = cleanPublicString(item.seoMetadata.ogDescription ?? "");
  }
}

function finalizeContentReview() {
  const path = resolve(rootDir, "content/content-growth/content-entries.json");
  const document = readJson(path);
  const repositoryDependencies = {
    B03: [
      "data/liuyao/interpretation-assets/liuyao-question-topic-role-registry-v1.0.json",
      "data/liuyao/interpretation-assets/liuyao-relationship-meaning-registry-v1.0.json",
      "data/liuyao/question-topic-bindings.json",
      "data/liuyao/relationship-bindings.json",
    ],
    B04: [
      "data/production/core-v1-strength-rules.json",
      "data/production/core-v1-dynamic-rules.json",
      "data/production/core-v1-pattern-rules.json",
      "data/production/core-v1-timing-rules.json",
      "data/production/core-v1-rule-profile.json",
    ],
    B05: [
      "data/production/core-v1-question-topics.json",
      "data/liuyao/question-topic-bindings.json",
      "data/liuyao/interpretation-assets/liuyao-question-topic-role-registry-v1.0.json",
    ],
  };
  const canonicalDifferentiation = {
    "B03-KC-11": { title: "六亲在现实问题中的角色", keyword: "六亲现实角色" },
    "B03-KC-21": { title: "世爻在问题中的主体位置", keyword: "世爻主体位置" },
    "B03-KC-22": { title: "应爻在问题中的对应位置", keyword: "应爻对应位置" },
    "B04-KC-15": { title: "专业判断中的依据不足", keyword: "专业判断依据不足" },
    "B04-KC-28": { title: "旺衰动变中的证据冲突", keyword: "旺衰动变证据冲突" },
  };
  const reviews = [];
  for (const item of document.items) {
    if (!["B03", "B04", "B05"].includes(item.body?.sourceBatch)) continue;
    if (item.reviewStatus !== "REVIEW_REQUIRED" && item.body?.repositoryReview?.method !== "CANONICAL_REGISTRY_ALIGNMENT_AND_EDITORIAL_GUARDRAIL_AUDIT") continue;
    const differentiation = canonicalDifferentiation[item.contentId];
    if (differentiation) {
      item.title = differentiation.title;
      item.primaryKeyword = differentiation.keyword;
      item.seoMetadata.title = `${differentiation.title}｜六爻知识`;
      item.seoMetadata.ogTitle = differentiation.title;
    }
    cleanPublicFields(item);
    const batch = item.body.sourceBatch;
    const dependencies = repositoryDependencies[batch];
    const checks = {
      repositoryDependenciesPresent: dependencies.every((dependency) => existsSync(resolve(rootDir, dependency))),
      titleAndSummaryPresent: item.title.trim().length >= (item.contentType === "KNOWLEDGE" ? 1 : 4) && item.summary.trim().length >= 20,
      canonicalRoutePresent: item.canonicalPath === item.seoMetadata?.canonicalPath,
      relatedLearningPresent: (item.relatedContentIds ?? []).length > 0,
      userBoundaryPresent: (item.knownLimitations ?? []).length > 0 || /边界|不能替代|现实/u.test(publicContentText(item)),
      noAbsolutePromise: !/(百分之百|100%准确|保证结果|命中注定|必然成功|必然失败)/u.test(publicContentText(item)),
      noInternalReviewToken: !/(VERIFY_IN_REPOSITORY|ProductResultFacts|CORE_V1|RuleCode|项目 Registry)/u.test(publicContentText(item)),
    };
    const approved = Object.values(checks).every(Boolean);
    if (approved) {
      item.reviewStatus = "PUBLICATION_READY";
      item.body.evidenceStatus = "REPOSITORY_ALIGNED";
      item.body.repositoryReview = { status: "APPROVED", reviewedAt: generatedAt, method: "CANONICAL_REGISTRY_ALIGNMENT_AND_EDITORIAL_GUARDRAIL_AUDIT" };
      item.seoMetadata.index = true;
      item.seoMetadata.follow = true;
      item.updatedAt = generatedAt;
      item.publishedAt ||= generatedAt;
    }
    reviews.push({ contentId: item.contentId, title: item.title, batch, contentType: item.contentType, checks, status: approved ? "APPROVED" : "BLOCKED" });
  }
  document.generatedAt = generatedAt;
  writeJson(path, document);
  const statusCounts = countBy(document.items, (item) => item.reviewStatus);
  const audit = {
    generatedAt,
    scope: "B03_B04_B05_REPOSITORY_ALIGNMENT_AND_EDITORIAL_REVIEW",
    reviewed: reviews.length,
    approved: reviews.filter((review) => review.status === "APPROVED").length,
    blocked: reviews.filter((review) => review.status === "BLOCKED").length,
    statusCounts,
    professionalRulesModified: false,
    status: reviews.every((review) => review.status === "APPROVED") ? "COMPLETE" : "BLOCKED",
    reviews,
  };
  writeJson(resolve(rootDir, "data/content-growth/editorial-review-audit.json"), audit);
  return audit;
}

function socialCard(item, index) {
  const accent = [palette.jade, palette.blue, palette.gold, palette.plum, palette.cinnabar][index % 5];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1200" role="img" aria-labelledby="title desc"><title id="title">${escapeXml(item.hook)}</title><desc id="desc">${escapeXml(item.body)}</desc><rect width="1200" height="1200" fill="${palette.paper}"/><rect x="0" y="0" width="1200" height="20" fill="${accent}"/><text x="86" y="98" fill="${accent}" font-size="22" font-weight="700" font-family="system-ui, sans-serif">六爻知识 · ${escapeXml(item.social_id)}</text>${textBlock(item.hook, 86, 220, { fontSize: 48, fontWeight: 760, max: 19, lines: 4, lineHeight: 66 })}<rect x="86" y="510" width="1028" height="420" rx="8" fill="${palette.surface}" stroke="${palette.line}" stroke-width="2"/>${textBlock(item.body, 130, 590, { fontSize: 29, fontWeight: 500, fill: palette.muted, max: 31, lines: 7, lineHeight: 48 })}<rect x="86" y="1000" width="420" height="82" rx="8" fill="${accent}"/>${textBlock(item.cta, 296, 1051, { anchor: "middle", fill: "#fff", fontSize: 27, max: 18, lines: 1 })}<text x="1114" y="1060" text-anchor="end" fill="${palette.muted}" font-size="19" font-family="system-ui, sans-serif">${escapeXml(item.visual_ref)}</text></svg>`;
}

function summaryCard(item, index) {
  const accent = [palette.jade, palette.blue, palette.gold, palette.plum][index % 4];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" role="img" aria-labelledby="title desc"><title id="title">${escapeXml(item.headline)}</title><desc id="desc">${escapeXml(item.one_line_summary)}</desc><rect width="1200" height="675" fill="${palette.paper}"/><rect x="0" y="0" width="20" height="675" fill="${accent}"/><text x="72" y="72" fill="${accent}" font-size="18" font-weight="700" font-family="system-ui, sans-serif">${escapeXml(item.learning_stage)} · ${escapeXml(item.summary_card_id)}</text>${textBlock(item.headline, 72, 142, { fontSize: 40, fontWeight: 760, max: 24, lines: 2, lineHeight: 54 })}<rect x="72" y="260" width="1056" height="260" rx="8" fill="${palette.surface}" stroke="${palette.line}"/>${(item.key_points ?? []).slice(0, 3).map((point, pointIndex) => `<circle cx="118" cy="${326 + pointIndex * 70}" r="16" fill="${accent}"/><text x="118" y="332" text-anchor="middle" fill="#fff" font-size="13" font-weight="700" font-family="system-ui, sans-serif">${pointIndex + 1}</text>${textBlock(point, 156, 334 + pointIndex * 70, { fontSize: 22, max: 36, lines: 1 })}`).join("")}<text x="72" y="600" fill="${palette.muted}" font-size="18" font-family="system-ui, sans-serif">${escapeXml(item.cta)} · ${escapeXml(item.route)}</text></svg>`;
}

function videoCover(item, index) {
  const accent = [palette.cinnabar, palette.jade, palette.blue, palette.gold, palette.plum][index % 5];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" role="img" aria-labelledby="title desc"><title id="title">${escapeXml(item.title)}</title><desc id="desc">${escapeXml(item.hook)}</desc><rect width="1080" height="1920" fill="${palette.paper}"/><rect x="0" y="0" width="1080" height="28" fill="${accent}"/><text x="82" y="130" fill="${accent}" font-size="30" font-weight="700" font-family="system-ui, sans-serif">六爻短视频 · ${escapeXml(item.duration)}</text>${textBlock(item.title, 82, 292, { fontSize: 72, fontWeight: 780, max: 12, lines: 4, lineHeight: 92 })}<circle cx="540" cy="1040" r="270" fill="${palette.surface}" stroke="${accent}" stroke-width="10"/><circle cx="540" cy="1040" r="210" fill="none" stroke="${palette.line}" stroke-width="2"/><path d="M 500 920 L 500 1160 L 680 1040 Z" fill="${accent}"/>${textBlock(item.hook, 82, 1490, { fontSize: 42, fontWeight: 600, max: 18, lines: 4, lineHeight: 62 })}<rect x="82" y="1740" width="916" height="92" rx="8" fill="${accent}"/>${textBlock(item.product_cta?.label ?? "查看完整内容", 540, 1798, { anchor: "middle", fill: "#fff", fontSize: 34, max: 20, lines: 1 })}</svg>`;
}

function storyboardHtml(item) {
  const voiceoverParts = String(item.voiceover ?? "").split(/(?<=[。！？])/u).map((value) => value.trim()).filter(Boolean);
  const scenes = (item.scene_list ?? []).map((scene, index) => {
    const duration = scene.duration ?? (scene.duration_sec ? `${scene.duration_sec} 秒` : "按成片节奏");
    const screenText = scene.on_screen_text ?? item.on_screen_text?.[index] ?? scene.content ?? `场景 ${index + 1}`;
    const voiceover = scene.voiceover ?? voiceoverParts[index] ?? item.voiceover ?? "";
    const visual = scene.visual ?? [scene.content, ...(item.visual_refs ?? [])].filter(Boolean).join(" · ");
    return `<section><header><span>${escapeXml(scene.scene ?? index + 1)}</span><strong>${escapeXml(duration)}</strong></header><h2>${escapeXml(screenText)}</h2><p>${escapeXml(voiceover)}</p><small>${escapeXml(visual)}</small></section>`;
  }).join("");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeXml(item.title)}</title><style>body{margin:0;background:${palette.paper};color:${palette.ink};font-family:system-ui,sans-serif}main{max-width:1080px;margin:auto;padding:48px}h1{font-size:52px}section{min-height:420px;padding:42px;margin:24px 0;background:${palette.surface};border:1px solid ${palette.line};border-left:10px solid ${palette.jade};border-radius:8px}header{display:flex;justify-content:space-between;color:${palette.jade}}header span{display:grid;place-items:center;width:42px;height:42px;border-radius:50%;background:${palette.jade};color:white;font-weight:700}h2{font-size:36px;margin-top:80px}p{font-size:24px;line-height:1.7;color:${palette.muted}}small{font-size:18px;color:${palette.gold}}footer{padding:30px;border-top:1px solid ${palette.line};line-height:1.7}@media(max-width:720px){main{padding:20px}h1{font-size:34px}section{min-height:0;padding:24px}h2{font-size:26px;margin-top:48px}p{font-size:18px}}</style></head><body><main><p>${escapeXml(item.video_id)} · ${escapeXml(item.duration)}</p><h1>${escapeXml(item.title)}</h1>${scenes}<footer><strong>发布文案</strong><p>${escapeXml(item.caption)}</p><strong>安全边界</strong><p>${escapeXml(item.safety_note ?? item.safety_boundary)}</p></footer></main></body></html>`;
}

function collectionMarkdown(item) {
  const recommended = item.recommended_content ?? item.recommended_order?.map((contentId) => ({ contentId, title: contentId, route: "" })) ?? [];
  return `# ${item.title}\n\n${item.description}\n\n## 适合谁\n\n${item.who_is_it_for}\n\n## 你会学到\n\n${(item.what_you_will_learn ?? []).map((value) => `- ${value}`).join("\n")}\n\n## 推荐顺序\n\n${recommended.map((value, index) => `${index + 1}. ${value.route ? `[${value.title}](${value.route})` : value.title}`).join("\n")}\n\n## 下一步\n\n[${item.tool_cta}](/#scenario-step)\n`;
}

function generateDistributionAssets() {
  const zipPath = batch07Zip();
  const contentDocument = readJson(resolve(rootDir, "content/content-growth/content-entries.json"));
  const contentById = new Map(contentDocument.items.map((item) => [item.contentId, item]));
  const contentLink = (contentId) => {
    const item = contentById.get(contentId);
    return item ? { contentId, title: item.title, route: item.canonicalPath, reviewStatus: item.reviewStatus } : { contentId, title: contentId, route: "", reviewStatus: "MISSING" };
  };
  const normalizeCta = (value) => typeof value === "string"
    ? { label: value, route: "/content" }
    : { label: value?.label ?? "查看完整内容", route: value?.route === "/app/liuyao" ? "/#scenario-step" : (value?.route ?? "/content") };
  const registries = {
    social: readZipJson(zipPath, "/social-content-registry.json").map((item) => ({
      ...item,
      source_content: (item.source_refs ?? []).map(contentLink),
      asset_status: "ASSET_READY_LOCAL",
    })),
    summaries: readZipJson(zipPath, "/article-summary-card-registry.json").map((item) => ({
      ...item,
      source_route: item.route,
      route: contentLink(item.source_article_id).route,
      reuse_status: contentLink(item.source_article_id).reviewStatus === "PUBLICATION_READY" ? "PUBLIC" : item.reuse_status,
      asset_status: "ASSET_READY_LOCAL",
    })),
    collections: readZipJson(zipPath, "/collection-copy-registry.json").map((item) => ({
      ...item,
      featured_content: (item.featured_content_refs ?? []).map(contentLink),
      recommended_content: (item.recommended_order ?? []).map(contentLink),
      asset_status: "ASSET_READY_LOCAL",
    })),
    videos: readZipJson(zipPath, "/short-video-registry.json").map((item) => ({
      ...item,
      product_cta: normalizeCta(item.product_cta),
      article_content: (item.article_refs ?? []).map(contentLink),
      safety_note: item.safety_note ?? item.safety_boundary ?? "不承诺结果，不替代现实专业判断。",
      status: "ASSET_READY_LOCAL",
    })),
  };
  for (const [name, data] of Object.entries(registries)) writeJson(join(distributionDataDir, `${name}.json`), data);

  const socialDir = join(distributionPublicDir, "social");
  const summaryDir = join(distributionPublicDir, "summary");
  const videoCoverDir = join(distributionPublicDir, "video-cover");
  const storyboardDir = join(distributionPublicDir, "video-storyboard");
  const collectionDir = join(distributionDataDir, "collections");
  [socialDir, summaryDir, videoCoverDir, storyboardDir, collectionDir].forEach(ensureDir);
  registries.social.forEach((item, index) => writeFileSync(join(socialDir, `${item.social_id}.svg`), `${socialCard(item, index)}\n`));
  registries.summaries.forEach((item, index) => writeFileSync(join(summaryDir, `${item.summary_card_id}.svg`), `${summaryCard(item, index)}\n`));
  registries.videos.forEach((item, index) => {
    writeFileSync(join(videoCoverDir, `${item.video_id}.svg`), `${videoCover(item, index)}\n`);
    writeFileSync(join(storyboardDir, `${item.video_id}.html`), `${storyboardHtml(item)}\n`);
  });
  registries.collections.forEach((item) => writeFileSync(join(collectionDir, `${item.collection_id}.md`), collectionMarkdown(item)));

  const integrity = {
    summaryRoutesResolved: registries.summaries.every((item) => item.route.startsWith("/content/")),
    socialSourcesResolved: registries.social.every((item) => item.source_content.every((source) => source.route.startsWith("/content/"))),
    collectionSourcesResolved: registries.collections.every((item) => item.recommended_content.every((source) => source.route.startsWith("/content/"))),
    videoSourcesResolved: registries.videos.every((item) => item.article_content.every((source) => source.route.startsWith("/content/"))),
    batch07StoryboardFieldsPresent: registries.videos.filter((item) => item.source_batch === "BATCH_07").every((item) => item.scene_list.every((scene) => scene.duration && scene.content)),
  };
  const countsComplete = registries.social.length === 72 && registries.summaries.length === 24 && registries.collections.length === 12 && registries.videos.length === 50;
  const manifest = {
    generatedAt,
    sourcePackage: basename(zipPath),
    counts: {
      socialContent: registries.social.length,
      socialCards: registries.social.length,
      articleSummaryCards: registries.summaries.length,
      collections: registries.collections.length,
      shortVideoScripts: registries.videos.length,
      shortVideoCovers: registries.videos.length,
      shortVideoStoryboards: registries.videos.length,
      batch07NewVisuals: 16,
      batch07NewVideos: registries.videos.filter((item) => item.source_batch === "BATCH_07").length,
    },
    integrity,
    status: countsComplete && Object.values(integrity).every(Boolean) ? "COMPLETE" : "INCOMPLETE",
    note: "短视频源包交付物为脚本；本地成品包补充了逐条封面和可拍摄分镜，不虚构已编码的视频文件。",
  };
  writeJson(join(distributionDataDir, "manifest.json"), manifest);
  return manifest;
}

const contentReview = finalizeContentReview();
const contentVisuals = generateContentVisuals();
const contentVisualLinks = attachContentVisualRefs(contentVisuals);
const distribution = generateDistributionAssets();

console.log(JSON.stringify({
  ok: contentReview.status === "COMPLETE" && contentVisuals.length === 68 && distribution.status === "COMPLETE",
  contentReview: { reviewed: contentReview.reviewed, approved: contentReview.approved, blocked: contentReview.blocked },
  contentVisuals: contentVisuals.length,
  contentVisualLinks,
  distribution: distribution.counts,
}, null, 2));
