"use client";

import { FormEvent, useMemo, useState } from "react";
import { apiBase, readError, type DivinationMode, type ExperienceResponse } from "./lib/api";

const lineOptions = [
  { value: "6", label: "老阴 6", short: "老阴", moving: true },
  { value: "7", label: "少阳 7", short: "少阳", moving: false },
  { value: "8", label: "少阴 8", short: "少阴", moving: false },
  { value: "9", label: "老阳 9", short: "老阳", moving: true }
];

const branchOrdinals = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

type LiuyaoCastMode = "coins" | "digitalCoins" | "auto" | "manual";
type MeihuaMethod = "MEIHUA_TWO_NUMBER_V1" | "MEIHUA_THREE_NUMBER_V1" | "MEIHUA_TIME_LUNAR_BRANCH_V1";

function tossCoins() {
  return Array.from({ length: 3 }, () => (Math.random() > 0.5 ? 3 : 2));
}

function lineValue(coins: number[]) {
  return coins.reduce((sum, item) => sum + item, 0);
}

function lineInfo(value: number | string) {
  return lineOptions.find((item) => item.value === String(value)) ?? lineOptions[1]!;
}

function coinText(coins: number[]) {
  return coins.map((coin) => (coin === 3 ? "阳" : "阴")).join(" / ");
}

function coinFace(value: string) {
  if (value === "3") return "阳";
  if (value === "2") return "阴";
  return "未";
}

