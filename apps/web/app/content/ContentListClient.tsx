"use client";

import { useEffect, useMemo, useState } from "react";
import { AppNav } from "../AppNav";
import { apiBase, readError, type ContentSummary } from "../lib/api";

const typeLabels: Record<string, string> = {
  TUTORIAL: "教程",
  KNOWLEDGE: "知识卡",
  FAQ: "问答",
  LANDING_PAGE: "专题",
  LEARNING_PATH: "路径",
  GLOSSARY: "术语",
  TRIGRAM: "八卦",
  HEXAGRAM: "六十四卦",
};

const pathStages = [
  { key: "B01", title: "建立边界", detail: "适用问题、可信报告、不确定性", match: (item: ContentSummary) => item.contentId.startsWith("B01-") },
  { key: "B02", title: "起卦与结构", detail: "阴阳动静、本卦变卦、排盘结构", match: (item: ContentSummary) => item.contentId.startsWith("B02-") },
  { key: "B03", title: "角色与关系", detail: "用神、六亲、世应、原忌仇", match: (item: ContentSummary) => item.contentId.startsWith("B03-") },
  { key: "B04", title: "力量与时间", detail: "旺衰、旬空月破、动变、应期", match: (item: ContentSummary) => item.contentId.startsWith("B04-") },
  { key: "B05", title: "现实决策", detail: "事业、合作、财务、关系、考试、出行", match: (item: ContentSummary) => item.contentId.startsWith("B05-") },
  { key: "B06", title: "读懂报告", detail: "解释片段、证据顺序、保守结论", match: (item: ContentSummary) => item.contentId.startsWith("B06-") },
];

const filters = [
  { key: "all", label: "全部" },
  { key: "TUTORIAL", label: "教程" },
  { key: "KNOWLEDGE", label: "知识卡" },
  { key: "FAQ", label: "问答" },
  { key: "LANDING_PAGE", label: "专题" },
];

function contentHref(item: ContentSummary) {
  return `/content/${item.contentType.toLowerCase().replaceAll("_", "-")}/${encodeURIComponent(item.slug)}`;
}

function statusLabel(item: ContentSummary) {
  if (item.reviewStatus === "PUBLICATION_READY") return "已发布";
  if (item.reviewStatus === "REVIEW_REQUIRED") return "内测";
  return "示例";
}

function pickItems(items: ContentSummary[], predicate: (item: ContentSummary) => boolean, limit: number) {
  return items.filter(predicate).slice(0, limit);
}

function ContentCard({ item, compact = false }: { item: ContentSummary; compact?: boolean }) {
  return (
    <a className={compact ? "content-card compact" : "content-card"} href={contentHref(item)}>
      <span className="content-meta">
        {typeLabels[item.contentType] ?? item.contentType}
        <i>{statusLabel(item)}</i>
      </span>
      <strong>{item.title}</strong>
      {!compact ? <small>{item.summary}</small> : null}
    </a>
  );
}

