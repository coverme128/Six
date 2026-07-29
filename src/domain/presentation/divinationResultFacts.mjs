import { formatFinding, formatMethod, formatRelationship, formatTiming } from "./terminologyFormatter.mjs";

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

export function buildDivinationResultFacts({ result, type }) {
  const chart = result.chart;
  const signals = type === "meihua" ? meihuaSignals(result) : allFindings(result).map(signalFromFinding);
  const timing = (result.timingCandidates ?? []).slice(0, 5).map((candidate, index) => ({
    id: `timing-${index + 1}`,
    title: candidate.window ?? "时间候选",
    text: formatTiming(candidate),
    granularity: candidate.granularity,
    rank: candidate.rank ?? index + 1,
    limitation: candidate.limitation ?? "仅作为候选窗口，不是保证日期。",
    rawRef: index,
  }));
  const knowledgeRefs = new Map();
  for (const section of result.narrativeReport?.sections ?? []) {
    for (const id of section.knowledgeIds ?? []) knowledgeRefs.set(id, { id, title: id });
  }
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
    situation: {
      headline: sectionText(result, "overview", `${chartTitle(chart, type)}，需要结合支持与阻碍一起看。`),
      currentSituation: sectionText(result, "support", "当前局势需要结合证据观察。"),
      changeDirection: sectionText(result, "change", "变化方向需要继续观察。"),
    },
    positiveSignals: signals.filter((item) => item.polarity === "SUPPORT"),
    negativeSignals: signals.filter((item) => item.polarity === "RISK"),
    neutralSignals: signals.filter((item) => item.polarity === "NEUTRAL"),
    relationships: [
      chart.worldResponse ? { id: "world-response", title: "世应关系", text: `世爻在第 ${chart.worldResponse.worldLine} 爻，应爻在第 ${chart.worldResponse.responseLine} 爻。` } : null,
      chart.bodyUseRelation ? { id: "body-use", title: "体用关系", text: chart.bodyUseRelation.meaning_zh ?? chart.bodyUseRelation.code } : null,
    ].filter(Boolean),
    timingOrPriority: timing,
    importantFindings: signals,
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
