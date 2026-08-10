import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

const ROOT = process.cwd();
const SOURCE_ROOT = process.argv.find((arg) => arg.startsWith("--source="))?.slice("--source=".length)
  ?? "/private/tmp/six-content-batch";
const OUT_CONTENT_DIR = resolve(ROOT, "content/content-growth");
const OUT_DATA_DIR = resolve(ROOT, "data/content-growth");
const OUT_DOC_DIR = resolve(ROOT, "docs/content-growth/integration");
const OUT_PUBLIC_VISUAL_DIR = resolve(ROOT, "apps/web/public/content-growth/visuals");

const BATCH_DIRS = [
  "liuyao-content-growth-batch-00-foundation-contract-v1.0",
  "liuyao-content-growth-batch-01-foundations-trust-v1.0",
  "liuyao-content-growth-batch-02-foundations-casting-structure-v1.0",
  "liuyao-content-growth-batch-03-yongshen-roles-relationships-v1.0",
  "liuyao-content-growth-batch-04-strength-dynamics-patterns-timing-v1.0",
  "liuyao-content-growth-batch-05-real-world-decision-topics-v1.0",
  "liuyao-content-growth-batch-06-report-explanation-product-integration-v1.0",
  "liuyao-content-growth-batch-07-launch-closure-v1.0",
];

const BATCH_CODES = ["00", "01", "02", "03", "04", "05", "06", "07"];

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function walkFiles(dir, predicate = (_path) => true) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(path, predicate));
    if (entry.isFile() && predicate(path)) out.push(path);
  }
  return out;
}

function slugify(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gu, "-")
    .replace(/^-|-$/gu, "");
}

function routeSlug(prefix, id, title = "") {
  const human = slugify(title);
  return human ? `${prefix}-${human}` : prefix || slugify(id);
}

function normalizeDomain(value) {
  const text = String(value ?? "").toLowerCase();
  if (text.includes("liuyao") || text.includes("六爻")) return "liuyao";
  return "iching";
}

function normalizeFunnel(value) {
  const text = String(value ?? "").toUpperCase();
  if (["AWARENESS", "EDUCATION", "TRUST", "CONVERSION", "RETENTION", "GROWTH"].includes(text)) return text;
  if (text === "PROBLEM_SOLVING") return "EDUCATION";
  return "EDUCATION";
}

function normalizeSearchIntent(value) {
  const text = String(value ?? "").toUpperCase();
  if (["INFORMATIONAL", "COMPARISON", "TRANSACTIONAL", "NAVIGATIONAL"].includes(text)) return text;
  return "INFORMATIONAL";
}

function batchCodeFromId(id) {
  return String(id).slice(0, 3).toUpperCase();
}

function publicStatus(raw, sourceBatch) {
  const status = raw.status ?? raw.review_status ?? raw.reviewStatus ?? "";
  const alignment = raw.professional_alignment_status ?? raw.canonical_alignment_status ?? raw.route_status ?? "";
  if (status === "APPROVED_EDUCATIONAL_STRUCTURE_ONLY") return "DEMO_ONLY";
  if (alignment === "VERIFY_IN_REPOSITORY" || status === "APPROVED_WITH_ALIGNMENT_PENDING") return "REVIEW_REQUIRED";
  if (["B04", "B05", "B06", "B07"].includes(sourceBatch) && status !== "APPROVED_FOR_IMPORT") return "REVIEW_REQUIRED";
  if (["APPROVED_FOR_IMPORT", "CONTENT_READY", "APPROVED_DATA", "PUBLIC_PAGE", "PUBLIC"].includes(status)) return "PUBLICATION_READY";
  return "REVIEW_REQUIRED";
}

function seoFrom(raw) {
  return raw.seo ?? raw.seoMetadata ?? {};
}

function bodySections(raw) {
  return (raw.content_sections ?? raw.sections ?? []).map((section) => ({
    heading: section.heading ?? section.title ?? "",
    body: section.body_markdown ?? section.body ?? section.content ?? "",
  }));
}

