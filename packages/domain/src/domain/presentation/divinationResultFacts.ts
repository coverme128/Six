// @ts-nocheck
import { formatFinding, formatMethod, formatRelationship } from "./terminologyFormatter.js";

export const RESULT_FACTS_VERSION = "DIVINATION_RESULT_FACTS_V1";

const DIMENSION_POLARITY = {
  supporting_forces: "SUPPORT",
  subject_state: "SUPPORT",
  change_direction: "SUPPORT",
  blocking_forces: "RISK",
  target_state: "NEUTRAL",
  timing_state: "TIMING",
};

function sectionText(result, code, fallback = "") {
  return result.narrativeReport?.sections?.find((section) => section.code === code)?.text ?? fallback;
}

function allFindings(result) {
  const dimensionFindings = Object.values(result.report?.dimensions ?? {}).flat();
  const evidence = result.report?.evidence ?? [];
  const items = dimensionFindings.length ? dimensionFindings : evidence;
  return items.map((finding, index) => ({ ...finding, id: finding.id ?? `finding-${index + 1}` }));
}

function signalFromFinding(finding, index) {
  const formatted = formatFinding(finding);
  const dimension = finding.dimension ?? "supporting_forces";
  return {
    id: `signal-${index + 1}`,
    sourceRef: finding.id ?? finding.rule_code ?? `finding-${index + 1}`,
    polarity: DIMENSION_POLARITY[dimension] ?? "NEUTRAL",
    dimension,
    title: formatted.title,
    text: finding.summary ?? formatted.description,
    evidenceKind: finding.evidence_kind ?? "rule",
    outputRole: finding.output_role ?? "FACT",
    rawCode: finding.rule_code ?? finding.code ?? null,
    priorityHint: dimension === "supporting_forces" || dimension === "blocking_forces" ? "P1" : "P2",
  };
}

function meihuaSignals(result) {
  return (result.report?.evidence ?? []).map((item, index) => ({
    id: `signal-${index + 1}`,
    sourceRef: item.code ?? `meihua-${index + 1}`,
    polarity: "NEUTRAL",
    dimension: "target_state",
    title: item.label ?? item.code ?? "梅花结构",
    text: item.value ? `${item.label}：${item.value}` : item.summary ?? "梅花结构证据。",
    evidenceKind: "symbolism",
    outputRole: "FACT",
    rawCode: item.code ?? null,
    priorityHint: index < 3 ? "P1" : "P2",
  }));
}

function chartTitle(chart, type) {
  if (type === "meihua") {
    return `${chart.originalHexagram?.name_zh ?? "-"} → ${chart.mutualHexagram?.name_zh ?? "-"} → ${chart.changedHexagram?.name_zh ?? "-"}`;
  }
  return `${chart.originalHexagram?.name_zh ?? "-"} → ${chart.changedHexagram?.name_zh ?? "-"}`;
}

const OBSERVATION_LABELS = {
  officer_ghost: "官鬼",
  parent: "父母",
  world: "世爻",
  response: "应爻",
  wealth: "妻财",
  sibling: "兄弟",
  child_grandchild: "子孙",
};

function readableObservation(value) {
  return OBSERVATION_LABELS[value] ?? value;
}

function describeYongshen(finding) {
  const raw = String(finding.summary ?? finding.text ?? "");
  if (raw.includes("系统按问题场景自动聚焦") || raw.includes("系统已自动确定")) return raw;
  const values = raw.includes("：") ? raw.split("：").at(-1).split("/").map((item) => item.trim()).filter(Boolean) : [];
  const labels = values.map(readableObservation).filter(Boolean);
  if (!labels.length) return "本次问题已有明确观察对象，后续判断会围绕它们展开。";
  return `本次重点看${labels.join("、")}，报告会围绕这些对象组织判断。`;
}

