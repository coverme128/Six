#!/usr/bin/env node
// @ts-nocheck
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const rootDir = process.cwd();
const packagePath = process.argv.slice(2).find((argument) => argument !== "--");
if (!packagePath) throw new Error("Usage: pnpm content:import-knowledge <batch-02.zip>");

function archiveText(suffix: string) {
  const files = execFileSync("/usr/bin/unzip", ["-Z1", packagePath], { encoding: "utf8", maxBuffer: 30 * 1024 * 1024 }).split("\n").filter(Boolean);
  const matches = files.filter((file) => file.endsWith(suffix));
  if (matches.length !== 1) throw new Error(`Expected one ${suffix}, received ${matches.length}.`);
  return execFileSync("/usr/bin/unzip", ["-p", packagePath, matches[0]], { encoding: "utf8", maxBuffer: 60 * 1024 * 1024 });
}

function readJson(path: string) {
  return JSON.parse(readFileSync(resolve(rootDir, path), "utf8"));
}

function writeJson(path: string, value: unknown) {
  writeFileSync(resolve(rootDir, path), `${JSON.stringify(value, null, 2)}\n`);
}

function requireCondition(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function sha256(path: string) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function normalizeEditorialText(value: string) {
  return String(value ?? "")
    .replaceAll("CORE_V1", "六爻判断引擎")
    .replaceAll("ProductResultFacts", "已核验的报告事实")
    .replaceAll("DivinationResultFacts", "已核验的排盘事实")
    .replaceAll("Evidence", "判断依据")
    .replaceAll("Registry", "规则表")
    .replaceAll("Stable ID", "稳定内容编号")
    .replaceAll("Rule ID", "规则编号")
    .replaceAll("Timing", "时间判断")
    .replaceAll("Guided/Professional", "简明与专业")
    .replace(/(?<=[。！？；，]) (?=[\u3400-\u9fff])/gu, "")
    .replace(/(?<=[\u3400-\u9fff]) (?=[\u3400-\u9fff])/gu, "");
}

function markdownBlocks(markdown: string) {
  return markdown.split(/\n\s*\n/gu).map((part) => part.trim()).filter(Boolean).map((part) => {
    const lines = part.split("\n").map((line) => line.trim()).filter(Boolean);
    if (lines.every((line) => /^-\s+/u.test(line))) return { type: "unordered_list", items: lines.map((line) => line.replace(/^-\s+/u, "").trim()) };
    if (lines.every((line) => /^\d+\.\s+/u.test(line))) return { type: "ordered_list", items: lines.map((line) => line.replace(/^\d+\.\s+/u, "").trim()) };
    return { type: "paragraph", text: lines.join("\n") };
  });
}

function transformedBody(revision: any, decision: any) {
  const sections = revision.body.sections.map((section: any) => {
    const body = normalizeEditorialText(section.content_markdown);
    return { heading: normalizeEditorialText(section.heading), body, blocks: markdownBlocks(body) };
  });
  return {
    displayName: revision.display_name,
    shortDefinition: normalizeEditorialText(revision.short_definition),
    professionalDefinition: normalizeEditorialText(revision.professional_definition),
    practicalMeaning: normalizeEditorialText(revision.practical_meaning),
    guidedMeaning: normalizeEditorialText(revision.guided_meaning),
    commonMisunderstandings: revision.common_misunderstandings.map(normalizeEditorialText),
    examples: revision.examples.map(normalizeEditorialText),
    aliases: revision.aliases.map(normalizeEditorialText),
    relatedKnowledgeRefs: revision.related_knowledge_refs,
    articleRefs: revision.article_refs,
    faqRefs: revision.faq_refs,
    whenUserSeesIt: normalizeEditorialText(revision.when_user_sees_it),
    reportUsage: revision.report_usage,
    boundary: normalizeEditorialText(revision.boundary),
    sections,
    markdown: normalizeEditorialText(revision.body.markdown),
    editorialDecision: decision.decision,
    canonicalContentId: decision.canonical_content_id,
    editorialCompletionStatus: "IMPORTED_PENDING_DOMAIN_AND_RUNTIME_REVIEW",
    sourceEditorialClaim: revision.editorial_completion_status,
    professionalReviewStatus: revision.professional_review_status,
    repositoryReview: { status: "REVIEW_REQUIRED", method: "COMMERCIAL_BATCH_02_PENDING_DOMAIN_AND_RUNTIME_RELEASE_GATE" }
  };
}

const manifest = JSON.parse(archiveText("/00_START-HERE/manifest.json"));
const revisions = JSON.parse(archiveText("/02_KNOWLEDGE/knowledge-commercial-finalization-registry.json"));
const decisions = JSON.parse(archiveText("/03_DECISIONS/knowledge-content-decision-registry.json"));
const canonicalization = JSON.parse(archiveText("/03_DECISIONS/knowledge-canonicalization-map.json"));
const decisionById = new Map(decisions.map((item: any) => [item.content_id, item]));

requireCondition(manifest.snapshotCounts?.total === 298, "Package manifest does not declare 298 source records.");
requireCondition(revisions.length === 228 && decisions.length === 298, "Package revision/decision count mismatch.");
requireCondition(new Set(decisions.map((item: any) => item.content_id)).size === 298, "Package decision IDs are not unique.");
requireCondition(new Set(revisions.map((item: any) => item.content_id)).size === 228, "Package revision IDs are not unique.");
requireCondition(revisions.every((item: any) => item.decision === "REWRITE" && item.recommended_publication_status === "REVIEW_REQUIRED"), "Unsafe revision decision or publication recommendation.");

const internalPattern = /(CORE_V1|ProductResultFacts|DivinationResultFacts|Stable ID|Registry|Rule ID|Timing)/u;
const meihuaPattern = /(体用|互卦|外应|梅花易数|梅花起卦|梅花时间起卦)/u;
for (const revision of revisions) {
  requireCondition(revision.canonical_content_id === revision.content_id && revision.stable_id_action === "KEEP", `Stable ID violation for ${revision.content_id}.`);
  requireCondition(revision.body?.sections?.length >= 7, `Incomplete structured body for ${revision.content_id}.`);
  requireCondition(!meihuaPattern.test(revision.body.markdown), `Meihua-domain term in rewrite ${revision.content_id}.`);
}

const catalogPath = "content/content-growth/content-entries.json";
const catalog = readJson(catalogPath);
const catalogById = new Map(catalog.items.map((item: any) => [item.contentId, item]));
const knowledgeNodesPath = "data/content/knowledge-nodes-v1.2.json";
const knowledgeNodes = readJson(knowledgeNodesPath);
const glossaryPath = "data/content/glossary.json";
const glossary = readJson(glossaryPath);
const trigramsPath = "data/core/trigrams.json";
const trigrams = readJson(trigramsPath);
const hexagramsPath = "data/core/hexagrams-64.json";
const hexagrams = readJson(hexagramsPath);

function sourceRecord(contentId: string) {
  if (/^B0[1-4]-KC-/u.test(contentId)) return catalogById.get(contentId);
  if (contentId.startsWith("knowledge:")) return knowledgeNodes.find((item: any) => `knowledge:${item.code}` === contentId);
  if (contentId.startsWith("glossary:")) return glossary.items.find((item: any) => `glossary:${item.code}` === contentId);
  if (contentId.startsWith("trigram:")) return trigrams.items.find((item: any) => `trigram:${item.code}` === contentId);
  if (contentId.startsWith("hexagram:")) return hexagrams.items.find((item: any) => `hexagram:${item.code}` === contentId);
  return null;
}

for (const decision of decisions) {
  const source = sourceRecord(decision.content_id);
  requireCondition(source, `Cannot map ${decision.content_id} to a repository source record.`);
  if (/^B0[1-4]-KC-/u.test(decision.content_id)) continue;
  source.commercial_decision = {
    decision: decision.decision,
    canonical_content_id: decision.canonical_content_id,
    merge_target: decision.merge_target,
    reason: decision.reason,
    stable_id_action: decision.stable_id_action
  };
}

for (const revision of revisions) {
  const decision = decisionById.get(revision.content_id);
  const source = sourceRecord(revision.content_id);
  requireCondition(source && decision?.decision === "REWRITE", `Invalid rewrite target ${revision.content_id}.`);
  const body = transformedBody(revision, decision);
  if (/^B0[1-4]-KC-/u.test(revision.content_id)) {
    requireCondition(source.slug === revision.slug, `Stable slug mismatch for ${revision.content_id}.`);
    source.title = revision.title;
    source.summary = body.shortDefinition;
    source.body = { ...(source.body ?? {}), ...body };
    source.relatedKnowledgeIds = [...new Set([...(source.relatedKnowledgeIds ?? []), ...revision.related_knowledge_refs])];
    source.relatedContentIds = [...new Set([...(source.relatedContentIds ?? []), ...revision.article_refs])];
    source.faqIds = [...new Set([...(source.faqIds ?? []), ...revision.faq_refs])];
    source.secondaryKeywords = [...new Set([...(source.secondaryKeywords ?? []), ...body.aliases])];
    source.knownLimitations = [body.boundary];
    source.reviewStatus = "REVIEW_REQUIRED";
    source.publishedAt = null;
    source.seoMetadata = { ...(source.seoMetadata ?? {}), description: body.shortDefinition, ogDescription: body.shortDefinition, index: false, follow: false, publishedAt: null };
    continue;
  }
  source.summary = body.shortDefinition;
  source.commercial_content = body;
  source.commercial_content.seo = { ...revision.seo, description: body.shortDefinition, ogDescription: body.shortDefinition, index: false, follow: false, publishedAt: null };
}

for (const alias of canonicalization) {
  const canonical = sourceRecord(alias.canonical_content_id);
  const source = sourceRecord(alias.source_content_id);
  requireCondition(canonical && source, `Invalid canonicalization ${alias.source_content_id} -> ${alias.canonical_content_id}.`);
  const aliasTitle = source.title ?? source.title_zh ?? source.name_zh;
  if (/^B0[1-4]-KC-/u.test(alias.canonical_content_id)) {
    canonical.secondaryKeywords = [...new Set([...(canonical.secondaryKeywords ?? []), aliasTitle].filter(Boolean))];
    canonical.body.aliases = [...new Set([...(canonical.body.aliases ?? []), aliasTitle].filter(Boolean))];
  } else if (canonical.commercial_content) {
    canonical.commercial_content.aliases = [...new Set([...(canonical.commercial_content.aliases ?? []), aliasTitle].filter(Boolean))];
  }
}

catalog.generatedAt = new Date().toISOString();
writeJson(catalogPath, catalog);
writeJson(knowledgeNodesPath, knowledgeNodes);
writeJson(glossaryPath, glossary);
writeJson(trigramsPath, trigrams);
writeJson(hexagramsPath, hexagrams);

const exactSectionCounts = new Map<string, number>();
for (const revision of revisions) {
  for (const section of revision.body.sections) {
    const value = normalizeEditorialText(section.content_markdown).trim();
    if (value.length >= 40) exactSectionCounts.set(value, (exactSectionCounts.get(value) ?? 0) + 1);
  }
}
const repeatedSections = [...exactSectionCounts.entries()].filter(([, count]) => count > 1).sort((left, right) => right[1] - left[1]).map(([text, count]) => ({ count, text }));
const sourceInternalTermIds = revisions.filter((item: any) => internalPattern.test(item.body.markdown) || internalPattern.test(JSON.stringify(item.seo))).map((item: any) => item.content_id);
const productCentricIds = revisions.filter((item: any) => /(在本产品|实际产品|系统正在做什么|项目正式|内容层|界面还应|本 Batch)/u.test(item.body.markdown)).map((item: any) => item.content_id);
const audit = {
  package: manifest.packageName,
  package_sha256: sha256(packagePath),
  source_records_audited: decisions.length,
  rewritten_records_imported: revisions.length,
  decisions: manifest.decisions,
  source_files_updated: [catalogPath, knowledgeNodesPath, glossaryPath, trigramsPath, hexagramsPath],
  source_publication_status_set: "REVIEW_REQUIRED_FOR_REWRITES",
  runtime_publication_promotion_performed: false,
  stable_id_diff: 0,
  package_claimed_release_gate: "PASS",
  repository_release_gate: repeatedSections.some((item) => item.count >= 10) || sourceInternalTermIds.length || productCentricIds.length ? "BLOCKED_PENDING_EDITORIAL_AND_DOMAIN_REVIEW" : "PENDING_DOMAIN_AND_RUNTIME_REVIEW",
  exact_repeated_section_groups: repeatedSections.length,
  repeated_sections: repeatedSections,
  package_source_internal_term_ids: sourceInternalTermIds,
  product_centric_language_ids: productCentricIds
};
writeJson("reports/content/knowledge-commercial-finalization-batch-02-import.json", audit);
console.log(JSON.stringify({ ok: true, imported: revisions.length, decisions: manifest.decisions, releaseGate: audit.repository_release_gate, exactRepeatedSectionGroups: repeatedSections.length, packageSourceInternalTermCount: sourceInternalTermIds.length, productCentricLanguageCount: productCentricIds.length }, null, 2));