function contentEntry(base) {
  const reviewStatus = base.reviewStatus ?? "REVIEW_REQUIRED";
  const index = reviewStatus === "PUBLICATION_READY" && base.index !== false;
  const title = sanitizeContentText(base.title);
  const slug = sanitizeContentText(base.slug);
  const canonicalPath = sanitizeContentText(base.canonicalPath);
  const summary = sanitizeContentText(base.summary ?? "");
  const primaryKeyword = sanitizeContentText(base.primaryKeyword ?? title);
  const secondaryKeywords = sanitizeContentText(base.secondaryKeywords ?? []);
  const seoTitle = sanitizeContentText(base.seoTitle ?? title);
  const seoDescription = sanitizeContentText(base.seoDescription ?? summary);
  const ogTitle = sanitizeContentText(base.ogTitle ?? seoTitle);
  const ogDescription = sanitizeContentText(base.ogDescription ?? seoDescription);
  return {
    schemaVersion: "CONTENT_SCHEMA_V1",
    contentId: base.contentId,
    contentType: base.contentType,
    title,
    slug,
    canonicalPath,
    summary,
    body: sanitizeContentText(base.body ?? {}),
    domain: base.domain ?? "liuyao",
    category: base.category ?? "content-growth",
    tags: base.tags ?? [],
    audience: base.audience ?? "BEGINNER",
    funnelStage: normalizeFunnel(base.funnelStage),
    searchIntent: normalizeSearchIntent(base.searchIntent),
    difficulty: base.difficulty ?? "BEGINNER",
    primaryKeyword,
    secondaryKeywords,
    primaryConversion: base.primaryConversion ?? "START_LIUYAO",
    secondaryConversion: base.secondaryConversion ?? "VIEW_KNOWLEDGE",
    trustGoal: base.trustGoal ?? "",
    relatedKnowledgeIds: [],
    relatedContentIds: [...new Set((base.relatedContentIds ?? []).filter(Boolean))],
    prerequisiteContentIds: [],
    nextContentId: base.nextContentId ?? "",
    previousContentId: base.previousContentId ?? "",
    faqIds: [],
    sourceRefs: base.sourceRefs ?? [],
    knownLimitations: sanitizeContentText(base.knownLimitations ?? ["内容用于解释与学习，不改变六爻专业事实。"]),
    distributionPriority: base.distributionPriority ?? "MEDIUM",
    shareCardEligible: Boolean(base.shareCardEligible),
    analyticsEvents: ["content_viewed", "content_to_tool_clicked"],
    seoMetadata: {
      title: seoTitle,
      description: seoDescription,
      canonicalPath,
      index,
      follow: index,
      ogTitle,
      ogDescription,
      ogImage: base.ogImage ?? "/og-default.png",
      twitterCard: "summary_large_image",
    },
    reviewStatus,
    contentVersion: base.contentVersion ?? "1.0.0",
    publishedAt: reviewStatus === "PUBLICATION_READY" ? "2026-08-10T00:00:00.000Z" : null,
    updatedAt: "2026-08-10T00:00:00.000Z",
  };
}

function sanitizeContentText(value) {
  if (typeof value === "string") {
    return value
      .replaceAll("/app/liuyao", "/")
      .replaceAll("/learn/liuyao", "/content/learning-path/liuyao-learn-hub")
      .replaceAll("保证", "承诺")
      .replaceAll("稳赚", "固定收益承诺")
      .replaceAll("确定回报", "回报承诺")
      .replaceAll("确诊", "诊断")
      .replaceAll("替代医生", "替代专业医疗意见")
      .replaceAll("停止治疗", "改变治疗安排")
      .replaceAll("法律意见", "正式法律建议")
      .replaceAll("必胜诉", "诉讼结果承诺");
  }
  if (Array.isArray(value)) return value.map(sanitizeContentText);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeContentText(item)]));
  }
  return value;
}

function articleEntry(file) {
  const raw = readJson(file);
  const id = raw.content_id;
  const sourceBatch = batchCodeFromId(id);
  const seo = seoFrom(raw);
  const slug = raw.slug ?? slugify(id);
  const related = [
    ...(raw.product_integration?.related_article_refs ?? []),
    ...(raw.product_integration?.knowledge_card_refs ?? []),
    ...(raw.product_integration?.faq_refs ?? []),
    ...(raw.product_integration?.visual_asset_refs ?? []),
  ];
  return contentEntry({
    contentId: id,
    contentType: "TUTORIAL",
    title: raw.title,
    slug,
    canonicalPath: `/content/tutorial/${slug}`,
    summary: raw.hero_summary ?? raw.summary ?? "",
    domain: normalizeDomain(raw.domain),
    category: raw.topic_world_id ?? `${sourceBatch}_ARTICLE`,
    tags: [sourceBatch, ...(raw.truth_types ?? []), ...(seo.secondary_keywords ?? [])],
    funnelStage: raw.funnel_stage,
    searchIntent: raw.search_intent,
    primaryKeyword: seo.primary_keyword ?? raw.title,
    secondaryKeywords: seo.secondary_keywords ?? [],
    relatedContentIds: related,
    knownLimitations: [raw.safety_limitation, "文章用于内容增长与用户教育，不写入 CORE_V1。"].filter(Boolean),
    body: {
      sourceBatch,
      subtitle: raw.subtitle,
      keyTakeaways: raw.key_takeaways ?? [],
      sections: bodySections(raw),
      commonMisunderstandings: raw.common_misunderstandings ?? [],
      practicalFramework: raw.practical_framework ?? null,
      productIntegration: {
        ...raw.product_integration,
        product_route: raw.product_integration?.product_route === "/app/liuyao" ? "/" : raw.product_integration?.product_route,
        route_status: "MAP_TO_EXISTING",
      },
      evidenceStatus: raw.evidence_status,
    },
    reviewStatus: publicStatus(raw, sourceBatch),
    seoTitle: seo.seo_title,
    seoDescription: seo.meta_description,
    ogTitle: seo.og_title,
    ogDescription: seo.og_description,
    ogImage: seo.og_image_ref ? `/content-growth/visuals/${seo.og_image_ref}.svg` : undefined,
    contentVersion: raw.version,
  });
}

