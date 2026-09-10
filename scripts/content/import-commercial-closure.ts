#!/usr/bin/env node
// @ts-nocheck
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const rootDir = process.cwd();
const packagePath = process.argv.slice(2).find((argument) => argument !== "--");
if (!packagePath) throw new Error("Usage: pnpm content:import-closure <batch-04.zip>");

function archiveText(suffix: string) {
  const files = execFileSync("/usr/bin/unzip", ["-Z1", packagePath], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 }).split("\n").filter(Boolean);
  const matches = files.filter((file) => file.endsWith(suffix));
  if (matches.length !== 1) throw new Error(`Expected one ${suffix}, received ${matches.length}.`);
  return execFileSync("/usr/bin/unzip", ["-p", packagePath, matches[0]], { encoding: "utf8", maxBuffer: 60 * 1024 * 1024 });
}

function packageJson(suffix: string) {
  return JSON.parse(archiveText(suffix));
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

const manifest = packageJson("/00_START-HERE/manifest.json");
const decisions = packageJson("/01_FINAL-REGISTRY/unified-content-decision-registry.json");
const canonicalIds = packageJson("/01_FINAL-REGISTRY/canonical-content-id-registry.json");
const releaseLanes = packageJson("/01_FINAL-REGISTRY/content-release-lane-registry.json");
const knowledgeAliases = packageJson("/02_CANONICALIZATION/knowledge-alias-map.json");
const faqAliases = packageJson("/02_CANONICALIZATION/faq-query-variant-alias-map.json");
const contentFamilies = packageJson("/02_CANONICALIZATION/content-family-registry.json");
const contentGraph = packageJson("/02_CANONICALIZATION/content-graph.json");
const unresolved = packageJson("/02_CANONICALIZATION/unresolved-ref-classification.json");
const tracks = packageJson("/03_PRODUCT-IA/content-track-registry.json");
const learnHub = packageJson("/03_PRODUCT-IA/learn-hub-commercial-v1.json");
const topicPolicy = packageJson("/03_PRODUCT-IA/topic-landing-policy.json");
const collectionPolicy = packageJson("/03_PRODUCT-IA/collection-policy.json");
const publicationTruth = packageJson("/04_PUBLICATION/publication-source-of-truth.json");
const releaseGates = packageJson("/04_PUBLICATION/release-gates.json");
const searchContract = packageJson("/05_SEARCH-SEO/search-contract.json");
const recommendationContract = packageJson("/05_SEARCH-SEO/recommendation-contract.json");
const seoContract = packageJson("/05_SEARCH-SEO/seo-indexation-contract.json");
const publicStates = packageJson("/06_UX/public-content-states.json");

requireCondition(manifest.counts?.snapshot_content_scope === 536, "Closure manifest scope mismatch.");
requireCondition(decisions.length === 536 && releaseLanes.length === 536, "Unified decision coverage mismatch.");
requireCondition(canonicalIds.length === 457 && tracks.length === 457, "Canonical content/track count mismatch.");
requireCondition(knowledgeAliases.length === 49 && faqAliases.length === 8, "Alias count mismatch.");
requireCondition(contentGraph.length === 1193, "Content graph edge count mismatch.");
requireCondition(unresolved.unknown_release_blockers === 0, "Package contains unknown unresolved reference blockers.");

const decisionCounts = Object.fromEntries(["REWRITE", "MERGE", "REMOVE", "INTERNAL_ONLY"].map((decision) => [decision, decisions.filter((item: any) => item.decision === decision).length]));
requireCondition(JSON.stringify(decisionCounts) === JSON.stringify({ REWRITE: 457, MERGE: 57, REMOVE: 15, INTERNAL_ONLY: 7 }), "Unified decision math mismatch.");

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
  if (/^B0[1-5]-(?:A\d+|KC-|FAQ-)/u.test(contentId)) return catalogById.get(contentId);
  if (contentId.startsWith("knowledge:")) return knowledgeNodes.find((item: any) => `knowledge:${item.code}` === contentId);
  if (contentId.startsWith("glossary:")) return glossary.items.find((item: any) => `glossary:${item.code}` === contentId);
  if (contentId.startsWith("trigram:")) return trigrams.items.find((item: any) => `trigram:${item.code}` === contentId);
  if (contentId.startsWith("hexagram:")) return hexagrams.items.find((item: any) => `hexagram:${item.code}` === contentId);
  return null;
}

