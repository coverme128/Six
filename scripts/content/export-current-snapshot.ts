#!/usr/bin/env node
// @ts-nocheck
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";
import { getPrismaClient } from "../../packages/database/src/index.ts";

import { topicProfileList } from "../../apps/web/app/content/topicProfiles.ts";

const rootDir = process.cwd();
const snapshotName = "liuyao-current-content-repository-snapshot-v1.0";
const outputDir = resolve(rootDir, "artifacts", snapshotName);
const zipPath = `${outputDir}.zip`;
const generatedAt = new Date().toISOString();

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required. Snapshot export must use the runtime database.");

const internalTerms = [
  "Registry", "Evidence", "CORE_V1", "CAL_STD_V1", "ProductResultFacts", "DivinationResultFacts",
  "Guided", "Professional", "Finding", "Rule", "VERIFY_IN_REPOSITORY", "Stable ID"
];
const meihuaMarkers = [
  { label: "体卦", pattern: /(?<!具)体卦/u },
  { label: "用卦", pattern: /(?<!利)(?<!使)用卦/u },
  { label: "体用", pattern: /体用/u },
  { label: "互卦", pattern: /互卦/u },
  { label: "外应", pattern: /外应/u },
  { label: "梅花起卦", pattern: /梅花起卦/u },
  { label: "梅花时间起卦", pattern: /梅花时间起卦/u },
  { label: "梅花易数", pattern: /梅花易数/u }
];
const articleIdPattern = /^B0[345]-A\d+/u;
const caseIdPattern = /^B0[56]-CASE-/u;

function ensureDir(path: string) {
  mkdirSync(path, { recursive: true });
}

function writeText(path: string, value: string) {
  ensureDir(dirname(path));
  writeFileSync(path, value.endsWith("\n") ? value : `${value}\n`);
}

function writeJson(path: string, value: unknown) {
  writeText(path, JSON.stringify(value, null, 2));
}

function readJson(path: string) {
  return JSON.parse(readFileSync(resolve(rootDir, path), "utf8"));
}

function runtimeReviewStatus(status: string) {
  if (status === "PUBLISHED") return "PUBLICATION_READY";
  if (status === "IN_REVIEW") return "REVIEW_REQUIRED";
  if (status === "APPROVED") return "REVIEWED";
  if (status === "ARCHIVED") return "DEFERRED";
  if (status === "INTERNAL_ONLY") return "INTERNAL_ONLY";
  return "DEMO_ONLY";
}

function strings(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string");
  return [];
}

function textValue(...values: unknown[]) {
  return values.find((value) => typeof value === "string" && value.trim()) ?? null;
}

function bodyText(body: unknown) {
  if (typeof body === "string") return body;
  if (!body || typeof body !== "object") return "";
  return JSON.stringify(body);
}

function sectionsMarkdown(sections: unknown) {
  if (!Array.isArray(sections) || !sections.length) return null;
  const blocks = sections.map((section) => {
    const heading = textValue(section?.heading, section?.title);
    const rawBody = section?.body ?? section?.content;
    const paragraphs = Array.isArray(rawBody) ? rawBody : typeof rawBody === "string" ? [rawBody] : [];
    return [heading ? `## ${heading}` : null, ...paragraphs.map((paragraph) => String(paragraph))].filter(Boolean).join("\n\n");
  }).filter(Boolean);
  return blocks.length ? blocks.join("\n\n") : null;
}

function flattenStrings(value: unknown, path = "", output: Array<{ field: string; text: string }> = []) {
  if (typeof value === "string") {
    output.push({ field: path || "value", text: value });
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => flattenStrings(item, `${path}[${index}]`, output));
    return output;
  }
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => flattenStrings(item, path ? `${path}.${key}` : key, output));
  }
  return output;
}

function excerpt(text: string, match: string) {
  const index = text.toLowerCase().indexOf(match.toLowerCase());
  if (index < 0) return text.slice(0, 180);
  return text.slice(Math.max(0, index - 70), Math.min(text.length, index + match.length + 110));
}

