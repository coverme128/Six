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

function relationshipDecisionFocus(state) {
  if (state === "FAVORABLE") return "当前具备继续小步推进的条件，但仍要用对方的现实回应验证。";
  if (state === "CAUTIOUS") return "先放慢推进，处理边界、压力或沟通问题，再决定下一步。";
  if (state === "MIXED") return "先核对双方投入与核心矛盾，再决定是否加深承诺。";
  if (state === "TRANSITIONAL") return "适合边沟通边观察变化，不宜在信号尚未稳定时仓促定性。";
  return "当前信息还不足，先澄清关系目标与现实回应，不宜急着作最终判断。";
}

function relationshipPartySignal(signals, keyword, supportedText, pressuredText) {
  const support = signals.supports.find((item) => item.text?.includes(keyword));
  if (support) return { state: "SUPPORT", summary: supportedText, evidence: support.text };
  const risk = signals.risks.find((item) => item.text?.includes(keyword));
  if (risk) return { state: "PRESSURE", summary: pressuredText, evidence: risk.text };
  return {
    state: "OBSERVE",
    summary: "当前没有足够直接的单一信号，需要结合双方现实互动继续观察。",
    evidence: "报告保留不确定性，不用单项事实替代完整关系判断。",
  };
}

function scenarioGuidance(presentationFacts, overall, supports, risks, actions) {
  const topic = presentationFacts.topicRoleContext?.displayName ?? "";
  if (!topic.includes("感情")) return null;
  return {
    scenario: "RELATIONSHIP",
    label: "感情关系",
    headline: `这段关系：${overall?.patternName ?? "仍需继续观察"}`,
    direction: overall?.baseStateText ?? presentationFacts.situation.currentSituation,
    interactionTrend: overall?.dynamicDirectionText ?? presentationFacts.situation.changeDirection,
    decisionFocus: relationshipDecisionFocus(overall?.overallState),
    selfSignal: relationshipPartySignal(
      { supports, risks },
      "世爻",
      "你这边存在可以利用的主动条件，适合用清晰表达和稳定行动推进。",
      "你这边当前承受一定压力，先照顾边界和节奏，再判断投入程度。",
    ),
    otherSignal: relationshipPartySignal(
      { supports, risks },
      "应爻",
      "对方或外部回应存在支持信号，但仍要以持续、具体的现实行动验证。",
      "对方或外部回应仍有压力，不宜只凭一次表态判断关系走向。",
    ),
    nextSteps: actions.slice(0, 3),
    boundary: "报告帮助你整理互动结构，不替你判断爱意，也不替你决定是否继续关系。",
  };
}

export function buildGuidedViewModel(facts) {
  const productFacts = isLiuyaoProductResultFacts(facts) ? facts : null;
  const presentationFacts = productPresentationFacts(facts);
  const allowedGraphNodes = productFacts?.evidenceGraph?.nodes.filter((item) => productFacts.decisionFacts?.allowedFindingRefs?.includes(item.id)) ?? [];
  const useCompoundDecisionEvidence = allowedGraphNodes.some((item) => item.nodeType === "COMPOSITE" && !["ALL_LINES_STATIC", "MOVING_LINES_PRESENT"].includes(item.ruleId));
  const graphSignal = (item) => ({ title: item.category === "SUPPORT" ? "支持条件" : "风险条件", text: item.meaning, priority: item.weight, mergedCount: 1 });
  const supports = productFacts && useCompoundDecisionEvidence
    ? allowedGraphNodes.filter((item) => item.category === "SUPPORT").slice(0, 4).map(graphSignal)
    : guidedSignals(deduplicateSignals(presentationFacts.positiveSignals)).slice(0, 4).map(publicSignal);
  const risks = productFacts && useCompoundDecisionEvidence
    ? allowedGraphNodes.filter((item) => item.category === "RISK").slice(0, 4).map(graphSignal)
    : guidedSignals(deduplicateSignals(presentationFacts.negativeSignals)).slice(0, 4).map(publicSignal);
  const simplifiedEvidence = guidedSignals(deduplicateSignals([...presentationFacts.positiveSignals, ...presentationFacts.negativeSignals, ...presentationFacts.neutralSignals])).slice(0, 12).map(publicSignal);
  const overall = productFacts?.overallAssessmentFacts;
  const decisionSupport = productFacts?.decisionSupportFacts ?? null;
  const timing = productFacts?.timingExplanationFacts?.[0];
  const fallbackActions = productFacts?.actionGuidanceFacts?.items ?? recommendedActions(presentationFacts);
  const actions = decisionSupport?.actionTimeline?.map((item) => item.action) ?? fallbackActions;
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
    directAnswer: decisionSupport?.directAnswer ?? null,
    decisionSupport: decisionSupport ? {
      scenario: decisionSupport.scenarioCode,
      label: decisionSupport.scenarioLabel,
      mode: decisionSupport.decisionMode,
      directAnswer: decisionSupport.directAnswer,
      dimensions: decisionSupport.dimensions,
      proceedConditions: decisionSupport.proceedConditions,
      holdConditions: decisionSupport.holdConditions,
      actionTimeline: decisionSupport.actionTimeline,
      scopeNote: decisionSupport.scopeNote,
      hexagramChain: decisionSupport.hexagramChain,
      boundary: decisionSupport.boundary,
      clarificationRequired: decisionSupport.clarificationRequired,
      clarificationQuestion: decisionSupport.clarificationQuestion,
      possibleModes: decisionSupport.possibleModes,
      branchAssessments: decisionSupport.branchAssessments,
    } : null,
    questionClarification: productFacts?.questionProfile?.clarificationRequired ? {
      required: true,
      question: productFacts.questionProfile.clarificationQuestion,
      options: productFacts.questionProfile.possibleModes,
      reason: "不同加入身份对应的责任、收益和判断重点不同，确认后才能给出单一路径结论。",
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
    scenarioGuidance: scenarioGuidance(presentationFacts, overall, supports, risks, fallbackActions),
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
