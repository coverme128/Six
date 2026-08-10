"use client";

import { useEffect, useMemo, useState } from "react";
import { AppNav } from "../../../AppNav";
import { apiBase, readError, type ContentDetail } from "../../../lib/api";

function readableValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(readableValue).filter(Boolean).join("、");
  if (value && typeof value === "object") return Object.values(value).map(readableValue).filter(Boolean).join("；");
  return String(value ?? "");
}

function bodyEntries(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return [];
  return Object.entries(body as Record<string, unknown>)
    .filter(([key]) => !["sections", "keyTakeaways", "productIntegration"].includes(key))
    .filter(([, value]) => readableValue(value).trim());
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

function visualRefs(body: unknown) {
  const integration = bodyRecord(bodyRecord(body).productIntegration);
  const refs = integration.visual_asset_refs;
  return Array.isArray(refs) ? refs.filter((item): item is string => typeof item === "string") : [];
}

export function ContentDetailClient({ type, slug }: { type: string; slug: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [item, setItem] = useState<ContentDetail | null>(null);
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
        if (!cancelled) setItem(body);
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

      <section className="hero compact">
        <p className="eyebrow">{item?.contentType ?? apiType}</p>
        <h1>{item?.title ?? "内容详情"}</h1>
        <p>{item?.summary ?? slug}</p>
      </section>

      {loading ? <p className="empty">正在读取内容。</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {item ? (
        <section className="panel report-section">
          <div className="fact-strip">
            <span>{item.domain}</span>
            <span>{item.category}</span>
            <span>{item.difficulty}</span>
            <span>{item.reviewStatus}</span>
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
            {bodyEntries(item.body).length ? (
              <dl>
                {bodyEntries(item.body).map(([key, value]) => (
                  <div key={key}>
                    <dt>{key.replaceAll("_", " ")}</dt>
                    <dd>{readableValue(value)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="empty">正式正文尚未发布。当前内容可作为术语定位，深入判断仍以报告依据为准。</p>
            )}
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
          {item.tags?.length ? (
            <div className="chips report-section">
              {item.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
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
      ) : null}
    </main>
  );
}