function sourceFileFor(entry: any) {
  if (/^B0[1-7]-/u.test(entry.contentId) || ["RELATIONSHIP", "CAREER_WORK", "BUSINESS_PARTNERSHIP", "FINANCE_PROJECT", "EXAM_JOB_SEARCH", "TRAVEL_PLANNING", "LIUYAO_LEARN_HUB"].includes(entry.contentId)) {
    return "content/content-growth/content-entries.json";
  }
  if (entry.contentId.startsWith("knowledge:")) return "data/content/knowledge-nodes-v1.2.json";
  if (entry.contentId.startsWith("glossary:")) return "data/content/glossary.json";
  if (entry.contentId.startsWith("trigram:")) return "data/core/trigrams.json";
  if (entry.contentId.startsWith("hexagram:")) return "data/core/hexagrams-64.json";
  return null;
}

function safeFileName(id: string) {
  return id.replace(/[^a-zA-Z0-9._-]+/gu, "_");
}

function hasMeihuaLeak(entry: any) {
  const text = `${entry.title ?? ""}\n${entry.summary ?? ""}\n${bodyText(entry.body)}`;
  return meihuaMarkers.some((marker) => marker.pattern.test(text));
}

function isPublic(entry: any) {
  return entry.runtime_database_status === "PUBLISHED" && String(entry.domain).toLowerCase() === "liuyao" && !caseIdPattern.test(entry.contentId) && !hasMeihuaLeak(entry);
}

function relationRefs(entry: any) {
  return {
    related_content_refs: strings(entry.relatedContentIds),
    knowledge_refs: strings(entry.relatedKnowledgeIds),
    prerequisite_refs: strings(entry.prerequisiteContentIds),
    faq_refs: strings(entry.faqIds),
    previous_content_id: textValue(entry.previousContentId),
    next_content_id: textValue(entry.nextContentId)
  };
}

function collectionRefsFor(contentId: string, collections: any[]) {
  return collections.filter((collection) => (collection.recommended_content ?? []).some((item) => item.contentId === contentId)).map((collection) => collection.collection_id);
}

function topicRefsFor(contentId: string) {
  return topicProfileList.filter((topic) => topic.recommendedContentIds.includes(contentId)).map((topic) => topic.slug);
}

function exportArticle(entry: any, collections: any[]) {
  const body = entry.body && typeof entry.body === "object" ? entry.body : {};
  return {
    content_id: entry.contentId,
    original_batch: textValue(body.sourceBatch, /^B0[1-7]/u.exec(entry.contentId)?.[0]),
    title: entry.title ?? null,
    subtitle: textValue(body.subtitle),
    slug: entry.slug ?? null,
    domain: entry.domain ?? null,
    topic: textValue(entry.category, body.decisionTopic),
    topic_id: textValue(body.topicId, body.decisionTopic),
    search_intent: entry.searchIntent ?? null,
    publication_status: entry.reviewStatus,
    review_status: entry.repository_review_status,
    runtime_database_status: entry.runtime_database_status,
    repository_review_status: entry.repository_review_status,
    index_status: Boolean(entry.seoMetadata?.index && isPublic(entry)),
    hero_summary: entry.summary ?? null,
    key_takeaways: strings(body.keyTakeaways),
    body,
    body_sections: Array.isArray(body.sections) ? body.sections : null,
    body_markdown: textValue(body.bodyMarkdown, body.markdown, sectionsMarkdown(body.sections)),
    practical_framework: body.practicalFramework ?? null,
    common_misunderstandings: body.commonMisunderstandings ?? null,
    examples: body.examples ?? null,
    professional_boundary: body.professionalBoundary ?? null,
    safety_boundary: textValue(body.safetyBoundary, ...(entry.knownLimitations ?? [])),
    ...relationRefs(entry),
    primary_cta: entry.primaryConversion ?? null,
    product_route: textValue(body.productRoute, body.contentUrl, entry.canonicalPath),
    seo_metadata: entry.seoMetadata ?? null,
    collection_refs: collectionRefsFor(entry.contentId, collections),
    topic_landing_refs: topicRefsFor(entry.contentId),
    created_at: entry.runtime_created_at ?? entry.createdAt ?? null,
    updated_at: entry.runtime_updated_at ?? entry.updatedAt ?? null,
    version: entry.contentVersion ?? null,
    source_file: sourceFileFor(entry)
  };
}

