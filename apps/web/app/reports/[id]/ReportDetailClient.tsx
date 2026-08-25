"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileText, Printer, ShieldCheck, Sparkles } from "lucide-react";
import { AppNav } from "../../AppNav";
import { apiBase, readError, type ChartViewModel, type ExperienceResponse } from "../../lib/api";
import { LiuyaoVisualSystemPanel } from "../../liuyao-visuals/LiuyaoVisualSystem";
import { renderLiuyaoVisualizationSvg } from "../../liuyao-visuals/export";

function textList(items: Array<{ title?: string; text?: string }> = []) {
  return items.map((item) => `- ${item.text ?? item.title ?? ""}`).filter((item) => item.trim() !== "-").join("\n");
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
  const [error, setError] = useState("");
  const [aiStatus, setAiStatus] = useState("");
  const [report, setReport] = useState<ExperienceResponse | null>(null);
  const aiSectionRef = useRef<HTMLElement | null>(null);
  const guided = report?.experience?.guidedViewModel;
  const professional = report?.experience?.professionalViewModel;
  const visualization = report?.experience?.visualization;
  const contentSnippets = report?.experience?.contentExplanationSnippets ?? [];
  const relatedContent = report?.relatedContent ?? [];
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
        experience: body.experience,
        relatedContent: report?.relatedContent
      });
      setAiStatus(body.aiReportBundle?.fallbackUsed ? "AI 暂时不可用，已保留基础解读。" : "白话解读已生成。");
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
        <p className="eyebrow">六爻报告</p>
        <h1>{guided?.scenarioGuidance?.headline ?? guided?.headline ?? "报告详情"}</h1>
        <p>{guided?.scenarioGuidance?.decisionFocus ?? guided?.summary ?? "正在整理本次报告的结论、依据和后续行动。"}</p>
      </section>

      {loading ? <p className="empty">正在读取报告。</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {guided ? (
        <section className="panel report-section">
          <h2>结论摘要</h2>
          <p className="section-kicker">先看判断含义和下一步，专业盘面与证据用于复核来源。</p>
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
          <div className="preview-grid">
            {guided.overallAssessment ? (
              <div>
                <h3>总体判断</h3>
                <p>{guided.overallAssessment.label}</p>
                <p>{guided.overallAssessment.baseState}</p>
                <p>{guided.overallAssessment.dynamicDirection}</p>
              </div>
            ) : null}
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
            {guided.whyThisAssessment ? (
              <div>
                <h3>为什么这样判断</h3>
                <p>{guided.whyThisAssessment.conflictResolution}</p>
                {(guided.whyThisAssessment.basis ?? []).slice(0, 3).map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            ) : null}
          </div>
          <aside className="ai-generation-notice" aria-label="AI 白话解读说明">
            <Sparkles aria-hidden="true" size={20} />
            <div>
              <strong>需要更容易读懂的说明？</strong>
              <p>AI 会读取本次问题和必要的排盘事实，只负责整理表达，不会改变卦盘、判断或依据。</p>
              <small><ShieldCheck aria-hidden="true" size={15} />手机号、邮箱和证件号会在发送前自动隐藏，通常约 10 秒完成。</small>
            </div>
          </aside>
          <div className="inline-actions">
            <a className="primary-link" href="#professional-evidence">
              查看依据
            </a>
            <button type="button" onClick={generateAIReport} disabled={aiLoading}>
              <Sparkles aria-hidden="true" size={17} />
              {aiLoading ? "正在整理" : report?.aiReportBundle ? "重新生成白话解读" : "用 AI 生成白话解读"}
            </button>
            <button type="button" onClick={exportReadableReport}>
              <FileText aria-hidden="true" size={17} />下载文本
            </button>
            <button data-testid="export-visual-svg" type="button" onClick={exportVisualReport} disabled={!visualization}>
              <Download aria-hidden="true" size={17} />下载 SVG
            </button>
            <button data-testid="print-report" type="button" onClick={() => window.print()}>
              <Printer aria-hidden="true" size={17} />打印 / PDF
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

      {report?.aiReportBundle ? (
        <section className="panel report-section ai-report-section" id="ai-plain-language" ref={aiSectionRef}>
          <div className="ai-report-heading">
            <div>
              <p className="eyebrow">AI 表达层</p>
              <h2>{report.aiReportBundle.fallbackUsed ? "基础解读" : "白话解读"}</h2>
              <p className="section-kicker">从现实处境、关键因素到下一步，快速读懂这份报告。</p>
            </div>
            <div className="fact-strip" aria-label="解读状态">
              <span>{report.aiReportBundle.validationStatus === "VALID" ? "事实一致性已校验" : "确定性报告已保留"}</span>
              <span>不改变排盘与判断</span>
            </div>
          </div>

          <div className="ai-report-lead">
            <span>先看结论</span>
            <strong>{aiReport?.summary ?? guided?.summary ?? "当前已保留基础报告，可继续查看结论和依据。"}</strong>
            <p>{aiReport?.currentSituation ?? guided?.currentSituation}</p>
          </div>

          {aiReport ? (
            <>
              <div className="ai-factor-grid">
                <section>
                  <h3>推动这件事的因素</h3>
                  {(aiReport.supportingFactors ?? []).length ? (
                    <ul>{aiReport.supportingFactors?.map((item, index) => <li key={`${item.text}-${index}`}>{item.text}</li>)}</ul>
                  ) : <p>当前没有足够明确的支持因素。</p>}
                </section>
                <section>
                  <h3>需要先处理的阻碍</h3>
                  {(aiReport.blockingFactors ?? []).length ? (
                    <ul>{aiReport.blockingFactors?.map((item, index) => <li key={`${item.text}-${index}`}>{item.text}</li>)}</ul>
                  ) : <p>当前没有足够明确的阻碍因素。</p>}
                </section>
              </div>

              <div className="ai-report-grid">
                <section>
                  <span>接下来可能怎么变化</span>
                  <h3>{aiReport.outcomeTrend?.text ?? aiReport.changeDirection}</h3>
                  <p>{aiReport.changeDirection}</p>
                </section>
                <section>
                  <span>什么时候再观察</span>
                  {(aiReport.timingWindows ?? []).length ? (
                    <ul>{aiReport.timingWindows?.map((item, index) => <li key={`${item.candidateRef}-${index}`}>{item.text}</li>)}</ul>
                  ) : <p>当前没有足够明确的时间窗口，先观察现实条件是否变化。</p>}
                </section>
              </div>

              <section className="ai-next-actions">
                <span>现在可以做什么</span>
                <ol>{(aiReport.actionSuggestions ?? []).map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ol>
              </section>

              <details className="ai-evidence-details" open>
                <summary>为什么得出这个结论</summary>
                <div>
                  {(aiReport.evidenceSummary ?? []).map((item, index) => <p key={`${item.text}-${index}`}>{item.text}</p>)}
                  <a href="#professional-evidence">查看完整专业依据</a>
                </div>
              </details>

              {(aiReport.limitations ?? []).length || aiReport.disclaimer ? (
                <aside className="ai-limitations">
                  <strong>这份解读的边界</strong>
                  {(aiReport.limitations ?? []).map((item, index) => <p key={`${item}-${index}`}>{item}</p>)}
                  {aiReport.disclaimer ? <p>{aiReport.disclaimer}</p> : null}
                </aside>
              ) : null}
            </>
          ) : (
            <p className="empty">AI 服务暂时不可用，本次排盘、正式判断和基础报告不受影响。</p>
          )}
        </section>
      ) : null}

      {report?.type === "liuyao" ? <LiuyaoVisualSystemPanel visualization={visualization} /> : null}
      {report?.type === "liuyao" && !visualization ? <ChartPanel chart={report?.chartViewModel} /> : null}

      {contentSnippets.length ? (
        <section className="panel report-section">
          <h2>报告帮助</h2>
          <p className="section-kicker">只看当前报告里最需要理解的概念和阅读重点。</p>
          <div className="preview-grid">
            {contentSnippets.slice(0, 6).map((item) => (
              <div key={item.snippetId}>
                <h3>{item.guided?.headline ?? item.professional?.label ?? item.category}</h3>
                <p>{item.guided?.short_text}</p>
                <p>{item.guided?.practical_meaning}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {relatedContent.length ? (
        <section className="panel report-section">
          <h2>相关内容</h2>
          <p className="section-kicker">继续理解本次报告中出现的关键概念。</p>
          <div className="history-list compact-list">
            {relatedContent.map((item) => (
              <a className="history-item" href={item.url ?? "/content"} key={item.contentId ?? item.title}>
                <span>概念解释</span>
                <strong>{item.title}</strong>
                <small>结合本次报告继续阅读</small>
              </a>
            ))}
          </div>
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
              <p className="empty">观察重点由问题场景自动确定，用于保持本次报告前后一致。</p>
            </details>
          ) : null}
          {professional.auditChain ? (
            <details className="evidence-details" open>
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