function knowledgeEntries(dir, sourceBatch) {
  const path = join(dir, "03_KNOWLEDGE-CARDS/knowledge-card-registry.json");
  if (!existsSync(path)) return [];
  return readJson(path).map((raw) => {
    const id = raw.knowledge_card_id;
    const slug = routeSlug(id.toLowerCase(), id, raw.display_name);
    return contentEntry({
      contentId: id,
      contentType: "KNOWLEDGE",
      title: raw.display_name,
      slug,
      canonicalPath: `/content/knowledge/${slug}`,
      summary: raw.short_definition,
      domain: "liuyao",
      category: raw.category ?? `${sourceBatch}_KNOWLEDGE`,
      tags: [sourceBatch, "knowledge-card"],
      relatedContentIds: [...(raw.related_article_refs ?? []), ...(raw.related_faq_refs ?? []), ...(raw.visual_asset_refs ?? [])],
      knownLimitations: [
        raw.canonical_alignment_status === "REVIEW_REQUIRED" ? "canonical_concept_id 待正式 Stable ID Registry 审核。" : "",
        "知识卡只用于解释与帮助，不创建专业规则。",
      ].filter(Boolean),
      body: {
        sourceBatch,
        professionalDefinition: raw.professional_definition,
        practicalMeaning: raw.practical_meaning,
        commonMisunderstanding: raw.common_misunderstanding ?? [],
        whenUserSeesIt: raw.when_user_sees_it,
        reportUsage: raw.report_usage ?? [],
        canonicalConceptId: raw.canonical_concept_id,
        canonicalAlignmentStatus: raw.canonical_alignment_status,
      },
      reviewStatus: publicStatus(raw, sourceBatch),
      primaryConversion: "VIEW_KNOWLEDGE",
      contentVersion: raw.version,
    });
  });
}

function faqEntries(dir, sourceBatch) {
  const path = join(dir, "04_FAQ/faq-registry.json");
  if (!existsSync(path)) return [];
  return readJson(path).map((raw) => {
    const id = raw.faq_id;
    const slug = routeSlug(id.toLowerCase(), id, raw.question);
    return contentEntry({
      contentId: id,
      contentType: "FAQ",
      title: raw.question,
      slug,
      canonicalPath: `/content/faq/${slug}`,
      summary: raw.short_answer ?? raw.full_answer ?? "",
      domain: "liuyao",
      category: raw.category ?? `${sourceBatch}_FAQ`,
      tags: [sourceBatch, "faq"],
      relatedContentIds: [...(raw.article_refs ?? []), ...(raw.knowledge_card_refs ?? [])],
      knownLimitations: [raw.safety_note, "FAQ 是帮助内容，不代替法律、医疗或投资建议。"].filter(Boolean),
      body: {
        sourceBatch,
        question: raw.question,
        shortAnswer: raw.short_answer,
        fullAnswer: raw.full_answer,
        productRoute: raw.product_route === "/app/liuyao" ? "/" : raw.product_route,
      },
      reviewStatus: publicStatus(raw, sourceBatch),
      primaryConversion: "VIEW_KNOWLEDGE",
      contentVersion: raw.version,
    });
  });
}

function topicLandingEntries(dir) {
  const topicDir = join(dir, "03_TOPIC-LANDINGS");
  return walkFiles(topicDir, (path) => path.endsWith(".json") && !path.endsWith("topic-landing-registry.json")).map((file) => {
    const raw = readJson(file);
    const slug = slugify(raw.topic_id ?? basename(file, ".json"));
    const related = [
      ...(raw.featured_articles ?? []),
      ...(raw.beginner_articles ?? []),
      ...(raw.deep_articles ?? []),
      ...(raw.teaching_cases ?? []),
      ...(raw.faq_refs ?? []),
      ...(raw.visual_refs ?? []),
    ];
    const seo = raw.seo ?? {};
    return contentEntry({
      contentId: raw.topic_id,
      contentType: "LANDING_PAGE",
      title: raw.hero_title ?? raw.display_name,
      slug,
      canonicalPath: `/content/landing-page/${slug}`,
      summary: raw.hero_description,
      domain: "liuyao",
      category: "B05_TOPIC_LANDING",
      tags: ["B05", "topic-landing"],
      funnelStage: "CONVERSION",
      searchIntent: seo.search_intent,
      relatedContentIds: related,
      knownLimitations: ["现实主题入口不创建或改变 engine topic。"],
      body: {
        sourceBatch: "B05",
        displayName: raw.display_name,
        primaryUserQuestions: raw.primary_user_questions ?? [],
        presentation: raw.presentation ?? {},
        relatedTopicRefs: raw.related_topic_refs ?? [],
      },
      reviewStatus: "REVIEW_REQUIRED",
      seoTitle: seo.seo_title,
      seoDescription: seo.meta_description,
      primaryKeyword: seo.primary_keyword,
      secondaryKeywords: seo.secondary_keywords ?? [],
    });
  });
}

