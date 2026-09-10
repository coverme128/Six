import { Controller, Get, NotFoundException, Param, Query } from "@nestjs/common";
import { getPrismaClient } from "@six/database";
import { buildSEOMetadata, buildStructuredData, HybridContentRepository } from "@six/domain/content-framework";
import { indexes, loadDomainData } from "@six/domain/data-store";
import { getBlogPost, getKnowledgeItem, getKnowledgeOverview, listBlogPosts, searchKnowledge } from "@six/domain/knowledge";

function rootDir() {
  return process.env.SIX_ROOT ?? process.cwd();
}

function contentRepository() {
  return new HybridContentRepository({
    rootDir: rootDir(),
    includePreview: !["beta", "production"].includes(process.env.APP_ENV ?? "development")
  });
}

function contentSummary(entry: any) {
  return {
    contentId: entry.contentId,
    contentType: entry.contentType,
    title: entry.title,
    slug: entry.slug,
    canonicalPath: entry.canonicalPath,
    summary: entry.summary,
    domain: entry.domain,
    category: entry.category,
    difficulty: entry.difficulty,
    funnelStage: entry.funnelStage,
    searchIntent: entry.searchIntent,
    primaryConversion: entry.primaryConversion,
    secondaryConversion: entry.secondaryConversion,
    reviewStatus: entry.reviewStatus,
    seoMetadata: buildSEOMetadata(entry, { baseUrl: process.env.APP_BASE_URL ?? "" })
  };
}

function contentDetail(entry: any) {
  return {
    ...contentSummary(entry),
    body: entry.body,
    tags: entry.tags,
    audience: entry.audience,
    primaryConversion: entry.primaryConversion,
    secondaryConversion: entry.secondaryConversion,
    relatedKnowledgeIds: entry.relatedKnowledgeIds,
    relatedContentIds: entry.relatedContentIds,
    prerequisiteContentIds: entry.prerequisiteContentIds,
    nextContentId: entry.nextContentId,
    previousContentId: entry.previousContentId,
    faqIds: entry.faqIds,
    sourceRefs: entry.sourceRefs,
    knownLimitations: entry.knownLimitations,
    structuredData: buildStructuredData(entry, { baseUrl: process.env.APP_BASE_URL ?? "" })
  };
}

const meihuaOnlyPattern = /((?<!具)体卦|(?<!利)(?<!使)用卦|体用|互卦|外应|梅花(?:易数|起卦|时间起卦))/u;

function containsMeihuaOnlySemantics(entry: any) {
  return meihuaOnlyPattern.test(JSON.stringify({
    title: entry.title,
    summary: entry.summary,
    body: entry.body,
    tags: entry.tags
  }));
}

function publicContentEntries(entries: any[]) {
  const production = ["beta", "production"].includes(process.env.APP_ENV ?? "development");
  return entries.filter((entry) => {
    const decision = entry.body?.commercialClosure?.decision ?? entry.body?.commercialDecision?.decision ?? entry.body?.commercial_decision?.decision;
    if (["MERGE", "REMOVE", "INTERNAL_ONLY"].includes(decision)) return false;
    if (String(entry.domain).toLowerCase() !== "liuyao" || containsMeihuaOnlySemantics(entry)) return false;
    return production
      ? entry.reviewStatus === "PUBLICATION_READY"
      : ["PUBLICATION_READY", "REVIEWED", "REVIEW_REQUIRED"].includes(entry.reviewStatus);
  });
}

function reviewStatusFromDatabase(status: string) {
  if (status === "PUBLISHED") return "PUBLICATION_READY";
  if (status === "IN_REVIEW") return "REVIEW_REQUIRED";
  if (status === "APPROVED") return "REVIEWED";
  if (status === "ARCHIVED") return "DEFERRED";
  if (status === "INTERNAL_ONLY") return "INTERNAL_ONLY";
  return "DEMO_ONLY";
}

function matchesQuery(entry: any, query: Record<string, string>) {
  return Object.entries(query).every(([key, value]) => {
    if (!value || key === "q") return true;
    const entryValue = entry[key];
    return String(entryValue ?? "").toLowerCase() === String(value).toLowerCase();
  });
}

function searchableBodyStrings(value: unknown, key = ""): string[] {
  if (["commercialDecision", "commercialClosure", "repositoryReview", "sourceRefs"].includes(key)) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap((item) => searchableBodyStrings(item));
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([childKey, child]) => searchableBodyStrings(child, childKey));
}

function searchScore(entry: any, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return 1;
  const title = String(entry.title ?? "").toLowerCase();
  const aliases = [...(entry.secondaryKeywords ?? []), ...(Array.isArray(entry.body?.aliases) ? entry.body.aliases : []), ...(Array.isArray(entry.body?.queryVariants) ? entry.body.queryVariants : [])].map((value) => String(value).toLowerCase());
  const summary = String(entry.summary ?? "").toLowerCase();
  const body = searchableBodyStrings(entry.body).join(" ").toLowerCase();
  if (title === needle) return 100;
  if (aliases.includes(needle)) return 90;
  if (title.includes(needle)) return 70;
  if (aliases.some((value) => value.includes(needle))) return 60;
  if (summary.includes(needle)) return 45;
  if (body.includes(needle)) return 25;
  return `${entry.contentId} ${entry.slug} ${entry.category} ${(entry.tags ?? []).join(" ")}`.toLowerCase().includes(needle) ? 10 : 0;
}

async function databaseContentEntries() {
  const prisma = getPrismaClient();
  if (!prisma) return null;
  try {
    const rows = await prisma.contentEntry.findMany({
      orderBy: [{ type: "asc" }, { slug: "asc" }]
    });
    return rows.map((row) => ({
      ...(row.payload as Record<string, unknown>),
      reviewStatus: reviewStatusFromDatabase(row.status),
      runtimePublicationStatus: row.status,
      runtimeCreatedAt: row.createdAt.toISOString(),
      runtimeUpdatedAt: row.updatedAt.toISOString()
    }));
  } catch {
    return null;
  }
}

