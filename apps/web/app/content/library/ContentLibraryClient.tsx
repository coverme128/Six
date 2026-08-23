"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, CircleHelp, FileText, Layers3, Search } from "lucide-react";

import { AppNav } from "../../AppNav";
import { apiBase, readError, type ContentSummary } from "../../lib/api";
import { ContentSectionNav } from "../ContentSectionNav";
import { contentVisualFor } from "../contentVisuals";

const moduleFilters = [
  { key: "all", label: "全部主题", detail: "浏览完整内容库", match: () => true },
  { key: "B01", label: "使用与可信", detail: "适用边界、提问、报告与 AI", match: (item: ContentSummary) => item.contentId.startsWith("B01-") },
  { key: "B02", label: "起卦与盘面", detail: "六次起卦、动爻、本卦与变卦", match: (item: ContentSummary) => item.contentId.startsWith("B02-") },
  { key: "B03", label: "角色与关系", detail: "用神、六亲、世应与角色映射", match: (item: ContentSummary) => item.contentId.startsWith("B03-") },
  { key: "B04", label: "力量与时间", detail: "旺衰、动变、冲突与应期", match: (item: ContentSummary) => item.contentId.startsWith("B04-") },
  { key: "B05", label: "现实问题", detail: "感情、工作、合作、财务与计划", match: (item: ContentSummary) => item.contentId.startsWith("B05-") && !item.contentId.includes("-CASE-") },
  { key: "cases", label: "教学案例", detail: "现实问题与报告解释练习", match: (item: ContentSummary) => item.contentId.includes("-CASE-") },
  { key: "reference", label: "术语与卦象", detail: "概念、八卦与六十四卦", match: (item: ContentSummary) => ["GLOSSARY", "TRIGRAM", "HEXAGRAM"].includes(item.contentType) },
] as const;

const formatFilters = [
  { key: "all", label: "全部形式", match: () => true },
  { key: "TUTORIAL", label: "教程", match: (item: ContentSummary) => item.contentType === "TUTORIAL" && !item.contentId.includes("-CASE-") },
  { key: "KNOWLEDGE", label: "知识卡", match: (item: ContentSummary) => item.contentType === "KNOWLEDGE" },
  { key: "FAQ", label: "问答", match: (item: ContentSummary) => item.contentType === "FAQ" },
  { key: "CASE", label: "案例", match: (item: ContentSummary) => item.contentId.includes("-CASE-") },
  { key: "REFERENCE", label: "参考资料", match: (item: ContentSummary) => ["GLOSSARY", "TRIGRAM", "HEXAGRAM"].includes(item.contentType) },
] as const;

const difficultyLabels: Record<string, string> = { BEGINNER: "入门", INTERMEDIATE: "进阶", ADVANCED: "专业" };
const typeLabels: Record<string, string> = { TUTORIAL: "教程", KNOWLEDGE: "知识卡", FAQ: "问答", GLOSSARY: "术语", TRIGRAM: "八卦", HEXAGRAM: "六十四卦", LANDING_PAGE: "专题", LEARNING_PATH: "路径" };

function contentHref(item: ContentSummary) {
  return `/content/${item.contentType.toLowerCase().replaceAll("_", "-")}/${encodeURIComponent(item.slug)}`;
}

function resultIcon(item: ContentSummary) {
  if (item.contentType === "FAQ") return CircleHelp;
  if (item.contentType === "KNOWLEDGE" || item.contentType === "GLOSSARY") return Layers3;
  if (item.contentType === "TUTORIAL") return FileText;
  return BookOpen;
}