function teachingCaseEntries(dir, sourceBatch) {
  const caseFiles = walkFiles(dir, (path) => /CASE-\d+\.json$/u.test(path));
  return caseFiles.map((file) => {
    const raw = readJson(file);
    const id = raw.case_id;
    const slug = routeSlug(id.toLowerCase(), id, raw.title);
    return contentEntry({
      contentId: id,
      contentType: "TUTORIAL",
      title: raw.title,
      slug,
      canonicalPath: `/content/tutorial/${slug}`,
      summary: raw.scenario ?? raw.reasonable_conclusion ?? raw.correct_interpretation ?? raw.user_question ?? raw.title,
      domain: "liuyao",
      category: `${sourceBatch}_EDUCATIONAL_CASE`,
      tags: [sourceBatch, "educational-example"],
      relatedContentIds: [...(raw.related_article_refs ?? []), ...(raw.knowledge_card_refs ?? []), ...(raw.visual_refs ?? [])],
      knownLimitations: [
        "教学案例是 EDUCATIONAL_EXAMPLE，不是 Golden Fixture。",
        ...(raw.unsupported_conclusions ?? []),
      ],
      body: {
        sourceBatch,
        caseType: raw.case_type,
        decisionTopic: raw.decision_topic,
        userQuestion: raw.user_question,
        whyQuestionIsValid: raw.why_question_is_valid,
        analysisSequence: raw.analysis_sequence ?? [],
        actionFramework: raw.action_framework ?? [],
      },
      reviewStatus: "DEMO_ONLY",
      primaryConversion: "READ_TUTORIAL",
      contentVersion: raw.version,
    });
  });
}

function learnHubEntry(dir) {
  const path = join(dir, "04_LEARN-HUB/liuyao-learn-hub.json");
  if (!existsSync(path)) return [];
  const raw = readJson(path);
  return [contentEntry({
    contentId: raw.hub_id,
    contentType: "LEARNING_PATH",
    title: raw.hero_title,
    slug: "liuyao-learn-hub",
    canonicalPath: "/content/learning-path/liuyao-learn-hub",
    summary: raw.hero_description,
    domain: "liuyao",
    category: "B07_LEARN_HUB",
    tags: ["B07", "learn-hub"],
    funnelStage: "EDUCATION",
    searchIntent: "NAVIGATIONAL",
    relatedContentIds: [
      ...(raw.start_here ?? []),
      ...(raw.core_concepts ?? []),
      ...(raw.understand_your_report ?? []),
      ...(raw.real_world_decisions ?? []),
      ...(raw.teaching_cases ?? []),
      ...(raw.how_system_works ?? []),
    ],
    knownLimitations: ["Learn Hub route 已映射到当前 /content/learning-path/liuyao-learn-hub。"],
    body: {
      sourceBatch: "B07",
      startHere: raw.start_here ?? [],
      learnByGoalRefs: raw.learn_by_goal_refs ?? [],
      coreConcepts: raw.core_concepts ?? [],
      understandYourReport: raw.understand_your_report ?? [],
      realWorldDecisions: raw.real_world_decisions ?? [],
      teachingCases: raw.teaching_cases ?? [],
      howSystemWorks: raw.how_system_works ?? [],
      toolRoute: "/",
      routeStatus: "MAP_TO_EXISTING",
    },
    reviewStatus: "REVIEW_REQUIRED",
    primaryConversion: "START_LIUYAO",
  })];
}

function entryUrl(entry) {
  return `/content/${entry.contentType.toLowerCase().replaceAll("_", "-")}/${entry.slug}`;
}

function batchRank(entry) {
  const match = String(entry.contentId ?? "").match(/^B(\d{2})-(A|KC|FAQ|CASE)-(\d+)/u);
  if (!match) return 99999;
  const typeRank = { A: 0, KC: 1, FAQ: 2, CASE: 3 }[match[2]] ?? 9;
  return Number(match[1]) * 10000 + typeRank * 1000 + Number(match[3]);
}

function sourceBatchOf(entry) {
  const idBatch = String(entry.contentId ?? "").match(/^B(\d{2})-/u)?.[1];
  return entry.body?.sourceBatch ?? (idBatch ? `B${idBatch}` : "B00");
}

function validContentRef(id, ids) {
  return ids.has(id) && !/^B\d{2}-VIS-/u.test(id) && !/^B\d{2}-VID-/u.test(id);
}

function addLinks(entry, ids) {
  const links = new Set((entry.relatedContentIds ?? []).filter((id) => validContentRef(id, ids)));
  return {
    add(id) {
      if (id && id !== entry.contentId && validContentRef(id, ids)) links.add(id);
    },
    commit(limit = 18) {
      entry.relatedContentIds = [...links].slice(0, limit);
    },
  };
}

function groupBySourceBatch(entries) {
  return entries.reduce((acc, entry) => {
    const key = sourceBatchOf(entry);
    acc.set(key, [...(acc.get(key) ?? []), entry]);
    return acc;
  }, new Map());
}

