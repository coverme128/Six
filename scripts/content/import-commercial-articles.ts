#!/usr/bin/env node
// @ts-nocheck
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const rootDir = process.cwd();
const packagePath = process.argv.slice(2).find((argument) => argument !== "--");
if (!packagePath) throw new Error("Usage: pnpm content:import-articles <batch-01.zip>");

function archiveText(suffix: string) {
  const files = execFileSync("/usr/bin/unzip", ["-Z1", packagePath], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 })
    .split("\n")
    .filter(Boolean);
  const matches = files.filter((file) => file.endsWith(suffix));
  if (matches.length !== 1) throw new Error(`Expected one ${suffix}, received ${matches.length}.`);
  return execFileSync("/usr/bin/unzip", ["-p", packagePath, matches[0]], { encoding: "utf8", maxBuffer: 30 * 1024 * 1024 });
}

function stripInlineMarkdown(value: string) {
  return value.replace(/\*\*(.*?)\*\*/gu, "$1").replace(/`(.*?)`/gu, "$1").trim();
}

function normalizeEditorialText(value: string, title: string) {
  const nestedTitle = title.includes("“") ? `“${title.replaceAll("“", "‘").replaceAll("”", "’")}”` : `“${title}”`;
  return value
    .replaceAll(`“${title}”`, nestedTitle)
    .replace(/“([^”\n]*)“([^”\n]+)”([^”\n]*)”/gu, "“$1‘$2’$3”")
    .replace(/(?<=[\u3400-\u9fff]) (?=[\u3400-\u9fff])/gu, "")
    .replaceAll("Timing 规则/事实", "时间规则与事实")
    .replaceAll("Timing 条件", "时间条件")
    .replaceAll("Timing 规则", "时间规则")
    .replaceAll("Timing", "时间条件")
    .replaceAll("Mental Model", "理解框架")
    .replaceAll("Relationship Meaning", "关系含义")
    .replaceAll("Facts", "事实")
    .replaceAll("Rules", "规则")
    .replaceAll("Conflict", "冲突")
    .replaceAll("Summary：", "要点：")
    .replaceAll("专业阅读用户", "希望深入核验的用户")
    .replaceAll("专业模式用户", "希望深入核验的用户")
    .replaceAll("专业阅读核验", "深入核验")
    .replaceAll("专业模式核验", "深入核验")
    .replaceAll("转化为引导阅读的", "转化为易懂的")
    .replaceAll("引导阅读报告", "面向普通用户的报告")
    .replaceAll("简明模式", "简明表达")
    .replace(/(?<=[\u3400-\u9fff]) (?=[\u3400-\u9fff])/gu, "");
}

function markdownBlocks(markdown: string) {
  return markdown.split(/\n\s*\n/gu).map((part) => part.trim()).filter(Boolean).map((part) => {
    const lines = part.split("\n").map((line) => line.trim()).filter(Boolean);
    if (lines.every((line) => /^-\s+/u.test(line))) {
      return { type: "unordered_list", items: lines.map((line) => stripInlineMarkdown(line.replace(/^-\s+/u, ""))) };
    }
    if (lines.every((line) => /^\d+\.\s+/u.test(line))) {
      return { type: "ordered_list", items: lines.map((line) => stripInlineMarkdown(line.replace(/^\d+\.\s+/u, ""))) };
    }
    return { type: "paragraph", text: stripInlineMarkdown(lines.join("\n")) };
  });
}

function sectionByHeading(item: any, heading: string) {
  return item.body.sections.find((section: any) => section.heading === heading);
}

function listFromSection(item: any, heading: string) {
  const section = sectionByHeading(item, heading);
  if (!section) return [];
  return markdownBlocks(section.content_markdown).flatMap((block: any) => block.items ?? []);
}

function summaryFromMarkdown(markdown: string) {
  const quote = /^>\s+(.+)$/mu.exec(markdown)?.[1];
  return quote ? stripInlineMarkdown(quote) : null;
}

