"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, CheckCircle2, CircleHelp, Layers3, Maximize2, X } from "lucide-react";
import { AppNav } from "../../../AppNav";
import { apiBase, readError, type ContentDetail, type ContentSummary } from "../../../lib/api";
import { ContentSectionNav } from "../../ContentSectionNav";
import { contentVisualFor } from "../../contentVisuals";
import { topicProfileFor } from "../../topicProfiles";

const typeLabels: Record<string, string> = {
  TUTORIAL: "六爻教程",
  KNOWLEDGE: "知识卡",
  FAQ: "常见问答",
  LANDING_PAGE: "现实问题专题",
  LEARNING_PATH: "学习路径",
  GLOSSARY: "术语解释",
  TRIGRAM: "八卦知识",
  HEXAGRAM: "六十四卦",
};

const difficultyLabels: Record<string, string> = {
  BEGINNER: "入门",
  INTERMEDIATE: "进阶",
  ADVANCED: "专业",
};

function publicationLabel(status?: string) {
  if (status === "PUBLICATION_READY") return "内容已核验";
  if (status === "REVIEW_REQUIRED") return "内容内测";
  return "示例内容";
}

function bodyRecord(body: unknown): Record<string, unknown> {
  return body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
}

function contentSections(body: unknown) {
  const sections = bodyRecord(body).sections;
  return Array.isArray(sections) ? sections as Array<{ heading?: string; body?: string; blocks?: Array<{ type?: string; text?: string; items?: string[] }> }> : [];
}

function keyTakeaways(body: unknown) {
  const items = bodyRecord(body).keyTakeaways;
  return Array.isArray(items) ? items.filter((item): item is string => typeof item === "string") : [];
}

function stringValue(body: unknown, key: string) {
  const value = bodyRecord(body)[key];
  return typeof value === "string" ? value : "";
}