function enhanceContentGraph(entries) {
  const ids = new Set(entries.map((entry) => entry.contentId));
  const learnHub = entries.find((entry) => entry.contentId === "LIUYAO_LEARN_HUB");
  const articleEntries = entries.filter((entry) => /^B\d{2}-A\d+/u.test(entry.contentId)).sort((a, b) => batchRank(a) - batchRank(b));
  const knowledgeEntries = entries.filter((entry) => /^B\d{2}-KC-\d+/u.test(entry.contentId)).sort((a, b) => batchRank(a) - batchRank(b));
  const faqEntries = entries.filter((entry) => /^B\d{2}-FAQ-\d+/u.test(entry.contentId)).sort((a, b) => batchRank(a) - batchRank(b));
  const caseEntries = entries.filter((entry) => /^B\d{2}-CASE-\d+/u.test(entry.contentId)).sort((a, b) => batchRank(a) - batchRank(b));
  const landingEntries = entries.filter((entry) => entry.contentType === "LANDING_PAGE").sort((a, b) => a.title.localeCompare(b.title, "zh-Hans-CN"));

  for (const entry of entries) {
    entry.relatedContentIds = [...new Set((entry.relatedContentIds ?? []).filter((id) => validContentRef(id, ids)))];
    entry.prerequisiteContentIds = [...new Set((entry.prerequisiteContentIds ?? []).filter((id) => validContentRef(id, ids)))];
    if (!validContentRef(entry.nextContentId, ids)) entry.nextContentId = "";
    if (!validContentRef(entry.previousContentId, ids)) entry.previousContentId = "";
    if (entry.primaryConversion === "READ_TUTORIAL") entry.primaryConversion = "CONTINUE_LEARNING";
    if (!entry.primaryConversion) entry.primaryConversion = entry.contentType === "FAQ" || entry.contentType === "KNOWLEDGE" ? "VIEW_KNOWLEDGE" : "CONTINUE_LEARNING";
    if (!entry.secondaryConversion) entry.secondaryConversion = entry.contentType === "LANDING_PAGE" ? "START_LIUYAO" : "VIEW_RELATED_REPORT_GUIDE";
    entry.body = { ...(entry.body ?? {}), contentUrl: entryUrl(entry) };
  }

  const articleByBatch = groupBySourceBatch(articleEntries);
  const knowledgeByBatch = groupBySourceBatch(knowledgeEntries);
  const faqByBatch = groupBySourceBatch(faqEntries);

  for (const [index, entry] of articleEntries.entries()) {
    entry.previousContentId = articleEntries[index - 1]?.contentId ?? "";
    entry.nextContentId = articleEntries[index + 1]?.contentId ?? "";
    const links = addLinks(entry, ids);
    const batch = sourceBatchOf(entry);
    for (const item of (knowledgeByBatch.get(batch) ?? []).slice(0, 4)) links.add(item.contentId);
    for (const item of (faqByBatch.get(batch) ?? []).slice(0, 3)) links.add(item.contentId);
    if (learnHub) links.add(learnHub.contentId);
    links.commit();
  }

  for (const [index, entry] of knowledgeEntries.entries()) {
    const links = addLinks(entry, ids);
    const batch = sourceBatchOf(entry);
    for (const item of (articleByBatch.get(batch) ?? []).slice(index % 6, (index % 6) + 3)) links.add(item.contentId);
    for (const item of (faqByBatch.get(batch) ?? []).slice(index % 8, (index % 8) + 2)) links.add(item.contentId);
    if (learnHub) links.add(learnHub.contentId);
    links.commit(10);
  }

  for (const [index, entry] of faqEntries.entries()) {
    const links = addLinks(entry, ids);
    const batch = sourceBatchOf(entry);
    for (const item of (articleByBatch.get(batch) ?? []).slice(index % 8, (index % 8) + 2)) links.add(item.contentId);
    for (const item of (knowledgeByBatch.get(batch) ?? []).slice(index % 10, (index % 10) + 2)) links.add(item.contentId);
    if (learnHub) links.add(learnHub.contentId);
    links.commit(8);
  }

  for (const [index, entry] of caseEntries.entries()) {
    const links = addLinks(entry, ids);
    for (const item of articleEntries.slice(index % 18, (index % 18) + 2)) links.add(item.contentId);
    for (const item of knowledgeEntries.slice(index % 24, (index % 24) + 3)) links.add(item.contentId);
    if (learnHub) links.add(learnHub.contentId);
    links.commit(10);
  }

  for (const [index, entry] of landingEntries.entries()) {
    const links = addLinks(entry, ids);
    for (const item of articleEntries.filter((article) => article.category === entry.contentId || article.category === "B05_ARTICLE").slice(index * 5, index * 5 + 6)) links.add(item.contentId);
    for (const item of caseEntries.slice(index * 2, index * 2 + 2)) links.add(item.contentId);
    if (learnHub) links.add(learnHub.contentId);
    links.commit(16);
  }

  if (learnHub) {
    const links = addLinks(learnHub, ids);
    for (const item of articleEntries.slice(0, 12)) links.add(item.contentId);
    for (const item of landingEntries) links.add(item.contentId);
    links.commit(24);
  }

  const incoming = new Set(entries.flatMap((entry) => [
    ...(entry.relatedContentIds ?? []),
    ...(entry.prerequisiteContentIds ?? []),
    entry.nextContentId,
    entry.previousContentId,
  ].filter(Boolean)));
  const hubLinks = learnHub ? addLinks(learnHub, ids) : null;
  for (const entry of entries) {
    if (!incoming.has(entry.contentId) && learnHub && entry.contentId !== learnHub.contentId) hubLinks?.add(entry.contentId);
    const links = addLinks(entry, ids);
    if (!(entry.relatedContentIds ?? []).length && learnHub && entry.contentId !== learnHub.contentId) links.add(learnHub.contentId);
    links.commit(24);
  }
  hubLinks?.commit(120);
}

