// @ts-nocheck
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const SNIPPET_PATH = "data/content-growth/explanation-snippets.json";

function readSnippets(rootDir = process.cwd()) {
  const path = resolve(rootDir, SNIPPET_PATH);
  if (!existsSync(path)) return [];
  const data = JSON.parse(readFileSync(path, "utf8"));
  return Array.isArray(data.snippets) ? data.snippets : [];
}

function publicSnippet(snippet) {
  return {
    snippetId: snippet.snippet_id,
    category: snippet.category,
    placement: snippet.recommended_report_placement,
    priority: snippet.priority_default,
    guided: snippet.guided,
    professional: snippet.professional,
    knowledgeRefs: snippet.knowledge_refs ?? [],
    articleRefs: snippet.article_refs ?? [],
    status: snippet.professional_alignment_status,
  };
}

function firstByCategory(snippets, category) {
  return snippets.find((item) => item.category === category && item.status === "APPROVED_WITH_ALIGNMENT_PENDING");
}

export function selectContentExplanationSnippets({ productResultFacts, rootDir = process.cwd(), limit = 8 } = {}) {
  if (!productResultFacts) return [];
  const snippets = readSnippets(rootDir);
  if (!snippets.length) return [];

  const categories = ["RESULT_OVERVIEW", "YONGSHEN_CORE_FOCUS"];
  const dimensions = new Set((productResultFacts.evidenceGroupingFacts ?? []).map((item) => item.dimension));
  if (dimensions.has("subject_state") || dimensions.has("supporting_forces") || dimensions.has("blocking_forces")) categories.push("STRENGTH_STATE");
  if (dimensions.has("change_direction") || productResultFacts.chartFacts?.movingLines?.length) categories.push("DYNAMICS");
  if ((productResultFacts.conflictResolutionFacts?.supportFindingRefs ?? []).length || (productResultFacts.conflictResolutionFacts?.blockingFindingRefs ?? []).length) {
    categories.push("SUPPORT_RISK_CONFLICT");
  }
  if ((productResultFacts.timingExplanationFacts ?? []).length) categories.push("TIMING");
  if ((productResultFacts.actionGuidanceFacts?.items ?? []).length) categories.push("ACTION_GUIDANCE");
  categories.push("AI_TRUST");

  return [...new Set(categories)]
    .map((category) => firstByCategory(snippets, category))
    .filter(Boolean)
    .slice(0, limit)
    .map(publicSnippet);
}
