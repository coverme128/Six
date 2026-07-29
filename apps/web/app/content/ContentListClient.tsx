"use client";

import { useEffect, useState } from "react";
import { apiBase, readError, type ContentSummary } from "../lib/api";

export function ContentListClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState<ContentSummary[]>([]);
  const [query, setQuery] = useState("");

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

  return (
    <main className="shell">
      <nav className="top-nav">
        <a href="/">起卦</a>
        <a href="/history">历史</a>
        <a href="/content">内容</a>
        <a href="/settings">设置</a>
      </nav>

      <section className="hero compact">
        <p className="eyebrow">Content Framework</p>
        <h1>内容与知识</h1>
        <p>读取 Nest API 内容框架和知识种子，用于报告后的继续学习。</p>
      </section>

      <form
        className="search-bar"
        onSubmit={(event) => {
          event.preventDefault();
          loadContent(query);
        }}
      >
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索内容、卦象、术语" />
        <button type="submit">搜索</button>
      </form>

      {loading ? <p className="empty">正在读取内容。</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <section className="history-list">
        {items.slice(0, 60).map((item) => (
          <a
            className="history-item"
            href={`/content/${item.contentType.toLowerCase().replaceAll("_", "-")}/${encodeURIComponent(item.slug)}`}
            key={item.contentId}
          >
            <span>{item.contentType} / {item.domain ?? "iching"}</span>
            <strong>{item.title}</strong>
            <small>{item.summary}</small>
          </a>
        ))}
      </section>
    </main>
  );
}
