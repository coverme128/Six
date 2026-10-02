"use client";

import { useEffect, useMemo, useState } from "react";
import { AppNav } from "../AppNav";
import { apiBase, readError, type ReportSummary } from "../lib/api";
import { workspaceFetch } from "../lib/workspace";

export function HistoryClient() {
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState("");
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [query, setQuery] = useState("");
  const [ownerId, setOwnerId] = useState("");

  async function loadReports() {
    setLoading(true);
    setError("");
    try {
      const response = await workspaceFetch(`${apiBase()}/reports?limit=50`);
      if (!response.ok) throw new Error(await readError(response));
      const body = (await response.json()) as { items?: ReportSummary[]; ownerId?: string };
      setReports(body.items ?? []);
      setOwnerId(body.ownerId ?? "");
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
    if (!window.confirm("删除这份报告？删除后无法恢复，其他报告不受影响。")) return;
    setMutating(true);
    setError("");
    try {
      const response = await workspaceFetch(`${apiBase()}/reports/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await readError(response));
      setReports((items) => items.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "暂时无法删除报告");
    } finally {
      setMutating(false);
    }
  }

  async function clearReports() {
    if (!window.confirm("清空当前浏览器名下的全部报告？此操作无法撤销。")) return;
    setMutating(true);
    setError("");
    try {
      const response = await workspaceFetch(`${apiBase()}/reports`, { method: "DELETE" });
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
        <h1>我的报告</h1>
        <p>报告属于当前浏览器的匿名身份。清除本站数据或更换浏览器后，将无法访问这些记录，请及时下载需要保留的报告。</p>
        {ownerId ? <details><summary>迁移旧报告</summary><p>旧版未归属的报告仍在数据库中，需要管理员确认归属后迁入。本浏览器的归属编号：</p><code style={{ overflowWrap: "anywhere" }}>{ownerId}</code></details> : null}
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
        <p className="section-kicker">只显示你的最近 50 份报告。删除仅影响当前匿名身份的记录。</p>
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
                {new Date(report.createdAt).toLocaleString("zh-CN")}{report.persistence !== "prisma" ? " · 临时保存，服务重启后可能丢失" : ""}
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