async function contentEntries() {
  const databaseEntries = await databaseContentEntries();
  if (databaseEntries) return publicContentEntries(databaseEntries);
  return publicContentEntries(contentRepository().list());
}

function hexagramDetail(slug: string) {
  const data = loadDomainData(rootDir());
  const idx = indexes(data);
  const key = String(slug).toLowerCase();
  const hexagram = idx.hexagramByCode.get(key) ?? data.hexagrams.find((item: any) => item.name_zh === slug);
  if (!hexagram) return null;
  return {
    ...hexagram,
    title: `${hexagram.name_zh}卦`,
    upperTrigram: idx.trigramByCode.get(hexagram.upper_trigram),
    lowerTrigram: idx.trigramByCode.get(hexagram.lower_trigram),
    lineStructure: hexagram.bits_bottom_up,
    detailStatus: "详细内容正在整理"
  };
}

function glossaryItem(slug: string) {
  const key = String(slug).toLowerCase();
  return (
    loadDomainData(rootDir()).glossary.find((item: any) =>
      [item.code, item.name_zh].map((value) => String(value).toLowerCase()).includes(key)
    ) ?? null
  );
}

@Controller()
export class ContentController {
  @Get("knowledge")
  knowledgeOverview() {
    return getKnowledgeOverview(rootDir());
  }

  @Get("knowledge/search")
  knowledgeSearch(@Query("q") query?: string) {
    return searchKnowledge(query ?? "", rootDir());
  }

  @Get("knowledge/:slug")
  knowledgeDetail(@Param("slug") slug: string) {
    const item = getKnowledgeItem(slug, rootDir());
    if (!item) throw new NotFoundException({ code: "KNOWLEDGE_NOT_FOUND", message: "未找到知识条目。" });
    return item;
  }

  @Get("content")
  async contentList(@Query() query: Record<string, string>) {
    const entries = await contentEntries();
    return { items: entries.filter((entry) => matchesQuery(entry, query)).map(contentSummary) };
  }

  @Get("content/search")
  async contentSearch(@Query("q") query?: string, @Query() filters?: Record<string, string>) {
    const entries = await contentEntries();
    const filterQuery = filters ?? {};
    return {
      query: query ?? "",
      items: entries
        .filter((entry) => matchesQuery(entry, filterQuery))
        .map((entry) => ({ entry, score: searchScore(entry, query ?? "") }))
        .filter(({ score }) => score > 0)
        .sort((left, right) => right.score - left.score || String(left.entry.title).localeCompare(String(right.entry.title), "zh-CN"))
        .map(({ entry }) => entry)
        .map(contentSummary)
    };
  }

  @Get("content/:contentId/related")
  async relatedContent(@Param("contentId") contentId: string) {
    const databaseEntries = await databaseContentEntries();
    if (!databaseEntries) return { items: contentRepository().getRelated(contentId).map(contentSummary) };
    const visibleEntries = publicContentEntries(databaseEntries);
    const source = visibleEntries.find((entry) => entry.contentId === contentId);
    const relatedIds = new Set([
      ...(source?.relatedContentIds ?? []),
      ...(source?.relatedKnowledgeIds ?? []),
      ...(source?.prerequisiteContentIds ?? []),
      source?.previousContentId,
      source?.nextContentId,
    ].filter(Boolean));
    return { items: visibleEntries.filter((entry) => relatedIds.has(entry.contentId)).map(contentSummary) };
  }

  @Get("content/:contentType/:slug")
  async contentDetail(@Param("contentType") contentType: string, @Param("slug") slug: string) {
    const databaseEntries = await databaseContentEntries();
    const allEntries = databaseEntries ?? new HybridContentRepository({ rootDir: rootDir(), includePreview: true }).list();
    const entries = publicContentEntries(allEntries);
    let item = entries.find(
      (entry) =>
        String(entry.contentType).toLowerCase() === String(contentType).toLowerCase() &&
        String(entry.slug).toLowerCase() === String(slug).toLowerCase()
    );
    if (!item) {
      const source = allEntries.find((entry) => String(entry.contentType).toLowerCase() === String(contentType).toLowerCase() && String(entry.slug).toLowerCase() === String(slug).toLowerCase());
      const decision = source?.body?.commercialClosure ?? source?.body?.commercialDecision;
      if (decision?.decision === "MERGE") item = entries.find((entry) => entry.contentId === (decision.canonicalContentId ?? decision.mergeTarget));
    }
    if (!item) throw new NotFoundException({ code: "CONTENT_NOT_FOUND", message: "未找到内容。" });
    return contentDetail(item);
  }

  @Get("hexagrams/:slug")
  hexagram(@Param("slug") slug: string) {
    const item = hexagramDetail(slug);
    if (!item) throw new NotFoundException({ code: "HEXAGRAM_NOT_FOUND", message: "未找到卦象。" });
    return item;
  }

  @Get("glossary/:slug")
  glossary(@Param("slug") slug: string) {
    const item = glossaryItem(slug);
    if (!item) throw new NotFoundException({ code: "GLOSSARY_NOT_FOUND", message: "未找到术语。" });
    return item;
  }

  @Get("blog/posts")
  blogPosts() {
    return listBlogPosts(rootDir());
  }

  @Get("blog/posts/:slug")
  blogPost(@Param("slug") slug: string) {
    const item = getBlogPost(slug, rootDir());
    if (!item) throw new NotFoundException({ code: "BLOG_NOT_FOUND", message: "未找到文章。" });
    return item;
  }
}
