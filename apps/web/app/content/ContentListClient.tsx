"use client";

import { useEffect, useState } from "react";
import { ArrowRight, CircleHelp, Compass, GraduationCap, Layers3, Maximize2, Search, ShieldCheck, X } from "lucide-react";
import { AppNav } from "../AppNav";
import { apiBase, readError, type ContentSummary } from "../lib/api";
import { ContentSectionNav } from "./ContentSectionNav";
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

const topicOrder = ["RELATIONSHIP", "BUSINESS_PARTNERSHIP", "CAREER_WORK", "FINANCE_PROJECT", "EXAM_JOB_SEARCH", "TRAVEL_PLANNING"];

const reportSteps = [
  { contentId: "B01-A14", title: "先确认报告在回答什么", detail: "先看原问题和总体判断，不急着进入术语。" },
  { contentId: "B01-A06", title: "分开看支持与阻碍", detail: "理解两种方向为什么可以同时存在。" },
  { contentId: "B04-A19", title: "再看变化与时间", detail: "把时间提示当作观察窗口，而不是承诺。" },
  { contentId: "B01-A13", title: "最后核对专业依据", detail: "需要深入时，再回到盘面、角色和证据。" },
];

export type HubVisualAsset = {
  visualAssetId: string;
  title: string;
  description: string;
  publicPath: string;
  articleRefs?: string[];
};

const visualGroupDefinitions = [
  { key: "B07", label: "全局导览", description: "学习、报告、可信边界与内容导航。" },
  { key: "B01", label: "使用与可信", description: "提问、报告、AI、隐私与使用边界。" },
  { key: "B02", label: "起卦与盘面", description: "六次起卦、动爻、本卦、变卦与盘面。" },
  { key: "B03", label: "角色与关系", description: "用神、六亲、世应与角色映射。" },
  { key: "B04", label: "力量与时间", description: "旺衰、动变、冲突处理与时间候选。" },
  { key: "B05", label: "现实问题", description: "工作、合作、资金、关系、考试与出行。" },
] as const;

const userJourneys = [
  { key: "new", label: "第一次了解", eyebrow: "从可靠基础开始", title: "先知道六爻适合解决什么，再学怎样提问", detail: "用最短路径理解适用范围、一次一问和完整起卦流程。", href: "#learning-path", cta: "进入入门路径", ids: ["B01-A01", "B01-A02", "B02-A02"] },
  { key: "problem", label: "带着问题来", eyebrow: "先进入现实场景", title: "从正在发生的事情开始，而不是先背术语", detail: "按感情、工作、合作、财务、考试或计划进入对应专题。", href: "#topics", cta: "选择现实专题", ids: ["B05-A16", "B05-A01", "B05-A06"] },
  { key: "report", label: "正在看报告", eyebrow: "先结论，后依据", title: "按固定顺序读懂支持、风险、变化与下一步", detail: "先抓住可行动信息，需要核验时再进入专业事实。", href: "#report-guide", cta: "按步骤读报告", ids: ["B01-A14", "B01-A06", "B04-A19"] },
  { key: "advanced", label: "系统与进阶", eyebrow: "建立完整知识结构", title: "沿着角色、力量、动变和时间逐层核验", detail: "适合已经有基础，希望系统理解专业依据的用户。", href: "#visual-atlas", cta: "进入图解知识", ids: ["B03-A01", "B04-A01", "B04-A20"] },
] as const;

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