function exportKnowledge(entry: any) {
  const body = entry.body && typeof entry.body === "object" ? entry.body : {};
  return {
    content_id: entry.contentId,
    knowledge_card_id: textValue(body.knowledgeCardId, body.knowledge_card_id),
    title: entry.title ?? null,
    display_name: textValue(body.displayName, entry.title),
    slug: entry.slug ?? null,
    domain: entry.domain ?? null,
    topic: textValue(entry.category, body.topic),
    content_type: entry.contentType,
    publication_status: entry.reviewStatus,
    review_status: entry.repository_review_status,
    runtime_database_status: entry.runtime_database_status,
    repository_review_status: entry.repository_review_status,
    short_definition: textValue(body.shortDefinition, body.short_definition, entry.summary),
    professional_definition: textValue(body.professionalDefinition, body.professional_definition),
    practical_meaning: textValue(body.practicalMeaning, body.practical_meaning),
    guided_meaning: textValue(body.guidedMeaning, body.guided_meaning),
    common_misunderstandings: body.commonMisunderstandings ?? body.commonMisunderstanding ?? null,
    examples: body.examples ?? null,
    aliases: body.aliases ?? entry.secondaryKeywords ?? [],
    canonical_ref: textValue(body.canonicalRef, body.canonical_ref),
    canonical_status: textValue(body.canonicalStatus, body.canonical_status),
    article_refs: strings(entry.relatedContentIds).filter((id) => /-A\d+/u.test(id)),
    faq_refs: strings(entry.faqIds),
    related_knowledge_refs: strings(entry.relatedKnowledgeIds),
    report_usage: body.reportUsage ?? body.report_usage ?? null,
    seo: entry.seoMetadata ?? null,
    route: entry.canonicalPath ?? null,
    created_at: entry.runtime_created_at ?? null,
    updated_at: entry.runtime_updated_at ?? entry.updatedAt ?? null,
    version: entry.contentVersion ?? null,
    raw_body: body,
    source_file: sourceFileFor(entry)
  };
}

function exportFaq(entry: any) {
  const body = entry.body && typeof entry.body === "object" ? entry.body : {};
  return {
    faq_id: entry.contentId,
    question: textValue(body.question, entry.title),
    slug: entry.slug ?? null,
    category: entry.category ?? null,
    topic: textValue(body.topic, body.decisionTopic),
    domain: entry.domain ?? null,
    publication_status: entry.reviewStatus,
    review_status: entry.repository_review_status,
    runtime_database_status: entry.runtime_database_status,
    repository_review_status: entry.repository_review_status,
    short_answer: textValue(body.shortAnswer, body.short_answer, entry.summary),
    full_answer: textValue(body.fullAnswer, body.full_answer),
    article_refs: strings(entry.relatedContentIds).filter((id) => /-A\d+/u.test(id)),
    knowledge_refs: strings(entry.relatedKnowledgeIds),
    related_faq_refs: strings(entry.relatedContentIds).filter((id) => /-FAQ-/u.test(id)),
    product_route: textValue(body.productRoute, body.contentUrl, entry.canonicalPath),
    seo: entry.seoMetadata ?? null,
    version: entry.contentVersion ?? null,
    created_at: entry.runtime_created_at ?? null,
    updated_at: entry.runtime_updated_at ?? entry.updatedAt ?? null,
    raw_body: body,
    source_file: sourceFileFor(entry)
  };
}

function categoryFor(entry: any) {
  if (caseIdPattern.test(entry.contentId)) return "CASE";
  if (articleIdPattern.test(entry.contentId) && entry.contentType === "TUTORIAL") return "ARTICLE";
  if (["KNOWLEDGE", "GLOSSARY", "TRIGRAM", "HEXAGRAM"].includes(entry.contentType)) return "KNOWLEDGE";
  if (entry.contentType === "FAQ") return "FAQ";
  return "OTHER";
}

