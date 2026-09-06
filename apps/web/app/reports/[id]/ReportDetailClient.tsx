"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileText, MoreHorizontal, Printer, ShieldCheck, Sparkles, PencilLine } from "lucide-react";
import { QuestionClarification, understandQuestion, type UnderstandingResult } from "../../QuestionUnderstanding";
import { AppNav } from "../../AppNav";
import { apiBase, readError, type ChartViewModel, type ExperienceResponse } from "../../lib/api";
import { LiuyaoVisualSystemPanel } from "../../liuyao-visuals/LiuyaoVisualSystem";
import { renderLiuyaoVisualizationSvg } from "../../liuyao-visuals/export";

const CURRENT_LIUYAO_AI_PROMPT = "liuyao-report-v9";

function textList(items: Array<{ title?: string; text?: string }> = []) {
  return items.map((item) => `- ${item.text ?? item.title ?? ""}`).filter((item) => item.trim() !== "-").join("\n");
}

function chartTransitionLabel(chart?: ChartViewModel) {
  if (!chart || chart.type !== "liuyao") return "六爻报告";
  return chart.movingLines?.length
    ? `${chart.originalHexagram} → ${chart.changedHexagram}`
    : `${chart.originalHexagram}（静卦，无变卦）`;
}

function actionText(item: string | { text?: string }) {
  return typeof item === "string" ? item : item.text ?? "";
}