function JourneyNavigator({ items }: { items: ContentSummary[] }) {
  const [activeKey, setActiveKey] = useState<(typeof userJourneys)[number]["key"]>(userJourneys[0]!.key);
  const active = userJourneys.find((journey) => journey.key === activeKey) ?? userJourneys[0]!;
  const recommendations = active.ids.map((id) => items.find((item) => item.contentId === id)).filter((item): item is ContentSummary => Boolean(item));

  return (
    <section className="journey-navigator" aria-labelledby="journey-heading">
      <div className="section-heading compact-heading"><div><p className="eyebrow">按当前目标进入</p><h2 id="journey-heading">你现在需要哪一种帮助？</h2></div></div>
      <div aria-label="选择当前目标" className="journey-tabs" role="tablist">
        {userJourneys.map((journey, index) => <button aria-controls="journey-panel" aria-selected={activeKey === journey.key} className={activeKey === journey.key ? "active" : ""} id={`journey-tab-${journey.key}`} key={journey.key} onClick={() => setActiveKey(journey.key)} onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? userJourneys.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + userJourneys.length) % userJourneys.length;
          const next = userJourneys[nextIndex]!;
          setActiveKey(next.key);
          window.requestAnimationFrame(() => document.getElementById(`journey-tab-${next.key}`)?.focus());
        }} role="tab" tabIndex={activeKey === journey.key ? 0 : -1} type="button">{journey.label}</button>)}
      </div>
      <div aria-labelledby={`journey-tab-${active.key}`} className="journey-panel" id="journey-panel" role="tabpanel">
        <div className="journey-summary"><p>{active.eyebrow}</p><h3>{active.title}</h3><span>{active.detail}</span><a className="primary-link" href={active.href}>{active.cta} <ArrowRight aria-hidden="true" size={16} /></a></div>
        <ol>
          {recommendations.map((item, index) => <li key={item.contentId}><a href={contentHref(item)}><em>{String(index + 1).padStart(2, "0")}</em><span><strong>{item.title}</strong><small>{item.summary}</small></span><ArrowRight aria-hidden="true" size={16} /></a></li>)}
        </ol>
      </div>
    </section>
  );
}

