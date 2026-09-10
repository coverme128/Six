#!/usr/bin/env node
// @ts-nocheck
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const rootDir = process.cwd();
const packagePath = process.argv.slice(2).find((argument) => argument !== "--");
if (!packagePath) throw new Error("Usage: pnpm content:import-faq <batch-03.zip>");

function archiveText(suffix: string) {
  const files = execFileSync("/usr/bin/unzip", ["-Z1", packagePath], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 }).split("\n").filter(Boolean);
  const matches = files.filter((file) => file.endsWith(suffix));
  if (matches.length !== 1) throw new Error(`Expected one ${suffix}, received ${matches.length}.`);
  return execFileSync("/usr/bin/unzip", ["-p", packagePath, matches[0]], { encoding: "utf8", maxBuffer: 40 * 1024 * 1024 });
}

function requireCondition(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function normalizeEditorialText(value: string) {
  return String(value ?? "")
    .replaceAll("Question Topic", "问题主题")
    .replaceAll("Role Mapping", "现实角色映射")
    .replaceAll("Yongshen", "用神")
    .replaceAll("Shi / Ying", "世爻与应爻")
    .replaceAll("Six Relation", "六亲")
    .replaceAll("Presenter", "表达层")
    .replaceAll("Fact 来源", "事实来源")
    .replaceAll("既定规则 /", "既定规则与")
    .replaceAll("专业模式 模式", "专业模式")
    .replaceAll("简明模式 用户", "普通用户")
    .replaceAll("受事实约束的 AI 解释 解释", "受事实约束的 AI 解读")
    .replaceAll("受事实约束的 AI 解释", "受事实约束的 AI 解读")
    .replace(/(?<=[。！？；，：、])\s+(?=[\u3400-\u9fff])/gu, "")
    .replace(/(?<=[\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/gu, "")
    .replace(/\s{2,}/gu, " ")
    .trim();
}

function answerParagraphs(value: string) {
  const normalized = normalizeEditorialText(value);
  const sentences = normalized.match(/[^。！？]+[。！？]?/gu)?.map((item) => item.trim()).filter(Boolean) ?? [];
  if (sentences.length <= 2) return [normalized];
  const midpoint = Math.ceil(sentences.length / 2);
  return [sentences.slice(0, midpoint).join(""), sentences.slice(midpoint).join("")].filter(Boolean);
}

function sha256(path: string) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

const manifest = JSON.parse(archiveText("/00_START-HERE/manifest.json"));
const revisions = JSON.parse(archiveText("/02_FAQ/faq-commercial-finalization-registry.json"));
const decisions = JSON.parse(archiveText("/03_DECISIONS/faq-content-decision-registry.json"));
const canonicalization = JSON.parse(archiveText("/03_DECISIONS/faq-canonicalization-map.json"));
const queryVariants = JSON.parse(archiveText("/03_DECISIONS/query-variant-map.json"));
const catalogPath = resolve(rootDir, "content/content-growth/content-entries.json");
const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
const currentFaqs = catalog.items.filter((item: any) => item.contentType === "FAQ");
const currentById = new Map(currentFaqs.map((item: any) => [item.contentId, item]));
const decisionById = new Map(decisions.map((item: any) => [item.faq_id, item]));

requireCondition(manifest.snapshotFaqCount === 170, "Package manifest does not declare 170 source FAQ records.");
requireCondition(currentFaqs.length === 170 && decisions.length === 170 && revisions.length === 161, "Package/current FAQ count mismatch.");
requireCondition(new Set(decisions.map((item: any) => item.faq_id)).size === 170, "Package decision IDs are not unique.");
requireCondition(new Set(revisions.map((item: any) => item.faq_id)).size === 161, "Package rewrite IDs are not unique.");
requireCondition(decisions.every((item: any) => currentById.has(item.faq_id)), "Package contains an unknown FAQ Stable ID.");
requireCondition(revisions.every((item: any) => item.decision === "REWRITE" && item.recommended_publication_status === "REVIEW_REQUIRED"), "Unsafe FAQ rewrite status.");

const sourceInternalPattern = /(Question Topic|Role Mapping|Yongshen|Shi \/ Ying|Six Relation|Presenter|Fact 来源|CORE_V1|ProductResultFacts|DivinationResultFacts|Stable ID|Registry|Rule ID)/u;
const sourceMeihuaPattern = /((?<!具)体卦|(?<!利)(?<!使)用卦|体用|互卦|外应|梅花(?:易数|起卦|时间起卦))/u;
const sourceInternalIds = revisions.filter((item: any) => sourceInternalPattern.test(`${item.short_answer} ${item.full_answer}`)).map((item: any) => item.faq_id);
const sourceMeihuaIds = revisions.filter((item: any) => sourceMeihuaPattern.test(`${item.short_answer} ${item.full_answer}`)).map((item: any) => item.faq_id);

for (const decision of decisions) {
  const current = currentById.get(decision.faq_id);
  requireCondition(current, `Cannot map FAQ ${decision.faq_id}.`);
  current.body = {
    ...(current.body ?? {}),
    commercialDecision: {
      decision: decision.decision,
      canonicalFaqId: decision.canonical_faq_id,
      mergeTarget: decision.merge_target,
      stableIdAction: decision.stable_id_action,
      reason: decision.reason
    }
  };
  if (decision.decision === "MERGE" || decision.decision === "INTERNAL_ONLY") {
    current.reviewStatus = "INTERNAL_ONLY";
    current.publishedAt = null;
    current.seoMetadata = { ...(current.seoMetadata ?? {}), index: false, follow: false, publishedAt: null };
  }
}

for (const revision of revisions) {
  const current = currentById.get(revision.faq_id);
  const decision = decisionById.get(revision.faq_id);
  requireCondition(current && decision?.decision === "REWRITE", `Invalid FAQ rewrite target ${revision.faq_id}.`);
  requireCondition(current.slug === revision.slug, `Stable slug mismatch for ${revision.faq_id}.`);
  const shortAnswer = normalizeEditorialText(revision.short_answer);
  const fullAnswer = normalizeEditorialText(revision.full_answer);
  const variants = [...new Set((revision.query_variants ?? []).map(normalizeEditorialText).filter(Boolean))];
  Object.assign(current, {
    title: normalizeEditorialText(revision.question),
    summary: shortAnswer,
    category: revision.category,
    secondaryKeywords: [...new Set([...(current.secondaryKeywords ?? []), ...variants])],
    relatedContentIds: [...new Set([...(current.relatedContentIds ?? []), ...(revision.article_refs ?? [])])],
    relatedKnowledgeIds: [...new Set([...(current.relatedKnowledgeIds ?? []), ...(revision.knowledge_refs ?? [])])],
    faqIds: [...new Set([...(current.faqIds ?? []), ...(revision.related_faq_refs ?? [])])],
    reviewStatus: "REVIEW_REQUIRED",
    publishedAt: null,
    seoMetadata: {
      ...(current.seoMetadata ?? {}),
      ...(revision.seo ?? {}),
      title: normalizeEditorialText(revision.question),
      description: shortAnswer,
      ogTitle: normalizeEditorialText(revision.question),
      ogDescription: shortAnswer,
      index: false,
      follow: false,
      publishedAt: null
    },
    body: {
      ...(current.body ?? {}),
      question: normalizeEditorialText(revision.question),
      shortAnswer,
      fullAnswer,
      answerParagraphs: answerParagraphs(revision.full_answer),
      queryVariants: variants,
      productRoute: revision.product_route,
      editorialCompletionStatus: "IMPORTED_PENDING_EDITORIAL_AND_DOMAIN_REVIEW",
      sourceEditorialClaim: revision.editorial_completion_status,
      professionalReviewStatus: revision.professional_review_status,
      repositoryReview: { status: "REVIEW_REQUIRED", method: "COMMERCIAL_BATCH_03_PENDING_DOMAIN_AND_RUNTIME_RELEASE_GATE" }
    }
  });
}

for (const alias of canonicalization) {
  const source = currentById.get(alias.source_faq_id);
  const canonical = currentById.get(alias.canonical_faq_id);
  requireCondition(source && canonical, `Invalid FAQ canonicalization ${alias.source_faq_id} -> ${alias.canonical_faq_id}.`);
  const sourceQuestion = normalizeEditorialText(alias.source_question);
  canonical.secondaryKeywords = [...new Set([...(canonical.secondaryKeywords ?? []), sourceQuestion])];
  canonical.body.queryVariants = [...new Set([...(canonical.body.queryVariants ?? []), sourceQuestion])];
  source.body.canonicalPath = canonical.canonicalPath;
}

for (const alias of queryVariants) {
  const canonical = currentById.get(alias.canonical_faq_id);
  requireCondition(canonical, `Invalid query variant target ${alias.canonical_faq_id}.`);
  const variants = alias.query_variants.map(normalizeEditorialText);
  canonical.secondaryKeywords = [...new Set([...(canonical.secondaryKeywords ?? []), ...variants])];
  canonical.body.queryVariants = [...new Set([...(canonical.body.queryVariants ?? []), ...variants])];
}

catalog.generatedAt = new Date().toISOString();
writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);

const sentenceCounts = new Map<string, { count: number; ids: Set<string> }>();
for (const revision of revisions) {
  for (const sentence of normalizeEditorialText(revision.full_answer).split(/(?<=[。！？])/gu).map((value) => value.trim()).filter((value) => value.length >= 35)) {
    const record = sentenceCounts.get(sentence) ?? { count: 0, ids: new Set<string>() };
    record.count += 1;
    record.ids.add(revision.faq_id);
    sentenceCounts.set(sentence, record);
  }
}
const repeatedSentences = [...sentenceCounts.entries()]
  .filter(([, record]) => record.count > 1)
  .sort((left, right) => right[1].count - left[1].count)
  .map(([text, record]) => ({ count: record.count, ids: [...record.ids], text }));
const importedFaqs = catalog.items.filter((item: any) => item.contentType === "FAQ");
const importedInternalIds = importedFaqs
  .filter((item: any) => item.body?.commercialDecision?.decision === "REWRITE")
  .filter((item: any) => sourceInternalPattern.test(`${item.body?.question ?? ""} ${item.body?.shortAnswer ?? ""} ${item.body?.fullAnswer ?? ""}`))
  .map((item: any) => item.contentId);
const audit = {
  package: manifest.packageName,
  package_sha256: sha256(packagePath),
  source_records_audited: decisions.length,
  rewritten_records_imported: revisions.length,
  decisions: manifest.decisions,
  canonical_public_intents: revisions.length,
  runtime_publication_promotion_performed: false,
  source_status: "REVIEW_REQUIRED_FOR_REWRITES_INTERNAL_ONLY_FOR_ALIASES",
  stable_id_diff: 0,
  package_claimed_release_gate: "PASS",
  repository_release_gate: sourceInternalIds.length || sourceMeihuaIds.length || repeatedSentences.some((item) => item.count >= 5)
    ? "BLOCKED_PENDING_EDITORIAL_AND_DOMAIN_REVIEW"
    : "PENDING_DOMAIN_AND_RUNTIME_REVIEW",
  package_source_internal_term_ids: sourceInternalIds,
  package_source_meihua_term_ids: sourceMeihuaIds,
  imported_internal_term_ids: importedInternalIds,
  exact_repeated_sentence_groups: repeatedSentences.length,
  repeated_sentences: repeatedSentences
};
writeFileSync(resolve(rootDir, "reports/content/faq-commercial-finalization-batch-03-import.json"), `${JSON.stringify(audit, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, imported: revisions.length, decisions: manifest.decisions, releaseGate: audit.repository_release_gate, packageSourceInternalTermCount: sourceInternalIds.length, importedInternalTermCount: importedInternalIds.length, repeatedSentenceGroups: repeatedSentences.length }, null, 2));