function requireCondition(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function sha256(path: string) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

const manifest = JSON.parse(archiveText("/00_START-HERE/manifest.json"));
const revisions = JSON.parse(archiveText("/02_ARTICLES/article-commercial-finalization-registry.json"));
const decisions = JSON.parse(archiveText("/03_DECISIONS/content-decision-registry.json"));
const catalogPath = resolve(rootDir, "content/content-growth/content-entries.json");
const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
const targetPattern = /^B0[345]-A\d+$/u;
const currentTargets = catalog.items.filter((item: any) => item.contentType === "TUTORIAL" && targetPattern.test(item.contentId));
const currentById = new Map(currentTargets.map((item: any) => [item.contentId, item]));
const decisionById = new Map(decisions.map((item: any) => [item.content_id, item]));

requireCondition(manifest.counts?.articles === 68, "Package manifest does not declare 68 articles.");
requireCondition(revisions.length === 68 && currentTargets.length === 68, "Package/current target count mismatch.");
requireCondition(new Set(revisions.map((item: any) => item.content_id)).size === 68, "Package content IDs are not unique.");

const internalPattern = /(Registry|Evidence|CORE_V1|CAL_STD_V1|ProductResultFacts|DivinationResultFacts|Guided|Professional|Finding|VERIFY_IN_REPOSITORY|Stable ID)/iu;
const meihuaPattern = /(体用|互卦|外应|梅花易数|梅花起卦)/u;
const mechanicallyNormalizedIds: string[] = [];

for (const revision of revisions) {
  const current = currentById.get(revision.content_id);
  const decision = decisionById.get(revision.content_id);
  requireCondition(current, `Unknown article ID ${revision.content_id}.`);
  requireCondition(revision.canonical_content_id === revision.content_id && revision.stable_id_action === "KEEP", `Stable ID violation for ${revision.content_id}.`);
  requireCondition(current.slug === revision.slug && current.title === revision.title, `Identity mismatch for ${revision.content_id}.`);
  requireCondition(revision.recommended_publication_status === "REVIEW_REQUIRED", `Unsafe publication recommendation for ${revision.content_id}.`);
  requireCondition(decision?.recommended_publication_status === "REVIEW_REQUIRED", `Decision registry mismatch for ${revision.content_id}.`);
  requireCondition(revision.body?.sections?.length >= 8 && revision.body?.markdown?.length >= 1800, `Incomplete article ${revision.content_id}.`);
  requireCondition(!internalPattern.test(revision.body.markdown), `Internal implementation term in ${revision.content_id}.`);
  requireCondition(!meihuaPattern.test(revision.body.markdown), `Meihua-domain term in ${revision.content_id}.`);

  const normalizedMarkdown = normalizeEditorialText(revision.body.markdown, revision.title);
  if (normalizedMarkdown !== revision.body.markdown) mechanicallyNormalizedIds.push(revision.content_id);
  const transformedSections = revision.body.sections.map((section: any) => {
    const normalizedSection = normalizeEditorialText(section.content_markdown, revision.title);
    return {
    heading: section.heading,
    body: normalizedSection,
    blocks: markdownBlocks(normalizedSection)
  };
  });
  const normalizedRevision = { ...revision, body: { ...revision.body, markdown: normalizedMarkdown, sections: transformedSections.map((section: any) => ({ heading: section.heading, content_markdown: section.body })) } };
  const keyTakeaways = listFromSection(normalizedRevision, "关键结论");
  const commonMisunderstandings = listFromSection(normalizedRevision, "常见误区");
  const boundary = sectionByHeading(normalizedRevision, "使用边界");
  const summary = summaryFromMarkdown(normalizedMarkdown) ?? current.summary;
  const {
    sections: _oldSections,
    markdown: _oldMarkdown,
    bodyMarkdown: _oldBodyMarkdown,
    subtitle: _oldSubtitle,
    keyTakeaways: _oldTakeaways,
    commonMisunderstandings: _oldMisunderstandings,
    practicalFramework: _oldFramework,
    repositoryReview: _oldReview,
    ...preservedBody
  } = current.body ?? {};

  Object.assign(current, {
    title: revision.title,
    summary,
    reviewStatus: "REVIEW_REQUIRED",
    publishedAt: null,
    knownLimitations: boundary ? markdownBlocks(boundary.content_markdown).flatMap((block: any) => block.text ? [block.text] : block.items ?? []) : current.knownLimitations,
    seoMetadata: {
      ...(current.seoMetadata ?? {}),
      ...(revision.seo_metadata ?? {}),
      description: summary,
      ogDescription: summary,
      index: false,
      follow: false,
      publishedAt: null
    },
    body: {
      ...preservedBody,
      subtitle: normalizeEditorialText(revision.subtitle, revision.title),
      keyTakeaways,
      sections: transformedSections,
      commonMisunderstandings,
      markdown: normalizedMarkdown,
      editorialCompletionStatus: "IMPORTED_PENDING_EDITORIAL_AND_DOMAIN_REVIEW",
      sourceEditorialClaim: revision.editorial_completion_status,
      repositoryReview: {
        status: "REVIEW_REQUIRED",
        method: "COMMERCIAL_BATCH_01_PENDING_DOMAIN_AND_RUNTIME_RELEASE_GATE"
      }
    }
  });
}

catalog.generatedAt = new Date().toISOString();
writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);