const decisionById = new Map(decisions.map((item: any) => [item.content_id, item]));
const trackById = new Map(tracks.map((item: any) => [item.content_id, item.track]));
const graphBySource = new Map<string, string[]>();
for (const edge of contentGraph) {
  const values = graphBySource.get(edge.source_content_id) ?? [];
  values.push(edge.target_content_id);
  graphBySource.set(edge.source_content_id, values);
}

for (const decision of decisions) {
  const source = sourceRecord(decision.content_id);
  requireCondition(source, `Cannot map closure content ID ${decision.content_id}.`);
  const closure = {
    decision: decision.decision,
    canonicalContentId: decision.canonical_content_id,
    releaseLane: decision.release_lane,
    professionalReviewStatus: decision.professional_review_status,
    recommendedRuntimeStatus: decision.recommended_runtime_status,
    publicRouteAction: decision.public_route_action,
    track: trackById.get(decision.content_id) ?? null
  };
  const graphRefs = [...new Set(graphBySource.get(decision.content_id) ?? [])].filter((id) => id !== decision.content_id);
  if (catalogById.has(decision.content_id)) {
    source.body = { ...(source.body ?? {}), commercialClosure: closure, closureRelatedContentIds: graphRefs };
    source.relatedContentIds = [...new Set([...(source.relatedContentIds ?? []).filter((id: string) => id !== "LIUYAO_LEARN_HUB" && id !== "B04-FAQ-40"), ...graphRefs])];
  } else {
    source.commercial_closure = closure;
    source.commercial_content = { ...(source.commercial_content ?? {}), relatedContentRefs: graphRefs };
  }
}

const routeRefSources = unresolved.items.filter((item: any) => item.classification === "PRODUCT_ROUTE_REF_NOT_CONTENT_ID").map((item: any) => item.source_content_id);
for (const contentId of routeRefSources) {
  const source = catalogById.get(contentId);
  if (!source) continue;
  source.relatedContentIds = (source.relatedContentIds ?? []).filter((id: string) => id !== "LIUYAO_LEARN_HUB");
  source.body.navigationRefs = [...new Set([...(source.body.navigationRefs ?? []), "/content"])];
}

const hub = catalogById.get("LIUYAO_LEARN_HUB");
requireCondition(hub, "LIUYAO_LEARN_HUB is missing.");
hub.title = "六爻学习中心";
hub.summary = "从正确提问、现实问题和专业理解三条路径进入六爻知识体系。";
hub.body = {
  ...(hub.body ?? {}),
  commercialIA: learnHub,
  primaryNavigation: learnHub.primary_navigation,
  secondaryHelp: learnHub.secondary_help,
  mobileFirstFold: learnHub.mobile_first_fold,
  editorialCompletionStatus: "COMMERCIAL_CLOSURE_IMPORTED"
};

const publicInternalPattern = /(CORE_V1|ProductResultFacts|DivinationResultFacts|Stable ID|Registry|Rule ID|VERIFY_IN_REPOSITORY)/u;
for (const item of catalog.items) {
  if (item.reviewStatus !== "PUBLICATION_READY") continue;
  if (!publicInternalPattern.test(`${item.title} ${item.summary} ${JSON.stringify(item.body ?? {})}`)) continue;
  item.reviewStatus = "REVIEW_REQUIRED";
  item.publishedAt = null;
  item.seoMetadata = { ...(item.seoMetadata ?? {}), index: false, follow: false, publishedAt: null };
  item.body = {
    ...(item.body ?? {}),
    repositoryReview: { status: "REVIEW_REQUIRED", method: "BATCH_04_PUBLIC_INTERNAL_LANGUAGE_GATE" }
  };
}

