"use client";

import { useEffect, useMemo, useState } from "react";
import { apiBase, readError, type ExperienceResponse } from "../../lib/api";

export function ReportDetailClient({ reportId }: { reportId: string }) {
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState("");
  const [aiStatus, setAiStatus] = useState("");
  const [report, setReport] = useState<ExperienceResponse | null>(null);
  const guided = report?.experience?.guidedViewModel;
  const professional = report?.experience?.professionalViewModel;
  const aiReport = report?.aiReportBundle?.aiReport;
  const supports = useMemo(() => professional?.evidenceGroups?.supports ?? [], [professional]);
  const risks = useMemo(() => professional?.evidenceGroups?.risks ?? [], [professional]);
  const otherEvidence = useMemo(() => professional?.evidenceGroups?.other ?? [], [professional]);

  useEffect(() => {
    let cancelled = false;
    async function loadReport() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`${apiBase()}/reports/${encodeURIComponent(reportId)}/experience`);
        if (!response.ok) throw new Error(await readError(response));
        const body = (await response.json()) as ExperienceResponse;
        if (!cancelled) setReport(body);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "暂时无法读取报告");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadReport();
    return () => {
      cancelled = true;
    };
  }, [reportId]);

  async function generateAIReport() {
    setAiLoading(true);
    setAiStatus("");
    setError("");
    try {
      const response = await fetch(`${apiBase()}/reports/${encodeURIComponent(reportId)}/ai`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ language: "zh-CN", deviceId: "anonymous-web" })
      });
      if (!response.ok) throw new Error(await readError(response));
      const body = (await response.json()) as {
        reportId: string;
        reportType: ExperienceResponse["type"];
        persistence?: string;
        aiReportBundle?: ExperienceResponse["aiReportBundle"];
        experience?: ExperienceResponse["experience"];
      };
      setReport({
        id: body.reportId,
        type: body.reportType,
        persistence: body.persistence,
        aiReportBundle: body.aiReportBundle,
        experience: body.experience
      });
      setAiStatus(body.aiReportBundle?.fallbackUsed ? "已生成基础增强解读。" : "AI 解读已生成。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "暂时无法生成 AI 解读");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <main className="shell" data-testid="report-page">
      <nav className="top-nav">
        <a href="/">起卦</a>
        <a href="/history">历史</a>
        <a href="/content">内容</a>
        <a href="/settings">设置</a>
      </nav>

      <section className="hero compact">
        <p className="eyebrow">{report?.type === "meihua" ? "梅花" : "六爻"}报告</p>
        <h1>{guided?.headline ?? "报告详情"}</h1>
        <p>{guided?.summary ?? reportId}</p>
      </section>

      {loading ? <p className="empty">正在读取报告。</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {guided ? (
        <section className="panel report-section">
          <h2>一句话结论</h2>
          <div className="preview-grid">
            <div>
              <h3>当前局势</h3>
              <p>{guided.currentSituation}</p>
            </div>
            <div>
              <h3>变化方向</h3>
              <p>{guided.changeDirection}</p>
            </div>
            <div>
              <h3>时间提示</h3>
              <p>{guided.timingHint}</p>
            </div>
          </div>
          <div className="preview-grid">
            <div>
              <h3>主要支持</h3>
              {(guided.mainSupports ?? []).map((item, index) => (
                <p key={`${item.title}-${index}`}>{item.text ?? item.title}</p>
              ))}
            </div>
            <div>
              <h3>主要阻碍</h3>
              {(guided.mainRisks ?? []).map((item, index) => (
                <p key={`${item.title}-${index}`}>{item.text ?? item.title}</p>
              ))}
            </div>
            <div>
              <h3>下一步</h3>
              {(guided.recommendedActions ?? []).map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          </div>
          <div className="inline-actions">
            <a className="primary-link" href="#professional-evidence">
              查看依据
            </a>
            <button type="button" onClick={generateAIReport} disabled={aiLoading}>
              {aiLoading ? "生成中" : report?.aiReportBundle ? "重新生成 AI 解读" : "生成 AI 解读"}
            </button>
            <a className="primary-link" href={`${apiBase()}/reports/${encodeURIComponent(reportId)}/export`}>
              导出 JSON
            </a>
          </div>
          {aiStatus ? <p className="empty">{aiStatus}</p> : null}
        </section>
      ) : null}

      {report?.aiReportBundle ? (
        <section className="panel report-section">
          <h2>AI 增强解读</h2>
          <div className="fact-strip">
            <span>{report.aiReportBundle.reportSource}</span>
            <span>{report.aiReportBundle.validationStatus}</span>
            {report.aiReportBundle.fallbackUsed ? <span>fallback</span> : null}
          </div>
          <div className="preview-grid">
            <div>
              <h3>摘要</h3>
              <p>{aiReport?.summary ?? "已使用确定性报告作为兜底。"}</p>
            </div>
            <div>
              <h3>变化方向</h3>
              <p>{aiReport?.changeDirection ?? guided?.changeDirection}</p>
            </div>
            <div>
              <h3>行动建议</h3>
              {(aiReport?.actionSuggestions ?? guided?.recommendedActions ?? []).map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {professional ? (
        <section className="panel report-section" id="professional-evidence">
          <h2>专业依据</h2>
          <div className="fact-strip">
            <span>{professional.method}</span>
            <span>{professional.chartSummary?.title}</span>
            {professional.chartSummary?.movingLines?.length ? (
              <span>动爻 {professional.chartSummary.movingLines.join(", ")}</span>
            ) : null}
          </div>
          <div className="preview-grid">
            <div>
              <h3>支持证据</h3>
              {supports.map((item, index) => (
                <p key={`${item.title}-${index}`}>{item.text ?? item.title}</p>
              ))}
            </div>
            <div>
              <h3>风险证据</h3>
              {risks.map((item, index) => (
                <p key={`${item.title}-${index}`}>{item.text ?? item.title}</p>
              ))}
            </div>
            <div>
              <h3>其他依据</h3>
              {otherEvidence.map((item, index) => (
                <p key={`${item.title}-${index}`}>{item.text ?? item.title}</p>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
