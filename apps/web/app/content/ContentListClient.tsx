"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import { ArrowRight, BookOpen, Compass, FileText, Search } from "lucide-react";
import { AppNav } from "../AppNav";
import { apiBase, readError, type ContentSummary } from "../lib/api";
import { topicProfileFor } from "./topicProfiles";

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
  { key: "B01", title: "先知道怎么使用", detail: "适用问题、提问方法与可信边界", match: (item: ContentSummary) => item.contentId.startsWith("B01-") },
  { key: "B02", title: "理解起卦与盘面", detail: "阴阳动静、本卦变卦与排盘结构", match: (item: ContentSummary) => item.contentId.startsWith("B02-") },
  { key: "B03", title: "看懂角色与关系", detail: "用神、六亲、世应与关系结构", match: (item: ContentSummary) => item.contentId.startsWith("B03-") },
  { key: "B04", title: "判断力量与时间", detail: "旺衰、动变、冲突与时间提示", match: (item: ContentSummary) => item.contentId.startsWith("B04-") },
  { key: "B05", title: "进入现实问题", detail: "感情、事业、合作、财务与出行", match: (item: ContentSummary) => item.contentId.startsWith("B05-") },
  { key: "B06", title: "练习阅读报告", detail: "从结论、依据到保守表达", match: (item: ContentSummary) => item.contentId.startsWith("B06-") },
];

const libraryModules = [
  { key: "B01", label: "入门与边界", match: pathStages[0]!.match },
  { key: "B02", label: "起卦与盘面", match: pathStages[1]!.match },
  { key: "B03", label: "角色与关系", match: pathStages[2]!.match },
  { key: "B04", label: "力量与时间", match: pathStages[3]!.match },
  { key: "B05", label: "现实问题", match: pathStages[4]!.match },
  { key: "B06", label: "报告案例", match: pathStages[5]!.match },
  { key: "reference", label: "术语与卦象", match: (item: ContentSummary) => ["GLOSSARY", "TRIGRAM", "HEXAGRAM"].includes(item.contentType) },
  { key: "all", label: "全部内容", match: () => true },
];

const topicOrder = ["RELATIONSHIP", "BUSINESS_PARTNERSHIP", "CAREER_WORK", "FINANCE_PROJECT", "EXAM_JOB_SEARCH", "TRAVEL_PLANNING"];

const reportSteps = [
  { contentId: "B01-A14", title: "先确认报告在回答什么", detail: "先看原问题和总体判断，不急着进入术语。" },
  { contentId: "B01-A06", title: "分开看支持与阻碍", detail: "理解两种方向为什么可以同时存在。" },
  { contentId: "B04-A19", title: "再看变化与时间", detail: "把时间提示当作观察窗口，而不是承诺。" },
  { contentId: "B01-A13", title: "最后核对专业依据", detail: "需要深入时，再回到盘面、角色和证据。" },
];

const editorialAssets = {
  articleHero: "/liuyao-visual-system/editorial/final/article-hero/ED-LY-001-thumb-400x225.png",
  caseCover: "/liuyao-visual-system/editorial/final/case-cover/ED-LY-003-thumb-400x300.png",
  lessonCover: "/liuyao-visual-system/editorial/final/lesson-cover/ED-LY-004-thumb-400x500.png",
  culturalScene: "/liuyao-visual-system/editorial/final/cultural-scene/ED-LY-008-thumb-400x267.png",
  conceptExplainer: "/liuyao-visual-system/editorial/final/inline/ED-LY-002-concept-explainer-1200x630.svg",
  trustSystem: "/liuyao-visual-system/editorial/final/inline/ED-LY-010-trust-system-illustration-1200x630.svg",
};

function contentHref(item: ContentSummary) {
  return `/content/${item.contentType.toLowerCase().replaceAll("_", "-")}/${encodeURIComponent(item.slug)}`;
}

function statusLabel(item: ContentSummary) {
  if (item.reviewStatus === "PUBLICATION_READY") return "已发布";
  if (item.reviewStatus === "REVIEW_REQUIRED") return "内测";
  return "示例";
}

function editorialVisualFor(item: ContentSummary) {
  if (item.contentType === "LEARNING_PATH") return editorialAssets.lessonCover;
  if (item.contentType === "TUTORIAL") return item.contentId.startsWith("B05-") ? editorialAssets.caseCover : editorialAssets.articleHero;
  if (item.contentType === "FAQ") return editorialAssets.trustSystem;
  if (item.contentType === "GLOSSARY" || item.contentType === "KNOWLEDGE") return editorialAssets.conceptExplainer;
  if (item.contentType === "HEXAGRAM" || item.contentType === "TRIGRAM") return editorialAssets.culturalScene;
  return editorialAssets.articleHero;
}