function publicSignalTitle(finding) {
  const code = finding.rule_code ?? finding.code ?? finding.rawCode;
  if (finding.rule_type === "yongshen" || code?.includes?.("job_search") || finding.evidenceKind === "direct_target_fact") return "观察重点";
  if (code === "YONGSHEN_HOLDS_WORLD" || finding.evidenceKind === "world_response_fact") return "主体状态";
  if (code === "MOVING_LINE" || finding.evidenceKind === "moving_change_fact") return "变化动力";
  if (code === "MONTH_SAME_BRANCH" || finding.dedupe_group === "time-environment") return "外部条件";
  if (code === "DAY_CLASH" || finding.dedupe_group === "daily-pressure") return "短期阻力";
  if (finding.dimension === "timing_state") return "时间窗口";
  return formatFinding(finding).title;
}

function publicSignalText(finding, chart) {
  const code = finding.rule_code ?? finding.code ?? finding.rawCode;
  if (finding.rule_type === "yongshen" || code?.includes?.("job_search") || finding.evidenceKind === "direct_target_fact") return describeYongshen(finding);
  if (code === "YONGSHEN_HOLDS_WORLD" || finding.evidenceKind === "world_response_fact") {
    return `世爻在第 ${chart.worldResponse?.worldLine ?? "-"} 爻，代表当事人的状态是这次判断的主轴。`;
  }
  if (code === "MOVING_LINE" || finding.evidenceKind === "moving_change_fact") {
    const lines = finding.input_facts?.movingLines ?? chart.movingLines ?? [];
    const text = Array.isArray(lines) && lines.length ? lines.join("、") : "-";
    return `第 ${text} 爻发动，事情会进入变化过程，不宜按静态局面判断。`;
  }
  if (code === "MONTH_SAME_BRANCH" || finding.dedupe_group === "time-environment") {
    return "时间环境对事情有一定承托，外部条件不是完全逆风。";
  }
  if (code === "DAY_CLASH" || finding.dedupe_group === "daily-pressure") {
    return "短期节奏里有扰动，需要留意临时变化、沟通冲突或现实阻力。";
  }
  if (finding.dimension === "timing_state") return "时间信号只适合作为观察窗口，不能当作确定日期。";
  return finding.summary ?? finding.text ?? "这是一条用于理解结果的依据。";
}

function publicTiming(candidate = {}) {
  const title = candidate.window ?? "近期观察窗口";
  return {
    title,
    text: `${title}可作为观察窗口；这不是保证日期，仍需结合现实进展复核。`,
    limitation: "仅作为候选窗口，不代表确定日期。",
  };
}

function hexagramKnowledgeRefs(chart) {
  const refs = [];
  if (chart.originalHexagram?.code && chart.originalHexagram?.name_zh) {
    refs.push({ id: chart.originalHexagram.code, title: `${chart.originalHexagram.name_zh}卦` });
  }
  if (chart.changedHexagram?.code && chart.changedHexagram?.name_zh && chart.changedHexagram.code !== chart.originalHexagram?.code) {
    refs.push({ id: chart.changedHexagram.code, title: `${chart.changedHexagram.name_zh}卦` });
  }
  if (chart.mutualHexagram?.code && chart.mutualHexagram?.name_zh) {
    refs.push({ id: chart.mutualHexagram.code, title: `${chart.mutualHexagram.name_zh}卦` });
  }
  return refs;
}

