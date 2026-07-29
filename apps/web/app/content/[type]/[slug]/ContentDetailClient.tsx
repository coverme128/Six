"use client";

import { useEffect, useMemo, useState } from "react";
import { apiBase, readError, type ContentDetail } from "../../../lib/api";

function renderBody(body: unknown) {
  if (!body || (typeof body === "object" && Object.keys(body).length === 0)) return "暂无正文结构。";
  if (typeof body === "string") return body;
  return JSON.stringify(body, null, 2);
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
      <nav className="top-nav">
        <a href="/">起卦</a>
        <a href="/history">历史</a>
        <a href="/content">内容</a>
        <a href="/settings">设置</a>
      </nav>

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
          <pre className="content-body">{renderBody(item.body)}</pre>
          {item.knownLimitations?.length ? (
            <div className="preview-grid">
              <div>
                <strong>边界说明</strong>
                {item.knownLimitations.map((text) => (
                  <p key={text}>{text}</p>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