function ContentCard({ item, compact = false, showSummary = false }: { item: ContentSummary; compact?: boolean; showSummary?: boolean }) {
  return (
    <a className={compact ? "content-card compact" : "content-card"} href={contentHref(item)}>
      {!compact ? <img className="content-card-visual" src={editorialVisualFor(item)} alt="" aria-hidden="true" loading="lazy" /> : null}
      <span className="content-meta">
        {typeLabels[item.contentType] ?? item.contentType}
        <i>{statusLabel(item)}</i>
      </span>
      <strong>{item.title}</strong>
      {!compact || showSummary ? <small>{item.summary}</small> : null}
    </a>
  );
}

function TopicCard({ item }: { item: ContentSummary }) {
  const profile = topicProfileFor(item.contentId);
  if (!profile) return <ContentCard item={item} />;
  return (
    <a className="topic-card" href={contentHref(item)}>
      <img src={profile.visual} alt={profile.visualAlt} loading="lazy" />
      <span>{profile.category}</span>
      <strong>{profile.name}</strong>
      <small>{profile.intro}</small>
      <em>进入专题 <ArrowRight aria-hidden="true" size={16} /></em>
    </a>
  );
}

function IntentLink({ href, icon: Icon, label, detail }: { href: string; icon: ComponentType<{ size?: number; "aria-hidden"?: boolean }>; label: string; detail: string }) {
  return (
    <a className="learning-intent" href={href}>
      <Icon aria-hidden={true} size={22} />
      <span><strong>{label}</strong><small>{detail}</small></span>
      <ArrowRight aria-hidden="true" size={17} />
    </a>
  );
}