catalog.publicationPolicy = {
  ...(catalog.publicationPolicy ?? {}),
  sourceOfTruth: publicationTruth.single_source_of_truth,
  publicStatus: publicationTruth.public_status,
  allPublicSurfaces: publicationTruth.all_public_surfaces,
  automaticPromotion: "FROZEN",
  closureVersion: manifest.version
};
catalog.generatedAt = new Date().toISOString();

writeJson(catalogPath, catalog);
writeJson(knowledgeNodesPath, knowledgeNodes);
writeJson(glossaryPath, glossary);
writeJson(trigramsPath, trigrams);
writeJson(hexagramsPath, hexagrams);

const policyDir = resolve(rootDir, "data/content-commercialization/release-closure-v1");
mkdirSync(policyDir, { recursive: true });
const installed = {
  "manifest.json": manifest,
  "unified-content-decision-registry.json": decisions,
  "canonical-content-id-registry.json": canonicalIds,
  "content-release-lane-registry.json": releaseLanes,
  "knowledge-alias-map.json": knowledgeAliases,
  "faq-query-variant-alias-map.json": faqAliases,
  "content-family-registry.json": contentFamilies,
  "content-graph.json": contentGraph,
  "unresolved-ref-classification.json": unresolved,
  "content-track-registry.json": tracks,
  "learn-hub-commercial-v1.json": learnHub,
  "topic-landing-policy.json": topicPolicy,
  "collection-policy.json": collectionPolicy,
  "publication-source-of-truth.json": publicationTruth,
  "release-gates.json": releaseGates,
  "search-contract.json": searchContract,
  "recommendation-contract.json": recommendationContract,
  "seo-indexation-contract.json": seoContract,
  "public-content-states.json": publicStates
};
for (const [name, value] of Object.entries(installed)) writeFileSync(resolve(policyDir, name), `${JSON.stringify(value, null, 2)}\n`);

const allMapped = decisions.filter((item: any) => sourceRecord(item.content_id)).length;
const canonicalMapped = canonicalIds.filter((id: string) => sourceRecord(id)).length;
const legacyPublicInternalLanguageDemoted = catalog.items.filter((item: any) => item.body?.repositoryReview?.method === "BATCH_04_PUBLIC_INTERNAL_LANGUAGE_GATE").map((item: any) => item.contentId);
const audit = {
  package: manifest.packageName,
  package_sha256: sha256(packagePath),
  unified_decision_coverage: `${allMapped}/${decisions.length}`,
  canonical_asset_coverage: `${canonicalMapped}/${canonicalIds.length}`,
  decision_counts: decisionCounts,
  alias_sources: knowledgeAliases.length + faqAliases.length,
  content_graph_edges_installed: contentGraph.length,
  navigation_refs_migrated: routeRefSources.length,
  unknown_unresolved_refs: unresolved.unknown_release_blockers,
  legacy_public_internal_language_demoted: legacyPublicInternalLanguageDemoted,
  ready_for_runtime_gate: decisions.filter((item: any) => item.release_lane === "READY_FOR_RUNTIME_RELEASE_GATE").length,
  professional_review_required: decisions.filter((item: any) => item.release_lane === "PROFESSIONAL_REVIEW_REQUIRED").length,
  production_promotion_performed: false,
  repository_release_status: "LIUYAO_CONTENT_COMMERCIAL_READY_WITH_BLOCKERS",
  blockers: [
    "Batch 01 article independent editorial audit remains blocked.",
    "Batch 02 knowledge independent editorial/domain audit remains blocked.",
    "Batch 03 FAQ contains 36 repeated long-sentence groups and remains blocked.",
    "No deterministic domain review has promoted the 240 editorially complete candidates."
  ]
};
writeJson("reports/content/commercial-finalization-batch-04-closure-import.json", audit);
console.log(JSON.stringify({ ok: true, ...audit }, null, 2));
