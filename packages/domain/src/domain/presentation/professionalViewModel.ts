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

function displayEvidenceNode(node) {
  return {
    title: node.category === "SUPPORT" ? "支持条件" : node.category === "RISK" ? "风险条件" : node.category === "MIXED" ? "需要同时看" : "判断背景",
    text: node.meaning,
    priority: node.weight,
    evidenceKind: node.nodeType === "COMPOSITE" ? "综合证据" : "基础证据",
    factRefs: node.factRefs,
    limitations: node.limitations,
  };
}

export function buildProfessionalViewModel(facts) {
  const productFacts = isLiuyaoProductResultFacts(facts) ? facts : null;
  const presentationFacts = productPresentationFacts(facts);
  const decisionEvidence = productFacts?.evidenceGraph?.decisionNodes.filter((item) => productFacts.decisionFacts?.allowedFindingRefs?.includes(item.id)) ?? [];
  const useCompoundDecisionEvidence = decisionEvidence.some((item) => !["ALL_LINES_STATIC", "MOVING_LINES_PRESENT"].includes(item.ruleId));
  return {
    viewModelVersion: "PROFESSIONAL_VIEWMODEL_V1",
    reportId: presentationFacts.resultId,
    reportType: presentationFacts.resultType === "MEIHUA" ? "梅花" : "六爻",
    method: presentationFacts.method.displayName,
    chartSummary: productFacts && !(productFacts.chartFacts?.movingLines ?? []).length ? {
      ...presentationFacts.chartSummary,
      title: `${productFacts.chartFacts.originalHexagram}（静卦，无变卦）`,
      changedHexagram: null,
    } : presentationFacts.chartSummary,
    topicRoleContext: presentationFacts.topicRoleContext,
    observationFocus: presentationFacts.observationFocus,
    auditChain: productFacts ? {
      question: {
        question: productFacts.questionContext.question,
        topic: productFacts.questionContext.topicDisplayName,
        bindingStatus: productFacts.questionContext.topicBindingStatus,
        interpretationStatus: productFacts.questionProfile?.clarificationStatus,
        interpretationLabel: productFacts.topicLens?.activeLabel,
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
    evidenceGroups: productFacts?.evidenceGraph && useCompoundDecisionEvidence ? {
      supports: decisionEvidence.filter((item) => item.category === "SUPPORT").map(displayEvidenceNode),
      risks: decisionEvidence.filter((item) => item.category === "RISK").map(displayEvidenceNode),
      other: decisionEvidence.filter((item) => ["MIXED", "NEUTRAL"].includes(item.category)).map(displayEvidenceNode),
    } : {
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
