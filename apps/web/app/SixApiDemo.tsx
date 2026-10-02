"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { LiuyaoChartRequestSchema, QuestionUnderstandingSchema } from "@six/shared";
import { workspaceFetch, workspaceToken } from "./lib/workspace";
import { originalCastInstant, wallTime } from "./lib/cast-time";
import { apiBase, type ExperienceResponse } from "./lib/api";
import { QuestionClarification, understandQuestion, type UnderstandingResult } from "./QuestionUnderstanding";
import {
  ArrowRight,
  BriefcaseBusiness,
  Compass,
  FileSearch,
  GraduationCap,
  Handshake,
  HeartHandshake,
  HeartPulse,
  House,
  Scale,
  Search,
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

type CastSubmission = {
  mode: LiuyaoCastMode;
  coins?: number[][];
  digitalCoins?: string[][];
  values?: number[];
};

const scenarios = [
  {
    id: "career:job_search",
    group: "工作与钱",
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
    group: "感情与合作",
    topic: "business",
    subtype: "partnership",
    label: "合作 / 项目",
    hint: "合作方、合同、项目推进",
    icon: Handshake,
    placeholder: "例如：这个合作方是否值得继续深入推进？",
    examples: ["这个项目合作值得继续参与吗？", "今年是否适合成立公司，自己负责经营？"],
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
    examples: ["这段恋爱关系适合继续推进吗？", "我与前任现在适合尝试复合吗？", "我与恋人最近反复争执，该如何沟通？"],
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

const coreScenes = [
  { id: "relationship", label: "感情关系", icon: HeartHandshake, scenario: "relationship:relationship_stability" },
  { id: "career", label: "工作事业", icon: BriefcaseBusiness, scenario: "career:job_search" },
  { id: "business", label: "合作创业", icon: Handshake, scenario: "business:partnership" },
  { id: "wealth", label: "财务收支", icon: WalletCards, scenario: "wealth:income" },
  { id: "study", label: "学业考试", icon: GraduationCap, scenario: "study:exam" },
  { id: "life", label: "生活事务", icon: House, scenario: "property:buy_house" },
] as const;
const lifeTopics = ["property", "travel", "goods", "legal", "health"];

function ScenarioIcon({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon aria-hidden="true" strokeWidth={1.8} />;
}

function tossCoins() {
  return Array.from(crypto.getRandomValues(new Uint8Array(3)), (value) => value % 2 ? 3 : 2);
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
  const [castTime, setCastTime] = useState("");
  const [timezone, setTimezone] = useState("Asia/Shanghai");
  const [instantUtc, setInstantUtc] = useState("");
  const [requestId, setRequestId] = useState("");
  const [submittedPayload, setSubmittedPayload] = useState<ReturnType<typeof LiuyaoChartRequestSchema.parse> | null>(null);
  const [createdId, setCreatedId] = useState("");
  const [restored, setRestored] = useState(false);
  const [understandingFailed, setUnderstandingFailed] = useState(false);
  const requestController = useRef<AbortController | null>(null);
  const submitting = useRef(false);
  const [question, setQuestion] = useState("");
  const [scenarioId, setScenarioId] = useState("relationship:relationship_stability");
  const [activeScene, setActiveScene] = useState<string | null>(null);
  const [understanding, setUnderstanding] = useState<UnderstandingResult | null>(null);
  const [clarification, setClarification] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const [understandingBusy, setUnderstandingBusy] = useState(false);
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
  const supports = useMemo(() => guided?.mainSupports?.slice(0, 3) ?? [], [guided]);
  const risks = useMemo(() => guided?.mainRisks?.slice(0, 3) ?? [], [guided]);

  useEffect(() => {
    const requestedScenario = new URLSearchParams(window.location.search).get("scenario");
    const matched = scenarios.find((item) => item.topic === requestedScenario || item.id === requestedScenario);
    if (matched) {
      setScenarioId(matched.id);
      setActiveScene(coreScenes.find((item) => item.scenario === matched.id)?.id ?? "life");
    }
    const requestedQuestion = new URLSearchParams(window.location.search).get("question");
    if (requestedQuestion?.trim()) setQuestion(requestedQuestion.trim().slice(0, 500));
    else {
      try {
        const draft = JSON.parse(localStorage.getItem("six-cast-draft-v2") ?? sessionStorage.getItem("six-question-draft") ?? "null");
        if (draft && Date.now() - draft.savedAt < 7 * 24 * 60 * 60 * 1000 && typeof draft.question === "string") {
          setQuestion(draft.question.slice(0, 500));
          if (typeof draft.clarification === "string") setClarification(draft.clarification.slice(0, 500));
          if (["auto", "manual", "coins", "digitalCoins"].includes(draft.mode)) setLiuyaoCastMode(draft.mode);
          if (Array.isArray(draft.values) && draft.values.length === 6 && draft.values.every((v: unknown) => ["", "6", "7", "8", "9"].includes(String(v)))) setLiuyaoValues(draft.values.map(String));
          if (Array.isArray(draft.coins) && draft.coins.length <= 6 && draft.coins.every((line: any) => Array.isArray(line) && line.length === 3 && line.every((v: unknown) => v === 2 || v === 3))) setCoinLines(draft.coins);
          if (Array.isArray(draft.digitalCoins) && draft.digitalCoins.length === 6 && draft.digitalCoins.every((line: any) => Array.isArray(line) && line.length === 3 && line.every((v: unknown) => ["", "2", "3"].includes(String(v))))) {
            setDigitalCoinLines(draft.digitalCoins); setDigitalCoinsStarted(Boolean(draft.digitalCoinsStarted));
          }
          if (typeof draft.timezone === "string") { new Intl.DateTimeFormat("en", { timeZone: draft.timezone }); setTimezone(draft.timezone); }
          if (typeof draft.castTime === "string") setCastTime(draft.castTime);
          if (typeof draft.instantUtc === "string" && Number.isFinite(Date.parse(draft.instantUtc))) setInstantUtc(draft.instantUtc);
          if (typeof draft.requestId === "string") setRequestId(draft.requestId);
          if (draft.understanding && QuestionUnderstandingSchema.safeParse(draft.understanding.understanding).success) setUnderstanding(draft.understanding);
          if (LiuyaoChartRequestSchema.safeParse(draft.submittedPayload).success) setSubmittedPayload(draft.submittedPayload);
          if (typeof draft.createdId === "string") setCreatedId(draft.createdId);
          setRestored(true);
        }
      } catch { /* Storage may be disabled; the form remains usable. */ }
    }
    setDraftReady(true);
  }, []);
  function persistDraft(overrides: Record<string, unknown> = {}) {
    workspaceToken();
    localStorage.setItem("six-cast-draft-v2", JSON.stringify({ question, clarification, mode: liuyaoCastMode, values: liuyaoValues,
      coins: coinLines, digitalCoins: digitalCoinLines, digitalCoinsStarted, castTime, timezone, instantUtc, requestId,
      understanding, submittedPayload, createdId, savedAt: Date.now(), ...overrides }));
  }
  useEffect(() => {
    if (!draftReady) return;
    try {
      if (question.trim()) persistDraft();
      else localStorage.removeItem("six-cast-draft-v2");
    } catch { setError("浏览器未能保存草稿，请允许本站本地存储后继续。"); }
  }, [question, clarification, draftReady, liuyaoCastMode, liuyaoValues, coinLines, digitalCoinLines, digitalCoinsStarted, castTime, timezone, instantUtc, requestId, understanding, submittedPayload, createdId]);
  useEffect(() => () => requestController.current?.abort(), []);
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
  const questionReady = Boolean(question.trim()) && Boolean(understanding && ["RESOLVED", "BRANCHED"].includes(understanding.understanding.status));
  const canGenerate = Boolean(question.trim()) && liuyaoReady;
  const locked = loading || understandingBusy || Boolean(submittedPayload);

  function switchLiuyaoCastMode(nextMode: LiuyaoCastMode) {
    if (locked || nextMode === liuyaoCastMode) return;
    if ((coinLines.length || digitalCoinsStarted || liuyaoValues.some(Boolean)) && !window.confirm("切换方式会清除当前尚未提交的卦爻，确定切换吗？")) return;
    setLiuyaoCastMode(nextMode);
    setInstantUtc(""); setRequestId(""); setUnderstandingFailed(false);
    setCoinLines([]);
    setDigitalCoinsStarted(false);
    setDigitalCoinLines(Array.from({ length: 6 }, () => ["", "", ""]));
    setLiuyaoValues(["", "", "", "", "", ""]);
    setError("");
    setReport(null);
  }

  function moveToStep(id: string, focusSelector?: string) {
    window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (focusSelector) {
        window.setTimeout(() => document.querySelector<HTMLElement>(focusSelector)?.focus({ preventScroll: true }), 360);
      }
    }, 40);
  }

  function chooseScenario(nextScenarioId: string) {
    setScenarioId(nextScenarioId);
    setReport(null);
  }

  function changeQuestion(value: string) {
    if (locked) return;
    setQuestion(value);
    setUnderstanding(null);
    setClarification("");
    setReport(null);
    setUnderstandingFailed(false);
  }

  async function prepareQuestion(answer = "", generateImmediately = liuyaoCastMode === "auto") {
    if (understandingBusy || loading) return;
    setUnderstandingBusy(true);
    setError("");
    const nextClarification = answer ? [clarification, answer].filter(Boolean).join("；").slice(0, 500) : clarification;
    setClarification(nextClarification);
    requestController.current = new AbortController();
    try {
      const result = await understandQuestion(question, nextClarification, requestController.current.signal);
      setUnderstanding(result);
      setClarification(nextClarification);
      if (["RESOLVED", "BRANCHED"].includes(result.understanding.status)) {
        if (generateImmediately) {
          const nextLines = coinLines.length === 6 ? coinLines : Array.from({ length: 6 }, tossCoins);
          setCoinLines(nextLines);
          await generateReport({ mode: "auto", coins: nextLines }, result, nextClarification);
        } else if (canGenerate) await generateReport(undefined, result, nextClarification);
        else moveToStep("cast-step");
      }
    } catch (err) { setUnderstandingFailed(true); setError(err instanceof Error ? err.message : "暂时无法理解问题，请重试。"); }
    finally { setUnderstandingBusy(false); }
  }

  function addCoinLine() {
    if (coinLines.length >= 6) return;
    const nextLines = [...coinLines, tossCoins()];
    if (!instantUtc) setInstantUtc(new Date().toISOString());
    setCoinLines(nextLines);
    setReport(null);
    if (nextLines.length === 6) void generateReport({ mode: "coins", coins: nextLines });
  }

  function autoCastSixLines(generateAfterCast = false) {
    if (coinLines.length && !window.confirm("重新起卦会放弃当前尚未提交的卦爻，确定继续吗？")) return;
    setInstantUtc(""); setRequestId("");
    const nextLines = Array.from({ length: 6 }, tossCoins);
    setCoinLines(nextLines);
    setLiuyaoCastMode("auto");
    setReport(null);
    if (generateAfterCast) void generateReport({ mode: "auto", coins: nextLines });
  }

  function startDigitalCoins() {
    const nextLines = autoDigitalCoinLines();
    setDigitalCoinsStarted(true);
    setDigitalCoinLines(nextLines);
    setError("");
    setReport(null);
    void generateReport({ mode: "digitalCoins", digitalCoins: nextLines });
  }

  function resetDigitalCoins() {
    if (!window.confirm("放弃当前数字铜钱记录并重新起卦？")) return;
    setInstantUtc(""); setRequestId("");
    setDigitalCoinsStarted(false);
    setDigitalCoinLines(Array.from({ length: 6 }, () => ["", "", ""]));
    setReport(null);
  }

  async function generateReport(submission?: CastSubmission, understood = understanding, answer = clarification, defer = false) {
    if (submitting.current) return;
    if (createdId) { window.location.assign(`/reports/${encodeURIComponent(createdId)}`); return; }
    submitting.current = true;
    requestController.current = new AbortController();
    setLoading(true);
    setError("");

    if (!submittedPayload && (!question.trim() || (!submission && !canGenerate))) {
      setLoading(false);
      submitting.current = false;
      setError("请填写问题并完成六爻记录。");
      return;
    }

    const submissionMode = submission?.mode ?? liuyaoCastMode;
    const submissionCoins = submission?.coins ?? coinLines;
    const submissionDigitalCoins = submission?.digitalCoins ?? digitalCoinLines;
    const submissionValues = submission?.values ?? castValues;

    try {
    const fixedInstant = submittedPayload?.calendar.instantUtc ?? (submissionMode === "manual" ? originalCastInstant(castTime, timezone) : instantUtc || new Date().toISOString());
    const castId = submittedPayload?.requestId ?? (requestId || crypto.randomUUID());
    setInstantUtc(fixedInstant); setRequestId(castId);
    // Persist the cast before any remote work. A retry uses the exact same input and identifier.
    persistDraft({ instantUtc: fixedInstant, requestId: castId, coins: submissionCoins, digitalCoins: submissionDigitalCoins });
    if (!submittedPayload && !defer && !["RESOLVED", "BRANCHED"].includes(understood?.understanding.status ?? "")) {
      requestController.current = new AbortController();
      try { understood = await understandQuestion(question, answer, requestController.current.signal); }
      catch (err) { setUnderstandingFailed(true); throw err; }
      setUnderstanding(understood);
      if (["CLARIFY", "SPLIT"].includes(understood.understanding.status)) { moveToStep("question-step"); return; }
    }
    const payload = submittedPayload ? { ...submittedPayload, deferUnderstanding: defer || submittedPayload.deferUnderstanding } : LiuyaoChartRequestSchema.parse({
      requestId: castId,
      deferUnderstanding: defer,
      question,
      understandingToken: understood?.understandingToken,
      clarification: answer,
      ...(submissionMode === "manual" ? { values: submissionValues } : {}),
      ...(submissionMode === "digitalCoins" ? { coins: submissionDigitalCoins.map((line) => line.map(Number)) } : {}),
      ...(submissionMode === "coins" || submissionMode === "auto" ? { coins: submissionCoins } : {}),
      calendar: { timezone, instantUtc: fixedInstant }
    });
    setSubmittedPayload(payload);
    persistDraft({ submittedPayload: payload, instantUtc: fixedInstant, requestId: castId, coins: submissionCoins, digitalCoins: submissionDigitalCoins });

      const created = await workspaceFetch(`${apiBase()}/liuyao/charts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: requestController.current?.signal,
      });
      if (!created.ok) {
        const failure = await created.json();
        if (["QUESTION_PROVIDER_UNAVAILABLE", "QUESTION_UNDERSTANDING_FAILED", "AI_RATE_LIMITED"].includes(failure.code)) setUnderstandingFailed(true);
        if (failure.understanding) { setUnderstanding(failure); setSubmittedPayload(null); persistDraft({ submittedPayload: null }); moveToStep("question-step"); }
        throw new Error(failure.message ?? "报告暂未保存，请重试。");
      }
      const createdJson = (await created.json()) as ExperienceResponse;
      setCreatedId(createdJson.id);
      persistDraft({ createdId: createdJson.id, submittedPayload: payload, instantUtc: fixedInstant, requestId: castId });
      try { sessionStorage.removeItem("six-question-draft"); } catch { /* Legacy draft cleanup. */ }
      window.location.assign(`/reports/${encodeURIComponent(createdJson.id)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "暂时无法连接 API");
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }

  function createReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void generateReport();
  }

  function startNewQuestion() {
    if (!window.confirm(createdId ? "开始新的问题？已经保存的报告仍在“我的报告”中。" : "放弃当前草稿并重新开始？已经记录的卦爻将被清除。")) return;
    setQuestion(""); setClarification(""); setUnderstanding(null); setSubmittedPayload(null); setCreatedId("");
    setCoinLines([]); setLiuyaoValues(["", "", "", "", "", ""]); setDigitalCoinsStarted(false);
    setDigitalCoinLines(Array.from({ length: 6 }, () => ["", "", ""]));
    setInstantUtc(""); setCastTime(""); setRequestId(""); setLiuyaoCastMode("auto"); setError(""); setRestored(false); setUnderstandingFailed(false);
    localStorage.removeItem("six-cast-draft-v2"); sessionStorage.removeItem("six-question-draft");
  }

  function saveWithoutAI() {
    const coins = coinLines.length === 6 ? coinLines : Array.from({ length: 6 }, tossCoins);
    if (liuyaoCastMode === "auto") { setCoinLines(coins); void generateReport({ mode: "auto", coins }, understanding, clarification, true); }
    else void generateReport(undefined, understanding, clarification, true);
  }

  return (
    <section className="workbench" id="liuyao-workbench">
      {restored || submittedPayload || createdId ? <div className="cast-recovery" role="status">
        <span>{createdId ? "本次报告已保存。" : submittedPayload ? "本次盘面已锁定，重试不会重新起卦。" : "已恢复未完成的问题和卦爻。"}</span>
        {createdId ? <a href={`/reports/${encodeURIComponent(createdId)}`}>继续查看报告</a> : submittedPayload ? <button type="button" disabled={loading || understandingBusy} onClick={() => void generateReport()}>继续保存原卦</button> : null}
        <button type="button" className="text-link" disabled={loading || understandingBusy} onClick={startNewQuestion}>{createdId ? "开始新问题" : "放弃草稿"}</button>
      </div> : null}
      <form className="journey-form" onSubmit={createReport}>
        <section className="journey-screen question-step" id="question-step">
          <header className="journey-heading compact">
            <div>
              <h2>你想问什么？</h2>
            </div>
          </header>

          <div className="home-scenes" role="group" aria-label="问题场景（可选）">
            {coreScenes.map((item) => <button type="button" className={`home-scene scene-${item.id}`} key={item.id} aria-pressed={activeScene === item.id} aria-expanded={activeScene === item.id} aria-controls="scene-examples" disabled={understandingBusy || loading} onClick={() => {
              const next = activeScene === item.id ? null : item.id;
              setActiveScene(next);
              if (next) chooseScenario(item.scenario);
            }}><ScenarioIcon icon={item.icon} /><span>{item.label}</span></button>)}
          </div>
          <div id="scene-examples" className="home-scene-examples" hidden={!activeScene}>
            {activeScene === "life" ? <label className="life-topic-select">生活事项<select value={scenarioId} disabled={understandingBusy || loading} onChange={(event) => chooseScenario(event.target.value)}>{scenarios.filter((item) => lifeTopics.includes(item.topic)).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label> : null}
            <div className="scene-example-list">
              {scenario.examples.map((example) => <button type="button" key={example} disabled={understandingBusy || loading} onClick={() => { changeQuestion(example); document.getElementById("question-input")?.focus(); }}>{example}<ArrowRight size={14} aria-hidden="true" /></button>)}
            </div>
            {["health", "legal", "wealth"].includes(scenario.topic) ? <p className="scene-boundary">{scenario.boundary}</p> : null}
          </div>

          <label className="question-box prominent">
            <span className="sr-only">你的问题</span>
            <textarea
              id="question-input"
              value={question}
              onChange={(event) => changeQuestion(event.target.value)}
              disabled={locked}
              maxLength={500}
              rows={4}
              placeholder="把具体事情和你正在犹豫的决定写在这里……"
              required
              aria-describedby="question-help"
            />
            <p id="question-help">请勿填写姓名、电话或证件号。</p>
          </label>

          <QuestionClarification key={understanding?.understanding.clarificationQuestion} result={understanding} busy={understandingBusy || loading} onAnswer={(answer) => void prepareQuestion(answer)} />
          {questionReady ? <p className="question-understood">{understanding?.understanding.summary}</p> : null}

          <button
            type="button"
            className="continue-button"
            hidden={liuyaoCastMode !== "auto" || Boolean(submittedPayload) || Boolean(understanding && ["CLARIFY", "SPLIT"].includes(understanding.understanding.status))}
            disabled={!question.trim() || locked}
            onClick={() => { setLiuyaoCastMode("auto"); void prepareQuestion("", true); }}
          >
            {understandingBusy ? "正在理解你的问题" : loading ? "正在生成报告" : "开始起卦并查看报告"}
            <ArrowRight aria-hidden="true" size={17} />
          </button>
          {liuyaoCastMode === "auto" && !submittedPayload ? <button className="text-link" type="button" disabled={!question.trim() || locked} onClick={() => { switchLiuyaoCastMode("manual"); moveToStep("cast-step"); }}>手动摇卦或录入已有卦爻</button> : null}
          {error && liuyaoCastMode === "auto" ? <p className="error" role="alert">{error}</p> : null}
          {understandingBusy ? <button className="text-link" type="button" onClick={() => requestController.current?.abort()}>暂停，保留问题</button> : null}
          {understandingFailed && liuyaoCastMode === "auto" ? <button className="secondary" type="button" disabled={loading || understandingBusy} onClick={saveWithoutAI}>先保存卦盘，稍后继续解读</button> : null}
          <p className="question-service-boundary">AI 会结合原问题与六爻盘面解读；现实条件仍需你核实。</p>
        </section>

        <section className="journey-screen cast-step" id="cast-step" hidden={liuyaoCastMode === "auto"}>
          <header className="journey-heading compact">
            <div>
              <h2>{liuyaoCastMode === "manual" ? "录入已有卦" : "逐爻起卦"}</h2>
            </div>
            <div className="question-confirmation">
              <FileSearch aria-hidden="true" size={18} />
              <span>{question.trim() || "请先在上一屏填写问题"}</span>
            </div>
          </header>

          <fieldset className="cast-method-fieldset" disabled={locked}>
            <legend className="sr-only">选择并完成起卦</legend>
            <div className="cast-method-header">
              <div>
                <strong>{liuyaoCastMode === "auto" ? "系统代摇" : liuyaoCastMode === "coins" ? "逐爻摇铜钱" : liuyaoCastMode === "digitalCoins" ? "数字铜钱法" : "手动录入爻值"}</strong>
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
              <>
              <div className="cast-time-fields">
                <div className="cast-time-entry"><label>原起卦日期与时间<input type="datetime-local" value={castTime} onChange={(event) => setCastTime(event.target.value)} required /></label><button className="text-link" type="button" onClick={() => setCastTime(wallTime(new Date().toISOString(), timezone))}>使用当前时间</button></div>
                <label>起卦地时区<select value={timezone} onChange={(event) => setTimezone(event.target.value)}>
                  {["Asia/Shanghai", "Asia/Hong_Kong", "Asia/Taipei", "Asia/Tokyo", "Europe/London", "America/New_York", "America/Los_Angeles", "UTC"].map((zone) => <option key={zone} value={zone}>{zone === "Asia/Shanghai" ? "中国标准时间 (UTC+8)" : zone}</option>)}
                </select></label>
              </div>
              <div className="line-grid">
                {liuyaoValues.map((value, index) => (
                  <label key={`line-${index}`}>
                    <span>{index === 0 ? "初爻（最下方）" : index === 5 ? "上爻（最上方）" : `第 ${index + 1} 爻`}</span>
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
              <div className="cast-preview" aria-label="本次录入的卦爻，从上爻到初爻">
                {[...liuyaoValues].reverse().map((value, index) => <div className="cast-preview-row" key={index}>
                  <span>{index === 0 ? "上爻" : index === 5 ? "初爻" : `${6 - index} 爻`}</span>
                  <span className={`cast-preview-line ${!value ? "pending" : Number(value) % 2 ? "yang" : "yin"}`} aria-label={value ? Number(value) % 2 ? "阳" : "阴" : "未录入"}><i /><i /></span>
                  <span>{value ? lineInfo(value).short : "未录入"}{value === "6" || value === "9" ? " · 动" : ""}</span>
                </div>)}
              </div>
              </>
            ) : liuyaoCastMode === "digitalCoins" ? (
              <div className="cast-flow">
                {digitalCoinsStarted ? (
                  <>
                    <p className="section-kicker">
                      六爻已记录，正在用本次盘面整理报告。
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
                      <span>系统会一次生成六爻铜钱面，并直接整理报告。</span>
                    </div>
                    <button type="button" disabled={loading} onClick={startDigitalCoins}>
                      {loading ? "正在生成报告" : "开始起卦并查看报告"}
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
                      <span>系统会一次完成六爻，保留铜钱面并直接整理报告。</span>
                    </div>
                    <button type="button" disabled={loading} onClick={() => autoCastSixLines(true)}>
                      {loading ? "正在生成报告" : "开始起卦并查看报告"}
                    </button>
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
                          <button type="button" className="tertiary-button" onClick={() => autoCastSixLines(false)}>重新起卦</button>
                        </>
                      ) : coinLines.length >= 6 ? (
                        <span className="completion-badge">六爻已完成</span>
                      ) : (
                        <button type="button" onClick={addCoinLine}>摇第 {coinLines.length + 1} 爻</button>
                      )}
                      {liuyaoCastMode === "coins" && coinLines.length ? (
                        <button type="button" className="tertiary-button" onClick={() => { if (window.confirm("放弃当前卦爻并从初爻重新开始？")) { setCoinLines([]); setInstantUtc(""); setRequestId(""); } }}>重新逐爻起卦</button>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            )}
          </fieldset>

          {instantUtc ? <p className="section-kicker">起卦记录：{wallTime(instantUtc, timezone).replace("T", " ")}（{timezone}）</p> : null}
          {error ? <p className="error" role="alert">{error}</p> : null}
          {loading ? <button type="button" className="text-link" onClick={() => requestController.current?.abort()}>暂停等待，保留盘面</button> : null}
          {understandingFailed ? <button className="secondary" type="button" disabled={loading || understandingBusy} onClick={saveWithoutAI}>先保存卦盘，稍后继续解读</button> : null}
          {canGenerate && !createdId && (liuyaoCastMode === "manual" || Boolean(error)) ? (
            <div className="form-actions final-actions">
              <button type="submit" disabled={loading}>
                {loading ? "正在保存盘面并准备解读" : submittedPayload ? "继续保存原卦" : "保存此卦并查看解读"}
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