export function ContentListClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState<ContentSummary[]>([]);
  const [query, setQuery] = useState("");
  const [activeType, setActiveType] = useState("all");

  async function loadContent(search = "") {
    setLoading(true);
    setError("");
    try {
      const endpoint = search.trim()
        ? `${apiBase()}/content/search?q=${encodeURIComponent(search.trim())}`
        : `${apiBase()}/content`;
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error(await readError(response));
      const body = (await response.json()) as { items?: ContentSummary[] };
      setItems(body.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "暂时无法读取内容");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadContent();
  }, []);

  const visibleItems = useMemo(
    () => items.filter((item) => activeType === "all" || item.contentType === activeType),
    [activeType, items]
  );
  const learnHub = items.find((item) => item.contentType === "LEARNING_PATH") ?? items[0];
  const topicLandings = pickItems(items, (item) => item.contentType === "LANDING_PAGE", 6);
  const reportReading = pickItems(
    items,
    (item) => item.contentId.startsWith("B06-") || item.title.includes("报告") || Boolean(item.summary?.includes("报告")),
    8
  );
  const starter = pickItems(items, (item) => item.contentId.startsWith("B01-A") || item.contentId.startsWith("B02-A"), 6);
  const professional = pickItems(items, (item) => item.contentId.startsWith("B03-") || item.contentId.startsWith("B04-"), 8);
  const faqs = pickItems(items, (item) => item.contentType === "FAQ", 8);

  return (
    <main className="shell">
      <AppNav current="content" />

      <section className="content-hub-hero">
        <div>
          <p className="eyebrow">Liuyao Learn Hub</p>
          <h1>六爻知识中心</h1>
          <p>从提问、起卦、排盘结构到报告阅读，把术语、案例和现实问题放在同一条学习线上。</p>
        </div>
        <div className="hub-metrics" aria-label="内容统计">
          <strong>{items.length || 0}</strong>
          <span>条内容</span>
          <strong>{topicLandings.length}</strong>
          <span>个专题</span>
        </div>
      </section>

      <form
        className="search-bar content-search"
        onSubmit={(event) => {
          event.preventDefault();
          loadContent(query);
        }}
      >
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索术语、问题、报告字段" />
        <button type="submit">搜索</button>
        {query ? (
          <button
            className="secondary"
            type="button"
            onClick={() => {
              setQuery("");
              loadContent();
            }}
          >
            重置
          </button>
        ) : null}
      </form>

      {loading ? <p className="empty">正在读取内容。</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {!loading && !error ? (
        <>
          <section className="hub-layout">
            <aside className="learning-rail">
              <div className="rail-header">
                <span>学习顺序</span>
                {learnHub ? <a href={contentHref(learnHub)}>完整路径</a> : null}
              </div>
              {pathStages.map((stage, index) => {
                const count = items.filter(stage.match).length;
                const first = items.find(stage.match);
                return (
                  <a className="path-step" href={first ? contentHref(first) : "#library"} key={stage.key}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{stage.title}</strong>
                    <small>{stage.detail}</small>
                    <em>{count} 条</em>
                  </a>
                );
              })}
            </aside>

            <section className="hub-main">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Start</p>
                  <h2>从这里开始</h2>
                </div>
                <a className="text-link" href="/">开始起卦</a>
              </div>
              <div className="content-grid">
                {starter.map((item) => <ContentCard item={item} key={item.contentId} />)}
              </div>
            </section>
          </section>

          <section className="topic-band">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Topics</p>
                <h2>现实问题专题</h2>
              </div>
            </div>
            <div className="topic-grid">
              {topicLandings.map((item) => <ContentCard item={item} key={item.contentId} />)}
            </div>
          </section>

          <section className="content-columns">
            <div>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Report</p>
                  <h2>报告阅读</h2>
                </div>
              </div>
              <div className="stack-list">
                {reportReading.map((item) => <ContentCard compact item={item} key={item.contentId} />)}
              </div>
            </div>
            <div>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Professional</p>
                  <h2>专业概念</h2>
                </div>
              </div>
              <div className="stack-list">
                {professional.map((item) => <ContentCard compact item={item} key={item.contentId} />)}
              </div>
            </div>
            <div>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">FAQ</p>
                  <h2>常见疑问</h2>
                </div>
              </div>
              <div className="stack-list">
                {faqs.map((item) => <ContentCard compact item={item} key={item.contentId} />)}
              </div>
            </div>
          </section>

          <section className="library-section" id="library">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Library</p>
                <h2>全部内容</h2>
              </div>
              <div className="filter-tabs" aria-label="内容类型">
                {filters.map((filter) => (
                  <button
                    className={activeType === filter.key ? "active" : ""}
                    key={filter.key}
                    onClick={() => setActiveType(filter.key)}
                    type="button"
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="library-list">
              {visibleItems.slice(0, 120).map((item) => <ContentCard compact item={item} key={item.contentId} />)}
            </div>
            {visibleItems.length > 120 ? <p className="quiet-empty">已显示前 120 条，可用搜索精确定位。</p> : null}
          </section>
        </>
      ) : null}
    </main>
  );
}
