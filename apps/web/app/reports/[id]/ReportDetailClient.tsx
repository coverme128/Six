"use client";

import { useEffect, useMemo, useState } from "react";
import { AppNav } from "../../AppNav";
import { apiBase, readError, type ChartViewModel, type ExperienceResponse } from "../../lib/api";

function textList(items: Array<{ title?: string; text?: string }> = []) {
  return items.map((item) => `- ${item.text ?? item.title ?? ""}`).filter((item) => item.trim() !== "-").join("\n");
}

function buildReadableMarkdown(report: ExperienceResponse) {
  const guided = report.experience?.guidedViewModel;
  const professional = report.experience?.professionalViewModel;
  const chart = report.chartViewModel;
  const lines = [
    `# ${guided?.headline ?? "六爻与梅花报告"}`,
    "",
    `报告编号：${report.id}`,
    `类型：${report.type === "meihua" ? "梅花" : "六爻"}`,
    report.createdAt ? `生成时间：${new Date(report.createdAt).toLocaleString("zh-CN")}` : "",
    "",
    "## 一句话结论",
    guided?.summary ?? "",
    "",
    "## 当前局势",
    guided?.currentSituation ?? "",
    "",
    "## 核心事项",
    guided?.coreMatter?.summary ?? "",
    "",
    "## 观察重点",
    guided?.observationFocus?.summary ?? "",
    "",
    "## 变化方向",
    guided?.changeDirection ?? "",
    "",
    "## 时间提示",
    guided?.timingHint ?? "",
    "",
    "## 主要支持",
    textList(guided?.mainSupports),
    "",
    "## 主要阻碍",
    textList(guided?.mainRisks),
    "",
    "## 下一步",
    (guided?.recommendedActions ?? []).map((item) => `- ${item}`).join("\n"),
    "",
    "## 专业盘面",
    chart?.type === "liuyao"
      ? `本卦：${chart.originalHexagram ?? ""}\n变卦：${chart.changedHexagram ?? ""}\n动爻：${chart.movingLines?.join("、") || "无"}\n世爻：${chart.worldLine ?? ""}\n应爻：${chart.responseLine ?? ""}`
      : `本卦：${chart?.originalHexagram ?? ""}\n互卦：${chart?.type === "meihua" ? chart.mutualHexagram ?? "" : ""}\n变卦：${chart?.changedHexagram ?? ""}\n体卦：${chart?.type === "meihua" ? chart.bodyTrigram ?? "" : ""}\n用卦：${chart?.type === "meihua" ? chart.useTrigram ?? "" : ""}\n体用关系：${chart?.type === "meihua" ? chart.relationship ?? "" : ""}`,
    "",
    "## 专业依据",
    "### 支持证据",
    textList(professional?.evidenceGroups?.supports),
    "",
    "### 风险证据",
    textList(professional?.evidenceGroups?.risks),
    "",
    "### 其他依据",
    textList(professional?.evidenceGroups?.other),
    "",
    "> 本报告仅供传统文化研究与个人参考，不替代医疗、法律、投资等现实专业决策。"
  ];

  return lines.filter((line) => line !== "").join("\n");
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function HexagramLine({ yinYang, moving }: { yinYang?: string; moving?: boolean }) {
  const broken = yinYang === "阴";
  return (
    <span className={moving ? "hex-line moving" : "hex-line"} aria-label={`${yinYang ?? "爻"}${moving ? "动爻" : ""}`}>
      {broken ? (
        <>
          <i />
          <i />
        </>
      ) : (
        <i />
      )}
    </span>
  );
}

function LineTags({ line }: { line: NonNullable<Extract<ChartViewModel, { type: "liuyao" }>["lines"]>[number] }) {
  const tags = [
    line.branchName ? `${line.stem ?? ""}${line.branchName}${line.elementName ? ` / ${line.elementName}` : ""}` : "",
    line.isWorld ? "世" : "",
    line.isResponse ? "应" : "",
    line.isVoid ? "空" : "",
    line.moving ? "动" : ""
  ].filter(Boolean);
  return <small>{tags.join(" / ") || "-"}</small>;
}

function ChartPanel({ chart }: { chart?: ChartViewModel }) {
  if (!chart) return null;
  if (chart.type === "meihua") {
    return (
      <section className="panel report-section">
        <h2>专业盘面</h2>
        <p className="section-kicker">梅花盘面以本卦、互卦、变卦和体用关系为核心。</p>
        <div className="hexagram-summary">
          <div>
            <span>本卦</span>
            <strong>{chart.originalHexagram}</strong>
          </div>
          <div>
            <span>互卦</span>
            <strong>{chart.mutualHexagram}</strong>
          </div>
          <div>
            <span>变卦</span>
            <strong>{chart.changedHexagram}</strong>
          </div>
        </div>
        <div className="preview-grid">
          <div>
            <h3>动爻</h3>
            <p>第 {chart.movingLine ?? "-"} 爻</p>
          </div>
          <div>
            <h3>体用</h3>
            <p>
              体卦 {chart.bodyTrigram ?? "-"}，用卦 {chart.useTrigram ?? "-"}。
            </p>
          </div>
          <div>
            <h3>关系</h3>
            <p>{chart.relationship ?? "暂无关系说明。"}</p>
          </div>
        </div>
      </section>
    );
  }

  const lines = [...(chart.lines ?? [])].sort((a, b) => Number(b.position ?? 0) - Number(a.position ?? 0));
  return (
    <section className="panel report-section">
      <h2>专业盘面</h2>
      <p className="section-kicker">六爻盘面从下往上生成，表格中按上爻到初爻阅读，动爻以朱砂色标记。</p>
      <div className="hexagram-layout">
        <div className="hexagram-figure" aria-label="六爻卦象">
          <strong>
            {chart.originalHexagram} → {chart.changedHexagram}
          </strong>
          {lines.map((line) => (
            <HexagramLine key={`figure-line-${line.position}`} yinYang={line.yinYang} moving={line.moving} />
          ))}
        </div>
        <div className="line-table">
          {lines.map((line) => (
            <div className="line-row" key={`line-row-${line.position}`}>
              <span>第 {line.position} 爻</span>
              <HexagramLine yinYang={line.yinYang} moving={line.moving} />
              <strong>
                {line.sixSpiritName ?? "-"} / {line.sixRelationName ?? "-"}
              </strong>
              <LineTags line={line} />
              <small>
                {line.monthInfluence ? `月：${line.monthInfluence}` : "月：-"}
                {line.dayInfluence ? ` / 日：${line.dayInfluence}` : ""}
                {line.moving && line.changed?.returnInfluenceName ? ` / ${line.changed.returnInfluenceName}` : ""}
              </small>
            </div>
          ))}
        </div>
      </div>
      <div className="fact-strip">
        <span>本卦 {chart.originalHexagram}</span>
        <span>变卦 {chart.changedHexagram}</span>
        <span>动爻 {chart.movingLines?.length ? chart.movingLines.join("、") : "无"}</span>
        <span>世 {chart.worldLine ?? "-"}</span>
        <span>应 {chart.responseLine ?? "-"}</span>
      </div>
    </section>
  );
}

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
        createdAt: report?.createdAt,
        persistence: body.persistence,
        chartViewModel: report?.chartViewModel,
        aiReportBundle: body.aiReportBundle,
        experience: body.experience
      });
      setAiStatus(body.aiReportBundle?.fallbackUsed ? "已生成基础白话解读。" : "白话解读已生成。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "暂时无法生成 AI 解读");
    } finally {
      setAiLoading(false);
    }
  }

  function exportReadableReport() {
    if (!report) return;
    downloadText(`${report.id}-report.md`, buildReadableMarkdown(report));
  }

  return (
    <main className="shell" data-testid="report-page">
      <AppNav current="report" />

      <section className="hero compact">
        <p className="eyebrow">{report?.type === "meihua" ? "梅花" : "六爻"}报告</p>
        <h1>{guided?.headline ?? "报告详情"}</h1>
        <p>{guided?.summary ?? "正在整理本次报告的结论、依据和后续行动。"}</p>
      </section>

      {loading ? <p className="empty">正在读取报告。</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {guided ? (
        <section className="panel report-section">
          <h2>结论摘要</h2>
          <p className="section-kicker">先看判断含义和下一步，专业盘面与证据用于复核来源。</p>
          <div className="preview-grid">
            {guided.coreMatter ? (
              <div>
                <h3>核心事项</h3>
                <p>{guided.coreMatter.summary}</p>
                {(guided.coreMatter.roles ?? []).slice(0, 3).map((role) => (
                  <p key={`${role.label}-${role.importance}`}>
                    {role.label}：{role.practicalMeaning}
                  </p>
                ))}
              </div>
            ) : null}
            {guided.observationFocus ? (
              <div>
                <h3>观察重点</h3>
                <p>{guided.observationFocus.summary}</p>
                {(guided.observationFocus.roles ?? []).slice(0, 3).map((role) => (
                  <p key={`${role.label}-${role.importance}`}>
                    {role.label}：{role.meaning}
                  </p>
                ))}
              </div>
            ) : null}
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
              {aiLoading ? "生成中" : report?.aiReportBundle ? "重新生成白话解读" : "生成白话解读"}
            </button>
            <button type="button" onClick={exportReadableReport}>
              导出报告
            </button>
            <a className="text-link" href="/">
              再次起卦
            </a>
          </div>
          {aiStatus ? <p className="empty">{aiStatus}</p> : null}
          <div className="trust-chain" aria-label="报告可信链路">
            <span>确定性排盘</span>
            <span>正式历法</span>
            <span>规则判断</span>
            <span>证据聚合</span>
            <span>白话解读</span>
          </div>
        </section>
      ) : null}

      <ChartPanel chart={report?.chartViewModel} />

      {report?.aiReportBundle ? (
        <section className="panel report-section">
          <h2>白话解读</h2>
          <p className="section-kicker">这一层只整理表达，不改变排盘与依据。</p>
          <div className="fact-strip">
            <span>{report.aiReportBundle.fallbackUsed ? "基础解读" : "已生成"}</span>
            <span>{report.aiReportBundle.validationStatus === "VALID" ? "一致性已校验" : "基础报告可读"}</span>
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
          {aiReport?.disclaimer ? <p className="empty">{aiReport.disclaimer}</p> : null}
        </section>
      ) : null}

      {professional ? (
        <section className="panel report-section" id="professional-evidence">
          <h2>专业依据</h2>
          <p className="section-kicker">这里用于复核判断来源。默认收起细节，需要时再展开。</p>
          <div className="fact-strip">
            <span>{professional.method}</span>
            <span>{professional.chartSummary?.title}</span>
            {professional.chartSummary?.movingLines?.length ? (
              <span>动爻 {professional.chartSummary.movingLines.join(", ")}</span>
            ) : null}
          </div>
          {professional.observationFocus ? (
            <details className="evidence-details" open>
              <summary>本次观察重点</summary>
              <div className="preview-grid">
                {(professional.observationFocus.roles ?? []).map((role) => (
                  <div key={`${role.label}-${role.importance}`}>
                    <h3>{role.label}</h3>
                    <p>{role.meaning}</p>
                    {role.lines?.length ? (
                      role.lines.map((line) => (
                        <p key={`${role.label}-${line.position}`}>
                          第 {line.position} 爻
                          {line.branchName ? ` / ${line.branchName}` : ""}
                          {line.moving ? " / 动" : ""}
                          {line.isWorld ? " / 世" : ""}
                          {line.isResponse ? " / 应" : ""}
                          {line.isVoid ? " / 空" : ""}
                        </p>
                      ))
                    ) : (
                      <p>本盘未见对应爻位，需结合世应与动爻观察。</p>
                    )}
                  </div>
                ))}
              </div>
              <p className="empty">观察重点由系统按场景自动确定；专业模式后续可开放自定义，不作为普通用户必经步骤。</p>
            </details>
          ) : null}
          <details className="evidence-details">
            <summary>查看完整证据</summary>
            <div className="preview-grid">
              <div>
                <h3>支持证据</h3>
                {supports.length ? (
                  supports.map((item, index) => <p key={`${item.title}-${index}`}>{item.text ?? item.title}</p>)
                ) : (
                  <p>暂无明确支持证据。</p>
                )}
              </div>
              <div>
                <h3>风险证据</h3>
                {risks.length ? (
                  risks.map((item, index) => <p key={`${item.title}-${index}`}>{item.text ?? item.title}</p>)
                ) : (
                  <p>暂无明确风险证据。</p>
                )}
              </div>
              <div>
                <h3>其他依据</h3>
                {otherEvidence.length ? (
                  otherEvidence.map((item, index) => <p key={`${item.title}-${index}`}>{item.text ?? item.title}</p>)
                ) : (
                  <p>暂无其他证据。</p>
                )}
              </div>
            </div>
          </details>
          {professional.knowledgeRefs?.length ? (
            <details className="evidence-details">
              <summary>查看相关知识</summary>
              <div className="chips">
                {professional.knowledgeRefs.map((item, index) => (
                  <span key={`${item.id ?? item.title}-${index}`}>{item.title ?? item.id}</span>
                ))}
              </div>
            </details>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
