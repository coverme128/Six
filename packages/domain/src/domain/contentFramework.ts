// @ts-nocheck
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { indexes, loadDomainData } from "./dataStore.js";

export const CONTENT_SCHEMA_VERSION = "CONTENT_SCHEMA_V1";
export const PUBLICATION_STATUSES = new Set(["DRAFT", "REVIEW_REQUIRED", "REVIEWED", "PUBLICATION_READY", "DEFERRED", "DEMO_ONLY", "INTERNAL_ONLY"]);
export const PUBLIC_CONTENT_STATUSES = new Set(["PUBLICATION_READY"]);
export const CONTENT_TYPES = new Set(["LANDING_PAGE", "TRUST_PAGE", "KNOWLEDGE", "GLOSSARY", "TUTORIAL", "BLOG", "TRIGRAM", "HEXAGRAM", "FAQ", "LEARNING_PATH"]);
export const CTA_CODES = new Set([
  "START_LIUYAO",
  "START_MEIHUA",
  "CHOOSE_METHOD",
  "READ_TUTORIAL",
  "VIEW_KNOWLEDGE",
  "CONTINUE_LEARNING",
  "VIEW_RELATED_REPORT_GUIDE",
  "EXPORT_REPORT",
  "SUBMIT_FEEDBACK",
  "SHARE_ANONYMOUS_CARD",
]);
export const ANALYTICS_EVENTS = new Set([
  "landing_page_viewed",
  "content_viewed",
  "content_read_progress",
  "content_completed",
  "content_search_used",
  "content_related_clicked",
  "content_to_tool_clicked",
  "casting_started",
  "casting_completed",
  "report_viewed",
  "report_to_content_clicked",
  "learning_path_started",
  "learning_path_completed",
  "cta_clicked",
  "anonymous_share_started",
  "feedback_submitted",
]);

const REQUIRED_FIELDS = ["schemaVersion", "contentId", "contentType", "title", "slug", "canonicalPath", "summary", "domain", "reviewStatus", "contentVersion"];
const SAFE_DOMAINS = new Set(["iching", "liuyao", "meihua", "platform"]);
const SAFE_AUDIENCES = new Set(["BEGINNER", "ACTIVE_USER", "LEARNER", "PROFESSIONAL"]);
const SAFE_FUNNELS = new Set(["AWARENESS", "EDUCATION", "TRUST", "CONVERSION", "RETENTION", "GROWTH"]);
const SAFE_INTENTS = new Set(["INFORMATIONAL", "COMPARISON", "TRANSACTIONAL", "NAVIGATIONAL"]);
const SAFE_DIFFICULTY = new Set(["BEGINNER", "INTERMEDIATE", "ADVANCED"]);
const SAFETY_PATTERNS = [
  /(?<!不)(?<!不是)(?<!不能)(?<!无法)(?<!不应)保证.*(成功|结果|准确|应期)/u,
  /(?<!不)(?<!不能)(?<!无法)(?<!不可)(?:确诊|替代医生|停止治疗)/u,
  /(?:可以|能够|可)替代(?:律师|法律意见)|必胜诉/u,
  /稳赚|(?<!不)(?<!不是)(?<!不能)(?<!无法)(?<!不应)保证收益|(?<!不)(?<!不是)(?<!不能)(?<!无法)(?<!不应)确定回报/u,
];

function visibleBodyStrings(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(visibleBodyStrings);
  if (value && typeof value === "object") return Object.values(value).flatMap(visibleBodyStrings);
  return [];
}

function arrayOf(value) {
  return Array.isArray(value) ? value : [];
}

