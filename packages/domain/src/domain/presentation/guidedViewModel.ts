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
    summary: facts.situation.headline,
    currentSituation: facts.situation.currentSituation,
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
