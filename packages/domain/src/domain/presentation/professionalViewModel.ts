// @ts-nocheck
import { deduplicateSignals } from "./evidenceDeduplicator.js";
import { professionalSignals } from "./priorityEngine.js";
import { isLiuyaoProductResultFacts, productPresentationFacts } from "./productResultFacts.js";

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
  const productFacts = isLiuyaoProductResultFacts(facts) ? facts : null;
  const presentationFacts = productPresentationFacts(facts);
  return {
    viewModelVersion: "PROFESSIONAL_VIEWMODEL_V1",
    reportId: presentationFacts.resultId,
    reportType: presentationFacts.resultType === "MEIHUA" ? "梅花" : "六爻",
    method: presentationFacts.method.displayName,
    chartSummary: presentationFacts.chartSummary,
    topicRoleContext: presentationFacts.topicRoleContext,
    observationFocus: presentationFacts.observationFocus,
    auditChain: productFacts ? {
      question: {
        question: productFacts.questionContext.question,
        topic: productFacts.questionContext.topicDisplayName,
        bindingStatus: productFacts.questionContext.topicBindingStatus,
      },
      yongshenSelection: productFacts.yongshenSelectionFacts,
      calendar: productFacts.calendarFacts,
      lineDiagnostics: productFacts.lineAssessmentFacts,
      strength: productFacts.evidenceGroupingFacts
        .filter((item) => ["supporting_forces", "blocking_forces", "subject_state"].includes(item.dimension))
        .map((item) => ({ label: item.label, count: item.count })),
      dynamics: productFacts.evidenceGroupingFacts
        .filter((item) => item.dimension === "change_direction")
        .map((item) => ({ label: item.label, count: item.count })),
      patternFindings: productFacts.evidenceGroupingFacts.map((item) => ({ label: item.label, count: item.count })),
      evidenceResolution: {
        conflictState: productFacts.conflictResolutionFacts.conflictState,
        summary: productFacts.conflictResolutionFacts.resolutionSummary,
      },
      overallAssessment: {
        patternName: productFacts.overallAssessmentFacts.patternName,
        overallState: productFacts.overallAssessmentFacts.overallState,
        baseState: productFacts.overallAssessmentFacts.baseStateText,
        dynamicDirection: productFacts.overallAssessmentFacts.dynamicDirectionText,
        conflictState: productFacts.overallAssessmentFacts.conflictState,
        summary: productFacts.overallAssessmentFacts.summary,
        basis: productFacts.overallAssessmentFacts.basis,
        boundary: productFacts.overallAssessmentFacts.algorithmBoundary,
      },
      timing: productFacts.timingExplanationFacts.map((item) => ({
        window: item.window,
        explanation: item.explanation,
        limitation: item.limitation,
        precision: item.precision,
      })),
      limitations: [
        productFacts.overallAssessmentFacts.algorithmBoundary,
        productFacts.actionGuidanceFacts.boundary,
        ...productFacts.yongshenSelectionFacts.limitations,
      ].filter(Boolean),
    } : null,
    relationships: presentationFacts.relationships.map((item) => ({ title: item.title, text: item.text })),
    evidenceGroups: {
      supports: professionalSignals(deduplicateSignals(presentationFacts.positiveSignals)).map(displaySignal),
      risks: professionalSignals(deduplicateSignals(presentationFacts.negativeSignals)).map(displaySignal),
      other: professionalSignals(deduplicateSignals(presentationFacts.neutralSignals)).map(displaySignal),
    },
    timingCandidates: presentationFacts.timingOrPriority.map((item) => ({
      title: item.title,
      text: item.text,
      rank: item.rank,
    })),
    knowledgeRefs: presentationFacts.knowledgeRefs.map((item) => ({ id: item.id, title: item.title })),
  };
}
