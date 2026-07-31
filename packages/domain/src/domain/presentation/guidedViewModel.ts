// @ts-nocheck
import { deduplicateSignals } from "./evidenceDeduplicator.js";
import { guidedSignals } from "./priorityEngine.js";
import { assembleHeadline, recommendedActions, timingHint } from "./narrativeAssembler.js";
import { isLiuyaoProductResultFacts, productPresentationFacts } from "./productResultFacts.js";

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
  const productFacts = isLiuyaoProductResultFacts(facts) ? facts : null;
  const presentationFacts = productPresentationFacts(facts);
  const supports = guidedSignals(deduplicateSignals(presentationFacts.positiveSignals)).slice(0, 4).map(publicSignal);
  const risks = guidedSignals(deduplicateSignals(presentationFacts.negativeSignals)).slice(0, 4).map(publicSignal);
  const simplifiedEvidence = guidedSignals(deduplicateSignals([...presentationFacts.positiveSignals, ...presentationFacts.negativeSignals, ...presentationFacts.neutralSignals])).slice(0, 12).map(publicSignal);
  const overall = productFacts?.overallAssessmentFacts;
  const timing = productFacts?.timingExplanationFacts?.[0];
  const actions = productFacts?.actionGuidanceFacts?.items ?? recommendedActions(presentationFacts);
  return {
    viewModelVersion: "GUIDED_VIEWMODEL_V1",
    reportId: presentationFacts.resultId,
    reportType: presentationFacts.resultType === "MEIHUA" ? "梅花" : "六爻",
    question: presentationFacts.question,
    headline: overall?.headline ?? assembleHeadline(presentationFacts),
    summary: overall ? `${overall.summary} ${buildSummary(presentationFacts, supports, risks)}` : buildSummary(presentationFacts, supports, risks),
    overallAssessment: overall ? {
      state: overall.overallState,
      label: overall.patternName,
      baseState: overall.baseStateText,
      dynamicDirection: overall.dynamicDirectionText,
      conflictState: overall.conflictState,
    } : null,
    currentSituation: overall?.baseStateText ?? presentationFacts.situation.currentSituation,
    coreMatter: presentationFacts.topicRoleContext ? {
      topic: presentationFacts.topicRoleContext.displayName,
      summary: presentationFacts.topicRoleContext.summary,
      roles: presentationFacts.topicRoleContext.roles.slice(0, 4).map((role) => ({
        label: role.label,
        practicalMeaning: role.practicalMeaning,
        importance: role.importance,
      })),
      clarificationTriggers: presentationFacts.topicRoleContext.clarificationTriggers,
      safetyNotes: presentationFacts.topicRoleContext.safetyNotes,
    } : null,
    observationFocus: presentationFacts.observationFocus ? {
      summary: presentationFacts.observationFocus.summary,
      roles: presentationFacts.observationFocus.roles.slice(0, 4).map((role) => ({
        label: role.label,
        meaning: role.meaning,
        importance: role.importance,
        lines: role.lines.slice(0, 3),
      })),
    } : null,
    mainSupports: supports,
    mainRisks: risks,
    changeDirection: overall?.dynamicDirectionText ?? presentationFacts.situation.changeDirection,
    timingHint: timing ? `${timing.explanation} ${timing.limitation}` : timingHint(presentationFacts),
    recommendedActions: actions,
    whyThisAssessment: productFacts ? {
      conflictResolution: productFacts.conflictResolutionFacts.resolutionSummary,
      basis: productFacts.overallAssessmentFacts.basis,
    } : null,
    simplifiedEvidence,
    nextActions: [
      { code: "VIEW_BASIS", label: "查看依据", target: "professional" },
      { code: "EXPORT_REPORT", label: "导出报告", target: "/history" },
      { code: "LEARN_RELATED", label: "继续学习", target: "/learn" },
      { code: "CAST_AGAIN", label: "再次起卦", target: presentationFacts.resultType === "MEIHUA" ? "/meihua" : "/" },
    ],
  };
}