export function SixApiDemo() {
  const [mode, setMode] = useState<DivinationMode>("liuyao");
  const [question, setQuestion] = useState("");
  const [liuyaoCastMode, setLiuyaoCastMode] = useState<LiuyaoCastMode>("coins");
  const [coinLines, setCoinLines] = useState<number[][]>([]);
  const [digitalCoinLines, setDigitalCoinLines] = useState<string[][]>(
    Array.from({ length: 6 }, () => ["", "", ""])
  );
  const [liuyaoValues, setLiuyaoValues] = useState(["", "", "", "", "", ""]);
  const [meihuaMethod, setMeihuaMethod] = useState<MeihuaMethod>("MEIHUA_TWO_NUMBER_V1");
  const [meihuaA, setMeihuaA] = useState("");
  const [meihuaB, setMeihuaB] = useState("");
  const [meihuaC, setMeihuaC] = useState("");
  const [lunarMonth, setLunarMonth] = useState("");
  const [lunarDay, setLunarDay] = useState("");
  const [yearBranchOrdinal, setYearBranchOrdinal] = useState("");
  const [hourBranchOrdinal, setHourBranchOrdinal] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState<ExperienceResponse | null>(null);

  const guided = report?.experience?.guidedViewModel;
  const supports = useMemo(() => guided?.mainSupports?.slice(0, 3) ?? [], [guided]);
  const risks = useMemo(() => guided?.mainRisks?.slice(0, 3) ?? [], [guided]);
  const castValues = useMemo(
    () => {
      if (liuyaoCastMode === "manual") return liuyaoValues.map((item) => Number(item));
      if (liuyaoCastMode === "digitalCoins") return digitalCoinLines.map((coins) => lineValue(coins.map(Number)));
      return coinLines.map(lineValue);
    },
    [coinLines, digitalCoinLines, liuyaoCastMode, liuyaoValues]
  );
  const digitalCoinsReady = digitalCoinLines.every((coins) => coins.length === 3 && coins.every((coin) => coin === "2" || coin === "3"));
  const manualReady = liuyaoValues.every((item) => ["6", "7", "8", "9"].includes(item));
  const liuyaoReady = liuyaoCastMode === "manual" ? manualReady : (liuyaoCastMode === "digitalCoins" ? digitalCoinsReady : coinLines.length === 6);
  const meihuaReady =
    meihuaMethod === "MEIHUA_TWO_NUMBER_V1"
      ? Boolean(meihuaA && meihuaB)
      : meihuaMethod === "MEIHUA_THREE_NUMBER_V1"
        ? Boolean(meihuaA && meihuaB && meihuaC)
        : Boolean(lunarMonth && lunarDay && yearBranchOrdinal && hourBranchOrdinal);
  const canGenerate = Boolean(question.trim()) && (mode === "liuyao" ? liuyaoReady : meihuaReady);
  const inputReady = mode === "liuyao" ? liuyaoReady : meihuaReady;
  const steps = [
    { label: "选择术法", done: true },
    { label: "填写问题", done: Boolean(question.trim()) },
    { label: "完成起卦", done: inputReady },
    { label: "生成报告", done: Boolean(report) }
  ];

  function switchMode(nextMode: DivinationMode) {
    setMode(nextMode);
    setError("");
    setReport(null);
  }

  function switchLiuyaoCastMode(nextMode: LiuyaoCastMode) {
    setLiuyaoCastMode(nextMode);
    setCoinLines([]);
    setDigitalCoinLines(Array.from({ length: 6 }, () => ["", "", ""]));
    setLiuyaoValues(["", "", "", "", "", ""]);
    setError("");
    setReport(null);
  }

  function switchMeihuaMethod(nextMethod: MeihuaMethod) {
    setMeihuaMethod(nextMethod);
    setError("");
    setReport(null);
  }

  function addCoinLine() {
    if (coinLines.length >= 6) return;
    setCoinLines([...coinLines, tossCoins()]);
    setReport(null);
  }

  function autoCastSixLines() {
    setCoinLines(Array.from({ length: 6 }, tossCoins));
    setLiuyaoCastMode("auto");
    setReport(null);
  }

  function toggleDigitalCoin(lineIndex: number, coinIndex: number) {
    const next = digitalCoinLines.map((line) => [...line]);
    if (!next[lineIndex]) return;
    next[lineIndex][coinIndex] = next[lineIndex][coinIndex] === "3" ? "2" : "3";
    setDigitalCoinLines(next);
    setReport(null);
  }

  function resetDigitalCoins() {
    setDigitalCoinLines(Array.from({ length: 6 }, () => ["", "", ""]));
    setReport(null);
  }

  async function createReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    if (!canGenerate) {
      setLoading(false);
      setError(mode === "liuyao" ? "请先填写问题并完成六爻生成。" : "请先填写问题并完成梅花起卦输入。");
      return;
    }

    const endpoint = mode === "liuyao" ? "liuyao/charts" : "meihua/charts";
    const payload =
      mode === "liuyao"
        ? {
            question,
            topic: "career",
            subtype: "job_search",
            ...(liuyaoCastMode === "manual" ? { values: castValues } : {}),
            ...(liuyaoCastMode === "digitalCoins" ? { coins: digitalCoinLines.map((line) => line.map(Number)) } : {}),
            ...(liuyaoCastMode === "coins" || liuyaoCastMode === "auto" ? { coins: coinLines } : {}),
            calendar: { timezone: "Asia/Shanghai" }
          }
        : {
            question,
            methodCode: meihuaMethod,
            ...(meihuaMethod === "MEIHUA_TWO_NUMBER_V1" ? { number_a: Number(meihuaA), number_b: Number(meihuaB) } : {}),
            ...(meihuaMethod === "MEIHUA_THREE_NUMBER_V1"
              ? { number_a: Number(meihuaA), number_b: Number(meihuaB), number_c: Number(meihuaC) }
              : {}),
            ...(meihuaMethod === "MEIHUA_TIME_LUNAR_BRANCH_V1"
              ? {
                  lunar_month: Number(lunarMonth),
                  lunar_day: Number(lunarDay),
                  year_branch_ordinal: Number(yearBranchOrdinal),
                  hour_branch_ordinal: Number(hourBranchOrdinal)
                }
              : {})
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
    <section className="workbench">
      <div className="workbench-header">
        <div>
          <p className="eyebrow">Workbench</p>
          <h2>开始一次占问</h2>
          <p>先选择术法，再完成起卦。系统只在你确认输入后生成报告。</p>
        </div>
        <a className="text-link" href="/history">查看报告历史</a>
      </div>

      <div className="mode-cards" aria-label="选择术法">
        <button type="button" className={mode === "liuyao" ? "mode-card active" : "mode-card"} onClick={() => switchMode("liuyao")}>
          <strong>六爻</strong>
          <span>适合围绕一个具体问题，逐爻生成本卦、变卦和动爻。</span>
        </button>
        <button type="button" className={mode === "meihua" ? "mode-card active" : "mode-card"} onClick={() => switchMode("meihua")}>
          <strong>梅花</strong>
          <span>适合通过数字或时间快速生成本互变与体用关系。</span>
        </button>
      </div>

      <ol className="flow-steps" aria-label="起卦步骤">
        {steps.map((step, index) => (
          <li className={step.done ? "done" : ""} key={step.label}>
            <span>{index + 1}</span>
            {step.label}
          </li>
        ))}
      </ol>

      <form className="workbench-form" onSubmit={createReport}>
        <label className="question-box">
          <span>你要问什么？</span>
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={500}
            placeholder="例如：这次合作接下来最需要注意什么？"
            required
            aria-describedby="question-help"
          />
          <p id="question-help" className="section-kicker">
            一个报告只处理一个问题。问题越具体，报告越容易复核。
          </p>
        </label>

        {mode === "liuyao" ? (
          <fieldset>
            <legend>六爻生成方式</legend>
            <div className="method-grid">
              <button type="button" className={liuyaoCastMode === "coins" ? "" : "secondary"} onClick={() => switchLiuyaoCastMode("coins")}>
                逐爻摇铜钱
              </button>
              <button
                type="button"
                className={liuyaoCastMode === "digitalCoins" ? "" : "secondary"}
                onClick={() => switchLiuyaoCastMode("digitalCoins")}
              >
                数字铜钱法
              </button>
              <button type="button" className={liuyaoCastMode === "auto" ? "" : "secondary"} onClick={() => switchLiuyaoCastMode("auto")}>
                自动代摇
              </button>
              <button type="button" className={liuyaoCastMode === "manual" ? "" : "secondary"} onClick={() => switchLiuyaoCastMode("manual")}>
                手动高级
              </button>
            </div>

            {liuyaoCastMode === "manual" ? (
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
                      <option value="">未选择</option>
                    </select>
                  </label>
                ))}
              </div>
            ) : liuyaoCastMode === "digitalCoins" ? (
              <div className="cast-flow">
                <p className="section-kicker">
                  每爻点三枚铜钱，阳面记 3，阴面记 2。点击铜钱可切换阴阳；系统按初爻到上爻排盘。
                </p>
                <div className="coin-number-grid" aria-label="数字铜钱法">
                  {digitalCoinLines.map((coins, lineIndex) => {
                    const complete = coins.every(Boolean);
                    const value = complete ? lineValue(coins.map(Number)) : 0;
                    const info = lineInfo(value);
                    return (
                      <div className="coin-number-line" key={`digital-line-${lineIndex}`}>
                        <strong>第 {lineIndex + 1} 爻</strong>
                        <div className="coin-buttons">
                          {coins.map((coin, coinIndex) => (
                            <button
                              aria-label={`第 ${lineIndex + 1} 爻第 ${coinIndex + 1} 枚铜钱，当前${coinFace(coin)}`}
                              className={coin === "3" ? "coin-button yang" : coin === "2" ? "coin-button yin" : "coin-button"}
                              key={`digital-line-${lineIndex}-coin-${coinIndex}`}
                              onClick={() => toggleDigitalCoin(lineIndex, coinIndex)}
                              type="button"
                            >
                              {coinFace(coin)}
                            </button>
                          ))}
                        </div>
                        <small>
                          {complete ? `${coinText(coins.map(Number))} / ${info.short} ${value}${info.moving ? " / 动爻" : ""}` : "点击三枚铜钱定阴阳"}
                        </small>
                      </div>
                    );
                  })}
                </div>
                <div className="form-actions">
                  <button type="button" className="secondary" onClick={resetDigitalCoins} disabled={!digitalCoinLines.some((line) => line.some(Boolean))}>
                    重新开始
                  </button>
                </div>
              </div>
            ) : (
              <div className="cast-flow">
                <p className="section-kicker">
                  {liuyaoCastMode === "auto"
                    ? coinLines.length === 6
                      ? "系统已一次生成六爻。需要重新开始时，可重新代摇一次。"
                      : "先静心确认问题，再点击开始代摇。系统会一次完成六爻，并保留每一爻的铜钱面。"
                    : "从初爻到上爻依次生成六次。每次三枚铜钱合计为 6、7、8、9，其中 6 和 9 为动爻。"}
                </p>
                <div className="cast-lines" aria-label="六爻生成结果">
                  {Array.from({ length: 6 }, (_, index) => {
                    const coins = coinLines[index];
                    const value = coins ? lineValue(coins) : null;
                    const info = value ? lineInfo(value) : null;
                    return (
                      <div className={coins ? "line-token complete" : "line-token"} key={`coin-line-${index}`}>
                        <strong>第 {index + 1} 爻</strong>
                        <div className="coin-pips" aria-hidden="true">
                          {(coins ?? [0, 0, 0]).map((coin, coinIndex) => (
                            <i
                              className={coin === 3 ? "yang" : coin === 2 ? "yin" : ""}
                              key={`coin-line-${index}-pip-${coinIndex}`}
                            />
                          ))}
                        </div>
                        <span>{coins ? `${info?.short} ${value}` : "待生成"}</span>
                        <small>{coins ? coinText(coins) : "从下往上"}</small>
                      </div>
                    );
                  })}
                </div>
                <div className="form-actions">
                  {liuyaoCastMode === "auto" ? (
                    <button type="button" onClick={autoCastSixLines}>
                      {coinLines.length === 6 ? "重新代摇一次" : "开始代摇六爻"}
                    </button>
                  ) : (
                    <button type="button" onClick={addCoinLine} disabled={coinLines.length >= 6}>
                      {coinLines.length >= 6 ? "六爻已完成" : `摇第 ${coinLines.length + 1} 爻`}
                    </button>
                  )}
                  <button type="button" className="secondary" onClick={() => setCoinLines([])} disabled={!coinLines.length}>
                    重新开始
                  </button>
                </div>
              </div>
            )}
          </fieldset>
        ) : (
          <fieldset>
            <legend>梅花起卦方式</legend>
            <div className="method-grid">
              <button
                type="button"
                className={meihuaMethod === "MEIHUA_TWO_NUMBER_V1" ? "" : "secondary"}
                onClick={() => switchMeihuaMethod("MEIHUA_TWO_NUMBER_V1")}
              >
                两数起卦
              </button>
              <button
                type="button"
                className={meihuaMethod === "MEIHUA_THREE_NUMBER_V1" ? "" : "secondary"}
                onClick={() => switchMeihuaMethod("MEIHUA_THREE_NUMBER_V1")}
              >
                三数起卦
              </button>
              <button
                type="button"
                className={meihuaMethod === "MEIHUA_TIME_LUNAR_BRANCH_V1" ? "" : "secondary"}
                onClick={() => switchMeihuaMethod("MEIHUA_TIME_LUNAR_BRANCH_V1")}
              >
                时间起卦
              </button>
            </div>
            {meihuaMethod === "MEIHUA_TIME_LUNAR_BRANCH_V1" ? (
              <div className="number-grid wide">
                <label>
                  <span>年支</span>
                  <select value={yearBranchOrdinal} onChange={(event) => setYearBranchOrdinal(event.target.value)}>
                    <option value="">选择年支</option>
                    {branchOrdinals.map((name, index) => (
                      <option key={name} value={index + 1}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>农历月</span>
                  <input type="number" min="1" max="12" value={lunarMonth} onChange={(event) => setLunarMonth(event.target.value)} />
                </label>
                <label>
                  <span>农历日</span>
                  <input type="number" min="1" max="30" value={lunarDay} onChange={(event) => setLunarDay(event.target.value)} />
                </label>
                <label>
                  <span>时支</span>
                  <select value={hourBranchOrdinal} onChange={(event) => setHourBranchOrdinal(event.target.value)}>
                    <option value="">选择时支</option>
                    {branchOrdinals.map((name, index) => (
                      <option key={name} value={index + 1}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : (
              <div className={meihuaMethod === "MEIHUA_THREE_NUMBER_V1" ? "number-grid wide" : "number-grid"}>
                <label>
                  <span>上数</span>
                  <input type="number" min="1" value={meihuaA} onChange={(event) => setMeihuaA(event.target.value)} />
                </label>
                <label>
                  <span>下数</span>
                  <input type="number" min="1" value={meihuaB} onChange={(event) => setMeihuaB(event.target.value)} />
                </label>
                {meihuaMethod === "MEIHUA_THREE_NUMBER_V1" ? (
                  <label>
                    <span>动爻数</span>
                    <input type="number" min="1" value={meihuaC} onChange={(event) => setMeihuaC(event.target.value)} />
                  </label>
                ) : null}
              </div>
            )}
            <p className="empty">
              当前方式会生成本卦、互卦、变卦和体用关系。提交前请确认数字来源与你的问题对应。
            </p>
          </fieldset>
        )}

        <div className="confirmation-strip">
          <strong>起卦确认</strong>
          <span>{mode === "liuyao" ? `六爻 / ${liuyaoReady ? castValues.map((item) => lineInfo(item).short).join("、") : "尚未完成六爻"}` : `梅花 / ${meihuaReady ? "输入已完成" : "尚未完成输入"}`}</span>
        </div>

        <div className="form-actions">
          <button type="submit" disabled={loading || !canGenerate}>
            {loading ? "正在整理报告" : "生成报告"}
          </button>
          <button type="button" className="secondary" onClick={() => setReport(null)} disabled={loading || !report}>
            清空结果
          </button>
          <a className="text-link" href="/history">
            查看历史
          </a>
        </div>
      </form>

      {loading ? (
        <div className="processing-panel" role="status">
          <strong>正在生成报告</strong>
          <span>排盘、整理依据、生成阅读层级。</span>
        </div>
      ) : null}

      {error ? <p className="error">{error}</p> : null}

      {guided ? (
        <div className="result-card">
          <div>
            <p className="eyebrow">{report?.type === "meihua" ? "梅花报告" : "六爻报告"}</p>
            <h3>{guided.headline}</h3>
            <p>{guided.summary}</p>
          </div>
          <div className="result-actions">
            <a className="primary-link" href={`/reports/${encodeURIComponent(report.id)}`}>打开报告</a>
            <a className="text-link" href={`/reports/${encodeURIComponent(report.id)}#professional-evidence`}>查看依据</a>
          </div>
          <div className="preview-grid compact">
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
          <div className="preview-grid compact">
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
        <p className="quiet-empty">完成问题和起卦输入后，报告预览会出现在这里。</p>
      )}
    </section>
  );
}