function countBy<T>(items: T[], keyOf: (item: T) => string) {
  const counts: Record<string, number> = {};
  items.forEach((item) => { const key = keyOf(item) || "UNKNOWN"; counts[key] = (counts[key] ?? 0) + 1; });
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function grams(value: string) {
  const normalized = value.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
  const set = new Set<string>();
  for (let index = 0; index < normalized.length - 1; index += 1) set.add(normalized.slice(index, index + 2));
  return set;
}

function jaccard(left: Set<string>, right: Set<string>) {
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  left.forEach((value) => { if (right.has(value)) intersection += 1; });
  return intersection / (left.size + right.size - intersection);
}

function duplicateCandidates(entries: any[]) {
  const prepared = entries.map((entry) => ({
    entry,
    text: `${entry.title ?? entry.question ?? ""} ${entry.hero_summary ?? entry.short_definition ?? entry.short_answer ?? ""}`,
    title: String(entry.title ?? entry.question ?? "").trim(),
    summary: String(entry.hero_summary ?? entry.short_definition ?? entry.short_answer ?? "").trim()
  })).map((item) => ({ ...item, gramSet: grams(item.text) }));
  const candidates = [];
  for (let leftIndex = 0; leftIndex < prepared.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < prepared.length; rightIndex += 1) {
      const left = prepared[leftIndex];
      const right = prepared[rightIndex];
      const exactTitle = left.title && left.title === right.title;
      const exactSummary = left.summary.length >= 20 && left.summary === right.summary;
      const score = jaccard(left.gramSet, right.gramSet);
      if (!exactTitle && !exactSummary && score < 0.72) continue;
      candidates.push({
        left_content_id: left.entry.content_id ?? left.entry.faq_id,
        left_type: left.entry.snapshot_type,
        right_content_id: right.entry.content_id ?? right.entry.faq_id,
        right_type: right.entry.snapshot_type,
        similarity: Number(score.toFixed(4)),
        reason: exactTitle ? "EXACT_TITLE" : exactSummary ? "EXACT_SUMMARY" : "TITLE_SUMMARY_BIGRAM_SIMILARITY",
        recommendation: "REVIEW_ONLY_NO_AUTOMATIC_MERGE"
      });
    }
  }
  return candidates.sort((a, b) => b.similarity - a.similarity || a.left_content_id.localeCompare(b.left_content_id));
}

function listFiles(path: string): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((item) => {
    const fullPath = resolve(path, item.name);
    return item.isDirectory() ? listFiles(fullPath) : [fullPath];
  });
}

function sha256(path: string) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function missingFieldCounts(items: any[]) {
  const counts: Record<string, number> = {};
  items.forEach((item) => Object.entries(item).forEach(([key, value]) => {
    if (value === null || value === "" || (Array.isArray(value) && !value.length)) counts[key] = (counts[key] ?? 0) + 1;
  }));
  return counts;
}

function requireCount(label: string, actual: number, expected: number) {
  if (actual !== expected) throw new Error(`${label} count mismatch: expected ${expected}, received ${actual}.`);
}

