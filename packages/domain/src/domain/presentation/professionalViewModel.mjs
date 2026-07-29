import { deduplicateSignals } from "./evidenceDeduplicator.mjs";
import { professionalSignals } from "./priorityEngine.mjs";

function displaySignal(signal) {
  return {
    title: signal.title,
    text: signal.text,
    priority: signal.priority,
    evidenceKind: signal.evidenceKind,
    mergedCount: signal.mergedCount,
  };
}

export function buildProfessionalViewModel(facts) {
  return {
    viewModelVersion: "PROFESSIONAL_VIEWMODEL_V1",
    reportId: facts.resultId,
    reportType: facts.resultType === "MEIHUA" ? "梅花" : "六爻",
    method: facts.method.displayName,
    chartSummary: facts.chartSummary,
    relationships: facts.relationships.map((item) => ({ title: item.title, text: item.text })),
    evidenceGroups: {
      supports: professionalSignals(deduplicateSignals(facts.positiveSignals)).map(displaySignal),
      risks: professionalSignals(deduplicateSignals(facts.negativeSignals)).map(displaySignal),
      other: professionalSignals(deduplicateSignals(facts.neutralSignals)).map(displaySignal),
    },
    timingCandidates: facts.timingOrPriority.map((item) => ({
      title: item.title,
      text: item.text,
      rank: item.rank,
    })),
    knowledgeRefs: facts.knowledgeRefs.map((item) => ({ id: item.id, title: item.title })),
  };
}
