"use client";

import { useEffect, useMemo, useState } from "react";
import { AppNav } from "../AppNav";
import { apiBase, readError, type ReportSummary } from "../lib/api";

export function HistoryClient() {
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState("");
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [query, setQuery] = useState("");

  async function loadReports() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${apiBase()}/reports?limit=50`);
      if (!response.ok) throw new Error(await readError(response));
      const body = (await response.json()) as { items?: ReportSummary[] };
      setReports(body.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "暂时无法读取历史");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
  }, []);

  const filteredReports = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return reports.filter((report) => report.type === "liuyao" && (
      !normalized || report.question.toLowerCase().includes(normalized) || report.id.toLowerCase().includes(normalized)
    ));
  }, [query, reports]);

  async function deleteReport(id: string) {
    setMutating(true);
    setError("");
    try {
      const response = await fetch(`${apiBase()}/reports/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await readError(response));
      setReports((items) => items.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "暂时无法删除报告");
    } finally {
      setMutating(false);
    }
  }

  async function clearReports() {
    setMutating(true);
    setError("");
    try {
      const response = await fetch(`${apiBase()}/reports`, { method: "DELETE" });
      if (!response.ok) throw new Error(await readError(response));
      setReports([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "暂时无法清空历史");
    } finally {
      setMutating(false);
    }
  }

  return (
    <main className="shell">
      <AppNav current="history" />

      <section className="hero compact">
        <p className="eyebrow">Anonymous Workspace</p>
        <h1>报告历史</h1>
        <p>匿名使用期间，这里保留当前环境可读取的报告摘要。你可以打开旧报告、继续查看依据，或删除不再需要的记录。</p>
      </section>

      <section className="panel">
        <div className="history-toolbar">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索问题或报告编号" />
          <button type="button" className="secondary" onClick={loadReports} disabled={loading || mutating}>
            刷新
          </button>
          <button type="button" className="secondary" onClick={clearReports} disabled={loading || mutating || reports.length === 0}>
            清空历史
          </button>
        </div>
        <p className="section-kicker">清空或删除只影响当前报告存储，不会改变核心知识库与规则数据。</p>
      </section>

      {loading ? <p className="empty">正在读取历史。</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <section className="history-list">
        {filteredReports.map((report) => (
          <article className="history-card" key={report.id}>
            <a className="history-item" href={`/reports/${encodeURIComponent(report.id)}`}>
              <span>六爻</span>
              <strong>{report.question || "未命名问题"}</strong>
              <small>
                {new Date(report.createdAt).toLocaleString("zh-CN")} / {report.persistence ?? "memory"}
              </small>
            </a>
            <button type="button" className="secondary" onClick={() => deleteReport(report.id)} disabled={mutating}>
              删除
            </button>
          </article>
        ))}
      </section>

      {!loading && !error && reports.length === 0 ? (
        <p className="empty">当前还没有报告。返回首页完成一次起卦后，这里会显示可继续阅读的记录。</p>
      ) : null}
      {!loading && !error && reports.length > 0 && filteredReports.length === 0 ? (
        <p className="empty">没有匹配的六爻报告。可以调整搜索词。</p>
      ) : null}
    </main>
  );
}
