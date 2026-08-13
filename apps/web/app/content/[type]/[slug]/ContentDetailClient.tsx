"use client";

import { useEffect, useMemo, useState } from "react";
import { AppNav } from "../../../AppNav";
import { apiBase, readError, type ContentDetail, type ContentSummary } from "../../../lib/api";

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
  if (item.contentType === "LANDING_PAGE") return "/liuyao-visual-system/editorial/final/topic-hero/ED-LY-006-topic-landing-hero-1200x675.png";
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
  const scenarioBySlug: Record<string, string> = {
    relationship: "relationship",
    "career-work": "career",
    "finance-project": "wealth",
    "business-partnership": "business",
    "exam-study-job": "study",
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
  const displayName = stringValue(item.body, "displayName") || item.title;
  const isRelationship = item.slug === "relationship";
  const examples = isRelationship
    ? [
        "未来三个月，这段关系适合继续推进还是先观察？",
        "双方当前投入是否平衡，主要互动阻力在哪里？",
        "经过最近的矛盾后，这段关系还有哪些修复条件？",
      ]
    : [
        `未来三个月，${displayName}最需要优先观察什么？`,
        `当前推进${displayName}的主要支持与阻碍分别是什么？`,
        `下一步应该先验证什么，再决定是否继续投入？`,
      ];

  return (
    <>
      <section className="topic-detail-hero">
        <div>
          <p className="eyebrow">现实问题专题</p>
          <h1>{item.title}</h1>
          <p>{item.summary}</p>
          <span className="content-publication-note">{publicationLabel(item.reviewStatus)}</span>
          <div className="hero-actions">
            <a className="primary-link" href={scenarioHref(item)}>带着问题开始分析</a>
            <a className="secondary-link" href="#topic-guides">先看看怎么问</a>
          </div>
        </div>
        <img src={editorialVisualFor(item)} alt="" aria-hidden="true" />
      </section>

      <section className="topic-needs" id="topic-guides">
        <div>
          <p className="eyebrow">你可能正在想</p>
          <h2>先把模糊担忧变成可分析的问题</h2>
        </div>
        <div className="topic-question-grid">
          {(questions.length ? questions : examples).map((question) => <p key={question}>{question}</p>)}
        </div>
      </section>

      <section className="topic-method">
        <div>
          <p className="eyebrow">六爻怎样帮助你</p>
          <h2>不是替你做决定，而是整理当前结构</h2>
        </div>
        <div className="topic-method-grid">
          <div><strong>看双方状态</strong><span>区分自己的承受力、主动性与对方回应。</span></div>
          <div><strong>看支持与阻碍</strong><span>找到当前互动中可以利用和需要处理的条件。</span></div>
          <div><strong>看变化信号</strong><span>判断局面是在推进、拉扯、停滞还是等待转折。</span></div>
          <div><strong>形成下一步</strong><span>把结论变成可以沟通、验证和复盘的现实动作。</span></div>
        </div>
      </section>

      <section className="topic-examples">
        <div>
          <p className="eyebrow">提问示例</p>
          <h2>一个报告只处理一个具体问题</h2>
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
    { key: "startHere", step: "01", title: "第一次接触六爻", detail: "先建立适用边界，再学会提出一个清楚的问题。" },
    { key: "coreConcepts", step: "02", title: "理解盘面核心结构", detail: "认识起卦、用神、力量与动变分别回答什么。" },
    { key: "understandYourReport", step: "03", title: "读懂自己的报告", detail: "从总体方向进入支持、阻碍、时间和专业依据。" },
    { key: "realWorldDecisions", step: "04", title: "进入现实问题专题", detail: "按感情、事业、合作、财务等任务选择最短路径。" },
    { key: "howSystemWorks", step: "05", title: "核验系统如何工作", detail: "理解确定性排盘、规则事实和 AI 解释之间的边界。" },
  ];
  const byId = new Map(related.map((entry) => [entry.contentId, entry]));

  return (
    <>
      <section className="learning-path-hero">
        <div>
          <p className="eyebrow">六爻学习路径</p>
          <h1>{item.title}</h1>
          <p>{item.summary}</p>
          <div className="hero-actions">
            <a className="primary-link" href="#learning-path-steps">从第一步开始</a>
            <a className="secondary-link" href="/#liuyao-workbench">先完成一次起卦</a>
          </div>
        </div>
        <img src={editorialVisualFor(item)} alt="" aria-hidden="true" />
      </section>
      <section className="learning-path-steps" id="learning-path-steps">
        {groups.map((group) => {
          const entries = stringList(item.body, group.key).map((id) => byId.get(id)).filter((entry): entry is ContentSummary => Boolean(entry));
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
