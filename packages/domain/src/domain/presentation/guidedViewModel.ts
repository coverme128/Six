// @ts-nocheck
import { deduplicateSignals } from "./evidenceDeduplicator.js";
import { guidedSignals } from "./priorityEngine.js";
import { assembleHeadline, recommendedActions, timingHint } from "./narrativeAssembler.js";

function publicSignal(signal) {
  return {
    title: signal.title,
    text: signal.text,
    priority: signal.priority,
    mergedCount: signal.mergedCount,
  };
}

function buildSummary(facts, supports, risks) {
  const supportText = supports[0]?.text ?? "盘面中已有可用的支持条件。";
  const riskText = risks[0]?.text ?? "暂无特别突出的单一阻碍。";
  return `${supportText} ${riskText} 建议先看结论与下一步，再按需展开专业依据。`;
}

export function buildGuidedViewModel(facts) {
  const supports = guidedSignals(deduplicateSignals(facts.positiveSignals)).slice(0, 4).map(publicSignal);
  const risks = guidedSignals(deduplicateSignals(facts.negativeSignals)).slice(0, 4).map(publicSignal);
  const simplifiedEvidence = guidedSignals(deduplicateSignals([...facts.positiveSignals, ...facts.negativeSignals, ...facts.neutralSignals])).slice(0, 12).map(publicSignal);
  return {
    viewModelVersion: "GUIDED_VIEWMODEL_V1",
    reportId: facts.resultId,
    reportType: facts.resultType === "MEIHUA" ? "梅花" : "六爻",
    question: facts.question,
    headline: assembleHeadline(facts),
    summary: buildSummary(facts, supports, risks),
    currentSituation: facts.situation.currentSituation,
    coreMatter: facts.topicRoleContext ? {
      topic: facts.topicRoleContext.displayName,
      summary: facts.topicRoleContext.summary,
      roles: facts.topicRoleContext.roles.slice(0, 4).map((role) => ({
        label: role.label,
        practicalMeaning: role.practicalMeaning,
        importance: role.importance,
      })),
      clarificationTriggers: facts.topicRoleContext.clarificationTriggers,
      safetyNotes: facts.topicRoleContext.safetyNotes,
    } : null,
    observationFocus: facts.observationFocus ? {
      summary: facts.observationFocus.summary,
      roles: facts.observationFocus.roles.slice(0, 4).map((role) => ({
        label: role.label,
        meaning: role.meaning,
        importance: role.importance,
        lines: role.lines.slice(0, 3),
      })),
    } : null,
    mainSupports: supports,
    mainRisks: risks,
    changeDirection: facts.situation.changeDirection,
    timingHint: timingHint(facts),
    recommendedActions: recommendedActions(facts),
    simplifiedEvidence,
    nextActions: [
      { code: "VIEW_BASIS", label: "查看依据", target: "professional" },
      { code: "EXPORT_REPORT", label: "导出报告", target: "/history" },
      { code: "LEARN_RELATED", label: "继续学习", target: "/learn" },
      { code: "CAST_AGAIN", label: "再次起卦", target: facts.resultType === "MEIHUA" ? "/meihua" : "/" },
    ],
  };
}
