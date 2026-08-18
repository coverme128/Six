"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiBase, readError, type ExperienceResponse } from "./lib/api";
import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  Compass,
  FileSearch,
  GraduationCap,
  Handshake,
  HeartHandshake,
  HeartPulse,
  History,
  House,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  WalletCards,
  type LucideIcon
} from "lucide-react";

const lineOptions = [
  { value: "6", label: "老阴 6", short: "老阴", moving: true },
  { value: "7", label: "少阳 7", short: "少阳", moving: false },
  { value: "8", label: "少阴 8", short: "少阴", moving: false },
  { value: "9", label: "老阳 9", short: "老阳", moving: true }
];

type LiuyaoCastMode = "coins" | "digitalCoins" | "auto" | "manual";

const scenarios = [
  {
    id: "career:job_search",
    group: "感情与合作",
    topic: "career",
    subtype: "job_search",
    label: "事业 / 工作",
    hint: "机会、岗位、面试、升迁",
    icon: BriefcaseBusiness,
    placeholder: "例如：这次面试机会接下来最需要注意什么？",
    examples: ["这次面试机会值得继续投入吗？", "未来三个月是否适合主动争取晋升？"],
    focus: ["机会质量", "阻碍来源", "推进节奏"],
    reportPreview: ["这次机会值不值得继续", "真正的卡点来自哪里", "下一步优先补什么"],
    boundary: "不替代职业决策，重点帮助你看清当前机会与阻碍。"
  },
  {
    id: "wealth:income",
    group: "工作与钱",
    topic: "wealth",
    subtype: "income",
    label: "求财 / 收入",
    hint: "收入、回款、现金流",
    icon: WalletCards,
    placeholder: "例如：这笔回款近期推进最需要注意什么？",
    examples: ["这笔回款近期能否按计划推进？", "当前收入计划最需要防范什么？"],
    focus: ["资金流动", "回收阻力", "风险边界"],
    reportPreview: ["资金能否按预期流动", "最需要防的延迟在哪里", "怎样行动更留有余地"],
    boundary: "不提供投资承诺或收益判断，只呈现趋势与风险。"
  },
  {
    id: "business:partnership",
    group: "工作与钱",
    topic: "business",
    subtype: "partnership",
    label: "合作 / 项目",
    hint: "合作方、合同、项目推进",
    icon: Handshake,
    placeholder: "例如：这个合作方是否值得继续深入推进？",
    examples: ["这个合作方值得继续深入推进吗？", "这个项目接下来最可能卡在哪里？"],
    focus: ["对方状态", "合作阻力", "项目稳定性"],
    reportPreview: ["合作有没有推进基础", "双方可能卡在哪里", "下一步怎样验证诚意"],
    boundary: "不替代合同审查，重点辅助判断合作节奏和风险。"
  },
  {
    id: "relationship:relationship_stability",
    group: "感情与合作",
    topic: "relationship",
    subtype: "relationship_stability",
    label: "感情 / 关系",
    hint: "关系状态、对方态度",
    icon: HeartHandshake,
    placeholder: "例如：这段关系接下来是否适合继续推进？",
    examples: ["这段关系接下来适合继续推进吗？", "我们最近反复拉扯的原因是什么？"],
    focus: ["双方状态", "互动阻力", "关系变化"],
    reportPreview: ["关系正在靠近还是疏远", "互动为什么反复或受阻", "现在适合沟通还是观察"],
    boundary: "不替你决定关系，只帮助拆解当下互动结构。"
  },
  {
    id: "study:exam",
    group: "工作与钱",
    topic: "study",
    subtype: "exam",
    label: "学业 / 考试",
    hint: "考试、申请、证书",
    icon: GraduationCap,
    placeholder: "例如：这次考试准备接下来最应该补哪里？",
    examples: ["这次考试准备最应该补哪里？", "这项申请目前最欠缺什么条件？"],
    focus: ["准备状态", "关键阻碍", "结果不确定性"],
    reportPreview: ["当前准备是否够用", "最薄弱的一环在哪里", "接下来优先补什么"],
    boundary: "不承诺录取或分数，重点帮助你调整准备策略。"
  },
  {
    id: "property:buy_house",
    group: "生活事务",
    topic: "property",
    subtype: "buy_house",
    label: "房产 / 居所",
    hint: "买卖、租住、搬迁",
    icon: House,
    placeholder: "例如：这次搬迁计划是否需要调整？",
    examples: ["这次搬迁计划是否需要调整？", "当前这套房是否适合继续推进交易？"],
    focus: ["居住稳定", "手续阻碍", "时间安排"],
    reportPreview: ["计划是否具备推进条件", "手续、资金或时间哪里会卡", "什么时候调整更稳妥"],
    boundary: "不替代法律或交易审查，重点看计划推进。"
  },
  {
    id: "legal:dispute",
    group: "健康与纠纷",
    topic: "legal",
    subtype: "dispute",
    label: "纠纷 / 法律",
    hint: "争议、程序、协商",
    icon: Scale,
    placeholder: "例如：这次争议接下来更适合协商还是等待？",
    examples: ["这次争议更适合协商还是等待？", "当前冲突最可能在哪一步升级？"],
    focus: ["协商空间", "程序阻力", "对方态度"],
    reportPreview: ["更适合协商还是等待", "冲突可能在哪里升级", "哪些决定必须交给专业人士"],
    boundary: "不提供法律建议或诉讼判断，必要时应咨询律师。"
  },
  {
    id: "health:self_health",
    group: "健康与纠纷",
    topic: "health",
    subtype: "self_health",
    label: "健康 / 恢复",
    hint: "仅作趋势参考",
    icon: HeartPulse,
    placeholder: "例如：近期恢复状态有哪些需要留意的地方？",
    examples: ["近期恢复状态有哪些需要留意？", "这段休养期应该重点观察什么变化？"],
    focus: ["恢复趋势", "注意事项", "外部支持"],
    reportPreview: ["恢复状态是否稳定", "哪些变化需要尽快就医", "日常可以先观察什么"],
    boundary: "不替代医生、诊断或治疗安排；不适请及时就医。"
  },
  {
    id: "goods:lost_item",
    group: "生活事务",
    topic: "goods",
    subtype: "lost_item",
    label: "寻物 / 物品",
    hint: "遗失、购买、交付",
    icon: Search,
    placeholder: "例如：这个遗失物品还有哪些寻找方向？",
    examples: ["这个遗失物品还有哪些寻找方向？", "这次购买或交付最容易卡在哪里？"],
    focus: ["寻找方向", "阻碍位置", "时间线索"],
    reportPreview: ["还有哪些寻找方向", "阻碍可能在哪里", "先按什么顺序排查"],
    boundary: "只提供趋势与行动线索，不承诺一定找回。"
  },
  {
    id: "travel:trip",
    group: "生活事务",
    topic: "travel",
    subtype: "trip",
    label: "出行 / 行程",
    hint: "旅行、签证、迁移",
    icon: Compass,
    placeholder: "例如：这次行程是否需要提前调整计划？",
    examples: ["这次行程是否需要提前调整？", "这项签证或迁移计划最可能卡在哪里？"],
    focus: ["行程稳定", "延误阻碍", "安全边界"],
    reportPreview: ["行程是否适合按计划推进", "哪里可能延误", "需要提前准备什么"],
    boundary: "不替代安全、签证或交通规则，重点辅助计划判断。"
  }
];