function slugOf(value) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/gu, "-").replace(/^-|-$/gu, "");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function readJsonFile(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJsonFile(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function normalizeDomain(value) {
  const text = String(value ?? "").toLowerCase();
  if (text.includes("六爻") || text.includes("liuyao")) return "liuyao";
  if (text.includes("梅花") || text.includes("meihua")) return "meihua";
  if (text.includes("platform")) return "platform";
  return "iching";
}

function defaultSeo(entry) {
  const index = entry.reviewStatus === "PUBLICATION_READY" && entry.seoMetadata?.index !== false;
  return {
    title: entry.seoMetadata?.title ?? entry.title,
    description: entry.seoMetadata?.description ?? entry.summary,
    canonicalPath: entry.canonicalPath,
    index,
    follow: index,
    ogTitle: entry.seoMetadata?.ogTitle ?? entry.title,
    ogDescription: entry.seoMetadata?.ogDescription ?? entry.summary,
    ogImage: entry.seoMetadata?.ogImage ?? "/og-default.png",
    twitterCard: entry.seoMetadata?.twitterCard ?? "summary_large_image",
    contentType: entry.contentType,
    publishedAt: entry.publishedAt ?? null,
    updatedAt: entry.updatedAt ?? null,
  };
}

export function normalizeContentEntry(raw = {}) {
  const contentType = raw.contentType ?? "KNOWLEDGE";
  const contentId = raw.contentId ?? raw.id ?? raw.code ?? `${contentType.toLowerCase()}:${raw.slug ?? raw.title ?? "entry"}`;
  const slug = raw.slug ?? slugOf(raw.code ?? raw.title ?? raw.title_zh ?? raw.name_zh ?? contentId);
  const title = raw.title ?? raw.title_zh ?? raw.name_zh ?? raw.question ?? contentId;
  const reviewStatus = raw.reviewStatus ?? "DEMO_ONLY";
  const canonicalPath = raw.canonicalPath ?? `/${contentType.toLowerCase().replaceAll("_", "-")}/${slug}`;
  const entry = {
    schemaVersion: raw.schemaVersion ?? CONTENT_SCHEMA_VERSION,
    contentId,
    contentType,
    title,
    slug,
    canonicalPath,
    summary: raw.summary ?? raw.summary_zh ?? raw.definition_zh ?? "",
    body: raw.body ?? {},
    domain: normalizeDomain(raw.domain),
    category: raw.category ?? "",
    tags: arrayOf(raw.tags ?? raw.keywords),
    audience: raw.audience ?? "BEGINNER",
    funnelStage: raw.funnelStage ?? "EDUCATION",
    searchIntent: raw.searchIntent ?? "INFORMATIONAL",
    difficulty: String(raw.difficulty ?? raw.level ?? "BEGINNER").toUpperCase(),
    primaryKeyword: raw.primaryKeyword ?? title,
    secondaryKeywords: arrayOf(raw.secondaryKeywords),
    primaryConversion: raw.primaryConversion ?? "",
    secondaryConversion: raw.secondaryConversion ?? "",
    trustGoal: raw.trustGoal ?? "",
    relatedKnowledgeIds: arrayOf(raw.relatedKnowledgeIds ?? raw.knowledgeIds),
    relatedContentIds: arrayOf(raw.relatedContentIds),
    prerequisiteContentIds: arrayOf(raw.prerequisiteContentIds ?? raw.prerequisites),
    nextContentId: raw.nextContentId ?? "",
    previousContentId: raw.previousContentId ?? "",
    faqIds: arrayOf(raw.faqIds),
    sourceRefs: arrayOf(raw.sourceRefs ?? raw.source_refs),
    knownLimitations: arrayOf(raw.knownLimitations),
    distributionPriority: raw.distributionPriority ?? "LOW",
    shareCardEligible: Boolean(raw.shareCardEligible),
    analyticsEvents: arrayOf(raw.analyticsEvents),
    seoMetadata: raw.seoMetadata ?? {},
    reviewStatus,
    contentVersion: raw.contentVersion ?? raw.version ?? "0.0.0",
    publishedAt: raw.publishedAt ?? null,
    updatedAt: raw.updatedAt ?? null,
  };
  entry.seoMetadata = defaultSeo(entry);
  return entry;
}

export function contentText(entry) {
  return [
    entry.contentId,
    entry.contentType,
    entry.title,
    entry.slug,
    entry.summary,
    entry.domain,
    entry.category,
    entry.primaryKeyword,
    ...entry.secondaryKeywords,
    ...entry.tags,
  ].join(" ").toLowerCase();
}

export function validateContentEntry(entry, { publicOnly = false } = {}) {
  const errors = [];
  for (const field of REQUIRED_FIELDS) {
    if (entry[field] === undefined || entry[field] === null || entry[field] === "") errors.push({ code: "CONTENT_REQUIRED_FIELD", field });
  }
  if (entry.schemaVersion !== CONTENT_SCHEMA_VERSION) errors.push({ code: "CONTENT_SCHEMA_VERSION", field: "schemaVersion" });
  if (!CONTENT_TYPES.has(entry.contentType)) errors.push({ code: "CONTENT_TYPE_INVALID", field: "contentType" });
  if (!PUBLICATION_STATUSES.has(entry.reviewStatus)) errors.push({ code: "CONTENT_STATUS_INVALID", field: "reviewStatus" });
  if (!SAFE_DOMAINS.has(entry.domain)) errors.push({ code: "CONTENT_DOMAIN_INVALID", field: "domain" });
  if (!SAFE_AUDIENCES.has(entry.audience)) errors.push({ code: "CONTENT_AUDIENCE_INVALID", field: "audience" });
  if (!SAFE_FUNNELS.has(entry.funnelStage)) errors.push({ code: "CONTENT_FUNNEL_INVALID", field: "funnelStage" });
  if (!SAFE_INTENTS.has(entry.searchIntent)) errors.push({ code: "CONTENT_INTENT_INVALID", field: "searchIntent" });
  if (!SAFE_DIFFICULTY.has(entry.difficulty)) errors.push({ code: "CONTENT_DIFFICULTY_INVALID", field: "difficulty" });
  if (!entry.canonicalPath.startsWith("/")) errors.push({ code: "CONTENT_CANONICAL_PATH", field: "canonicalPath" });
  if (/localhost|staging/i.test(entry.canonicalPath)) errors.push({ code: "CONTENT_CANONICAL_ENV", field: "canonicalPath" });
  if (entry.seoMetadata?.index && entry.reviewStatus !== "PUBLICATION_READY") errors.push({ code: "CONTENT_INDEX_STATUS", field: "seoMetadata.index" });
  if (publicOnly && !PUBLIC_CONTENT_STATUSES.has(entry.reviewStatus)) errors.push({ code: "CONTENT_NOT_PUBLIC", field: "reviewStatus" });
  for (const code of [entry.primaryConversion, entry.secondaryConversion].filter(Boolean)) {
    if (!CTA_CODES.has(code)) errors.push({ code: "CONTENT_CTA_INVALID", field: code });
  }
  for (const event of entry.analyticsEvents) {
    if (!ANALYTICS_EVENTS.has(event)) errors.push({ code: "CONTENT_ANALYTICS_INVALID", field: event });
  }
  const safetyFields = [entry.title, entry.summary, ...visibleBodyStrings(entry.body ?? {})];
  for (const pattern of SAFETY_PATTERNS) {
    if (safetyFields.some((text) => pattern.test(text))) errors.push({ code: "CONTENT_SAFETY_LANGUAGE", field: "body" });
  }
  return errors;
}

export class FileBasedContentRepository {
  constructor({ rootDir = process.cwd(), contentDir = "content", includePreview = false } = {}) {
    this.rootDir = rootDir;
    this.contentDir = contentDir;
    this.includePreview = includePreview;
    this.entries = null;
  }

  loadEntries() {
    if (this.entries) return this.entries;
    const dir = resolve(this.rootDir, this.contentDir);
    if (!existsSync(dir)) {
      this.entries = [];
      return this.entries;
    }
    const files = [];
    const walk = (current) => {
      for (const name of readdirSync(current, { withFileTypes: true })) {
        const path = join(current, name.name);
        if (name.isDirectory()) walk(path);
        else if (name.isFile() && name.name.endsWith(".json")) files.push(path);
      }
    };
    walk(dir);
    this.entries = files.flatMap((path) => {
      const data = readJsonFile(path);
      const items = Array.isArray(data) ? data : data.items ?? data.entries ?? data.contentEntries ?? [];
      return items.map(normalizeContentEntry);
    });
    return this.entries;
  }

  visibleEntries() {
    return this.loadEntries().filter((entry) => this.includePreview || PUBLIC_CONTENT_STATUSES.has(entry.reviewStatus));
  }

  getById(contentId) {
    return this.visibleEntries().find((entry) => entry.contentId === contentId) ?? null;
  }

  getBySlug(contentType, slug) {
    const type = String(contentType).toUpperCase().replaceAll("-", "_");
    const key = String(slug).toLowerCase();
    return this.visibleEntries().find((entry) => entry.contentType === type && entry.slug.toLowerCase() === key) ?? null;
  }

  list(query = {}) {
    return this.visibleEntries().filter((entry) => {
      if (query.contentType && entry.contentType !== String(query.contentType).toUpperCase().replaceAll("-", "_")) return false;
      if (query.domain && entry.domain !== query.domain) return false;
      if (query.category && entry.category !== query.category) return false;
      if (query.difficulty && entry.difficulty !== String(query.difficulty).toUpperCase()) return false;
      return true;
    });
  }

  search(query = "", filters = {}) {
    const q = String(query).trim().toLowerCase();
    return this.list(filters)
      .map((entry) => ({ entry, score: q ? (contentText(entry).includes(q) ? 2 : 0) : 1 }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title))
      .map((item) => ({ ...item.entry, score: item.score }));
  }

  getRelated(contentId) {
    const entry = this.getById(contentId);
    if (!entry) return [];
    const ids = [...entry.relatedContentIds, ...entry.relatedKnowledgeIds, ...entry.prerequisiteContentIds, entry.nextContentId, entry.previousContentId].filter(Boolean);
    return ids.map((id) => this.getById(id)).filter(Boolean);
  }

  getLearningPath(pathId) {
    return this.getById(pathId);
  }
}

export function existingSeedEntries(rootDir = process.cwd()) {
  const data = loadDomainData(rootDir);
  const idx = indexes(data);
  const commercialStatus = (item) => {
    const decision = item.commercial_decision?.decision;
    if (decision === "REWRITE") return "REVIEW_REQUIRED";
    if (decision === "REMOVE") return "DEFERRED";
    if (decision === "MERGE" || decision === "INTERNAL_ONLY") return "INTERNAL_ONLY";
    return "DEMO_ONLY";
  };
  const commercialBody = (item, base = {}) => ({
    ...base,
    ...(item.commercial_content ?? {}),
    commercialDecision: item.commercial_decision ?? null,
    commercialClosure: item.commercial_closure ?? null,
  });
  const closureRelated = (item) => item.commercial_content?.relatedContentRefs ?? [];
  const knowledge = data.knowledgeNodes.map((node) => normalizeContentEntry({
    contentId: `knowledge:${node.code}`,
    contentType: "KNOWLEDGE",
    title: node.title_zh,
    slug: node.slug ?? node.code,
    canonicalPath: `/knowledge/${node.slug ?? node.code}`,
    summary: node.commercial_content?.shortDefinition ?? node.summary,
    body: commercialBody(node),
    domain: node.commercial_content ? "liuyao" : node.domain,
    category: node.category,
    difficulty: node.difficulty,
    prerequisiteContentIds: node.prerequisites?.map((code) => `knowledge:${code}`) ?? [],
    relatedKnowledgeIds: node.commercial_content?.relatedKnowledgeRefs,
    relatedContentIds: [...new Set([...(node.commercial_content?.articleRefs ?? []), ...closureRelated(node)])],
    faqIds: node.commercial_content?.faqRefs,
    secondaryKeywords: node.commercial_content?.aliases,
    knownLimitations: node.commercial_content?.boundary ? [node.commercial_content.boundary] : [],
    reviewStatus: commercialStatus(node),
    seoMetadata: node.commercial_content?.seo ?? { index: false },
    contentVersion: node.version,
  }));
  const glossary = data.glossary.map((item) => normalizeContentEntry({
    contentId: `glossary:${item.code}`,
    contentType: "GLOSSARY",
    title: item.name_zh,
    slug: item.code,
    canonicalPath: `/glossary/${item.code}`,
    summary: item.commercial_content?.shortDefinition ?? item.definition_zh,
    body: commercialBody(item),
    domain: item.commercial_content ? "liuyao" : "iching",
    category: "glossary",
    secondaryKeywords: item.commercial_content?.aliases,
    relatedContentIds: closureRelated(item),
    knownLimitations: item.commercial_content?.boundary ? [item.commercial_content.boundary] : [],
    reviewStatus: commercialStatus(item),
    seoMetadata: item.commercial_content?.seo ?? { index: false },
    contentVersion: "1.0.0",
  }));
  const trigrams = data.trigrams.map((item) => normalizeContentEntry({
    contentId: `trigram:${item.code}`,
    contentType: "TRIGRAM",
    title: `${item.name_zh}卦`,
    slug: `trigram-${item.code}`,
    canonicalPath: `/trigrams/${item.code}`,
    summary: item.commercial_content?.shortDefinition ?? `${item.name_zh}，${item.nature}象，五行属${item.element}。`,
    body: commercialBody(item, item),
    domain: item.commercial_content ? "liuyao" : "iching",
    category: "trigram",
    secondaryKeywords: item.commercial_content?.aliases,
    relatedContentIds: closureRelated(item),
    knownLimitations: item.commercial_content?.boundary ? [item.commercial_content.boundary] : [],
    reviewStatus: commercialStatus(item),
    seoMetadata: item.commercial_content?.seo ?? { index: false },
    contentVersion: data.trigrams.version ?? "1.0.0",
  }));
  const hexagrams = data.hexagrams.map((item) => normalizeContentEntry({
    contentId: `hexagram:${item.code}`,
    contentType: "HEXAGRAM",
    title: `${item.sequence}. ${item.name_zh}`,
    slug: item.code,
    canonicalPath: `/hexagrams/${item.code}`,
    summary: item.commercial_content?.shortDefinition ?? `${item.name_zh}卦，上卦${idx.trigramByCode.get(item.upper_trigram)?.name_zh ?? item.upper_trigram}，下卦${idx.trigramByCode.get(item.lower_trigram)?.name_zh ?? item.lower_trigram}。`,
    body: commercialBody(item, item),
    domain: item.commercial_content ? "liuyao" : "iching",
    category: "hexagram",
    secondaryKeywords: item.commercial_content?.aliases,
    relatedContentIds: closureRelated(item),
    knownLimitations: item.commercial_content?.boundary ? [item.commercial_content.boundary] : [],
    reviewStatus: commercialStatus(item),
    seoMetadata: item.commercial_content?.seo ?? { index: false },
    contentVersion: data.hexagrams.version ?? "1.0.0",
  }));

  const linkSequence = (items) => {
    for (const [index, entry] of items.entries()) {
      entry.previousContentId = items[index - 1]?.contentId ?? "";
      entry.nextContentId = items[index + 1]?.contentId ?? "";
    }
  };
  const appendRelated = (entry, ids) => {
    entry.relatedContentIds = [...new Set([...(entry.relatedContentIds ?? []), ...ids.filter(Boolean)])];
  };

  linkSequence(knowledge);
  linkSequence(glossary);
  linkSequence(trigrams);
  linkSequence(hexagrams);

  for (const entry of knowledge) {
    const matches = glossary
      .filter((term) => `${entry.title} ${entry.summary}`.includes(term.title))
      .slice(0, 4)
      .map((term) => term.contentId);
    appendRelated(entry, matches);
  }

  for (const [index, term] of glossary.entries()) {
    const matches = knowledge
      .filter((entry) => `${entry.title} ${entry.summary}`.includes(term.title))
      .slice(0, 4)
      .map((entry) => entry.contentId);
    appendRelated(term, matches.length ? matches : [knowledge[index % knowledge.length]?.contentId]);
  }

  for (const trigram of trigrams) {
    const code = trigram.contentId.replace("trigram:", "");
    appendRelated(
      trigram,
      hexagrams
        .filter((hexagram) => hexagram.body?.upper_trigram === code || hexagram.body?.lower_trigram === code)
        .slice(0, 16)
        .map((hexagram) => hexagram.contentId)
    );
  }

  for (const hexagram of hexagrams) {
    appendRelated(hexagram, [`trigram:${hexagram.body?.upper_trigram}`, `trigram:${hexagram.body?.lower_trigram}`]);
  }
  return [...knowledge, ...glossary, ...trigrams, ...hexagrams];
}

export class HybridContentRepository extends FileBasedContentRepository {
  loadEntries() {
    if (this.entries) return this.entries;
    const sourceEntries = super.loadEntries();
    this.entries = [...sourceEntries, ...existingSeedEntries(this.rootDir)];
    return this.entries;
  }
}

export function ctaFor(code) {
  const registry = {
    START_LIUYAO: { label: "开始六爻起卦", url: "/", analyticsEvent: "content_to_tool_clicked" },
    START_MEIHUA: { label: "开始梅花起卦", url: "/meihua", analyticsEvent: "content_to_tool_clicked" },
    CHOOSE_METHOD: { label: "选择起卦方式", url: "/liuyao-vs-meihua", analyticsEvent: "cta_clicked" },
    READ_TUTORIAL: { label: "继续学习", url: "/learn", analyticsEvent: "cta_clicked" },
    VIEW_KNOWLEDGE: { label: "查看知识库", url: "/knowledge", analyticsEvent: "cta_clicked" },
    CONTINUE_LEARNING: { label: "继续学习路径", url: "/learn", analyticsEvent: "cta_clicked" },
    VIEW_RELATED_REPORT_GUIDE: { label: "查看报告说明", url: "/how-it-works", analyticsEvent: "cta_clicked" },
    EXPORT_REPORT: { label: "导出报告", url: "/history", analyticsEvent: "cta_clicked" },
    SUBMIT_FEEDBACK: { label: "提交反馈", url: "/feedback", analyticsEvent: "feedback_submitted" },
    SHARE_ANONYMOUS_CARD: { label: "生成匿名分享卡", url: "/share", analyticsEvent: "anonymous_share_started" },
  };
  return registry[code] ?? null;
}

export function buildSEOMetadata(entry, { baseUrl = "" } = {}) {
  const seo = defaultSeo(entry);
  const canonicalPath = seo.canonicalPath.startsWith("/") ? seo.canonicalPath : `/${seo.canonicalPath}`;
  return {
    ...seo,
    canonicalPath,
    canonicalUrl: baseUrl ? new URL(canonicalPath, baseUrl).toString() : canonicalPath,
    index: entry.reviewStatus === "PUBLICATION_READY" && seo.index === true,
    follow: entry.reviewStatus === "PUBLICATION_READY" && seo.follow !== false,
  };
}

export function buildStructuredData(entry, { baseUrl = "" } = {}) {
  const seo = buildSEOMetadata(entry, { baseUrl });
  const common = {
    "@context": "https://schema.org",
    name: entry.title,
    description: entry.summary,
    url: seo.canonicalUrl,
  };
  if (entry.contentType === "BLOG" || entry.contentType === "TUTORIAL") return { ...common, "@type": "Article", headline: entry.title, datePublished: entry.publishedAt, dateModified: entry.updatedAt };
  if (entry.contentType === "GLOSSARY") return { ...common, "@type": "DefinedTerm" };
  if (entry.contentType === "FAQ") return { ...common, "@type": "FAQPage" };
  if (["LANDING_PAGE", "TRUST_PAGE"].includes(entry.contentType)) return { ...common, "@type": "WebPage" };
  return { ...common, "@type": "CollectionPage" };
}

export function robotsTxt({ appEnv = process.env.APP_ENV ?? "development" } = {}) {
  if (["development", "staging"].includes(appEnv)) return "User-agent: *\nDisallow: /\n";
  return [
    "User-agent: *",
    "Disallow: /api/",
    "Disallow: /internal/",
    "Disallow: /internal/status",
    "Disallow: /reports/",
    "Disallow: /content-preview/",
    "Sitemap: /sitemap.xml",
    "",
  ].join("\n");
}

export function sitemapXml(entries, { baseUrl = "" } = {}) {
  const urls = entries
    .filter((entry) => entry.reviewStatus === "PUBLICATION_READY" && buildSEOMetadata(entry).index)
    .map((entry) => buildSEOMetadata(entry, { baseUrl }))
    .filter((seo) => seo.canonicalPath.startsWith("/") && !/localhost|staging|\/reports\/|\/api\/|\/internal\//iu.test(seo.canonicalPath));
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((seo) => `  <url><loc>${seo.canonicalUrl}</loc>${seo.updatedAt ? `<lastmod>${seo.updatedAt.slice(0, 10)}</lastmod>` : ""}</url>`),
    "</urlset>",
    "",
  ].join("\n");
}

export class ContentQAValidator {
  constructor({ entries = [] } = {}) {
    this.entries = entries;
  }

  validate() {
    const errors = [];
    const warnings = [];
    const seen = { contentId: new Map(), slug: new Map(), canonicalPath: new Map(), keyword: new Map() };
    const ids = new Set(this.entries.map((entry) => entry.contentId));
    for (const entry of this.entries) {
      errors.push(...validateContentEntry(entry));
      for (const key of ["contentId", "slug", "canonicalPath"]) {
        const value = entry[key];
        if (seen[key].has(value)) errors.push({ code: `CONTENT_DUPLICATE_${key.toUpperCase()}`, field: key, value });
        seen[key].set(value, entry.contentId);
      }
      const keywordKey = `${entry.domain}:${entry.searchIntent}:${entry.primaryKeyword}`;
      if (entry.reviewStatus === "PUBLICATION_READY" && seen.keyword.has(keywordKey)) warnings.push({ code: "CONTENT_KEYWORD_CANNIBALIZATION", value: keywordKey });
      seen.keyword.set(keywordKey, entry.contentId);
      for (const ref of [...entry.relatedContentIds, ...entry.prerequisiteContentIds, entry.nextContentId, entry.previousContentId].filter(Boolean)) {
        if (!ids.has(ref)) {
          const code = entry.prerequisiteContentIds.includes(ref) ? "CONTENT_REQUIRED_LINK_MISSING" : "CONTENT_OPTIONAL_LINK_MISSING";
          (code === "CONTENT_REQUIRED_LINK_MISSING" ? errors : warnings).push({ code, source: entry.contentId, target: ref });
        }
      }
    }
    return { ok: errors.length === 0, errors, warnings, coverage: contentCoverage(this.entries), keywordCannibalization: warnings.filter((item) => item.code === "CONTENT_KEYWORD_CANNIBALIZATION") };
  }
}

export function contentCoverage(entries) {
  const countBy = (field) => entries.reduce((acc, entry) => ({ ...acc, [entry[field] || "unknown"]: (acc[entry[field] || "unknown"] ?? 0) + 1 }), {});
  const linkedTargets = new Set(entries.flatMap((entry) => [...entry.relatedContentIds, ...entry.prerequisiteContentIds, entry.nextContentId, entry.previousContentId].filter(Boolean)));
  return {
    total: entries.length,
    byContentType: countBy("contentType"),
    byDomain: countBy("domain"),
    byFunnelStage: countBy("funnelStage"),
    bySearchIntent: countBy("searchIntent"),
    byReviewStatus: countBy("reviewStatus"),
    byPrimaryCTA: countBy("primaryConversion"),
    isolatedContentCount: entries.filter((entry) => !linkedTargets.has(entry.contentId) && !entry.relatedContentIds.length).length,
    noIncomingLinksCount: entries.filter((entry) => !linkedTargets.has(entry.contentId)).length,
    noOutgoingLinksCount: entries.filter((entry) => !entry.relatedContentIds.length && !entry.prerequisiteContentIds.length && !entry.nextContentId && !entry.previousContentId).length,
  };
}

function packageFile(packageDir, name) {
  return resolve(packageDir, "import", name);
}

export class ContentPackageImporter {
  constructor({ rootDir = process.cwd(), targetDir = "content" } = {}) {
    this.rootDir = rootDir;
    this.targetDir = targetDir;
  }

  loadPackage(packageDir) {
    const manifestPath = packageFile(packageDir, "content-import-manifest.json");
    if (!existsSync(manifestPath)) throw new Error("content-import-manifest.json is required.");
    const manifest = readJsonFile(manifestPath);
    const files = manifest.files ?? [];
    const entries = [];
    const faqs = [];
    const learningPaths = [];
    const errors = [];
    for (const file of files) {
      const path = packageFile(packageDir, file.path);
      if (!existsSync(path)) {
        errors.push({ code: "CONTENT_PACKAGE_FILE_MISSING", file: file.path });
        continue;
      }
      const raw = readFileSync(path, "utf8");
      if (file.sha256 && file.sha256 !== sha256(raw)) errors.push({ code: "CONTENT_PACKAGE_CHECKSUM", file: file.path });
      const json = JSON.parse(raw);
      const items = json.items ?? json.entries ?? [];
      if (file.kind === "contentEntries") entries.push(...items.map(normalizeContentEntry));
      if (file.kind === "faqEntries") faqs.push(...items.map((item) => normalizeContentEntry({ ...item, contentType: "FAQ", contentId: item.contentId ?? `faq:${item.faqId}`, slug: item.slug ?? item.faqId, title: item.question, summary: item.answer, reviewStatus: item.reviewStatus ?? "DEMO_ONLY" })));
      if (file.kind === "learningPaths") learningPaths.push(...items.map((item) => normalizeContentEntry({ ...item, contentType: "LEARNING_PATH", contentId: item.contentId ?? item.pathId, slug: item.slug ?? item.pathId, title: item.title, summary: item.summary, relatedContentIds: item.contentIds, reviewStatus: item.reviewStatus ?? "DEMO_ONLY" })));
    }
    return { manifest, entries: [...entries, ...faqs, ...learningPaths], errors };
  }

  validateOnly(packageDir) {
    const loaded = this.loadPackage(packageDir);
    const qa = new ContentQAValidator({ entries: loaded.entries }).validate();
    return { mode: "validate-only", ok: loaded.errors.length === 0 && qa.ok, manifest: loaded.manifest, counts: summarizeImport(loaded.entries), errors: [...loaded.errors, ...qa.errors], warnings: qa.warnings };
  }

  dryRun(packageDir) {
    const validation = this.validateOnly(packageDir);
    const ready = validation.ok ? this.loadPackage(packageDir).entries.filter((entry) => entry.reviewStatus === "PUBLICATION_READY") : [];
    return { ...validation, mode: "dry-run", wouldWrite: false, publicEntries: ready.length };
  }

  apply(packageDir) {
    const validation = this.validateOnly(packageDir);
    if (!validation.ok) return { ...validation, mode: "apply", applied: false };
    const { entries } = this.loadPackage(packageDir);
    const publicEntries = entries.filter((entry) => entry.reviewStatus === "PUBLICATION_READY");
    const target = resolve(this.rootDir, this.targetDir);
    const staging = `${target}.staging-${Date.now()}`;
    mkdirSync(staging, { recursive: true });
    try {
      writeJsonFile(join(staging, "content-entries.json"), { schemaVersion: CONTENT_SCHEMA_VERSION, items: publicEntries });
      if (existsSync(target)) rmSync(target, { recursive: true, force: true });
      mkdirSync(resolve(target, ".."), { recursive: true });
      writeJsonFile(join(target, "content-entries.json"), { schemaVersion: CONTENT_SCHEMA_VERSION, items: publicEntries });
      rmSync(staging, { recursive: true, force: true });
      return { ...validation, mode: "apply", applied: true, publicEntries: publicEntries.length, targetDir: this.targetDir };
    } catch (err) {
      rmSync(staging, { recursive: true, force: true });
      return { ...validation, mode: "apply", applied: false, errors: [...validation.errors, { code: "CONTENT_IMPORT_WRITE_FAILED", message: err.message }] };
    }
  }
}

function summarizeImport(entries) {
  return {
    total: entries.length,
    publicationReady: entries.filter((entry) => entry.reviewStatus === "PUBLICATION_READY").length,
    reviewRequired: entries.filter((entry) => entry.reviewStatus === "REVIEW_REQUIRED").length,
    demoOnly: entries.filter((entry) => entry.reviewStatus === "DEMO_ONLY").length,
    skipped: entries.filter((entry) => entry.reviewStatus !== "PUBLICATION_READY").length,
  };
}

export function reportContentRecommendations({ report, repository, limit = 6 } = {}) {
  const result = report?.result ?? report;
  const type = report?.type ?? result?.chart?.type;
  const refs = new Set();
  for (const section of result?.narrativeReport?.sections ?? []) {
    for (const id of section.knowledgeIds ?? []) refs.add(`knowledge:${id}`);
  }
  for (const finding of result?.report?.evidence ?? []) {
    if (finding.knowledge_refs) for (const id of finding.knowledge_refs) refs.add(`knowledge:${id}`);
    if (finding.rule_type) refs.add(`knowledge:liuyao-${finding.rule_type}`);
  }
  const candidates = [...refs].map((id) => repository.getById(id)).filter(Boolean);
  const fallback = repository.search(type === "meihua" ? "梅花 入门" : "六爻 入门").slice(0, limit);
  const items = [...candidates, ...fallback]
    .filter((entry, index, arr) => arr.findIndex((item) => item.contentId === entry.contentId) === index)
    .slice(0, limit)
    .map((entry) => ({
      contentId: entry.contentId,
      title: entry.title,
      url: entry.canonicalPath,
      reasonCode: refs.has(entry.contentId) ? "RULE_EVIDENCE" : "TOPIC_GUIDE",
      sourceRef: refs.has(entry.contentId) ? entry.contentId : type ?? "general",
    }));
  return { reportId: result?.chart?.id ?? report?.id ?? "", items };
}

export function writeQAReports({ rootDir = process.cwd(), entries = [] } = {}) {
  const qa = new ContentQAValidator({ entries }).validate();
  const outDir = resolve(rootDir, "reports/content");
  mkdirSync(outDir, { recursive: true });
  writeJsonFile(join(outDir, "content-coverage-report.json"), qa.coverage);
  writeJsonFile(join(outDir, "keyword-cannibalization-report.json"), { items: qa.keywordCannibalization });
  return qa;
}