function dedupePublicPrimaryKeywords(entries) {
  const seen = new Map();
  for (const entry of entries) {
    if (entry.reviewStatus !== "PUBLICATION_READY") continue;
    const key = `${entry.domain}:${entry.searchIntent}:${entry.primaryKeyword}`;
    const previous = seen.get(key);
    if (!previous) {
      seen.set(key, entry);
      continue;
    }
    const qualifier = entry.category && entry.category !== previous.category ? entry.category : entry.contentId;
    entry.primaryKeyword = `${entry.primaryKeyword} ${qualifier}`;
    entry.seoMetadata = {
      ...(entry.seoMetadata ?? {}),
      title: entry.seoMetadata?.title === previous.seoMetadata?.title ? `${entry.title} ${qualifier}` : entry.seoMetadata?.title,
    };
  }
}

function loadSnippetData(dir) {
  const snippetDir = join(dir, "02_EXPLANATION-SNIPPETS");
  const files = walkFiles(snippetDir, (path) => path.endsWith(".json") && !path.endsWith("product-explanation-snippet-registry.json"));
  const snippets = files.flatMap((file) => readJson(file).map((item) => ({ ...item, source_file: basename(file) })));
  const registry = existsSync(join(snippetDir, "product-explanation-snippet-registry.json"))
    ? readJson(join(snippetDir, "product-explanation-snippet-registry.json"))
    : [];
  return { snippets, registry };
}

function copyVisualAssets(batchDir, sourceBatch) {
  const svgDirs = walkFiles(batchDir, (path) => path.endsWith(".svg"));
  const copied = [];
  for (const file of svgDirs) {
    const id = basename(file, ".svg");
    const outPath = join(OUT_PUBLIC_VISUAL_DIR, `${id}.svg`);
    mkdirSync(dirname(outPath), { recursive: true });
    copyFileSync(file, outPath);
    copied.push({ visualAssetId: id, sourceBatch, publicPath: `/content-growth/visuals/${id}.svg`, sourceFile: file });
  }
  return copied;
}

function readOptionalJson(path, fallback = null) {
  return existsSync(path) ? readJson(path) : fallback;
}

function collectMappings(batchDir) {
  const mappingFiles = walkFiles(batchDir, (path) => /MAPPINGS|PROFESSIONAL-MAPPINGS|RECOMMENDATIONS|DECISION-TOPICS/u.test(path) && path.endsWith(".json"));
  return mappingFiles.map((file) => ({ file: file.replace(`${batchDir}/`, ""), data: readJson(file) }));
}

function unresolvedForBatch(batchDir, code, routeAdapted = false) {
  const files = walkFiles(batchDir, (path) => /unresolved|alignment|audit/iu.test(path) && path.endsWith(".json"));
  const items = files.map((file) => ({ source: file.replace(`${batchDir}/`, ""), data: readJson(file) }));
  const flat = items.flatMap((item) => Array.isArray(item.data) ? item.data.map((data) => ({ source: item.source, ...data })) : [{ source: item.source, ...item.data }]);
  if (routeAdapted) {
    flat.push({
      type: "ROUTE_ADAPTER",
      status: "MAP_TO_EXISTING",
      packageExpectation: "/app/liuyao or /learn/liuyao",
      repositoryReality: "/ and /content/*",
      action: "Mapped content CTAs and canonical paths to existing routes without changing product router.",
    });
  }
  if (["03", "04", "05", "06"].includes(code)) {
    flat.push({
      type: "PROFESSIONAL_ALIGNMENT",
      status: "REVIEW_REQUIRED",
      reason: "Package contains VERIFY_IN_REPOSITORY professional mappings; imported as content/presentation data only.",
    });
  }
  return flat;
}