async function main() {
  if (existsSync(outputDir)) rmSync(outputDir, { recursive: true, force: true });
  if (existsSync(zipPath)) rmSync(zipPath, { force: true });
  ensureDir(outputDir);

  const prisma = getPrismaClient();
  if (!prisma) throw new Error("Runtime database client is unavailable.");
  const rows = await prisma.contentEntry.findMany({ orderBy: [{ type: "asc" }, { slug: "asc" }] });
  await prisma.$disconnect();

  const repositoryDocument = readJson("content/content-growth/content-entries.json");
  const repositoryById = new Map(repositoryDocument.items.map((entry) => [entry.contentId, entry]));
  const entries = rows.map((row) => {
    const payload = row.payload as any;
    return {
      ...payload,
      repository_review_status: repositoryById.get(payload.contentId)?.reviewStatus ?? payload.reviewStatus ?? null,
      reviewStatus: runtimeReviewStatus(row.status),
      runtime_database_status: row.status,
      runtime_created_at: row.createdAt.toISOString(),
      runtime_updated_at: row.updatedAt.toISOString()
    };
  });
  const byId = new Map(entries.map((entry) => [entry.contentId, entry]));
  const collectionsSource = readJson("data/content-growth/distribution/collections.json");
  const visualAudit = readJson("data/liuyao/visual-system/integration/content-growth-68-svg-production-audit.json");

  const articles = entries.filter((entry) => entry.contentType === "TUTORIAL" && articleIdPattern.test(entry.contentId)).map((entry) => exportArticle(entry, collectionsSource));
  const knowledge = entries.filter((entry) => ["KNOWLEDGE", "GLOSSARY", "TRIGRAM", "HEXAGRAM"].includes(entry.contentType)).map(exportKnowledge);
  const faqs = entries.filter((entry) => entry.contentType === "FAQ").map(exportFaq);
  const cases = entries.filter((entry) => caseIdPattern.test(entry.contentId)).map((entry) => ({
    content_id: entry.contentId,
    title: entry.title,
    publication_status: "INTERNAL_ONLY",
    runtime_database_status: entry.runtime_database_status,
    commercial_disposition: "NOT_FOR_COMMERCIAL_FINALIZATION_YET",
    body: entry.body ?? null,
    relationships: relationRefs(entry),
    source_file: sourceFileFor(entry)
  }));

  requireCount("B03 target articles", articles.filter((entry) => entry.content_id.startsWith("B03-")).length, 18);
  requireCount("B04 target articles", articles.filter((entry) => entry.content_id.startsWith("B04-")).length, 20);
  requireCount("B05 target articles", articles.filter((entry) => entry.content_id.startsWith("B05-")).length, 30);
  requireCount("All target articles", articles.length, 68);
  requireCount("Knowledge records", knowledge.filter((entry) => entry.content_type === "KNOWLEDGE").length, 196);
  requireCount("Glossary records", knowledge.filter((entry) => entry.content_type === "GLOSSARY").length, 30);
  requireCount("Trigram records", knowledge.filter((entry) => entry.content_type === "TRIGRAM").length, 8);
  requireCount("Hexagram records", knowledge.filter((entry) => entry.content_type === "HEXAGRAM").length, 64);
  requireCount("FAQ records", faqs.length, 170);
  requireCount("Internal cases", cases.length, 24);
  requireCount("Visual assets", visualAudit.assets?.length ?? visualAudit.total ?? 0, 68);

  articles.forEach((entry) => { entry.snapshot_type = "ARTICLE"; });
  knowledge.forEach((entry) => { entry.snapshot_type = "KNOWLEDGE"; });
  faqs.forEach((entry) => { entry.snapshot_type = "FAQ"; });

  articles.forEach((entry) => writeJson(resolve(outputDir, "articles/items", `${safeFileName(entry.content_id)}.json`), entry));
  knowledge.forEach((entry) => writeJson(resolve(outputDir, "knowledge/items", `${safeFileName(entry.content_id)}.json`), entry));
  faqs.forEach((entry) => writeJson(resolve(outputDir, "faq/items", `${safeFileName(entry.faq_id)}.json`), entry));
  cases.forEach((entry) => writeJson(resolve(outputDir, "internal-cases/items", `${safeFileName(entry.content_id)}.json`), entry));
  writeJson(resolve(outputDir, "articles/article-registry.json"), articles);
  writeJson(resolve(outputDir, "knowledge/knowledge-registry.json"), knowledge);
  writeJson(resolve(outputDir, "faq/faq-registry.json"), faqs);
  writeJson(resolve(outputDir, "internal-cases/case-registry.json"), cases);

  const collections = collectionsSource.map((collection) => ({
    ...collection,
    recommended_content: (collection.recommended_content ?? []).map((item) => {
      const live = byId.get(item.contentId);
      return { ...item, declared_review_status: item.reviewStatus ?? null, runtime_review_status: live?.reviewStatus ?? "MISSING", public_visible: live ? isPublic(live) : false };
    })
  }));
  const topics = topicProfileList.map((topic) => ({
    ...topic,
    recommendations: topic.recommendedContentIds.map((contentId) => {
      const live = byId.get(contentId);
      return { content_id: contentId, runtime_review_status: live?.reviewStatus ?? "MISSING", public_visible: live ? isPublic(live) : false };
    })
  }));
  const learnHub = {
    source: "apps/web/app/content/ContentListClient.tsx",
    user_journeys: ["FIRST_TIME", "BRINGING_A_QUESTION", "READING_A_REPORT", "SYSTEMATIC_ADVANCED"],
    learning_stages: ["B01", "B02", "B03", "B04", "B05", "B06"],
    public_rule: "RUNTIME_PUBLISHED_AND_LIUYAO_ONLY",
    public_counts: countBy(entries.filter(isPublic), (entry) => entry.contentType)
  };
  const relatedContent = entries.map((entry) => ({ content_id: entry.contentId, public_visible: isPublic(entry), ...relationRefs(entry) }));
  const reportMappings = readJson("data/content-growth/report-content-mappings.json");
  const searchStatus = entries.map((entry) => ({ content_id: entry.contentId, publication_status: entry.reviewStatus, domain: entry.domain, search_visible: isPublic(entry), reason: isPublic(entry) ? "PUBLISHED_LIUYAO" : "NOT_PUBLISHED_OR_NOT_LIUYAO" }));
  const sitemapStatus = entries.map((entry) => ({ content_id: entry.contentId, canonical_path: entry.canonicalPath ?? null, sitemap_visible: isPublic(entry) && entry.seoMetadata?.index === true, seo_index: isPublic(entry) && entry.seoMetadata?.index === true }));
  writeJson(resolve(outputDir, "relationships/collections.json"), collections);
  writeJson(resolve(outputDir, "relationships/topic-landings.json"), topics);
  writeJson(resolve(outputDir, "relationships/learn-hub.json"), learnHub);
  writeJson(resolve(outputDir, "relationships/related-content.json"), relatedContent);
  writeJson(resolve(outputDir, "relationships/recommendation-mappings.json"), { topic_recommendations: topics, collection_recommendations: collections, report_content_mappings: reportMappings });
  writeJson(resolve(outputDir, "relationships/search-index-status.json"), searchStatus);
  writeJson(resolve(outputDir, "relationships/sitemap-status.json"), sitemapStatus);

  const publicationAudit = {
    generated_at: generatedAt,
    source: "runtime PostgreSQL content_entries.status",
    total: entries.length,
    by_publication_status: countBy(entries, (entry) => entry.reviewStatus),
    by_runtime_database_status: countBy(entries, (entry) => entry.runtime_database_status),
    by_content_category: Object.fromEntries(["ARTICLE", "KNOWLEDGE", "FAQ", "CASE", "OTHER"].map((category) => {
      const categoryEntries = entries.filter((entry) => categoryFor(entry) === category);
      return [category, { total: categoryEntries.length, by_status: countBy(categoryEntries, (entry) => entry.reviewStatus), public_visible: categoryEntries.filter(isPublic).length }];
    })),
    visuals: { total: visualAudit.assets?.length ?? visualAudit.total ?? 0, publication_status: "ASSET_AUDIT_ONLY" },
    public_visible_total: entries.filter(isPublic).length,
    status_mismatches: entries.filter((entry) => entry.repository_review_status !== entry.reviewStatus).map((entry) => ({ content_id: entry.contentId, repository: entry.repository_review_status, runtime: entry.reviewStatus }))
  };

  const internalLanguageAudit = entries.flatMap((entry) => flattenStrings({ title: entry.title, subtitle: entry.body?.subtitle, summary: entry.summary, body: entry.body, primary_cta: entry.primaryConversion }).flatMap(({ field, text }) => internalTerms.filter((term) => text.toLowerCase().includes(term.toLowerCase())).map((term) => ({ content_id: entry.contentId, field, matched_term: term, text_excerpt: excerpt(text, term), publication_status: entry.reviewStatus, public_visible: isPublic(entry) }))));
  const domainLeakageAudit = entries.flatMap((entry) => {
    const fields = flattenStrings({ title: entry.title, summary: entry.summary, body: entry.body });
    const matches = fields.flatMap(({ field, text }) => meihuaMarkers.filter((marker) => marker.pattern.test(text)).map((marker) => ({ field, matched_term: marker.label, text_excerpt: excerpt(text, marker.label) })));
    if (String(entry.domain).toLowerCase() === "meihua" && !matches.length) matches.push({ field: "domain", matched_term: "meihua", text_excerpt: "domain=meihua" });
    if (!matches.length) return [];
    return [{
      content_id: entry.contentId,
      title: entry.title,
      domain: entry.domain,
      classification: entry.contentId === "knowledge:method-liuyao-vs-meihua" ? "CROSS_DOMAIN_HELP" : String(entry.domain).toLowerCase() === "meihua" ? "MEIHUA_DOMAIN" : "SEMANTIC_DOMAIN_LEAKAGE",
      publication_status: entry.reviewStatus,
      public_visible: isPublic(entry),
      matches
    }];
  });
  const completenessAudit = entries.filter((entry) => ["TUTORIAL", "KNOWLEDGE", "GLOSSARY", "TRIGRAM", "HEXAGRAM", "FAQ"].includes(entry.contentType)).map((entry) => {
    const body = entry.body && typeof entry.body === "object" ? entry.body : {};
    const category = categoryFor(entry);
    const sectionCount = Array.isArray(body.sections) ? body.sections.length : 0;
    const checks = category === "ARTICLE"
      ? { sections_non_empty: sectionCount > 0, body_character_count: bodyText(body).length, key_takeaways_non_empty: strings(body.keyTakeaways).length > 0, practical_framework_non_empty: Boolean(body.practicalFramework) }
      : category === "FAQ"
        ? { short_answer_non_empty: Boolean(textValue(body.shortAnswer, entry.summary)), full_answer_non_empty: Boolean(textValue(body.fullAnswer)) }
        : category === "KNOWLEDGE"
          ? { short_definition_non_empty: Boolean(textValue(body.shortDefinition, entry.summary)), professional_definition_non_empty: Boolean(textValue(body.professionalDefinition)), practical_meaning_non_empty: Boolean(textValue(body.practicalMeaning)) }
          : { body_non_empty: bodyText(body).length > 2 };
    return { content_id: entry.contentId, content_type: entry.contentType, category, publication_status: entry.reviewStatus, checks };
  });
  const duplicates = duplicateCandidates([...articles, ...knowledge, ...faqs]);
  writeJson(resolve(outputDir, "audits/publication-audit.json"), publicationAudit);
  writeJson(resolve(outputDir, "audits/internal-language-audit.json"), internalLanguageAudit);
  writeJson(resolve(outputDir, "audits/duplicate-content-candidates.json"), duplicates);
  writeJson(resolve(outputDir, "audits/domain-leakage-audit.json"), domainLeakageAudit);
  writeJson(resolve(outputDir, "audits/content-completeness-audit.json"), completenessAudit);

  const sourceMap = entries.map((entry) => ({ content_id: entry.contentId, runtime_table: "content_entries", source_file: sourceFileFor(entry), runtime_database_status: entry.runtime_database_status, repository_review_status: entry.repository_review_status, runtime_review_status: entry.reviewStatus }));
  writeJson(resolve(outputDir, "repository/source-files-map.json"), sourceMap);
  writeJson(resolve(outputDir, "repository/runtime-content-records.json"), entries);
  writeJson(resolve(outputDir, "repository/repository-content-entries.json"), repositoryDocument);
  writeText(resolve(outputDir, "repository/content-api-contract.md"), `# Content API Contract\n\nThe ordinary user API exposes only records whose runtime database status is \`PUBLISHED\`, whose domain is exactly \`liuyao\`, and which do not contain Meihua-only semantics. Internal, review, demo, archived, and cross-domain records are retained outside the public API.\n`);
  writeText(resolve(outputDir, "repository/publication-source-of-truth.md"), `# Publication Source Of Truth\n\nThe authoritative publication value is \`content_entries.status\` in the runtime PostgreSQL database. Repository and package status values are retained for provenance and comparison, but cannot override the runtime status. Automatic promotion to \`PUBLISHED\` is frozen until the commercial finalization gate is approved.\n`);

  const missingFields = {
    articles: missingFieldCounts(articles),
    knowledge: missingFieldCounts(knowledge),
    faq: missingFieldCounts(faqs)
  };
  const blockingIssues = [
    `${articles.filter((item) => !item.body_sections?.length).length} of ${articles.length} target articles have no body sections.`,
    `${cases.length} teaching cases are internal-only and lack commercial-grade traceable fixtures.`,
    `${internalLanguageAudit.length} internal-language field matches require editorial review.`,
    `${domainLeakageAudit.length} content records contain Meihua-domain or Meihua-only semantics.`,
    `${publicationAudit.status_mismatches.length} repository/runtime publication status mismatches remain recorded for reconciliation.`
  ];
  writeText(resolve(outputDir, "00_README.md"), `# Liuyao Current Content Repository Snapshot v1.0\n\nGenerated: ${generatedAt}\n\n## Source\n\nThis snapshot was exported from the runtime PostgreSQL \`content_entries\` table, then enriched with current repository files, collection definitions, topic profiles, relationship mappings, visual audit data, and source provenance. Missing values are represented as \`null\`; no editorial content was generated.\n\n## Scope\n\n- Target articles: ${articles.length} (B03/B04/B05)\n- Knowledge records: ${knowledge.length} total, comprising 196 KNOWLEDGE, 30 GLOSSARY, 8 TRIGRAM, and 64 HEXAGRAM records. The requested "196 Knowledge" count conflicts with the explicit requirement to include all reference records, so all ${knowledge.length} are retained and typed.\n- FAQ: ${faqs.length}\n- Internal cases: ${cases.length}\n- Visual assets audited: ${publicationAudit.visuals.total}\n\n## Publication\n\nRuntime database status is the only publication source of truth. Ordinary public surfaces may expose only \`PUBLISHED + liuyao\` records. Cases are retained under \`internal-cases/\` and are not commercial-finalization input.\n\n## Blocking Issues\n\n${blockingIssues.map((issue) => `- ${issue}`).join("\n")}\n\n## Missing Fields\n\nSee \`manifest.json\` for field-level null/empty counts and \`audits/content-completeness-audit.json\` for record-level checks.\n`);

  const filesBeforeManifest = listFiles(outputDir).sort();
  const manifest = {
    snapshot_name: snapshotName,
    version: "1.0",
    generated_at: generatedAt,
    source_of_truth: "runtime PostgreSQL content_entries.status",
    counts: {
      runtime_content_records: entries.length,
      target_articles: articles.length,
      knowledge_and_reference: knowledge.length,
      knowledge_type_only: knowledge.filter((item) => item.content_type === "KNOWLEDGE").length,
      glossary: knowledge.filter((item) => item.content_type === "GLOSSARY").length,
      trigrams: knowledge.filter((item) => item.content_type === "TRIGRAM").length,
      hexagrams: knowledge.filter((item) => item.content_type === "HEXAGRAM").length,
      faq: faqs.length,
      internal_cases: cases.length,
      internal_language_matches: internalLanguageAudit.length,
      domain_leakage_records: domainLeakageAudit.length,
      duplicate_candidates: duplicates.length,
      visual_assets: publicationAudit.visuals.total
    },
    publication: publicationAudit,
    missing_fields: missingFields,
    blocking_issues: blockingIssues,
    files: filesBeforeManifest.map((path) => ({ path: relative(outputDir, path), bytes: statSync(path).size, sha256: sha256(path) }))
  };
  writeJson(resolve(outputDir, "manifest.json"), manifest);
  execFileSync("/usr/bin/zip", ["-q", "-r", zipPath, basename(outputDir)], { cwd: dirname(outputDir) });
  console.log(JSON.stringify({ ok: true, outputDir, zipPath, zipSha256: sha256(zipPath), manifest: manifest.counts, publication: publicationAudit.by_publication_status, blockingIssues }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
