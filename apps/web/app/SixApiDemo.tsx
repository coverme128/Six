"use client";

import { FormEvent, useMemo, useState } from "react";
import { apiBase, readError, type DivinationMode, type ExperienceResponse } from "./lib/api";

const lineOptions = [
  { value: "6", label: "老阴 6" },
  { value: "7", label: "少阳 7" },
  { value: "8", label: "少阴 8" },
  { value: "9", label: "老阳 9" }
];

export function SixApiDemo() {
  const [mode, setMode] = useState<DivinationMode>("liuyao");
  const [question, setQuestion] = useState("新的 Web 应用是否可以承接真实起卦？");
  const [liuyaoValues, setLiuyaoValues] = useState(["7", "8", "9", "7", "8", "6"]);
  const [meihuaA, setMeihuaA] = useState("18");
  const [meihuaB, setMeihuaB] = useState("27");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState<ExperienceResponse | null>(null);

  const guided = report?.experience?.guidedViewModel;
  const supports = useMemo(() => guided?.mainSupports?.slice(0, 3) ?? [], [guided]);
  const risks = useMemo(() => guided?.mainRisks?.slice(0, 3) ?? [], [guided]);

  async function createReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const endpoint = mode === "liuyao" ? "liuyao/charts" : "meihua/charts";
    const payload =
      mode === "liuyao"
        ? {
            question,
            topic: "career",
            subtype: "job_search",
            values: liuyaoValues.map((item) => Number(item)),
            calendar: { timezone: "Asia/Shanghai" }
          }
        : {
            question,
            methodCode: "MEIHUA_TWO_NUMBER_V1",
            number_a: Number(meihuaA),
            number_b: Number(meihuaB)
          };

    try {
      const created = await fetch(`${apiBase()}/${endpoint}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!created.ok) throw new Error(await readError(created));
      const createdJson = (await created.json()) as ExperienceResponse;
      const experience = await fetch(`${apiBase()}/reports/${encodeURIComponent(createdJson.id)}/experience`);
      if (!experience.ok) throw new Error(await readError(experience));
      setReport((await experience.json()) as ExperienceResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "暂时无法连接 API");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel interactive">
      <div className="panel-head">
        <div>
          <h2>起卦工作台</h2>
          <p>Next Web 调用 Nest API，结果来自同一条确定性事实链与 P4-X Guided ViewModel。</p>
        </div>
        <div className="segmented" aria-label="起卦类型">
          <button type="button" className={mode === "liuyao" ? "active" : ""} onClick={() => setMode("liuyao")}>
            六爻
          </button>
          <button type="button" className={mode === "meihua" ? "active" : ""} onClick={() => setMode("meihua")}>
            梅花
          </button>
        </div>
      </div>

      <form className="workbench-form" onSubmit={createReport}>
        <label className="full-field">
          <span>问题</span>
          <input value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={500} required />
        </label>

        {mode === "liuyao" ? (
          <fieldset>
            <legend>六爻数值</legend>
            <div className="line-grid">
              {liuyaoValues.map((value, index) => (
                <label key={`line-${index}`}>
                  <span>第 {index + 1} 爻</span>
                  <select
                    value={value}
                    onChange={(event) => {
                      const nextValues = [...liuyaoValues];
                      nextValues[index] = event.target.value;
                      setLiuyaoValues(nextValues);
                    }}
                  >
                    {lineOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </fieldset>
        ) : (
          <fieldset>
            <legend>梅花两数</legend>
            <div className="number-grid">
              <label>
                <span>上数</span>
                <input type="number" min="1" value={meihuaA} onChange={(event) => setMeihuaA(event.target.value)} />
              </label>
              <label>
                <span>下数</span>
                <input type="number" min="1" value={meihuaB} onChange={(event) => setMeihuaB(event.target.value)} />
              </label>
            </div>
          </fieldset>
        )}

        <div className="form-actions">
          <button type="submit" disabled={loading}>
            {loading ? "生成中..." : "生成报告"}
          </button>
          <button type="button" className="secondary" onClick={() => setReport(null)} disabled={loading || !report}>
            清空结果
          </button>
          <a className="text-link" href="/history">
            查看历史
          </a>
        </div>
      </form>

      {error ? <p className="error">{error}</p> : null}

      {guided ? (
        <div className="report-preview">
          <p className="eyebrow">
            {report?.type === "meihua" ? "梅花" : "六爻"} / {report?.id}
          </p>
          <h3>{guided.headline}</h3>
          <div className="inline-actions">
            <a className="primary-link" href={`/reports/${encodeURIComponent(report.id)}`}>
              打开完整报告
            </a>
            <a className="text-link" href="/history">
              查看历史
            </a>
          </div>
          <div className="preview-grid">
            <div>
              <strong>当前局势</strong>
              <p>{guided.currentSituation}</p>
            </div>
            <div>
              <strong>变化方向</strong>
              <p>{guided.changeDirection}</p>
            </div>
            <div>
              <strong>时间提示</strong>
              <p>{guided.timingHint}</p>
            </div>
          </div>
          <div className="preview-grid">
            <div>
              <strong>主要支持</strong>
              {supports.map((item, index) => (
                <p key={`${item.title}-${index}`}>{item.text ?? item.title}</p>
              ))}
            </div>
            <div>
              <strong>主要阻碍</strong>
              {risks.map((item, index) => (
                <p key={`${item.title}-${index}`}>{item.text ?? item.title}</p>
              ))}
            </div>
            <div>
              <strong>下一步</strong>
              {(guided.recommendedActions ?? []).slice(0, 3).map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <p className="empty">生成后的报告会显示在这里。</p>
      )}
    </section>
  );
}
