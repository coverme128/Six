"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileText, MoreHorizontal, Printer, ShieldCheck, Sparkles } from "lucide-react";
import { AppNav } from "../../AppNav";
import { apiBase, readError, type ChartViewModel, type ExperienceResponse } from "../../lib/api";
import { LiuyaoVisualSystemPanel } from "../../liuyao-visuals/LiuyaoVisualSystem";
import { renderLiuyaoVisualizationSvg } from "../../liuyao-visuals/export";

function textList(items: Array<{ title?: string; text?: string }> = []) {
  return items.map((item) => `- ${item.text ?? item.title ?? ""}`).filter((item) => item.trim() !== "-").join("\n");
}

function decisionStateLabel(state?: string) {
  if (state === "SUPPORT") return "具备支持";
  if (state === "RISK") return "需要先处理";
  if (state === "MIXED") return "有利有阻";
  if (state === "OBSERVE") return "继续核对";
  return "信息不足";
}

function buildReadableMarkdown(report: ExperienceResponse) {
  const guided = report.experience?.guidedViewModel;
  const professional = report.experience?.professionalViewModel;
  const chart = report.chartViewModel;
  const lines = [
    `# ${guided?.scenarioGuidance?.headline ?? guided?.headline ?? "六爻报告"}`,
    "",
    `报告编号：${report.id}`,
    "类型：六爻",
    report.createdAt ? `生成时间：${new Date(report.createdAt).toLocaleString("zh-CN")}` : "",
    "",
    "## 总体判断",
    guided?.directAnswer ?? "",
    guided?.overallAssessment?.label ?? "",
    guided?.overallAssessment?.baseState ?? "",
    guided?.overallAssessment?.dynamicDirection ?? "",
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
    "## 为什么这样判断",
    guided?.whyThisAssessment?.conflictResolution ?? "",
    (guided?.whyThisAssessment?.basis ?? []).map((item) => `- ${item}`).join("\n"),
    "",
    "## 专业盘面",
    chart?.type === "liuyao"
      ? `本卦：${chart.originalHexagram ?? ""}\n变卦：${chart.changedHexagram ?? ""}\n动爻：${chart.movingLines?.join("、") || "无"}\n世爻：${chart.worldLine ?? ""}\n应爻：${chart.responseLine ?? ""}`
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
  const [aiAvailability, setAiAvailability] = useState<"checking" | "available" | "unavailable">("checking");
  const [error, setError] = useState("");
  const [aiStatus, setAiStatus] = useState("");
  const [report, setReport] = useState<ExperienceResponse | null>(null);
  const aiSectionRef = useRef<HTMLElement | null>(null);
  const guided = report?.experience?.guidedViewModel;
  const professional = report?.experience?.professionalViewModel;
  const visualization = report?.experience?.visualization;
  const relatedContent = report?.relatedContent ?? [];
  const aiReport = report?.aiReportBundle?.aiReport;
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
      window.setTimeout(() => aiSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
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
        <p>{guided?.directAnswer ?? aiReport?.questionResponse?.directAnswer ?? guided?.scenarioGuidance?.decisionFocus ?? guided?.overallAssessment?.label ?? "正在整理本次报告的回答。"}</p>
      </section>

      {loading ? <p className="empty">正在读取报告。</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {guided ? (
        <section className="panel report-section report-answer-overview">
          <div className="report-answer-heading">
            <div>
              <p className="eyebrow">当前回答</p>
              <h2>{guided.directAnswer ?? guided.overallAssessment?.label ?? "仍需继续观察"}</h2>
              <p className="section-kicker">先看能不能推进、要满足什么条件，再按需查看卦象解释和专业依据。</p>
            </div>
            <div className="fact-strip" aria-label="报告核心事实">
              <span>{report?.chartViewModel?.type === "liuyao" ? `${report.chartViewModel.originalHexagram} → ${report.chartViewModel.changedHexagram}` : "六爻报告"}</span>
              <span>{report?.chartViewModel?.type === "liuyao" && report.chartViewModel.movingLines?.length ? `第 ${report.chartViewModel.movingLines.join("、")} 爻变化` : "当前无明显动爻"}</span>
            </div>
          </div>
          {guided.scenarioGuidance?.scenario === "RELATIONSHIP" ? (
            <div className="relationship-summary" aria-label="感情关系结论">
              <div className="relationship-direction">
                <span>当前关系方向</span>
                <strong>{guided.scenarioGuidance.direction}</strong>
                <p>{guided.scenarioGuidance.interactionTrend}</p>
              </div>
              <div>
                <span>你这边</span>
                <strong>{guided.scenarioGuidance.selfSignal?.summary}</strong>
              </div>
              <div>
                <span>对方与互动</span>
                <strong>{guided.scenarioGuidance.otherSignal?.summary}</strong>
              </div>
              <div className="relationship-decision">
                <span>现在更适合</span>
                <strong>{guided.scenarioGuidance.decisionFocus}</strong>
              </div>
              <small>{guided.scenarioGuidance.boundary}</small>
            </div>
          ) : null}
          {guided.decisionSupport ? (
            <div className="decision-brief" aria-label="条件化决策建议">
              <div className="decision-dimensions">
                {guided.decisionSupport.dimensions?.map((item) => (
                  <article key={item.code} data-state={item.state}>
                    <div><span>{item.label}</span><strong>{decisionStateLabel(item.state)}</strong></div>
                    <p>{item.summary}</p>
                  </article>
                ))}
              </div>
              <div className="decision-condition-grid">
                <section>
                  <span>满足这些条件，再加大投入</span>
                  <ul>{guided.decisionSupport.proceedConditions?.map((item) => <li key={item}>{item}</li>)}</ul>
                </section>
                <section>
                  <span>出现这些情况，先不要决定</span>
                  <ul>{guided.decisionSupport.holdConditions?.map((item) => <li key={item}>{item}</li>)}</ul>
                </section>
              </div>
              <section className="decision-timeline">
                <span>接下来怎么做</span>
                <ol>{guided.decisionSupport.actionTimeline?.map((item) => <li key={`${item.phase}-${item.action}`}><strong>{item.phase}</strong><p>{item.action}</p></li>)}</ol>
              </section>
              <small className="decision-boundary">{guided.decisionSupport.boundary}</small>
            </div>
          ) : (
            <div className="report-answer-summary">
              <div><span>现在怎么看</span><strong>{guided.overallAssessment?.baseState ?? guided.currentSituation}</strong><p>{guided.overallAssessment?.dynamicDirection ?? guided.changeDirection}</p></div>
              <div><span>现在怎么做</span><strong>{guided.recommendedActions?.[0] ?? "先核对能改变决定的关键条件。"}</strong></div>
            </div>
          )}
          <aside className="ai-generation-notice" aria-label="AI 白话解读说明">
            <Sparkles aria-hidden="true" size={20} />
            <div>
              <strong>结合你的问题，解释这份卦</strong>
              <p>AI 会把原问题、本卦、动爻、变卦和关键角色放在一起，说明它们如何影响当前决定及需要核验的现实条件。</p>
              <small><ShieldCheck aria-hidden="true" size={15} />手机号、邮箱和证件号会在发送前自动隐藏，通常约 10 秒完成。</small>
            </div>
          </aside>
          <div className="inline-actions">
            <button className="primary-button" type="button" onClick={generateAIReport} disabled={aiLoading || aiProviderUnconfigured}>
              <Sparkles aria-hidden="true" size={17} />
              {aiLoading ? "正在结合问题解读" : aiProviderUnconfigured ? "真实模型未配置" : report?.aiReportBundle?.fallbackUsed ? "重试真实模型解读" : report?.aiReportBundle ? "重新生成针对问题的解读" : "生成针对问题的解读"}
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
          {aiStatus ? <p className="empty">{aiStatus}</p> : aiProviderUnconfigured ? <p className="empty">真实模型尚未配置，当前仅显示正式排盘与规则结论。</p> : report?.aiReportBundle?.fallbackUsed ? <p className="empty">真实模型暂时未能完成解读，正式排盘和规则结论不受影响。</p> : null}
          <div className="report-trust-note" aria-label="解读边界">
            <ShieldCheck aria-hidden="true" size={17} />
            <span>AI 只解释当前报告，不会重新排盘或改动专业判断；需要时可展开完整依据复核。</span>
          </div>
        </section>
      ) : null}

      {report?.aiReportBundle && !report.aiReportBundle.fallbackUsed && aiReport ? (
        <section className="panel report-section ai-report-section" id="ai-plain-language" ref={aiSectionRef}>
          <div className="ai-report-heading">
            <div>
              <p className="eyebrow">针对你的问题</p>
              <h2>{report.aiReportBundle.fallbackUsed ? "基础回答" : "问题解读"}</h2>
              <p className="section-kicker">先回答是否适合，再解释本卦、变化和需要现实核验的条件。</p>
            </div>
            <div className="fact-strip" aria-label="解读状态">
              <span>{report.aiReportBundle.validationStatus === "VALID" ? "事实一致性已校验" : "确定性报告已保留"}</span>
              <span>不改变排盘与判断</span>
            </div>
          </div>

          <div className="ai-report-lead">
            <span>对这个问题的直接回答</span>
            <strong>{guided?.directAnswer ?? aiReport?.questionResponse?.directAnswer ?? aiReport?.summary ?? guided?.summary ?? "当前已保留基础报告，可继续查看结论和依据。"}</strong>
            <p>{aiReport?.currentSituation ?? guided?.currentSituation}</p>
            {aiReport?.questionResponse?.scopeNote ? <small>本次理解范围：{aiReport.questionResponse.scopeNote}</small> : null}
          </div>

          {aiReport ? (
            <>
              {aiReport.hexagramReading ? (
                <section className="ai-hexagram-explanation" aria-labelledby="hexagram-explanation-title">
                  <div className="report-section-heading">
                    <span>卦象如何影响这个问题</span>
                    <h3 id="hexagram-explanation-title">
                      {report.chartViewModel?.type === "liuyao" ? `${report.chartViewModel.originalHexagram} → ${report.chartViewModel.changedHexagram}` : "本次卦象变化"}
                    </h3>
                  </div>
                  <div className="ai-hexagram-flow">
                    <article>
                      <span>1</span>
                      <div><strong>本卦：当前起点</strong><p>{aiReport.hexagramReading.original}</p></div>
                    </article>
                    <article>
                      <span>2</span>
                      <div><strong>动爻：变化来源</strong><p>{aiReport.hexagramReading.moving}</p></div>
                    </article>
                    <article>
                      <span>3</span>
                      <div><strong>变卦：后续观察</strong><p>{aiReport.hexagramReading.changed}</p></div>
                    </article>
                  </div>
                  <p className="ai-hexagram-synthesis">{aiReport.hexagramReading.synthesis}</p>
                </section>
              ) : null}

              <details className="ai-supporting-details">
                <summary>查看盘面角色与支持、阻碍</summary>
                {(aiReport.keyElements ?? []).length ? (
                  <section className="ai-key-elements">
                    <div className="report-section-heading">
                      <span>决策依据</span>
                      <h3>专业角色对应哪些现实条件</h3>
                    </div>
                    <div className="ai-key-element-grid">
                      {aiReport.keyElements?.map((item, index) => (
                        <article key={`${item.title}-${index}`}>
                          <small>盘面角色：{item.professionalRole}</small>
                          <strong>{item.title}</strong>
                          <p>{item.impact}</p>
                          <div><span>现实中看什么</span>{item.observe}</div>
                        </article>
                      ))}
                    </div>
                  </section>
                ) : null}
                <div className="ai-factor-grid">
                  <section>
                    <h3>支持推进的事实</h3>
                    {(aiReport.supportingFactors ?? []).length ? (
                      <ul>{aiReport.supportingFactors?.map((item, index) => <li key={`${item.text}-${index}`}>{item.text}</li>)}</ul>
                    ) : <p>当前没有足够明确的支持因素。</p>}
                  </section>
                  <section>
                    <h3>需要先处理的事实</h3>
                    {(aiReport.blockingFactors ?? []).length ? (
                      <ul>{aiReport.blockingFactors?.map((item, index) => <li key={`${item.text}-${index}`}>{item.text}</li>)}</ul>
                    ) : <p>当前没有足够明确的阻碍因素。</p>}
                  </section>
                </div>
              </details>

              {!guided?.decisionSupport && (aiReport.realityChecks ?? []).length ? (
                <section className="ai-reality-checks">
                  <div className="report-section-heading">
                    <span>先核对，再决定</span>
                    <h3>这份报告怎样落到现实</h3>
                  </div>
                  <div>
                    {aiReport.realityChecks?.map((item, index) => (
                      <article key={`${item.title}-${index}`}>
                        <span>{index + 1}</span>
                        <div><strong>{item.title}</strong><p>{item.check}</p><small>{item.signal}</small></div>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}

              {!guided?.decisionSupport ? (
                <section className="ai-next-actions">
                  <span>现在可以做什么</span>
                  <ol>{(aiReport.actionSuggestions ?? []).map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ol>
                </section>
              ) : null}

              <section className="ai-timing-note">
                <span>什么时候再观察</span>
                {(aiReport.timingWindows ?? []).length ? (
                  <ul>{aiReport.timingWindows?.map((item, index) => <li key={`${item.candidateRef}-${index}`}>{item.text}</li>)}</ul>
                ) : <p>当前没有足够明确的时间窗口，先以现实条件发生变化为复盘信号。</p>}
              </section>

              <details className="ai-evidence-details">
                <summary>为什么得出这个结论</summary>
                <div>
                  {(aiReport.evidenceSummary ?? []).map((item, index) => <p key={`${item.text}-${index}`}>{item.text}</p>)}
                  <a href="#professional-evidence">查看完整专业依据</a>
                </div>
              </details>

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

      {report?.type === "liuyao" ? (
        <details className="panel report-section report-layer-disclosure">
          <summary>
            <span><strong>查看六爻盘面与卦象图</strong><small>需要理解爻位、世应和动变时再展开</small></span>
          </summary>
          <div>
            {visualization ? <LiuyaoVisualSystemPanel visualization={visualization} /> : <ChartPanel chart={report?.chartViewModel} />}
          </div>
        </details>
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
            <details className="evidence-details">
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
              <p className="empty">观察重点由问题场景自动确定，用于保持本次报告前后一致。</p>
            </details>
          ) : null}
          {professional.auditChain ? (
            <details className="evidence-details">
              <summary>综合判断审计链</summary>
              <div className="preview-grid">
                <div>
                  <h3>问题与用神</h3>
                  <p>{professional.auditChain.question?.topic}</p>
                  <p>{professional.auditChain.yongshenSelection?.explanation}</p>
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
