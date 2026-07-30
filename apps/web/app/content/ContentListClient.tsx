"use client";

import { useEffect, useState } from "react";
import { AppNav } from "../AppNav";
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
      <AppNav current="content" />

      <section className="hero compact">
        <p className="eyebrow">Knowledge</p>
        <h1>内容与知识</h1>
        <p>内容用于解释报告中的术语、规则和边界。它不是主任务入口，而是帮助你在需要时继续验证和学习。</p>
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
      {!loading && !error && items.length === 0 ? <p className="empty">暂未找到相关内容。可以换一个术语或返回报告查看依据。</p> : null}
    </main>
  );
}