const importedTargets = catalog.items.filter((item: any) => item.contentType === "TUTORIAL" && targetPattern.test(item.contentId));
const paragraphCounts = new Map<string, number>();
for (const item of importedTargets) {
  for (const section of item.body.sections) {
    for (const paragraph of section.body.split(/\n\s*\n/gu).map((value: string) => value.trim()).filter((value: string) => value.length >= 40)) {
      paragraphCounts.set(paragraph, (paragraphCounts.get(paragraph) ?? 0) + 1);
    }
  }
}
const repeatedParagraphs = [...paragraphCounts.entries()]
  .filter(([, count]) => count > 1)
  .sort((left, right) => right[1] - left[1])
  .map(([text, count]) => ({ count, text }));
const nestedQuoteIds = importedTargets.filter((item: any) => /“[^”\n]*“/u.test(item.body.markdown)).map((item: any) => item.contentId);
const editorialTermIds = importedTargets.filter((item: any) => /(Timing|Mental Model|Relationship Meaning|Facts|Rules|Conflict)/u.test(item.body.markdown)).map((item: any) => item.contentId);
const productCentricIds = importedTargets.filter((item: any) => /(项目正式|产品不应该|系统先|确定性排盘|专业资产|AI\s*(?:不得|不能))/u.test(item.body.markdown)).map((item: any) => item.contentId);
const audit = {
  package: manifest.packageName,
  package_sha256: sha256(packagePath),
  imported_articles: revisions.length,
  status_preserved: "REVIEW_REQUIRED",
  runtime_promotion_performed: false,
  stable_id_diff: 0,
  body_sections_renderable: revisions.filter((item: any) => item.body.sections.length >= 8).length,
  exact_repeated_paragraph_groups: repeatedParagraphs.length,
  repeated_paragraphs: repeatedParagraphs,
  mechanically_normalized_article_ids: mechanicallyNormalizedIds,
  nested_quote_article_ids: nestedQuoteIds,
  editorial_term_article_ids: editorialTermIds,
  product_centric_language_article_ids: productCentricIds,
  release_gate: nestedQuoteIds.length || editorialTermIds.length || productCentricIds.length || repeatedParagraphs.some((item) => item.count >= 10)
    ? "BLOCKED_PENDING_EDITORIAL_AND_DOMAIN_REVIEW"
    : "PENDING_DOMAIN_AND_RUNTIME_REVIEW"
};
writeFileSync(resolve(rootDir, "reports/content/article-commercial-finalization-batch-01-import.json"), `${JSON.stringify(audit, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, catalogPath, auditPath: "reports/content/article-commercial-finalization-batch-01-import.json", ...audit, repeated_paragraphs: undefined }, null, 2));