export function ContentLibraryClient() {
  const [items, setItems] = useState<ContentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [moduleKey, setModuleKey] = useState("all");
  const [formatKey, setFormatKey] = useState("all");
  const [difficulty, setDifficulty] = useState("all");
  const [limit, setLimit] = useState(18);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedModule = params.get("module");
    const requestedFormat = params.get("format");
    const requestedQuery = params.get("q");
    if (requestedModule && moduleFilters.some((filter) => filter.key === requestedModule)) setModuleKey(requestedModule);
    if (requestedFormat && formatFilters.some((filter) => filter.key === requestedFormat)) setFormatKey(requestedFormat);
    if (requestedQuery) setQuery(requestedQuery);

    let cancelled = false;
    fetch(`${apiBase()}/content`)
      .then(async (response) => {
        if (!response.ok) throw new Error(await readError(response));
        return response.json() as Promise<{ items?: ContentSummary[] }>;
      })
      .then((body) => { if (!cancelled) setItems(body.items ?? []); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "暂时无法读取资料库"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const moduleFilter = moduleFilters.find((filter) => filter.key === moduleKey) ?? moduleFilters[0];
    const formatFilter = formatFilters.find((filter) => filter.key === formatKey) ?? formatFilters[0];
    const needle = query.trim().toLowerCase();
    return items.filter(moduleFilter.match).filter(formatFilter.match).filter((item) => difficulty === "all" || item.difficulty === difficulty).filter((item) => !needle || `${item.title} ${item.summary ?? ""}`.toLowerCase().includes(needle));
  }, [difficulty, formatKey, items, moduleKey, query]);

  function resetLimit() {
    setLimit(18);
  }

  return (
    <main className="shell content-library-page">
      <AppNav current="content" />
      <ContentSectionNav current="library" />

      <header className="library-hero">
        <div><p className="eyebrow">完整资料库</p><h1>从一个问题，找到刚好需要的内容</h1><p>按主题、内容形式和理解深度组合筛选；搜索结果会保留所在模块，方便继续学习。</p></div>
        <dl>
          <div><dt>全部内容</dt><dd>{items.length}</dd></div>
          <div><dt>当前结果</dt><dd>{filtered.length}</dd></div>
        </dl>
      </header>

      <div className="library-workspace">
        <aside className="library-filter-panel">
          <div><strong>学习主题</strong><span>先选你正在理解的范围</span></div>
          <nav aria-label="按学习主题筛选">
            {moduleFilters.map((filter) => (
              <button aria-pressed={moduleKey === filter.key} className={moduleKey === filter.key ? "active" : ""} key={filter.key} onClick={() => { setModuleKey(filter.key); resetLimit(); }} type="button">
                <strong>{filter.label}</strong><small>{filter.detail}</small>
              </button>
            ))}
          </nav>
        </aside>

        <section className="library-results">
          <div className="library-query-controls">
            <label><span className="sr-only">搜索资料库</span><Search aria-hidden="true" size={18} /><input onChange={(event) => { setQuery(event.target.value); resetLimit(); }} placeholder="搜索术语、问题或报告概念" value={query} /></label>
            <label><span>理解深度</span><select onChange={(event) => { setDifficulty(event.target.value); resetLimit(); }} value={difficulty}><option value="all">全部</option><option value="BEGINNER">入门</option><option value="INTERMEDIATE">进阶</option><option value="ADVANCED">专业</option></select></label>
          </div>

          <div aria-label="按内容形式筛选" className="library-format-tabs" role="group">
            {formatFilters.map((filter) => <button aria-pressed={formatKey === filter.key} className={formatKey === filter.key ? "active" : ""} key={filter.key} onClick={() => { setFormatKey(filter.key); resetLimit(); }} type="button">{filter.label}</button>)}
          </div>

          <header className="library-results-heading"><div><p className="eyebrow">筛选结果</p><h2>{filtered.length ? `找到 ${filtered.length} 条内容` : "没有匹配内容"}</h2></div>{query || moduleKey !== "all" || formatKey !== "all" || difficulty !== "all" ? <button onClick={() => { setQuery(""); setModuleKey("all"); setFormatKey("all"); setDifficulty("all"); resetLimit(); }} type="button">清除筛选</button> : null}</header>

          {loading ? <p className="empty">正在读取内容。</p> : null}
          {error ? <p className="error">{error}</p> : null}
          {!loading && !error ? (
            <div className="library-result-list">
              {filtered.slice(0, limit).map((item) => {
                const Icon = resultIcon(item);
                const visual = contentVisualFor(item);
                return (
                  <a href={contentHref(item)} key={item.contentId}>
                    <img src={visual.src} alt="" aria-hidden="true" loading="lazy" />
                    <div><span>{item.contentId.includes("-CASE-") ? "教学案例" : typeLabels[item.contentType] ?? item.contentType} · {difficultyLabels[item.difficulty ?? ""] ?? "通用"}</span><strong>{item.title}</strong><small>{item.summary}</small></div>
                    <span className="library-result-action"><Icon aria-hidden="true" size={17} /><ArrowRight aria-hidden="true" size={17} /></span>
                  </a>
                );
              })}
            </div>
          ) : null}
          {filtered.length > limit ? <button className="secondary library-more" onClick={() => setLimit((value) => value + 18)} type="button">显示下一组内容</button> : null}
        </section>
      </div>
    </main>
  );
}
