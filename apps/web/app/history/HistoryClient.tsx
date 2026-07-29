"use client";

import { useEffect, useState } from "react";
import { apiBase, readError, type ReportSummary } from "../lib/api";

export function HistoryClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reports, setReports] = useState<ReportSummary[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function loadReports() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`${apiBase()}/reports?limit=30`);
        if (!response.ok) throw new Error(await readError(response));
        const body = (await response.json()) as { items?: ReportSummary[] };
        if (!cancelled) setReports(body.items ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "暂时无法读取历史");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadReports();
    return () => {
      cancelled = true;
    };
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
        <p className="eyebrow">Report Store</p>
        <h1>报告历史</h1>
        <p>这里读取 Nest API 当前 report store 中的报告摘要。</p>
      </section>

      {loading ? <p className="empty">正在读取历史。</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <section className="history-list">
        {reports.map((report) => (
          <a className="history-item" href={`/reports/${encodeURIComponent(report.id)}`} key={report.id}>
            <span>{report.type === "meihua" ? "梅花" : "六爻"}</span>
            <strong>{report.question || "未命名问题"}</strong>
            <small>
              {new Date(report.createdAt).toLocaleString("zh-CN")} / {report.persistence ?? "memory"}
            </small>
          </a>
        ))}
      </section>

      {!loading && !error && reports.length === 0 ? (
        <p className="empty">当前 API store 暂无报告。先返回首页生成一条。</p>
      ) : null}
    </main>
  );
}