function buildReadableMarkdown(report: ExperienceResponse) {
  const guided = report.experience?.guidedViewModel;
  const professional = report.experience?.professionalViewModel;
  const chart = report.chartViewModel;
  const aiReport = report.aiReportBundle?.aiReport;
  const judgments = (aiReport?.keyJudgments ?? []).flatMap((item, index) => [
    `### ${index + 1}. ${item.title ?? "关键判断"}`,
    `专业依据：${item.professionalBasis ?? ""}`,
    item.plainInterpretation ?? "",
    `对决定的影响：${item.decisionImpact ?? ""}`,
    "",
  ]);
  const actionGroup = (title: string, items: Array<{ text?: string }> = []) => [
    `### ${title}`,
    ...items.map((item) => `- ${item.text ?? ""}`),
    "",
  ];
  const lines = [
    `# ${guided?.question ?? "六爻报告"}`,
    "",
    `报告编号：${report.id}`,
    "类型：六爻",
    report.createdAt ? `生成时间：${new Date(report.createdAt).toLocaleString("zh-CN")}` : "",
    "",
    "## 直接回答",
    aiReport?.questionResponse?.directAnswer ?? "AI 解读尚未完成。",
    aiReport?.questionResponse?.scopeNote ?? "",
    "",
    "## 卦象脉络",
    aiReport?.hexagramReading?.synthesis ?? "",
    aiReport?.hexagramReading?.original ?? "",
    aiReport?.hexagramReading?.moving ?? "",
    aiReport?.hexagramReading?.changed ?? "",
    "",
    "## 为什么这样判断",
    ...judgments,
    ...(aiReport?.decisionBalance?.length ? [
      "## 这次决定中的取舍",
      "| 可能获得 | 可能付出 |",
      "| --- | --- |",
      ...aiReport.decisionBalance.map((item) => `| ${item.gain ?? ""} | ${item.cost ?? ""} |`),
      "",
    ] : []),
    "## 对你的实际建议",
    ...actionGroup("现在可以做", aiReport?.actionPlan?.now),
    ...actionGroup("作决定前确认", aiReport?.actionPlan?.beforeDecision),
    ...actionGroup("需要避免", aiReport?.actionPlan?.avoid),
    "## 一句话总结",
    aiReport?.finalTakeaway ?? "",
    "",
    "## 专业盘面",
    chart?.type === "liuyao"
      ? `本卦：${chart.originalHexagram ?? ""}\n${chart.movingLines?.length ? `变卦：${chart.changedHexagram ?? ""}` : "卦象：静卦，无变卦"}\n动爻：${chart.movingLines?.join("、") || "无"}\n世爻：${chart.worldLine ?? ""}\n应爻：${chart.responseLine ?? ""}`
      : "当前页面仅支持六爻报告。",
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

function downloadSvg(filename: string, source: string) {
  const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
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
  if (!chart || chart.type !== "liuyao") return null;

  const lines = [...(chart.lines ?? [])].sort((a, b) => Number(b.position ?? 0) - Number(a.position ?? 0));
  return (
    <section className="panel report-section">
      <h2>专业盘面</h2>
      <p className="section-kicker">六爻盘面从下往上生成，表格中按上爻到初爻阅读，动爻以朱砂色标记。</p>
      <div className="hexagram-layout">
        <div className="hexagram-figure" aria-label="六爻卦象">
          <strong>
            {chartTransitionLabel(chart)}
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
        <span>{chart.movingLines?.length ? `变卦 ${chart.changedHexagram}` : "静卦，无变卦"}</span>
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
  const [aiAvailability, setAiAvailability] = useState<"checking" | "available" | "unavailable">("checking");
  const [error, setError] = useState("");
  const [aiStatus, setAiStatus] = useState("");
  const [report, setReport] = useState<ExperienceResponse | null>(null);
  const [editingUnderstanding, setEditingUnderstanding] = useState(false);
  const [supplement, setSupplement] = useState("");
  const [understandingResult, setUnderstandingResult] = useState<UnderstandingResult | null>(null);
  const [revisionBusy, setRevisionBusy] = useState(false);
  const aiSectionRef = useRef<HTMLElement | null>(null);
  const autoAIRequestedRef = useRef(false);
  const guided = report?.experience?.guidedViewModel;
  const professional = report?.experience?.professionalViewModel;
  const visualization = report?.experience?.visualization;
  const relatedContent = report?.relatedContent ?? [];
  const aiBundleIsCurrent = report?.aiReportBundle?.promptVersion === CURRENT_LIUYAO_AI_PROMPT;
  const aiReport = aiBundleIsCurrent ? report?.aiReportBundle?.aiReport : null;
  const aiProviderUnconfigured = aiAvailability === "unavailable";
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

  useEffect(() => {
    let cancelled = false;
    async function loadAIAvailability() {
      try {
        const response = await fetch(`${apiBase()}/ready`);
        const body = response.ok ? await response.json() as { ai?: { status?: string } } : null;
        if (!cancelled) setAiAvailability(body?.ai?.status === "configured" ? "available" : "unavailable");
      } catch {
        if (!cancelled) setAiAvailability("checking");
      }
    }
    loadAIAvailability();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (
      loading
      || !report
      || report.type !== "liuyao"
      || aiAvailability !== "available"
      || aiLoading
      || revisionBusy
      || editingUnderstanding
      || autoAIRequestedRef.current
      || (aiBundleIsCurrent && report.aiReportBundle?.aiReport)
    ) return;
    autoAIRequestedRef.current = true;
    void generateAIReport();
  }, [aiAvailability, aiBundleIsCurrent, aiLoading, loading, report, revisionBusy, editingUnderstanding]);

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
      if (!response.ok) {
        const failure = await response.json();
        if (failure.understanding) {
          setUnderstandingResult(failure);
          setEditingUnderstanding(true);
        }
        throw new Error(failure.message ?? "暂时无法生成解读");
      }
      const body = (await response.json()) as {
        reportId: string;
        reportType: ExperienceResponse["type"];
        persistence?: string;
        aiReportBundle?: ExperienceResponse["aiReportBundle"];
        experience?: ExperienceResponse["experience"];
      };
      setReport({
        ...report,
        id: body.reportId,
        type: body.reportType,
        createdAt: report?.createdAt,
        persistence: body.persistence,
        chartViewModel: report?.chartViewModel,
        aiReportBundle: body.aiReportBundle,
        experience: body.experience,
        relatedContent: report?.relatedContent
      });
      setAiStatus(
        body.aiReportBundle?.failureCode === "PROVIDER_UNAVAILABLE"
          ? "真实模型尚未配置，当前仅显示正式排盘与规则结论。"
          : body.aiReportBundle?.fallbackUsed
            ? "真实模型暂时未能完成解读，正式排盘和规则结论不受影响。"
            : "真实模型解读已生成。"
      );
      const refreshed = await fetch(`${apiBase()}/reports/${encodeURIComponent(reportId)}/experience`);
      if (refreshed.ok) setReport(await refreshed.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "暂时无法生成 AI 解读");
    } finally {
      setAiLoading(false);
    }
  }

  async function updateUnderstanding(answer = "") {
    if (!report || revisionBusy || aiLoading) return;
    setRevisionBusy(true);
    setError("");
    const clarification = [supplement, answer].filter(Boolean).join("；").slice(0, 500);
    setSupplement(clarification);
    try {
      const understood = await understandQuestion(guided?.question ?? "", clarification);
      setUnderstandingResult(understood);
      if (["CLARIFY", "SPLIT"].includes(understood.understanding.status)) return;
      const response = await fetch(`${apiBase()}/reports/${encodeURIComponent(reportId)}/understanding`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ clarification, understandingToken: understood.understandingToken, revision: report.interpretationRevision ?? 1 }),
      });
      if (!response.ok) throw new Error(await readError(response));
      const refreshed = await fetch(`${apiBase()}/reports/${encodeURIComponent(reportId)}/experience`);
      if (!refreshed.ok) throw new Error(await readError(refreshed));
      autoAIRequestedRef.current = false;
      setReport(await refreshed.json());
      setEditingUnderstanding(false);
      setUnderstandingResult(null);
      setAiStatus("已更新问题理解，正在沿用原卦解读。");
    } catch (err) { setError(err instanceof Error ? err.message : "暂时无法更新理解。"); }
    finally { setRevisionBusy(false); }
  }

  function exportReadableReport() {
    if (!report) return;
    downloadText(`${report.id}-report.md`, buildReadableMarkdown(report));
  }

  function exportVisualReport() {
    if (!visualization) return;
    downloadSvg(`${reportId}-visual-report.svg`, renderLiuyaoVisualizationSvg(visualization, guided?.headline ?? "六爻报告"));
  }

  return (
    <main className="shell" data-testid="report-page">
      <AppNav current="report" />

      <section className="hero compact">
        <p className="eyebrow">你的问题</p>
        <h1>{guided?.question ?? "报告详情"}</h1>
        {report?.questionUnderstanding?.summary ? <p>{report.questionUnderstanding.summary}</p> : null}
        {report ? <div className="report-reading-links"><a href="#ai-plain-language">阅读 AI 解读</a><button type="button" className="text-link" disabled={aiLoading || revisionBusy} onClick={() => { setEditingUnderstanding(!editingUnderstanding); setSupplement(report.questionUnderstanding?.clarification ?? ""); setUnderstandingResult(null); }}><PencilLine size={16} />补充或纠正理解</button></div> : null}
      </section>

      {editingUnderstanding ? <section className="report-understanding-editor">
        <h2>补充这次问题</h2>
        <label>背景或需要纠正的理解
          <textarea value={supplement} disabled={revisionBusy} maxLength={500} rows={3} onChange={(event) => { setSupplement(event.target.value); setUnderstandingResult(null); }} placeholder="例如：我说的是入股并参与经营，不是作为员工入职。" />
        </label>
        <p>沿用原卦与起卦时间，旧版解读会保留。</p>
        <QuestionClarification key={understandingResult?.understanding.clarificationQuestion} result={understandingResult} busy={revisionBusy} onAnswer={(answer) => void updateUnderstanding(answer)} />
        <button type="button" className="primary-button" disabled={revisionBusy || !supplement.trim()} onClick={() => void updateUnderstanding()}>{revisionBusy ? "正在更新理解" : "更新本次解读"}</button>
      </section> : null}

      {loading ? <p className="empty">正在读取报告。</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {report?.type === "liuyao" ? (
        visualization ? <LiuyaoVisualSystemPanel visualization={visualization} /> : <ChartPanel chart={report?.chartViewModel} />
      ) : null}

      {guided && (!aiReport || report?.aiReportBundle?.fallbackUsed) ? (
        <section className="panel report-section ai-report-entry" id="ai-plain-language" aria-live="polite">
          <div>
            <p className="eyebrow">AI 问题解读</p>
            <h2>{aiLoading ? "正在结合原问题与完整盘面生成解读" : "结合你的问题，解释这份卦"}</h2>
            <p>{aiLoading ? "盘面已就绪，你可以先查看卦象。" : "解读将回答你的问题，并说明关键依据与下一步建议。"}</p>
            <small><ShieldCheck aria-hidden="true" size={15} />排盘事实不会被 AI 改写；手机号、邮箱和证件号会在发送前自动隐藏。</small>
          </div>
          <div className="inline-actions">
            <button className="primary-button" type="button" onClick={generateAIReport} disabled={aiLoading || aiProviderUnconfigured}>
              <Sparkles aria-hidden="true" size={17} />
              {aiLoading ? "AI 正在解读" : aiProviderUnconfigured ? "真实模型未配置" : report?.aiReportBundle?.fallbackUsed ? "重试真实模型解读" : "生成 AI 解读"}
            </button>
            <a className="secondary-link" href="#professional-evidence">查看专业依据</a>
            <details className="report-more-actions">
              <summary><MoreHorizontal aria-hidden="true" size={18} />更多操作</summary>
              <div>
                <button type="button" onClick={exportReadableReport}><FileText aria-hidden="true" size={17} />下载文本</button>
                <button data-testid="export-visual-svg" type="button" onClick={exportVisualReport} disabled={!visualization}><Download aria-hidden="true" size={17} />下载 SVG</button>
                <button data-testid="print-report" type="button" onClick={() => window.print()}><Printer aria-hidden="true" size={17} />打印 / PDF</button>
                <a className="text-link" href="/">再次起卦</a>
              </div>
            </details>
          </div>
          {aiStatus ? <p className="empty">{aiStatus}</p> : aiProviderUnconfigured ? <p className="empty">真实模型尚未配置，仍可查看完整盘面和专业依据。</p> : null}
        </section>
      ) : null}

      {report?.aiReportBundle && !report.aiReportBundle.fallbackUsed && aiReport ? (
        <section className="panel report-section ai-report-section" id="ai-plain-language" ref={aiSectionRef}>
          <div className="ai-report-heading">
            <div>
              <p className="eyebrow">针对你的问题</p>
              <h2>AI 解读</h2>
            </div>
            <div className="fact-strip" aria-label="解读状态">
              <span>{report.aiReportBundle.validationStatus === "VALID" ? "排盘字段一致性已校验" : "确定性报告已保留"}</span>
              <span>现实条件仍待核实</span>
            </div>
          </div>

          <div className="ai-report-lead">
            <span>对这个问题的直接回答</span>
            <strong>{aiReport?.questionResponse?.directAnswer ?? aiReport?.finalTakeaway ?? "当前解读已生成。"}</strong>
            {aiReport?.questionResponse?.scopeNote ? <small>本次理解范围：{aiReport.questionResponse.scopeNote}</small> : null}
          </div>

          <div className="inline-actions ai-report-actions">
            <a className="secondary-link" href="#professional-evidence">查看专业依据</a>
            <details className="report-more-actions">
              <summary><MoreHorizontal aria-hidden="true" size={18} />更多操作</summary>
              <div>
                <button type="button" onClick={exportReadableReport}><FileText aria-hidden="true" size={17} />下载文本</button>
                <button data-testid="export-visual-svg" type="button" onClick={exportVisualReport} disabled={!visualization}><Download aria-hidden="true" size={17} />下载 SVG</button>
                <button data-testid="print-report" type="button" onClick={() => window.print()}><Printer aria-hidden="true" size={17} />打印 / PDF</button>
                <a className="text-link" href="/">再次起卦</a>
              </div>
            </details>
          </div>

          {aiReport ? (
            <>
              {aiReport.hexagramReading ? (
                <section className="ai-analysis-block ai-hexagram-narrative" aria-labelledby="hexagram-explanation-title">
                  <div className="report-section-heading">
                    <span>{chartTransitionLabel(report.chartViewModel)}</span>
                    <h3 id="hexagram-explanation-title">整体卦象脉络</h3>
                  </div>
                  <p className="ai-hexagram-synthesis">{aiReport.hexagramReading.synthesis}</p>
                  <div className="ai-hexagram-notes">
                    <p><strong>本卦</strong>{aiReport.hexagramReading.original}</p>
                    <p><strong>动变</strong>{aiReport.hexagramReading.moving}</p>
                    <p><strong>{report.chartViewModel?.type === "liuyao" && !report.chartViewModel.movingLines?.length ? "静卦" : "变卦"}</strong>{report.chartViewModel?.type === "liuyao" && !report.chartViewModel.movingLines?.length
                      ? aiReport.hexagramReading.changed
                      : aiReport.hexagramReading.changed}</p>
                  </div>
                </section>
              ) : null}

              {(aiReport.keyJudgments ?? []).length ? (
                <section className="ai-analysis-block ai-judgment-section" aria-labelledby="key-judgments-title">
                  <div className="report-section-heading">
                    <span>从证据到结论</span>
                    <h3 id="key-judgments-title">为什么这样判断</h3>
                  </div>
                  <div className="ai-judgment-list">
                    {aiReport.keyJudgments?.map((item, index) => (
                      <article key={`${item.title}-${index}`}>
                        <span className="ai-judgment-index">{index + 1}</span>
                        <div>
                          <h4>{item.title}</h4>
                          <p className="ai-professional-basis"><strong>盘面依据</strong>{item.professionalBasis}</p>
                          <p>{item.plainInterpretation}</p>
                          <p className="ai-decision-impact"><strong>对决定的影响</strong>{item.decisionImpact}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}

              {(aiReport.decisionBalance ?? []).length ? (
                <section className="ai-analysis-block ai-balance-section">
                  <div className="report-section-heading">
                    <span>不是简单的好或坏</span>
                    <h3>这次决定中的取舍</h3>
                  </div>
                  <div className="ai-balance-table" role="table" aria-label="决定取舍">
                    <div role="row"><strong role="columnheader">可能获得</strong><strong role="columnheader">可能付出</strong></div>
                    {aiReport.decisionBalance?.map((item, index) => (
                      <div role="row" key={`${item.gain}-${index}`}><span role="cell">{item.gain}</span><span role="cell">{item.cost}</span></div>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="ai-analysis-block ai-action-plan" aria-labelledby="action-plan-title">
                <div className="report-section-heading">
                  <span>把判断落到现实</span>
                  <h3 id="action-plan-title">对你的实际建议</h3>
                </div>
                <div>
                  <section><h4>现在可以做</h4><ul>{(aiReport.actionPlan?.now ?? []).map((item, index) => <li key={`${item.text}-${index}`}>{item.text}</li>)}</ul></section>
                  <section><h4>作决定前确认</h4><ul>{(aiReport.actionPlan?.beforeDecision ?? []).map((item, index) => <li key={`${item.text}-${index}`}>{item.text}</li>)}</ul></section>
                  <section><h4>需要避免</h4><ul>{(aiReport.actionPlan?.avoid ?? []).map((item, index) => <li key={`${item.text}-${index}`}>{item.text}</li>)}</ul></section>
                </div>
              </section>

              {aiReport.finalTakeaway ? <blockquote className="ai-final-takeaway"><span>一句话总结</span>{aiReport.finalTakeaway}</blockquote> : null}

              {(aiReport.timingWindows ?? []).length ? <details className="ai-timing-note"><summary>候选观察时间</summary><ul>{(aiReport.timingWindows ?? []).map((item, index) => <li key={`${item.candidateRef}-${index}`}>{item.text}</li>)}</ul></details> : null}

              {(aiReport.limitations ?? []).length || aiReport.disclaimer ? (
                <details className="ai-limitations">
                  <summary>这份解读不能替你判断什么</summary>
                  {(aiReport.limitations ?? []).map((item, index) => <p key={`${item}-${index}`}>{item}</p>)}
                  {aiReport.disclaimer ? <p>{aiReport.disclaimer}</p> : null}
                </details>
              ) : null}
            </>
          ) : (
            <p className="empty">AI 服务暂时不可用，本次排盘、正式判断和基础报告不受影响。</p>
          )}
        </section>
      ) : null}

      {relatedContent.length ? (
        <details className="panel report-section report-layer-disclosure">
          <summary><span><strong>需要理解术语时再看</strong><small>相关概念解释，不影响当前结论</small></span></summary>
          <div className="history-list compact-list">
            {relatedContent.map((item) => (
              <a className="history-item" href={item.url ?? "/content"} key={item.contentId ?? item.title}>
                <span>概念解释</span>
                <strong>{item.title}</strong>
                <small>结合本次报告继续阅读</small>
              </a>
            ))}
          </div>
        </details>
      ) : null}

      {report?.interpretationHistory?.length ? <details className="report-revision-history">
        <summary>此前的解读版本（{report.interpretationHistory.length}）</summary>
        {report.interpretationHistory.map((item) => <article key={item.revision}>
          <h3>第 {item.revision} 版</h3><p>{item.summary}</p>
          {item.directAnswer ? <p>{item.directAnswer}</p> : <p>该版本未生成 AI 解读。</p>}
        </article>)}
      </details> : null}

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
          {professional.auditChain ? (
            <details className="evidence-details">
              <summary>综合判断审计链</summary>
              <div className="preview-grid">
                <div>
                  <h3>排盘事实</h3>
                  <p>{professional.chartSummary?.title}</p>
                  <p>{professional.chartSummary?.movingLines?.length ? `动爻：${professional.chartSummary.movingLines.join("、")}` : "静卦，无动爻"}</p>
                </div>
                <div>
                  <h3>冲突裁决</h3>
                  <p>{professional.auditChain.evidenceResolution?.summary}</p>
                </div>
                <div>
                  <h3>综合判断</h3>
                  <p>{professional.auditChain.overallAssessment?.patternName}</p>
                  <p>{professional.auditChain.overallAssessment?.summary}</p>
                </div>
                <div>
                  <h3>时间依据</h3>
                  {(professional.auditChain.timing ?? []).slice(0, 3).map((item) => (
                    <p key={`${item.window}-${item.precision}`}>{item.explanation}</p>
                  ))}
                </div>
              </div>
              {(professional.auditChain.limitations ?? []).map((item) => (
                <p className="empty" key={item}>{item}</p>
              ))}
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