function stringList(body: unknown, key: string) {
  const value = bodyRecord(body)[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function practicalFramework(body: unknown) {
  const value = bodyRecord(body).practicalFramework;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const framework = value as Record<string, unknown>;
  return typeof framework.name === "string" && typeof framework.content === "string"
    ? { name: framework.name, content: framework.content }
    : null;
}

function visualRefs(body: unknown) {
  const integration = bodyRecord(bodyRecord(body).productIntegration);
  const refs = integration.visual_asset_refs;
  return Array.isArray(refs) ? refs.filter((item): item is string => typeof item === "string") : [];
}

function articleSectionGroups(body: unknown) {
  const frameworkHeading = practicalFramework(body)?.name;
  const primary: Array<{ heading?: string; body?: string }> = [];
  const supporting: Array<{ heading?: string; body?: string }> = [];

  for (const section of contentSections(body)) {
    const heading = section.heading?.trim() ?? "";
    if (!heading || heading === frameworkHeading || heading === "关键结论" || heading === "常见误区" || heading === "使用边界") continue;
    if (heading.startsWith("在产品中的")) continue;
    if (heading.includes("适用场景、停止条件与现实验证")) {
      supporting.push(section);
      continue;
    }
    primary.push(section);
  }

  return { primary, supporting };
}

function ArticleSectionBody({ section }: { section: { body?: string; blocks?: Array<{ type?: string; text?: string; items?: string[] }> } }) {
  if (!section.blocks?.length) return <>{paragraphs(section.body).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</>;
  return <>{section.blocks.map((block, index) => {
    if (block.type === "unordered_list") return <ul className="article-content-list" key={index}>{block.items?.map((item) => <li key={item}>{item}</li>)}</ul>;
    if (block.type === "ordered_list") return <ol className="article-content-list ordered" key={index}>{block.items?.map((item) => <li key={item}>{item}</li>)}</ol>;
    return block.text ? <p key={index}>{block.text}</p> : null;
  })}</>;
}

function sectionLabel(heading: string, index: number) {
  if (heading.startsWith("为什么")) return "先理解原因";
  if (heading.includes("第一次报告")) return "保留判断基准";
  if (heading.includes("什么情况下")) return "确认是否有新条件";
  if (heading.includes("教学示例")) return "看一个具体例子";
  if (heading.includes("记录卡")) return "照着记录与复盘";
  return `第 ${String(index + 1).padStart(2, "0")} 部分`;
}

function paragraphs(text?: string) {
  return (text ?? "").split("\n\n").map((paragraph) => paragraph.trim()).filter(Boolean);
}

function publicLimitations(items?: string[]) {
  return (items ?? []).filter((text) => !/(CORE_V1|内容增长|写入专业规则|写回排盘)/u.test(text));
}

function editorialVisualFor(item: ContentDetail) {
  return contentVisualFor(item).src;
}

function contentHref(item: ContentSummary) {
  return `/content/${item.contentType.toLowerCase().replaceAll("_", "-")}/${encodeURIComponent(item.slug)}`;
}

function breadcrumbTypeHref(item: ContentDetail) {
  if (item.contentType === "LANDING_PAGE") return "/content#topics";
  if (item.contentType === "LEARNING_PATH") return "/content#learning-path";
  if (item.contentId.includes("-CASE-")) return "/content/library?module=cases";
  if (["GLOSSARY", "TRIGRAM", "HEXAGRAM"].includes(item.contentType)) return "/content/library?module=reference";
  return `/content/library?format=${encodeURIComponent(item.contentType)}`;
}

type RelatedKind = "KNOWLEDGE" | "FAQ" | "TUTORIAL";

const relatedKindConfig: Record<RelatedKind, { label: string; title: string }> = {
  KNOWLEDGE: { label: "知识卡", title: "先把关键概念弄清楚" },
  FAQ: { label: "常见问答", title: "你可能还会问这些" },
  TUTORIAL: { label: "延伸教程", title: "沿着这个主题继续学习" },
};

function relatedItems(items: ContentSummary[], kind: RelatedKind) {
  const limit = kind === "FAQ" ? 4 : 3;
  return items.filter((item) => item.contentType === kind).slice(0, limit);
}

function RelatedKindIcon({ kind }: { kind: RelatedKind }) {
  if (kind === "KNOWLEDGE") return <Layers3 aria-hidden="true" size={20} />;
  if (kind === "FAQ") return <CircleHelp aria-hidden="true" size={20} />;
  return <BookOpen aria-hidden="true" size={20} />;
}

function RelatedTypeTabs({ items, active, onSelect, label }: { items: ContentSummary[]; active: RelatedKind; onSelect: (kind: RelatedKind) => void; label: string }) {
  const kinds = (Object.keys(relatedKindConfig) as RelatedKind[]).filter((kind) => relatedItems(items, kind).length);
  if (kinds.length <= 1) return null;

  return (
    <div className="related-type-tabs" role="tablist" aria-label={label}>
      {kinds.map((kind) => {
        const selected = active === kind;
        return (
          <button aria-controls="related-content-panel" aria-selected={selected} className={selected ? "active" : ""} key={kind} onClick={() => onSelect(kind)} role="tab" type="button">
            <RelatedKindIcon kind={kind} />
            <strong>{relatedItems(items, kind).length}</strong>
            <span>{relatedKindConfig[kind].label}</span>
          </button>
        );
      })}
    </div>
  );
}

function ZoomableImage({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <>
      <button aria-label={`放大查看：${alt}`} className={`zoomable-image ${className}`.trim()} onClick={() => setOpen(true)} type="button">
        <img alt={alt} src={src} />
        <span><Maximize2 aria-hidden="true" size={17} />放大查看</span>
      </button>
      {open ? (
        <div aria-label={alt} aria-modal="true" className="image-lightbox" onClick={() => setOpen(false)} role="dialog">
          <div onClick={(event) => event.stopPropagation()}>
            <button aria-label="关闭图片" autoFocus onClick={() => setOpen(false)} type="button"><X aria-hidden="true" size={22} /></button>
            <img alt={alt} src={src} />
          </div>
        </div>
      ) : null}
    </>
  );
}

function scenarioHref(item: ContentDetail) {
  const profile = topicProfileFor(item.contentId);
  if (profile) return `/?scenario=${profile.scenario}#liuyao-workbench`;
  const scenarioBySlug: Record<string, string> = {
    relationship: "relationship",
    "career-work": "career",
    "finance-project": "wealth",
    "business-partnership": "business",
    "exam-job-search": "study",
    "travel-planning": "travel",
  };
  return `/?scenario=${scenarioBySlug[item.slug] ?? "relationship"}#liuyao-workbench`;
}

function RelatedContent({ items }: { items: ContentSummary[] }) {
  if (!items.length) return null;
  return (
    <section className="related-learning">
      <div className="section-heading">
        <div>
          <p className="eyebrow">继续学习</p>
          <h2>接下来可以看</h2>
        </div>
      </div>
      <div className="related-learning-grid">
        {items.slice(0, 6).map((related) => (
          <a href={contentHref(related)} key={related.contentId}>
            <span>{typeLabels[related.contentType] ?? "六爻知识"}</span>
            <strong>{related.title}</strong>
            <small>{related.summary}</small>
          </a>
        ))}
      </div>
    </section>
  );
}

function ArticleRelatedContent({ items, active, onSelect, title }: { items: ContentSummary[]; active: RelatedKind; onSelect: (kind: RelatedKind) => void; title?: string }) {
  const selectedItems = relatedItems(items, active);
  if (!selectedItems.length) return null;

  return (
    <section className="article-discovery" id="related-learning">
      <div className="section-heading article-discovery-heading">
        <div><p className="eyebrow">相关内容</p><h2>{title ?? relatedKindConfig[active].title}</h2></div>
        <RelatedTypeTabs active={active} items={items} label="切换相关内容类型" onSelect={onSelect} />
      </div>

      <div aria-live="polite" id="related-content-panel" role="tabpanel">
        {active === "KNOWLEDGE" ? (
          <div className="knowledge-card-list">
            {selectedItems.map((item) => (
              <a href={contentHref(item)} key={item.contentId}>
                <span>概念</span><strong>{item.title}</strong><small>{item.summary}</small><ArrowRight aria-hidden="true" size={17} />
              </a>
            ))}
          </div>
        ) : null}

        {active === "FAQ" ? (
          <div className="faq-link-list">
            {selectedItems.map((item) => <a href={contentHref(item)} key={item.contentId}><strong>{item.title}</strong><ArrowRight aria-hidden="true" size={17} /></a>)}
          </div>
        ) : null}

        {active === "TUTORIAL" ? (
          <div className="tutorial-link-list">
            {selectedItems.map((item, index) => (
              <a href={contentHref(item)} key={item.contentId}>
                <em>{String(index + 1).padStart(2, "0")}</em><span><strong>{item.title}</strong><small>{item.summary}</small></span><ArrowRight aria-hidden="true" size={17} />
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ArticleContent({ item, related }: { item: ContentDetail; related: ContentSummary[] }) {
  const takeaways = keyTakeaways(item.body).slice(0, 4);
  const { primary: sections, supporting } = articleSectionGroups(item.body);
  const framework = practicalFramework(item.body);
  const misunderstandings = stringList(item.body, "commonMisunderstandings");
  const limitations = publicLimitations(item.knownLimitations);
  const firstRelatedKind = (Object.keys(relatedKindConfig) as RelatedKind[]).find((kind) => relatedItems(related, kind).length) ?? "KNOWLEDGE";
  const hasRelated = (Object.keys(relatedKindConfig) as RelatedKind[]).some((kind) => relatedItems(related, kind).length);
  const [activeRelated, setActiveRelated] = useState<RelatedKind>(firstRelatedKind);

  function selectRelated(kind: RelatedKind, scroll = false) {
    setActiveRelated(kind);
    if (scroll) window.requestAnimationFrame(() => document.getElementById("related-learning")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  return (
    <>
      <section className="article-hero">
        <div>
          <p className="eyebrow">{typeLabels[item.contentType] ?? "六爻知识"}</p>
          <h1>{item.title}</h1>
          <p className="article-deck">{item.summary || "用清晰的结构理解这个六爻问题，并把结论放回现实验证。"}</p>
          <div className="article-meta" aria-label="内容信息">
            <span>{difficultyLabels[item.difficulty ?? ""] ?? "通用"}</span>
            <span>{publicationLabel(item.reviewStatus)}</span>
          </div>
        </div>
        <ZoomableImage alt={contentVisualFor(item).alt} className="article-hero-visual" src={editorialVisualFor(item)} />
      </section>

      {takeaways.length ? (
        <section className="article-overview" id="article-key-points">
          <div><p className="eyebrow">先看结论</p><h2>读完后，你只需要记住这四点</h2></div>
          <div className="article-takeaway-grid">
            {takeaways.map((text, index) => (
              <div key={text}><CheckCircle2 aria-hidden="true" size={20} /><em>{String(index + 1).padStart(2, "0")}</em><strong>{text}</strong></div>
            ))}
          </div>
        </section>
      ) : null}

      {hasRelated ? (
        <section className="article-resource-nav" aria-label="本文相关内容">
          <div><p className="eyebrow">相关内容</p><strong>选择你现在需要的帮助</strong></div>
          <RelatedTypeTabs active={activeRelated} items={related} label="选择相关内容类型" onSelect={(kind) => selectRelated(kind, true)} />
        </section>
      ) : null}

      {visualRefs(item.body).length ? (
        <figure className="article-concept-visual">
          <ZoomableImage alt={`${item.title}的判断流程图`} className="article-concept-image" src={`/content-growth/visuals/${visualRefs(item.body)[0]}.svg`} />
          <figcaption>图解：{item.title}的核心关系与阅读顺序。</figcaption>
        </figure>
      ) : null}

      <div className="article-reading-layout">
        {sections.length ? (
          <aside className="article-toc">
            <strong>本文会讲清</strong>
            <nav aria-label="文章目录">
              {sections.map((section, index) => <a href={`#article-section-${index + 1}`} key={`${section.heading}-${index}`}>{section.heading}</a>)}
            </nav>
            <a className="article-toc-related" href="#related-learning">查看知识卡与问答 <ArrowRight aria-hidden="true" size={15} /></a>
          </aside>
        ) : null}

        <article className="article-flow">
          {typeof item.body === "string" && item.body.trim() ? <p>{item.body}</p> : null}
          {sections.map((section, index) => (
            <section id={`article-section-${index + 1}`} key={`${section.heading}-${index}`}>
              <p className="article-section-label">{sectionLabel(section.heading ?? "", index)}</p>
              {section.heading ? <h2>{section.heading}</h2> : null}
              <ArticleSectionBody section={section} />
            </section>
          ))}

          {framework ? (
            <aside className="article-framework" id="article-framework">
              <span>重新评估前先核对</span>
              <strong>{framework.name}</strong>
              <p>{framework.content}</p>
            </aside>
          ) : null}

          {misunderstandings.length ? (
            <section className="article-misunderstandings">
              <p className="article-section-label">避免判断被情绪带走</p>
              <h2>常见误区</h2>
              <ul>{misunderstandings.map((text) => <li key={text}>{text}</li>)}</ul>
            </section>
          ) : null}

          {supporting.map((section, index) => (
            <details className="article-supporting-details" key={`${section.heading}-${index}`}>
              <summary>适用范围、停止条件与现实验证</summary>
              <div>{paragraphs(section.body).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
            </details>
          ))}

          {limitations.length ? (
            <details className="article-supporting-details boundary">
              <summary>使用边界</summary>
              <div>{limitations.map((text) => <p key={text}>{text}</p>)}</div>
            </details>
          ) : null}
        </article>
      </div>

      <section className="article-actions">
        <div><p className="eyebrow">下一步</p><h2>需要概念解释或具体回答，再进入相关内容</h2></div>
        <div><a className="primary-link" href="#related-learning">查看相关知识</a><a className="secondary-link" href="/content">返回知识中心</a></div>
      </section>

      <ArticleRelatedContent active={activeRelated} items={related} onSelect={(kind) => selectRelated(kind)} />
    </>
  );
}

function ReferenceContent({ item, related }: { item: ContentDetail; related: ContentSummary[] }) {
  const practicalMeaning = stringValue(item.body, "practicalMeaning");
  const professionalDefinition = stringValue(item.body, "professionalDefinition").split(/系统需|CAL_[A-Z0-9_]+/u)[0]?.trim();
  const misunderstandings = stringList(item.body, "commonMisunderstandings").length
    ? stringList(item.body, "commonMisunderstandings")
    : stringList(item.body, "commonMisunderstanding");
  const examples = stringList(item.body, "examples");
  const whenUserSeesIt = stringValue(item.body, "whenUserSeesIt");
  const boundary = stringValue(item.body, "boundary") || publicLimitations(item.knownLimitations)[0] || "";
  const sections = contentSections(item.body).filter((section) => !["它是什么", "为什么值得理解", "在六爻里怎样使用", "一个具体例子", "常见误区", "边界与限制"].includes(section.heading ?? ""));
  const relevantItems = related.filter((entry) => entry.contentId !== item.contentId && entry.title !== item.title);
  const firstRelatedKind = (Object.keys(relatedKindConfig) as RelatedKind[]).find((kind) => relatedItems(relevantItems, kind).length) ?? "KNOWLEDGE";
  const [activeRelated, setActiveRelated] = useState<RelatedKind>(firstRelatedKind);

  return (
    <>
      <section className="reference-hero">
        <div>
          <p className="eyebrow">{typeLabels[item.contentType] ?? "六爻知识"}</p>
          <h1>{item.title}</h1>
          <p className="reference-definition">{item.summary}</p>
          <div className="reference-meta"><span>{difficultyLabels[item.difficulty ?? ""] ?? "通用"}</span><span>六爻基础</span></div>
        </div>
        <ZoomableImage alt={`${item.title}知识图解`} className="reference-hero-visual" src={editorialVisualFor(item)} />
      </section>

      {professionalDefinition || practicalMeaning || whenUserSeesIt ? (
        <section className="reference-usage">
          {professionalDefinition ? <div><p className="eyebrow">准确理解</p><p>{professionalDefinition}</p></div> : null}
          {practicalMeaning ? <div><p className="eyebrow">对你有什么用</p><p>{practicalMeaning}</p></div> : null}
          {whenUserSeesIt ? <div><p className="eyebrow">会在哪里看到</p><p>{whenUserSeesIt}</p></div> : null}
        </section>
      ) : null}

      {examples.length || sections.length ? (
        <div className="reference-reading-layout">
          <aside className="reference-toc">
            <strong>快速理解</strong>
            <nav aria-label="知识内容目录">
              {examples.length ? <a href="#reference-example">看一个例子</a> : null}
              {sections.map((section, index) => <a href={`#reference-section-${index + 1}`} key={`${section.heading}-${index}`}>{section.heading}</a>)}
              {misunderstandings.length ? <a href="#reference-misunderstandings">避开常见误区</a> : null}
            </nav>
          </aside>
          <article className="reference-flow">
            {examples.length ? <section id="reference-example"><p className="article-section-label">放到报告里理解</p><h2>看一个具体例子</h2>{examples.map((example) => <p key={example}>{example}</p>)}</section> : null}
            {sections.map((section, index) => <section id={`reference-section-${index + 1}`} key={`${section.heading}-${index}`}><p className="article-section-label">继续理解</p>{section.heading ? <h2>{section.heading}</h2> : null}<ArticleSectionBody section={section} /></section>)}
            {misunderstandings.length ? <section className="reference-misunderstandings" id="reference-misunderstandings"><p className="article-section-label">避免误读</p><h2>容易混淆的地方</h2><ul>{misunderstandings.map((text) => <li key={text}>{text}</li>)}</ul></section> : null}
            {boundary ? <aside className="reference-boundary"><strong>使用边界</strong><p>{boundary}</p></aside> : null}
          </article>
        </div>
      ) : null}

      <ArticleRelatedContent active={activeRelated} items={relevantItems} onSelect={setActiveRelated} title={item.contentType === "GLOSSARY" && activeRelated === "KNOWLEDGE" ? `和“${item.title}”一起理解的概念` : undefined} />
      <a className="reference-back-link" href="/content">返回知识中心 <ArrowRight aria-hidden="true" size={16} /></a>
    </>
  );
}

function FaqContent({ item, related }: { item: ContentDetail; related: ContentSummary[] }) {
  const question = stringValue(item.body, "question") || item.title;
  const shortAnswer = stringValue(item.body, "shortAnswer") || item.summary;
  const fullAnswer = stringValue(item.body, "fullAnswer");
  const answerParagraphs = stringList(item.body, "answerParagraphs");
  const queryVariants = stringList(item.body, "queryVariants").filter((variant) => variant !== question);
  const limitations = publicLimitations(item.knownLimitations);
  const firstRelatedKind = (Object.keys(relatedKindConfig) as RelatedKind[]).find((kind) => relatedItems(related, kind).length) ?? "KNOWLEDGE";
  const [activeRelated, setActiveRelated] = useState<RelatedKind>(firstRelatedKind);

  return (
    <>
      <section className="faq-detail-hero">
        <p className="eyebrow">常见问答</p>
        <h1>{question}</h1>
        <div className="faq-short-answer"><span>简短回答</span><p>{shortAnswer}</p></div>
      </section>
      {fullAnswer ? <section className="faq-full-answer">
        <div className="faq-answer-heading"><p className="eyebrow">展开理解</p><h2>为什么这样回答</h2></div>
        <div className="faq-answer-copy">{(answerParagraphs.length ? answerParagraphs : [fullAnswer]).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
      </section> : null}
      {queryVariants.length ? <section className="faq-query-variants"><strong>你也可能这样问</strong><div>{queryVariants.map((variant) => <span key={variant}>{variant}</span>)}</div></section> : null}
      {limitations.length ? <aside className="faq-boundary"><strong>使用提醒</strong>{limitations.map((text) => <p key={text}>{text}</p>)}</aside> : null}
      <ArticleRelatedContent active={activeRelated} items={related} onSelect={setActiveRelated} />
      <a className="reference-back-link" href="/content">返回知识中心 <ArrowRight aria-hidden="true" size={16} /></a>
    </>
  );
}

function TopicContent({ item, related }: { item: ContentDetail; related: ContentSummary[] }) {
  const questions = stringList(item.body, "primaryUserQuestions");
  const profile = topicProfileFor(item.contentId);
  const displayName = (profile?.name ?? stringValue(item.body, "displayName")) || item.title;
  const examples = profile?.examples ?? [
    `未来三个月，${displayName}最需要优先观察什么？`,
    `当前推进${displayName}的主要支持与阻碍分别是什么？`,
    "下一步应该先验证什么，再决定是否继续投入？",
  ];
  const lenses = profile?.lenses ?? [
    { title: "当前状态", detail: "先看与问题直接相关的人和条件。" },
    { title: "支持与阻碍", detail: "区分可以利用和需要处理的因素。" },
    { title: "变化信号", detail: "观察局面正在推进、停滞还是转向。" },
    { title: "下一步", detail: "把判断转成可以验证和复盘的行动。" },
  ];

  return (
    <>
      <section className="topic-detail-hero">
        <div>
          <p className="eyebrow">现实问题专题</p>
          <h1>{displayName}</h1>
          <p>{profile?.intro ?? item.summary}</p>
          <span className="content-publication-note">{publicationLabel(item.reviewStatus)}</span>
          <div className="hero-actions">
            <a className="primary-link" href={scenarioHref(item)}>带着问题开始分析</a>
            <a className="secondary-link" href="#topic-guides">先看看怎么问</a>
          </div>
        </div>
        <img src={editorialVisualFor(item)} alt={profile?.visualAlt ?? ""} />
      </section>

      <section className="topic-needs" id="topic-guides">
        <div>
          <p className="eyebrow">你可能正在想</p>
          <h2>这个专题从这些现实问题开始</h2>
        </div>
        <div className="topic-question-grid">
          {(questions.length ? questions : examples).map((question) => <p key={question}>{question}</p>)}
        </div>
      </section>

      <section className="topic-method">
        <div>
          <p className="eyebrow">问题怎样被梳理</p>
          <h2>先看什么，再怎样落到下一步</h2>
        </div>
        <div className="topic-method-grid">
          {lenses.map((lens, index) => (
            <div key={lens.title}><em>{String(index + 1).padStart(2, "0")}</em><strong>{lens.title}</strong><span>{lens.detail}</span></div>
          ))}
        </div>
      </section>

      <section className="topic-examples">
        <div>
          <p className="eyebrow">提问示例</p>
          <h2>先聚焦此刻最想确认的一件事</h2>
        </div>
        <div className="topic-example-list">
          {examples.map((example) => <p key={example}>{example}</p>)}
        </div>
        <a className="primary-link" href={scenarioHref(item)}>使用这个场景起卦</a>
      </section>

      <RelatedContent items={related} />
    </>
  );
}

function LearningPathContent({ item, related }: { item: ContentDetail; related: ContentSummary[] }) {
  const groups = [
    { key: "use", step: "01", title: "先知道怎么使用", detail: "适用问题、提问方法与可信边界。", ids: ["B01-A01", "B01-A02", "B01-A10"] },
    { key: "chart", step: "02", title: "理解起卦与盘面", detail: "阴阳动静、本卦变卦与排盘结构。", ids: ["B02-A01", "B02-A02"] },
    { key: "roles", step: "03", title: "看懂角色与关系", detail: "用神、六亲、世应与关系结构。", ids: ["B03-A01"] },
    { key: "timing", step: "04", title: "判断力量与时间", detail: "旺衰、动变、冲突与时间提示。", ids: ["B04-A01", "B04-A20"] },
    { key: "real", step: "05", title: "进入现实问题", detail: "按感情、事业、合作、财务等任务进入专题。", ids: ["RELATIONSHIP", "CAREER_WORK", "BUSINESS_PARTNERSHIP", "FINANCE_PROJECT", "EXAM_JOB_SEARCH", "TRAVEL_PLANNING"] },
    { key: "report", step: "06", title: "练习阅读报告", detail: "从总体判断进入支持、阻碍、时间和专业依据。", ids: ["B01-A14", "B01-A06", "B04-A20", "B01-A13"] },
  ];
  const byId = new Map(related.map((entry) => [entry.contentId, entry]));

  return (
    <>
      <section className="learning-path-hero">
        <div>
          <p className="eyebrow">六爻学习路径</p>
          <h1>从第一次提问，到读懂自己的报告</h1>
          <p>按六个阶段逐步建立理解；不需要先学完所有术语，也不用在完整内容库里挑选。</p>
          <div className="hero-actions">
            <a className="primary-link" href="#learning-path-steps">从第一步开始</a>
            <a className="secondary-link" href="/#liuyao-workbench">先完成一次起卦</a>
          </div>
        </div>
        <img src={editorialVisualFor(item)} alt="" aria-hidden="true" />
      </section>
      <section className="learning-path-steps" id="learning-path-steps">
        {groups.map((group) => {
          const entries = group.ids.map((id) => byId.get(id)).filter((entry): entry is ContentSummary => Boolean(entry));
          return (
            <section key={group.key}>
              <header>
                <span>{group.step}</span>
                <div><h2>{group.title}</h2><p>{group.detail}</p></div>
              </header>
              <div className="learning-step-links">
                {entries.slice(0, 6).map((entry) => (
                  <a href={contentHref(entry)} key={entry.contentId}>
                    <strong>{entry.title}</strong>
                    <small>{entry.summary}</small>
                  </a>
                ))}
              </div>
            </section>
          );
        })}
      </section>
      <section className="learning-path-cta">
        <p className="eyebrow">边用边学</p>
        <h2>完成一次六爻分析，再回到报告中的具体术语</h2>
        <p>不需要先学完全部理论。先带着真实问题体验完整流程，学习会更有上下文。</p>
        <a className="primary-link" href="/#liuyao-workbench">开始六爻分析</a>
      </section>
    </>
  );
}

function ContentBreadcrumb({ item }: { item: ContentDetail }) {
  const displayTitle = item.contentType === "LANDING_PAGE" ? topicProfileFor(item.contentId)?.name ?? item.title : item.title;
  return (
    <nav aria-label="当前位置" className="content-breadcrumb">
      <a href="/content">知识中心</a><span aria-hidden="true">/</span><a href={breadcrumbTypeHref(item)}>{typeLabels[item.contentType] ?? "内容"}</a><span aria-hidden="true">/</span><strong>{displayTitle}</strong>
    </nav>
  );
}

function ContentSequence({ item, related }: { item: ContentDetail; related: ContentSummary[] }) {
  const previous = related.find((entry) => entry.contentId === item.previousContentId);
  const next = related.find((entry) => entry.contentId === item.nextContentId);
  if (!previous && !next) return null;
  return (
    <nav aria-label="继续学习" className="content-sequence-nav">
      {previous ? <a href={contentHref(previous)}><span>上一篇</span><strong>{previous.title}</strong></a> : <span />}
      {next ? <a href={contentHref(next)}><span>下一篇</span><strong>{next.title}</strong><ArrowRight aria-hidden="true" size={16} /></a> : <span />}
    </nav>
  );
}

export function ContentDetailClient({ type, slug }: { type: string; slug: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [item, setItem] = useState<ContentDetail | null>(null);
  const [related, setRelated] = useState<ContentSummary[]>([]);
  const apiType = useMemo(() => type.toUpperCase().replaceAll("-", "_"), [type]);
  const decodedSlug = useMemo(() => {
    try {
      return decodeURIComponent(slug);
    } catch {
      return slug;
    }
  }, [slug]);

  useEffect(() => {
    let cancelled = false;
    async function loadContent() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`${apiBase()}/content/${encodeURIComponent(apiType)}/${encodeURIComponent(decodedSlug)}`);
        if (!response.ok) throw new Error(await readError(response));
        const body = (await response.json()) as ContentDetail;
        const relatedResponse = await fetch(`${apiBase()}/content/${encodeURIComponent(body.contentId)}/related`);
        const relatedBody = relatedResponse.ok ? await relatedResponse.json() as { items?: ContentSummary[] } : {};
        if (!cancelled) {
          setItem(body);
          setRelated(relatedBody.items ?? []);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "暂时无法读取内容");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadContent();
    return () => {
      cancelled = true;
    };
  }, [apiType, decodedSlug]);

  return (
    <main className="shell">
      <AppNav current="content" />
      <ContentSectionNav current="detail" />

      {loading ? <p className="empty">正在读取内容。</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {item ? <ContentBreadcrumb item={item} /> : null}

      {item?.contentType === "LANDING_PAGE" ? <TopicContent item={item} related={related} /> : item?.contentType === "LEARNING_PATH" ? (
        <LearningPathContent item={item} related={related} />
      ) : item && ["GLOSSARY", "KNOWLEDGE", "TRIGRAM", "HEXAGRAM"].includes(item.contentType) ? (
        <ReferenceContent item={item} related={related} />
      ) : item?.contentType === "FAQ" ? (
        <FaqContent item={item} related={related} />
      ) : item ? <ArticleContent item={item} related={related} /> : null}
      {item ? <ContentSequence item={item} related={related} /> : null}
    </main>
  );
}