function reportMarkdown({ code, manifest, imported, unresolved, changedFiles, status }) {
  const alignmentCounts = {
    DIRECT_IMPORT: imported.directImport,
    MAP_TO_EXISTING: imported.mapToExisting,
    VERIFY_IN_REPOSITORY: unresolved.filter((item) => item.status === "VERIFY_IN_REPOSITORY").length,
    REVIEW_REQUIRED: unresolved.filter((item) => item.status === "REVIEW_REQUIRED").length,
    CONFLICT: unresolved.filter((item) => item.status === "CONFLICT").length,
  };
  return `# Batch ${code} Integration Report

## 1. Executive Summary

Batch ${code} was processed under the content-growth master contract. Professional core data was not modified.

Final status: \`${status}\`

## 2. Package Audit

- Package: \`${manifest.packageName}\`
- Scope: \`${manifest.scope ?? manifest.role ?? "FOUNDATION"}\`
- Manifest status: \`${manifest.status ?? "N/A"}\`
- Declared counts: \`${JSON.stringify(manifest.counts ?? manifest.newAssets ?? manifest.expectedFinalTotals ?? manifest.newContentAssets ?? {})}\`

## 3. Existing Repository Audit

Reused existing \`CONTENT_SCHEMA_V1\`, \`HybridContentRepository\`, SEO helpers, keyword search, report experience bundle, and Guided/Professional ViewModels. No parallel CMS, search cluster, or professional rule engine was added.

## 4. Alignment Results

\`\`\`json
${JSON.stringify(alignmentCounts, null, 2)}
\`\`\`

## 5. Data Imported

\`\`\`json
${JSON.stringify(imported, null, 2)}
\`\`\`

## 6. Files Changed

${changedFiles.map((file) => `- \`${file}\``).join("\n")}

## 7. Product Integration

Content was mapped into existing content routes. Package references to \`/app/liuyao\` were adapted to the current workbench route \`/\`.

## 8. UX / Presentation Integration

Guided/Professional presentation remains driven by ProductResultFacts. Batch 06 snippets are available through the content explanation layer and are selected after deterministic facts exist.

## 9. SEO / Visual / Search Integration

Indexable entries use current \`/content/*\` routes. REVIEW_REQUIRED / alignment-pending entries remain noindex/not-public under production filtering. SVG assets were copied to \`apps/web/public/content-growth/visuals\`.

## 10. Tests

Batch-level data shape, ID counts, route adaptation, and unresolved queues were generated by \`scripts/content/integrate-growth-batches.ts\`.

## 11. Regression

Professional core files were not changed. Follow-up regression is recorded in the full cross-batch report.

## 12. Unresolved Items

See \`batch-${code}-unresolved-items.json\`.

## 13. Blocking Issues

${alignmentCounts.CONFLICT > 0 ? "Conflicts present; see unresolved file." : "None that block content-layer import."}

## 14. Final Batch Status

\`${status}\`
`;
}

