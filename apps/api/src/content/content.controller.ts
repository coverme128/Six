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

function includePreviewContent() {
  return !["beta", "production"].includes(process.env.APP_ENV ?? "development");
}

function publicContentEntries(entries: any[]) {
  const liuyaoProductEntries = entries.filter((entry) => String(entry.domain).toLowerCase() !== "meihua");
  if (includePreviewContent()) return liuyaoProductEntries;
  return liuyaoProductEntries.filter((entry) => entry.reviewStatus === "PUBLICATION_READY");
}

function matchesQuery(entry: any, query: Record<string, string>) {
  return Object.entries(query).every(([key, value]) => {
    if (!value || key === "q") return true;
    const entryValue = entry[key];
    return String(entryValue ?? "").toLowerCase() === String(value).toLowerCase();
  });
}

function searchEntry(entry: any, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    entry.contentId,
    entry.contentType,
    entry.title,
    entry.slug,
    entry.summary,
    entry.domain,
    entry.category,
    ...(entry.tags ?? [])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

async function databaseContentEntries() {
  const prisma = getPrismaClient();
  if (!prisma) return null;
  try {
    const rows = await prisma.contentEntry.findMany({
      orderBy: [{ type: "asc" }, { slug: "asc" }]
    });
    return rows.map((row) => row.payload);
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
        .filter((entry) => searchEntry(entry, query ?? ""))
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
    const entries = await contentEntries();
    const item = entries.find(
      (entry) =>
        String(entry.contentType).toLowerCase() === String(contentType).toLowerCase() &&
        String(entry.slug).toLowerCase() === String(slug).toLowerCase()
    );
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