function scenarioById(id: string) {
  return scenarios.find((item) => item.id === id) ?? scenarios[0]!;
}

function ScenarioIcon({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon aria-hidden="true" strokeWidth={1.8} />;
}

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

function autoDigitalCoinLines() {
  return Array.from({ length: 6 }, () => tossCoins().map(String));
}

export function SixApiDemo() {
  const [question, setQuestion] = useState("");
  const [scenarioId, setScenarioId] = useState("relationship:relationship_stability");
  const [scenarioGroup, setScenarioGroup] = useState("感情与合作");
  const [liuyaoCastMode, setLiuyaoCastMode] = useState<LiuyaoCastMode>("auto");
  const [coinLines, setCoinLines] = useState<number[][]>([]);
  const [digitalCoinsStarted, setDigitalCoinsStarted] = useState(false);
  const [digitalCoinLines, setDigitalCoinLines] = useState<string[][]>(
    Array.from({ length: 6 }, () => ["", "", ""])
  );
  const [liuyaoValues, setLiuyaoValues] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState<ExperienceResponse | null>(null);

  const guided = report?.experience?.guidedViewModel;
  const scenario = scenarioById(scenarioId);
  const scenarioGroups = useMemo(
    () => ["感情与合作", "工作与钱", "生活事务", "健康与纠纷"].map((group) => ({ group, items: scenarios.filter((item) => item.group === group) })),
    []
  );
  const currentScenarioGroup = scenarioGroups.find((group) => group.group === scenarioGroup) ?? scenarioGroups[0]!;
  const supports = useMemo(() => guided?.mainSupports?.slice(0, 3) ?? [], [guided]);
  const risks = useMemo(() => guided?.mainRisks?.slice(0, 3) ?? [], [guided]);

  useEffect(() => {
    const requestedScenario = new URLSearchParams(window.location.search).get("scenario");
    const matched = scenarios.find((item) => item.topic === requestedScenario || item.id === requestedScenario);
    if (matched) {
      setScenarioId(matched.id);
      setScenarioGroup(matched.group);
    }
  }, []);
  const castValues = useMemo(
    () => {
      if (liuyaoCastMode === "manual") return liuyaoValues.map((item) => Number(item));
      if (liuyaoCastMode === "digitalCoins") return digitalCoinLines.map((coins) => lineValue(coins.map(Number)));
      return coinLines.map(lineValue);
    },
    [coinLines, digitalCoinLines, liuyaoCastMode, liuyaoValues]
  );
  const digitalCoinsReady = digitalCoinsStarted && digitalCoinLines.every((coins) => coins.length === 3 && coins.every((coin) => coin === "2" || coin === "3"));
  const manualReady = liuyaoValues.every((item) => ["6", "7", "8", "9"].includes(item));
  const liuyaoReady = liuyaoCastMode === "manual" ? manualReady : (liuyaoCastMode === "digitalCoins" ? digitalCoinsReady : coinLines.length === 6);
  const canGenerate = Boolean(question.trim()) && liuyaoReady;

  function switchLiuyaoCastMode(nextMode: LiuyaoCastMode) {
    setLiuyaoCastMode(nextMode);
    setCoinLines([]);
    setDigitalCoinsStarted(false);
    setDigitalCoinLines(Array.from({ length: 6 }, () => ["", "", ""]));
    setLiuyaoValues(["", "", "", "", "", ""]);
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

  function startDigitalCoins() {
    setDigitalCoinsStarted(true);
    setDigitalCoinLines(autoDigitalCoinLines());
    setError("");
    setReport(null);
  }

  function resetDigitalCoins() {
    setDigitalCoinsStarted(false);
    setDigitalCoinLines(Array.from({ length: 6 }, () => ["", "", ""]));
    setReport(null);
  }

  async function createReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    if (!canGenerate) {
      setLoading(false);
      setError("请先填写问题并完成六爻生成。");
      return;
    }

    const payload = {
      question,
      topic: scenario.topic,
      subtype: scenario.subtype,
      ...(liuyaoCastMode === "manual" ? { values: castValues } : {}),
      ...(liuyaoCastMode === "digitalCoins" ? { coins: digitalCoinLines.map((line) => line.map(Number)) } : {}),
      ...(liuyaoCastMode === "coins" || liuyaoCastMode === "auto" ? { coins: coinLines } : {}),
      calendar: { timezone: "Asia/Shanghai" }
    };

    try {
      const created = await fetch(`${apiBase()}/liuyao/charts`, {
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
    <section className="workbench" id="liuyao-workbench">
      <form className="journey-form" onSubmit={createReport}>
        <section className="journey-screen scenario-step" id="scenario-step">
          <header className="journey-heading">
            <div>
              <span className="journey-step">第 1 步</span>
              <h2>你现在最想看清哪件事？</h2>
              <p>按你正在面对的事情来选。找不到完全一致的选项时，选择最接近的一项即可。</p>
            </div>
            <a className="history-link" href="/history">
              <History aria-hidden="true" size={17} />
              历史报告
            </a>
          </header>

          <fieldset className="scenario-fieldset">
            <legend className="sr-only">选择问题场景</legend>
            <div className="scenario-category-tabs" role="tablist" aria-label="问题类型">
              {scenarioGroups.map((group) => (
                <button
                  type="button"
                  role="tab"
                  aria-selected={scenarioGroup === group.group}
                  className={scenarioGroup === group.group ? "active" : ""}
                  key={group.group}
                  onClick={() => {
                    setScenarioGroup(group.group);
                    setScenarioId(group.items[0]!.id);
                    setReport(null);
                  }}
                >
                  {group.group}
                </button>
              ))}
            </div>
            <div className="scenario-group">
              <div className="scenario-group-title">
                <strong>{currentScenarioGroup.group}</strong>
                <span>{
                  currentScenarioGroup.group === "感情与合作"
                    ? "感情走向、对方态度与合作关系"
                    : currentScenarioGroup.group === "工作与钱"
                      ? "工作机会、收入与学习发展"
                      : currentScenarioGroup.group === "生活事务"
                        ? "居所、出行、寻物与具体计划"
                        : "健康问题先找医生，纠纷问题先找律师"
                }</span>
              </div>
              <div className={`scenario-grid${currentScenarioGroup.items.length <= 2 ? " compact" : ""}`} role="radiogroup" aria-label={`${currentScenarioGroup.group}场景`}>
                {currentScenarioGroup.items.map((item) => {
                  const active = scenarioId === item.id;
                  return (
                    <button
                      type="button"
                      className={`scenario-option scenario-${item.topic}${active ? " active" : ""}`}
                      key={item.id}
                      onClick={() => {
                        setScenarioId(item.id);
                        setReport(null);
                      }}
                      role="radio"
                      aria-checked={active}
                    >
                      <span className="scenario-icon"><ScenarioIcon icon={item.icon} /></span>
                      <span className="scenario-copy">
                        <strong>{item.label}</strong>
                        <small>{item.hint}</small>
                      </span>
                      <span className="scenario-check" aria-hidden="true">{active ? <Check size={16} /> : null}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </fieldset>

          <div className="scenario-selection-summary" aria-live="polite">
            <div className="selection-summary-title">
              <span className={`scenario-icon scenario-${scenario.topic}`}><ScenarioIcon icon={scenario.icon} /></span>
              <div>
                <span>已选择</span>
                <h3>{scenario.label}</h3>
              </div>
            </div>
            <div className="scenario-answer-grid">
              {scenario.reportPreview.map((item, index) => (
                <div key={item}>
                  <span>{["先看方向", "再找卡点", "落到行动"][index]}</span>
                  <strong>{item}</strong>
                </div>
              ))}
            </div>
            <p className="scenario-boundary"><ShieldCheck aria-hidden="true" size={18} />{scenario.boundary}</p>
            <button type="button" className="continue-button" onClick={() => document.getElementById("question-step")?.scrollIntoView({ behavior: "smooth" })}>
              按这个场景继续
              <ArrowRight aria-hidden="true" size={17} />
            </button>
          </div>
        </section>

        <section className="journey-screen question-step" id="question-step">
          <header className="journey-heading compact">
            <div>
              <span className="journey-step">第 2 步</span>
              <h2>写下此刻最想确认的一件事</h2>
              <p>说清相关的人、当前情况，以及你正在犹豫的选择，报告会更贴近你的实际处境。</p>
            </div>
            <div className="selected-scenario-pill">
              <ScenarioIcon icon={scenario.icon} />
              <span>{scenario.label}</span>
            </div>
          </header>

          <label className="question-box prominent">
            <span>你的问题</span>
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              maxLength={500}
              rows={4}
              placeholder={scenario.placeholder}
              required
              aria-describedby="question-help"
            />
            <p id="question-help">一次聚焦一件事，例如“这段关系现在适合继续推进吗？”</p>
          </label>

          <div className="question-examples" aria-label="问题示例">
            <span>可以这样问</span>
            <div>
              {scenario.examples.map((example) => (
                <button type="button" key={example} onClick={() => setQuestion(example)}>{example}</button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="continue-button"
            disabled={!question.trim()}
            onClick={() => document.getElementById("cast-step")?.scrollIntoView({ behavior: "smooth" })}
          >
            就问这个问题
            <ArrowRight aria-hidden="true" size={17} />
          </button>
        </section>

        <section className="journey-screen cast-step" id="cast-step">
          <header className="journey-heading compact">
            <div>
              <span className="journey-step">第 3 步</span>
              <h2>确认问题，开始起卦</h2>
              <p>确认这是你此刻最想了解的问题，然后开始起卦。</p>
            </div>
            <div className="question-confirmation">
              <FileSearch aria-hidden="true" size={18} />
              <span>{question.trim() || "请先在上一屏填写问题"}</span>
            </div>
          </header>

          <aside className="trust-note" aria-label="报告生成说明">
            <ShieldCheck aria-hidden="true" size={20} />
            <div>
              <strong>排盘与判断依据不会由 AI 改写</strong>
              <span>AI 只负责把正式结果解释清楚，不替换本次盘面和规则判断。</span>
              <details className="trust-disclosure">
                <summary>了解报告如何生成与复核</summary>
                <div>
                  <span><strong>先生成盘面</strong>本卦、变卦与动爻在报告文字生成前确定。</span>
                  <span><strong>判断有来源</strong>主要结论、支持与阻碍可以回到对应依据。</span>
                  <span><strong>解释有边界</strong>AI 不重新排盘，不修改正式判断，也不承诺现实结果。</span>
                </div>
              </details>
            </div>
          </aside>

          <fieldset className="cast-method-fieldset">
            <legend className="sr-only">选择并完成起卦</legend>
            <div className="cast-method-header">
              <div>
                <strong>{liuyaoCastMode === "auto" ? "系统代摇" : liuyaoCastMode === "coins" ? "逐爻摇铜钱" : liuyaoCastMode === "digitalCoins" ? "数字铜钱法" : "手动录入爻值"}</strong>
                <span>{liuyaoCastMode === "auto" ? "推荐方式，一次完成六爻" : "已选择自定义起卦方式"}</span>
              </div>
              <details className="cast-method-picker">
                <summary>更换起卦方式</summary>
                <div className="method-grid">
                  <button type="button" className={liuyaoCastMode === "auto" ? "" : "secondary"} onClick={() => switchLiuyaoCastMode("auto")}>
                    <Sparkles aria-hidden="true" size={17} />
                    系统代摇（推荐）
                  </button>
                  <button type="button" className={liuyaoCastMode === "coins" ? "" : "secondary"} onClick={() => switchLiuyaoCastMode("coins")}>
                    我自己逐爻摇
                  </button>
                  <button type="button" className={liuyaoCastMode === "digitalCoins" ? "" : "secondary"} onClick={() => switchLiuyaoCastMode("digitalCoins")}>
                    使用数字铜钱
                  </button>
                  <button type="button" className={liuyaoCastMode === "manual" ? "" : "secondary"} onClick={() => switchLiuyaoCastMode("manual")}>
                    手动录入爻值
                  </button>
                </div>
              </details>
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
                {digitalCoinsStarted ? (
                  <>
                    <p className="section-kicker">
                      系统已按数字铜钱法自动生成六爻，阳面记 3，阴面记 2。确认后即可生成报告。
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
                                <span
                                  aria-label={`第 ${lineIndex + 1} 爻第 ${coinIndex + 1} 枚铜钱，当前${coinFace(coin)}`}
                                  className={coin === "3" ? "coin-face yang" : coin === "2" ? "coin-face yin" : "coin-face"}
                                  key={`digital-line-${lineIndex}-coin-${coinIndex}`}
                                >
                                  {coinFace(coin)}
                                </span>
                              ))}
                            </div>
                            <small>
                              {complete ? `${coinText(coins.map(Number))} / ${info.short} ${value}${info.moving ? " / 动爻" : ""}` : "点击三枚铜钱定阴阳"}
                            </small>
                          </div>
                        );
                      })}
                    </div>
                    <button type="button" className="tertiary-button" onClick={resetDigitalCoins}>
                      重新使用数字铜钱起卦
                    </button>
                  </>
                ) : (
                  <div className="ritual-panel">
                    <div>
                      <strong>数字铜钱法</strong>
                      <span>点击开始后，系统会一次生成六爻铜钱面；你只需确认问题，再生成报告。</span>
                    </div>
                    <button type="button" onClick={startDigitalCoins}>
                      开始起卦
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="cast-flow">
                {liuyaoCastMode === "auto" && coinLines.length === 0 ? (
                  <div className="ritual-panel">
                    <div>
                      <strong>准备好了就开始</strong>
                      <span>系统会一次完成六爻，并保留每一爻的铜钱面。</span>
                    </div>
                    <button type="button" onClick={autoCastSixLines}>开始起卦</button>
                  </div>
                ) : (
                  <>
                    <p className="section-kicker">
                      {liuyaoCastMode === "auto"
                        ? "起卦已经完成，确认后即可生成报告。"
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
                    <div className="cast-primary-action">
                      {liuyaoCastMode === "auto" ? (
                        <>
                          <span className="completion-badge">起卦已完成</span>
                          <button type="button" className="tertiary-button" onClick={autoCastSixLines}>重新起卦</button>
                        </>
                      ) : coinLines.length >= 6 ? (
                        <span className="completion-badge">六爻已完成</span>
                      ) : (
                        <button type="button" onClick={addCoinLine}>摇第 {coinLines.length + 1} 爻</button>
                      )}
                      {liuyaoCastMode === "coins" && coinLines.length ? (
                        <button type="button" className="tertiary-button" onClick={() => setCoinLines([])}>重新逐爻起卦</button>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            )}
          </fieldset>

          <div className="confirmation-strip">
            <strong>当前进度</strong>
            <span>{`${scenario.label} · ${question.trim() ? "问题已确认" : "等待问题"} · ${liuyaoReady ? "六爻已完成" : "等待起卦"}`}</span>
          </div>

          {canGenerate || loading ? (
            <div className="form-actions final-actions">
              <button type="submit" disabled={loading}>
                {loading ? "正在整理报告" : "生成我的六爻报告"}
              </button>
              {report ? <button type="button" className="tertiary-button" onClick={() => setReport(null)} disabled={loading}>移除当前结果</button> : null}
            </div>
          ) : null}
        </section>
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
            <p className="eyebrow">六爻报告</p>
            <h3>{guided.scenarioGuidance?.headline ?? guided.headline}</h3>
            <p>{guided.scenarioGuidance?.decisionFocus ?? guided.summary}</p>
          </div>
          {guided.scenarioGuidance?.scenario === "RELATIONSHIP" ? (
            <div className="relationship-preview">
              <div><span>你这边</span><strong>{guided.scenarioGuidance.selfSignal?.summary}</strong></div>
              <div><span>对方与互动</span><strong>{guided.scenarioGuidance.otherSignal?.summary}</strong></div>
            </div>
          ) : null}
          <div className="result-actions">
            <a className="primary-link" href={`/reports/${encodeURIComponent(report.id)}`}>打开报告</a>
            <a className="text-link" href={`/reports/${encodeURIComponent(report.id)}#professional-evidence`}>查看依据</a>
          </div>
          <div className="preview-grid compact">
            {guided.coreMatter ? (
              <div>
                <strong>核心事项</strong>
                <p>{guided.coreMatter.summary}</p>
              </div>
            ) : null}
            {guided.observationFocus ? (
              <div>
                <strong>观察重点</strong>
                <p>{guided.observationFocus.summary}</p>
              </div>
            ) : null}
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
      ) : null}
    </section>
  );
}