export function ContentListClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState<ContentSummary[]>([]);
  const [query, setQuery] = useState("");
  const [activeStage, setActiveStage] = useState("B01");
  const [activeModule, setActiveModule] = useState("B01");
  const [libraryLimit, setLibraryLimit] = useState(12);

  async function loadContent(search = "") {
    setLoading(true);
    setError("");
    setLibraryLimit(12);
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

  const learnHub = items.find((item) => item.contentType === "LEARNING_PATH") ?? items[0];
  const topicLandings = topicOrder.map((id) => items.find((item) => item.contentId === id)).filter((item): item is ContentSummary => Boolean(item));
  const activeStageDefinition = pathStages.find((stage) => stage.key === activeStage) ?? pathStages[0]!;
  const stageItems = items.filter(activeStageDefinition.match).filter((item) => item.contentType === "TUTORIAL").slice(0, 3);
  const activeModuleDefinition = libraryModules.find((module) => module.key === activeModule) ?? libraryModules[0]!;
  const visibleItems = useMemo(
    () => items.filter(activeModuleDefinition.match).filter((item) => item.contentType !== "LANDING_PAGE" && item.contentType !== "LEARNING_PATH"),
    [activeModuleDefinition, items]
  );

  return (
    <main className="shell">
      <AppNav current="content" />

      <section className="content-hub-hero">
        <div>
          <p className="eyebrow">六爻学习中心</p>
          <h1>按你的目标，找到下一步</h1>
          <p>第一次接触、正在阅读报告，或带着现实问题而来，都可以从一条明确路径开始。</p>
        </div>
        <div className="content-hub-visual" aria-label="知识中心内容概览">
          <img src="/liuyao-visual-system/editorial/final/topic-hero/ED-LY-006-topic-landing-hero-1200x675.png" alt="" aria-hidden="true" />
          <div className="hub-metrics" aria-label="内容统计">
            <div><strong>{items.length || 0}</strong><span>条可检索内容</span></div>
            <div><strong>{topicLandings.length}</strong><span>个现实问题专题</span></div>
          </div>
        </div>
      </section>

      <nav className="learning-intents" aria-label="选择学习目标">
        <IntentLink href="#learning-path" icon={BookOpen} label="第一次接触六爻" detail="从适用边界和提问方法开始" />
        <IntentLink href="#report-guide" icon={FileText} label="我正在看一份报告" detail="按四个步骤抓住结论和依据" />
        <IntentLink href="#topics" icon={Compass} label="我有一个现实问题" detail="按感情、工作、财务等场景进入" />
      </nav>

      {loading ? <p className="empty">正在读取内容。</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {!loading && !error ? (
        <>
          <section className="learning-program" id="learning-path">
            <div className="section-heading">
              <div>
                <p className="eyebrow">循序学习</p>
                <h2>六个阶段，按顺序建立理解</h2>
                <p>左侧选择阶段，右侧只给出本阶段前三篇，不需要在完整内容库里挑选。</p>
              </div>
              {learnHub ? <a className="text-link" href={contentHref(learnHub)}>查看完整学习路径</a> : null}
            </div>
            <div className="hub-layout">
              <nav className="learning-rail" aria-label="六爻学习阶段">
                {pathStages.map((stage, index) => (
                  <button
                    aria-current={activeStage === stage.key ? "step" : undefined}
                    className={activeStage === stage.key ? "path-step active" : "path-step"}
                    key={stage.key}
                    onClick={() => setActiveStage(stage.key)}
                    type="button"
                  >
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{stage.title}</strong>
                    <small>{stage.detail}</small>
                  </button>
                ))}
              </nav>

              <section className="stage-panel" aria-live="polite">
                <header>
                  <span>第 {pathStages.findIndex((stage) => stage.key === activeStage) + 1} 阶段</span>
                  <h3>{activeStageDefinition.title}</h3>
                  <p>{activeStageDefinition.detail}</p>
                </header>
                <div className="stage-reading-list">
                  {stageItems.map((item, index) => (
                    <a href={contentHref(item)} key={item.contentId}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <div><strong>{item.title}</strong><small>{item.summary}</small></div>
                      <ArrowRight aria-hidden="true" size={17} />
                    </a>
                  ))}
                </div>
                {stageItems[0] ? <a className="primary-link" href={contentHref(stageItems[0])}>从本阶段第一篇开始</a> : null}
              </section>
            </div>
          </section>

          <section className="topic-band" id="topics">
            <div className="section-heading">
              <div>
                <p className="eyebrow">按现实问题学习</p>
                <h2>先选你正在面对的事情</h2>
                <p>每个专题都从常见问题、观察重点和提问示例开始，而不是先讲术语。</p>
              </div>
            </div>
            <div className="topic-grid">
              {topicLandings.map((item) => <TopicCard item={item} key={item.contentId} />)}
            </div>
          </section>

          <section className="report-learning" id="report-guide">
            <div className="section-heading">
              <div>
                <p className="eyebrow">已有报告</p>
                <h2>一份报告，按这四步读</h2>
                <p>阅读顺序已经排好；需要专业细节时，再进入最后一步核对依据。</p>
              </div>
            </div>
            <div className="report-step-grid">
              {reportSteps.map((step, index) => {
                const item = items.find((entry) => entry.contentId === step.contentId);
                if (!item) return null;
                return (
                  <a className="report-step-card" href={contentHref(item)} key={step.contentId}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{step.title}</strong>
                    <small>{step.detail}</small>
                    <em>阅读这一部分 <ArrowRight aria-hidden="true" size={15} /></em>
                  </a>
                );
              })}
            </div>
          </section>

          <section className="library-section" id="library">
            <div className="section-heading">
              <div>
                <p className="eyebrow">按需查找</p>
                <h2>需要时，再进入完整资料库</h2>
                <p>默认从入门模块开始；可以切换学习模块，或直接搜索一个术语和问题。</p>
              </div>
              <span className="library-count">当前 {visibleItems.length} 条</span>
            </div>

            <form
              className="search-bar content-search"
              onSubmit={(event) => {
                event.preventDefault();
                setActiveModule("all");
                loadContent(query);
              }}
            >
              <label className="library-search-field">
                <span className="sr-only">搜索知识内容</span>
                <Search aria-hidden="true" size={18} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索一个术语或具体问题" />
              </label>
              <button type="submit">搜索</button>
              {query ? (
                <button
                  className="secondary"
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setActiveModule("B01");
                    loadContent();
                  }}
                >
                  清除搜索
                </button>
              ) : null}
            </form>

            <label className="library-module-select">
              <span>学习模块</span>
              <select
                value={activeModule}
                onChange={(event) => {
                  setActiveModule(event.target.value);
                  setLibraryLimit(12);
                }}
              >
                {libraryModules.map((module) => <option key={module.key} value={module.key}>{module.label}</option>)}
              </select>
            </label>

            <div className="library-list">
              {visibleItems.slice(0, libraryLimit).map((item) => <ContentCard compact showSummary item={item} key={item.contentId} />)}
            </div>
            {visibleItems.length > libraryLimit ? (
              <button className="secondary library-more" type="button" onClick={() => setLibraryLimit((value) => value + 12)}>
                显示下一组内容
              </button>
            ) : null}
          </section>
        </>
      ) : null}
    </main>
  );
}