export function buildDivinationResultFacts({ result, type }) {
  const chart = result.chart;
  const signals = type === "meihua" ? meihuaSignals(result) : allFindings(result).map(signalFromFinding);
  const publicSignals = signals.map((signal) => ({
    ...signal,
    title: publicSignalTitle(signal),
    text: publicSignalText(signal, chart),
  }));
  const timing = (result.timingCandidates ?? []).slice(0, 5).map((candidate, index) => ({
    id: `timing-${index + 1}`,
    ...publicTiming(candidate),
    granularity: candidate.granularity,
    rank: candidate.rank ?? index + 1,
    rawRef: index,
  }));
  const knowledgeRefs = new Map();
  for (const item of hexagramKnowledgeRefs(chart)) knowledgeRefs.set(item.id, item);
  return {
    factsVersion: RESULT_FACTS_VERSION,
    resultId: chart.id,
    resultType: type === "meihua" ? "MEIHUA" : "LIUYAO",
    question: chart.question ?? "",
    method: {
      code: chart.methodCode,
      displayName: formatMethod(chart.methodCode, type),
    },
    chartSummary: {
      title: chartTitle(chart, type),
      originalHexagram: chart.originalHexagram?.name_zh ?? "",
      changedHexagram: chart.changedHexagram?.name_zh ?? "",
      mutualHexagram: chart.mutualHexagram?.name_zh ?? null,
      movingLines: chart.movingLines ?? (chart.movingLine ? [chart.movingLine] : []),
      worldLine: chart.worldResponse?.worldLine ?? null,
      responseLine: chart.worldResponse?.responseLine ?? null,
      bodyTrigram: chart.bodyTrigram?.name_zh ?? null,
      useTrigram: chart.useTrigram?.name_zh ?? null,
      relationship: chart.bodyUseRelation ? formatRelationship(chart.bodyUseRelation.code ?? chart.bodyUseRelation.meaning_zh, chart.bodyUseRelation.meaning_zh) : null,
    },
    observationFocus: chart.observationFocus ? {
      summary: chart.observationFocus.summary,
      selectionSource: chart.observationFocus.selectionSource,
      userEditable: chart.observationFocus.userEditable,
      roles: (chart.observationFocus.roles ?? []).map((role) => ({
        label: role.label,
        meaning: role.meaning,
        importance: role.importance,
        lines: (role.lines ?? []).map((line) => ({
          position: line.position,
          branchName: line.branchName,
          sixRelationName: line.sixRelationName,
          moving: line.moving,
          isWorld: line.isWorld,
          isResponse: line.isResponse,
          isVoid: line.isVoid,
          monthText: line.monthInfluence?.text,
          dayText: line.dayInfluence?.text,
          changedText: line.changed?.returnInfluence?.text,
        })),
      })),
    } : null,
    situation: {
      headline: sectionText(result, "overview", `${chartTitle(chart, type)}，需要结合支持与阻碍一起看。`),
      currentSituation: "支持与阻碍同时存在：外部条件有承托，但短期节奏仍有扰动。",
      changeDirection: publicSignals.find((item) => item.dimension === "change_direction")?.text ?? "变化方向需要继续观察。",
    },
    positiveSignals: publicSignals.filter((item) => item.polarity === "SUPPORT"),
    negativeSignals: publicSignals.filter((item) => item.polarity === "RISK"),
    neutralSignals: publicSignals.filter((item) => item.polarity === "NEUTRAL"),
    relationships: [
      chart.worldResponse ? { id: "world-response", title: "世应关系", text: `世爻在第 ${chart.worldResponse.worldLine} 爻，应爻在第 ${chart.worldResponse.responseLine} 爻。` } : null,
      chart.bodyUseRelation ? { id: "body-use", title: "体用关系", text: chart.bodyUseRelation.meaning_zh ?? chart.bodyUseRelation.code } : null,
    ].filter(Boolean),
    timingOrPriority: timing,
    importantFindings: publicSignals,
    knowledgeRefs: [...knowledgeRefs.values()],
    sourceVersions: {
      engine: result.engineVersions,
      calendar: chart.calendar?.policyVersion ?? null,
      ruleProfile: result.engineVersions?.rules ?? null,
      reportTemplate: result.narrativeReport?.reportTemplateVersion ?? null,
    },
    rawRefs: {
      chart,
      findings: allFindings(result),
      timingCandidates: result.timingCandidates ?? [],
      aiReportBundle: result.aiReportBundle ?? null,
    },
  };
}
