"use client";

import { useEffect, useMemo, useState } from "react";
import { AppNav } from "../../../AppNav";
import { apiBase, readError, type ContentDetail, type ContentSummary } from "../../../lib/api";
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
  return Array.isArray(sections) ? sections as Array<{ heading?: string; body?: string }> : [];
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

function editorialVisualFor(item: ContentDetail) {
  if (item.contentType === "LANDING_PAGE") return topicProfileFor(item.contentId)?.visual ?? "/liuyao-visual-system/editorial/final/topic-hero/ED-LY-006-topic-landing-hero-1200x675.png";
  if (item.contentType === "LEARNING_PATH") return "/liuyao-visual-system/editorial/final/lesson-cover/ED-LY-004-learn-lesson-cover-1080x1350.png";
  if (item.contentType === "TUTORIAL") return item.contentId.startsWith("B05-")
    ? "/liuyao-visual-system/editorial/final/case-cover/ED-LY-003-teaching-case-cover-1200x900.png"
    : "/liuyao-visual-system/editorial/final/article-hero/ED-LY-001-article-hero-1200x675.png";
  if (item.contentType === "FAQ") return "/liuyao-visual-system/editorial/final/inline/ED-LY-010-trust-system-illustration-1200x630.svg";
  if (item.contentType === "HEXAGRAM" || item.contentType === "TRIGRAM") return "/liuyao-visual-system/editorial/final/cultural-scene/ED-LY-008-historical-cultural-scene-1200x800.png";
  return "/liuyao-visual-system/editorial/final/inline/ED-LY-002-concept-explainer-1200x630.svg";
}

function contentHref(item: ContentSummary) {
  return `/content/${item.contentType.toLowerCase().replaceAll("_", "-")}/${encodeURIComponent(item.slug)}`;
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

export function ContentDetailClient({ type, slug }: { type: string; slug: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [item, setItem] = useState<ContentDetail | null>(null);
  const [related, setRelated] = useState<ContentSummary[]>([]);
  const apiType = useMemo(() => type.toUpperCase().replaceAll("-", "_"), [type]);

  useEffect(() => {
    let cancelled = false;
    async function loadContent() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`${apiBase()}/content/${encodeURIComponent(apiType)}/${encodeURIComponent(slug)}`);
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
  }, [apiType, slug]);

  return (
    <main className="shell">
      <AppNav current="content" />

      {loading ? <p className="empty">正在读取内容。</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {item?.contentType === "LANDING_PAGE" ? <TopicContent item={item} related={related} /> : item?.contentType === "LEARNING_PATH" ? (
        <LearningPathContent item={item} related={related} />
      ) : item ? (
        <>
        <section className="hero compact">
          <p className="eyebrow">{typeLabels[item.contentType] ?? "六爻知识"}</p>
          <h1>{item.title}</h1>
          <p>{stringValue(item.body, "subtitle") || item.summary}</p>
        </section>
        <section className="panel report-section">
          <div className="content-detail-visual">
            <img src={editorialVisualFor(item)} alt="" aria-hidden="true" />
          </div>
          <div className="fact-strip">
            <span>{typeLabels[item.contentType] ?? "六爻知识"}</span>
            <span>{difficultyLabels[item.difficulty ?? ""] ?? "通用"}</span>
            <span>{publicationLabel(item.reviewStatus)}</span>
          </div>
          <article className="content-article">
            <h2>{item.title}</h2>
            <p>{item.summary || "该条目正在整理正式正文，当前先保留结构化摘要与边界说明。"}</p>
            {keyTakeaways(item.body).length ? (
              <div className="fact-strip">
                {keyTakeaways(item.body).slice(0, 4).map((text) => (
                  <span key={text}>{text}</span>
                ))}
              </div>
            ) : null}
            {visualRefs(item.body).length ? (
              <div className="content-visuals">
                {visualRefs(item.body).slice(0, 2).map((ref) => (
                  <img alt={`${item.title} 图示`} key={ref} src={`/content-growth/visuals/${ref}.svg`} />
                ))}
              </div>
            ) : null}
            {typeof item.body === "string" && item.body.trim() ? <p>{item.body}</p> : null}
            {contentSections(item.body).length ? (
              <div className="article-sections">
                {contentSections(item.body).map((section, index) => (
                  <section key={`${section.heading}-${index}`}>
                    {section.heading ? <h3>{section.heading}</h3> : null}
                    {(section.body ?? "").split("\n\n").filter(Boolean).map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </section>
                ))}
              </div>
            ) : null}
            {practicalFramework(item.body) ? (
              <aside className="article-framework">
                <strong>{practicalFramework(item.body)?.name}</strong>
                <p>{practicalFramework(item.body)?.content}</p>
              </aside>
            ) : null}
            {stringList(item.body, "commonMisunderstandings").length ? (
              <section className="article-misunderstandings">
                <h3>常见误区</h3>
                <ul>{stringList(item.body, "commonMisunderstandings").map((text) => <li key={text}>{text}</li>)}</ul>
              </section>
            ) : null}
          </article>
          {item.knownLimitations?.length ? (
            <details className="evidence-details">
              <summary>边界说明</summary>
              <div>
                {item.knownLimitations.map((text) => (
                  <p key={text}>{text}</p>
                ))}
              </div>
            </details>
          ) : null}
          <div className="inline-actions">
            <a className="primary-link" href="/">
              开始起卦
            </a>
            <a className="text-link" href="/content">
              返回内容
            </a>
          </div>
        </section>
        <RelatedContent items={related} />
        </>
      ) : null}
    </main>
  );
}