function VisualAtlas({ items, assets }: { items: ContentSummary[]; assets: HubVisualAsset[] }) {
  const groups = visualGroupDefinitions.map((definition) => ({ ...definition, visuals: assets.filter((asset) => asset.visualAssetId.startsWith(`${definition.key}-VIS-`)) }));
  const [activeGroup, setActiveGroup] = useState(groups[0]!.key);
  const [selectedId, setSelectedId] = useState(groups[0]!.visuals[0]!.visualAssetId);
  const [zoomOpen, setZoomOpen] = useState(false);
  const group = groups.find((item) => item.key === activeGroup) ?? groups[0]!;
  const selected = group.visuals.find((item) => item.visualAssetId === selectedId) ?? group.visuals[0]!;
  const related = selected.articleRefs?.map((id) => items.find((item) => item.contentId === id)).find(Boolean);
  const imagePath = selected.publicPath;

  useEffect(() => {
    if (!zoomOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setZoomOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [zoomOpen]);

  return (
    <section className="visual-atlas" id="visual-atlas">
      <div className="section-heading">
        <div>
          <p className="eyebrow">看图理解</p>
          <h2>68 张图，按主题看懂完整知识结构</h2>
          <p>从使用边界到现实问题，每一批视觉内容都可以独立查看，并回到对应教程。</p>
        </div>
        <span className="library-count">6 组 · {assets.length} 张</span>
      </div>

      <div className="visual-atlas-tabs" role="tablist" aria-label="选择知识地图主题">
        {groups.map((item, index) => (
          <button
            aria-controls="visual-atlas-panel"
            aria-selected={item.key === activeGroup}
            className={item.key === activeGroup ? "active" : ""}
            id={`visual-atlas-tab-${item.key}`}
            key={item.key}
            onClick={() => {
              setActiveGroup(item.key);
              setSelectedId(item.visuals[0]!.visualAssetId);
            }}
            onKeyDown={(event) => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
              event.preventDefault();
              const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? groups.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + groups.length) % groups.length;
              const next = groups[nextIndex]!;
              setActiveGroup(next.key);
              setSelectedId(next.visuals[0]!.visualAssetId);
              window.requestAnimationFrame(() => document.getElementById(`visual-atlas-tab-${next.key}`)?.focus());
            }}
            role="tab"
            tabIndex={item.key === activeGroup ? 0 : -1}
            type="button"
          >
            <strong>{item.label}<em>{item.visuals.length}</em></strong>
            <small>{item.description}</small>
          </button>
        ))}
      </div>

      <div aria-labelledby={`visual-atlas-tab-${group.key}`} className="visual-atlas-layout" id="visual-atlas-panel" role="tabpanel">
        <div className="visual-atlas-preview" aria-live="polite">
          <header>
            <div><span>{selected.visualAssetId}</span><h3>{selected.title}</h3><p>{selected.description}</p></div>
            {related ? <a className="text-link" href={contentHref(related)}>阅读相关教程 <ArrowRight aria-hidden="true" size={15} /></a> : null}
          </header>
          <button aria-label={`放大查看：${selected.title}`} className="atlas-main-image" onClick={() => setZoomOpen(true)} type="button">
            <img alt={selected.title} src={imagePath} />
            <span><Maximize2 aria-hidden="true" size={17} />放大查看</span>
          </button>
        </div>

        <div className="visual-atlas-thumbnails" aria-label={`${group.label}图示`}>
          {group.visuals.map((visual) => (
            <button
              aria-current={visual.visualAssetId === selected.visualAssetId ? "true" : undefined}
              className={visual.visualAssetId === selected.visualAssetId ? "active" : ""}
              key={visual.visualAssetId}
              onClick={() => setSelectedId(visual.visualAssetId)}
              type="button"
            >
              <img alt="" aria-hidden="true" loading="lazy" src={visual.publicPath} />
              <span><strong>{visual.title}</strong><small>{visual.visualAssetId}</small></span>
            </button>
          ))}
        </div>
      </div>

      {zoomOpen ? (
        <div aria-label={selected.title} aria-modal="true" className="image-lightbox" onClick={() => setZoomOpen(false)} role="dialog">
          <div onClick={(event) => event.stopPropagation()}>
            <button aria-label="关闭图片" autoFocus onClick={() => setZoomOpen(false)} type="button"><X aria-hidden="true" size={22} /></button>
            <img alt={selected.title} src={imagePath} />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function CaseLab({ items }: { items: ContentSummary[] }) {
  const realWorldCases = items.filter((item) => item.contentId.startsWith("B05-CASE-")).slice(0, 4);
  const reportCases = items.filter((item) => item.contentId.startsWith("B06-CASE-")).slice(0, 4);
  return (
    <section className="case-lab" id="case-lab">
      <div className="section-heading">
        <div><p className="eyebrow">案例练习</p><h2>用 24 个教学案例练习怎样判断</h2><p>先看现实问题怎样被拆开，再练习支持、阻碍、冲突和保守结论如何共同成立。</p></div>
        <a className="text-link" href="/content/library?module=cases">查看全部案例 <ArrowRight aria-hidden="true" size={15} /></a>
      </div>
      <div className="case-lab-columns">
        <section>
          <header><Compass aria-hidden="true" size={20} /><div><h3>现实问题案例</h3><p>工作、合作、财务、关系和计划</p></div><strong>12</strong></header>
          <ol>{realWorldCases.map((item, index) => <li key={item.contentId}><a href={contentHref(item)}><em>{String(index + 1).padStart(2, "0")}</em><span><strong>{item.title}</strong><small>{item.summary}</small></span><ArrowRight aria-hidden="true" size={16} /></a></li>)}</ol>
        </section>
        <section>
          <header><ShieldCheck aria-hidden="true" size={20} /><div><h3>报告解释练习</h3><p>证据并存、条件不足和保守表达</p></div><strong>12</strong></header>
          <ol>{reportCases.map((item, index) => <li key={item.contentId}><a href={contentHref(item)}><em>{String(index + 1).padStart(2, "0")}</em><span><strong>{item.title}</strong><small>{item.summary}</small></span><ArrowRight aria-hidden="true" size={16} /></a></li>)}</ol>
        </section>
      </div>
    </section>
  );
}

function ReferenceGateway({ items }: { items: ContentSummary[] }) {
  const gateways = [
    { key: "concepts", icon: Layers3, title: "概念与知识卡", detail: "用神、六亲、动变与报告概念", count: items.filter((item) => ["KNOWLEDGE", "GLOSSARY"].includes(item.contentType)).length, href: "/content/library?format=KNOWLEDGE", examples: items.filter((item) => item.contentType === "KNOWLEDGE").slice(0, 3) },
    { key: "faq", icon: CircleHelp, title: "常见问题", detail: "直接查找一个具体疑问的回答", count: items.filter((item) => item.contentType === "FAQ").length, href: "/content/library?format=FAQ", examples: items.filter((item) => item.contentType === "FAQ").slice(0, 3) },
    { key: "symbols", icon: GraduationCap, title: "术语与卦象", detail: "术语、八卦与六十四卦参考资料", count: items.filter((item) => ["GLOSSARY", "TRIGRAM", "HEXAGRAM"].includes(item.contentType)).length, href: "/content/library?module=reference", examples: items.filter((item) => ["GLOSSARY", "TRIGRAM", "HEXAGRAM"].includes(item.contentType)).slice(0, 3) },
  ];
  return (
    <section className="reference-gateway" id="reference">
      <div className="section-heading"><div><p className="eyebrow">快速查阅</p><h2>知道要查什么，就直接进入对应资料</h2><p>概念、具体疑问和卦象资料分开组织，避免在教程列表里反复筛选。</p></div><a className="text-link" href="/content/library">进入完整资料库 <ArrowRight aria-hidden="true" size={15} /></a></div>
      <div className="reference-gateway-grid">
        {gateways.map(({ key, icon: Icon, title, detail, count, href, examples }) => (
          <section key={key}>
            <header><Icon aria-hidden="true" size={21} /><div><h3>{title}</h3><p>{detail}</p></div><strong>{count}</strong></header>
            <ul>{examples.map((item) => <li key={item.contentId}><a href={contentHref(item)}>{item.title}<ArrowRight aria-hidden="true" size={14} /></a></li>)}</ul>
            <a className="gateway-link" href={href}>查看这一类全部内容</a>
          </section>
        ))}
      </div>
    </section>
  );
}

export function ContentListClient({ visualAssets }: { visualAssets: HubVisualAsset[] }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState<ContentSummary[]>([]);
  const [activeStage, setActiveStage] = useState("B01");

  async function loadContent() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${apiBase()}/content`);
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
  const tutorialCount = items.filter((item) => item.contentType === "TUTORIAL").length;
  const knowledgeCount = items.filter((item) => ["KNOWLEDGE", "GLOSSARY"].includes(item.contentType)).length;
  const faqCount = items.filter((item) => item.contentType === "FAQ").length;

  return (
    <main className="shell">
      <AppNav current="content" />
      <ContentSectionNav current="home" />

      <section className="content-hub-hero">
        <div>
          <p className="eyebrow">六爻学习中心</p>
          <h1>先找到你要解决的事，再进入对应知识</h1>
          <p>无论第一次接触、正在读报告、带着现实问题，还是希望系统进阶，都有明确入口。</p>
          <form action="/content/library" className="hub-search" method="get">
            <label><span className="sr-only">搜索六爻知识</span><Search aria-hidden="true" size={19} /><input name="q" placeholder="搜索一个术语、问题或报告概念" /></label>
            <button type="submit">搜索知识</button>
          </form>
        </div>
        <div className="content-hub-visual" aria-label="知识中心内容概览">
          <img src="/liuyao-visual-system/editorial/final/topic-hero/ED-LY-006-topic-landing-hero-1200x675.png" alt="" aria-hidden="true" />
          <div className="hub-metrics" aria-label="内容统计">
            <div><strong>{tutorialCount}</strong><span>篇教程与案例</span></div>
            <div><strong>{knowledgeCount}</strong><span>条概念资料</span></div>
            <div><strong>{faqCount}</strong><span>个常见问答</span></div>
          </div>
        </div>
      </section>

      {loading ? <p className="empty">正在读取内容。</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {!loading && !error ? (
        <>
          <JourneyNavigator items={items} />

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

          <CaseLab items={items} />
          <VisualAtlas assets={visualAssets} items={items} />
          <ReferenceGateway items={items} />
        </>
      ) : null}
    </main>
  );
}