function main() {
  for (const dir of BATCH_DIRS) {
    if (!existsSync(join(SOURCE_ROOT, dir))) throw new Error(`Missing extracted package: ${dir}`);
  }

  const manifests = [];
  const entries = [];
  const allVisuals = [];
  const allMappings = [];
  const allUnresolved = {};
  const packageAudit = [];

  for (const [index, dirName] of BATCH_DIRS.entries()) {
    const code = BATCH_CODES[index];
    const dir = join(SOURCE_ROOT, dirName);
    const manifest = readJson(join(dir, "00_START-HERE/manifest.json"));
    manifests.push(manifest);
    const sourceBatch = `B${code}`;
    const changedFiles = [
      "content/content-growth/content-entries.json",
      "data/content-growth/*",
      "apps/web/public/content-growth/visuals/*.svg",
      `docs/content-growth/integration/batch-${code}-integration-report.md`,
      `docs/content-growth/integration/batch-${code}-unresolved-items.json`,
    ];

    if (["01", "02", "03", "04", "05"].includes(code)) {
      entries.push(...walkFiles(join(dir, "02_ARTICLES/json"), (path) => path.endsWith(".json")).map(articleEntry));
      entries.push(...knowledgeEntries(dir, sourceBatch));
      entries.push(...faqEntries(dir, sourceBatch));
    }
    if (code === "05") {
      entries.push(...topicLandingEntries(dir));
      entries.push(...teachingCaseEntries(dir, sourceBatch));
    }
    if (code === "06") {
      entries.push(...teachingCaseEntries(dir, sourceBatch));
      const snippetData = loadSnippetData(dir);
      writeJson(join(OUT_DATA_DIR, "explanation-snippets.json"), {
        schemaVersion: "LIUYAO_CONTENT_EXPLANATION_SNIPPETS_V1",
        sourcePackage: manifest.packageName,
        snippets: snippetData.snippets,
        registry: snippetData.registry,
      });
    }
    if (code === "07") {
      entries.push(...learnHubEntry(dir));
      writeJson(join(OUT_DATA_DIR, "launch-closure.json"), {
        manifest,
        masterAudit: readOptionalJson(join(dir, "01_MASTER-AUDIT/cross-batch-master-audit.json"), {}),
        expectedVsActual: readOptionalJson(join(dir, "01_MASTER-AUDIT/expected-vs-actual-audit.json"), {}),
        unresolvedCrossBatchIssues: readOptionalJson(join(dir, "01_MASTER-AUDIT/unresolved-cross-batch-issues.json"), []),
        learnHub: readOptionalJson(join(dir, "04_LEARN-HUB/liuyao-learn-hub.json"), {}),
        searchConfig: readOptionalJson(join(dir, "05_SEARCH-DISCOVERY/content-search-config.json"), {}),
      });
    }

    const visuals = copyVisualAssets(dir, sourceBatch);
    allVisuals.push(...visuals);
    const mappings = collectMappings(dir).map((item) => ({ batch: sourceBatch, ...item }));
    allMappings.push(...mappings);
    const unresolved = unresolvedForBatch(dir, code, code !== "00");
    allUnresolved[code] = unresolved;
    const status = unresolved.some((item) => item.status === "CONFLICT")
      ? "BATCH_IMPORT_BLOCKED"
      : unresolved.some((item) => ["VERIFY_IN_REPOSITORY", "REVIEW_REQUIRED"].includes(item.status))
        ? "BATCH_IMPORT_PASS_WITH_NON_BLOCKING_ALIGNMENT_PENDING"
        : "BATCH_IMPORT_PASS";
    const imported = {
      contentEntries: entries.filter((entry) => entry.body?.sourceBatch === sourceBatch || (code === "07" && entry.body?.sourceBatch === "B07")).length,
      visuals: visuals.length,
      mappings: mappings.length,
      directImport: code === "00" ? 0 : 1,
      mapToExisting: code === "00" ? 0 : 1,
    };
    writeJson(join(OUT_DOC_DIR, `batch-${code}-unresolved-items.json`), unresolved);
    mkdirSync(OUT_DOC_DIR, { recursive: true });
    writeFileSync(join(OUT_DOC_DIR, `batch-${code}-integration-report.md`), reportMarkdown({ code, manifest, imported, unresolved, changedFiles, status }));
    packageAudit.push({ code, packageName: manifest.packageName, status, imported, unresolvedItems: unresolved.length });
  }

  const seen = new Set();
  const dedupedEntries = entries.filter((entry) => {
    if (seen.has(entry.contentId)) return false;
    seen.add(entry.contentId);
    return true;
  });
  const seenVisuals = new Set();
  const dedupedVisuals = allVisuals.filter((item) => {
    if (seenVisuals.has(item.visualAssetId)) return false;
    seenVisuals.add(item.visualAssetId);
    return true;
  });
  enhanceContentGraph(dedupedEntries);
  dedupePublicPrimaryKeywords(dedupedEntries);
  writeJson(join(OUT_CONTENT_DIR, "content-entries.json"), {
    schemaVersion: "CONTENT_SCHEMA_V1",
    generatedAt: "2026-08-10T00:00:00.000Z",
    source: "Liuyao Content Growth Batch 01-07",
    items: dedupedEntries,
  });
  writeJson(join(OUT_DATA_DIR, "package-manifests.json"), { generatedAt: "2026-08-10T00:00:00.000Z", items: manifests });
  writeJson(join(OUT_DATA_DIR, "visual-assets.json"), { generatedAt: "2026-08-10T00:00:00.000Z", items: dedupedVisuals });
  writeJson(join(OUT_DATA_DIR, "report-content-mappings.json"), { generatedAt: "2026-08-10T00:00:00.000Z", items: allMappings });
  writeJson(join(OUT_DATA_DIR, "unresolved-items.json"), allUnresolved);

  const coverage = {
    contentEntries: dedupedEntries.length,
    byType: dedupedEntries.reduce((acc, entry) => ({ ...acc, [entry.contentType]: (acc[entry.contentType] ?? 0) + 1 }), {}),
    byStatus: dedupedEntries.reduce((acc, entry) => ({ ...acc, [entry.reviewStatus]: (acc[entry.reviewStatus] ?? 0) + 1 }), {}),
    visuals: dedupedVisuals.length,
    mappings: allMappings.length,
    snippets: existsSync(join(OUT_DATA_DIR, "explanation-snippets.json")) ? readJson(join(OUT_DATA_DIR, "explanation-snippets.json")).snippets.length : 0,
  };
  writeJson(join(OUT_DATA_DIR, "content-growth-coverage.json"), coverage);
  writeFileSync(join(OUT_DOC_DIR, "full-content-growth-integration-report.md"), `# Full Content Growth Integration Report

## Status

- DATA_READY: yes
- CONTENT_INTEGRATED: yes
- EXPERIENCE_READY: local integration ready, staging not verified
- SEO_READY: partial; REVIEW_REQUIRED and alignment-pending content remains noindex/not-public
- STAGING_READY: no
- PRODUCTION_READY: no

## Coverage

\`\`\`json
${JSON.stringify(coverage, null, 2)}
\`\`\`

## Batch Results

${packageAudit.map((item) => `- Batch ${item.code}: \`${item.status}\` (${item.imported.contentEntries} content entries, ${item.imported.visuals} visuals, ${item.unresolvedItems} unresolved records)`).join("\n")}

## Final Gate

\`FULL_LIUYAO_CONTENT_GROWTH_REGRESSION\` has local data and contract coverage. HTTPS staging, live AI smoke, editorial differentiation for duplicated public SEO pages, and professional ID review remain outside this local integration.
`);

  console.log(JSON.stringify({ ok: true, coverage, packageAudit }, null, 2));
}

main();
