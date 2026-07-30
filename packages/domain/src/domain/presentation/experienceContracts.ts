// @ts-nocheck
export const EXPERIENCE_CONTRACT_VERSION = "PAGE_EXPERIENCE_CONTRACT_V1";

export const REPORT_PAGE_EXPERIENCE = Object.freeze({
  pageId: "report.detail",
  pageGoal: "让用户理解本次判断，并明确下一步。",
  primaryQuestion: "这次最重要的结论是什么？",
  primaryAction: "理解结果 → 查看依据 → 导出 / 学习 / 再次起卦",
  visualHierarchy: {
    L1: ["headline", "currentSituation", "mainSupports", "mainRisks", "changeDirection", "recommendedActions"],
    L2: ["timingHint", "relationships", "simplifiedEvidence", "relatedKnowledge"],
    L3: ["chartSummary", "professionalEvidence", "timingCandidates"],
    Admin: ["rawFacts", "versions", "provider", "validator", "debug"],
  },
  states: {
    INITIAL: { message: "准备读取报告。", primaryAction: "加载报告", retry: false, preserveInput: true, fallback: false },
    LOADING: { message: "正在加载报告。", primaryAction: "等待", retry: false, preserveInput: true, fallback: false },
    PARSING: { message: "正在整理报告事实。", primaryAction: "等待", retry: false, preserveInput: true, fallback: false },
    NEEDS_CONFIRMATION: { message: "还需要确认问题或起卦信息。", primaryAction: "返回确认", retry: false, preserveInput: true, fallback: false },
    PROCESSING: { message: "正在生成增强解读。", primaryAction: "先阅读基础结果", retry: false, preserveInput: true, fallback: true },
    PARTIAL: { message: "增强解读暂不可用，基础报告仍可阅读。", primaryAction: "查看基础依据", retry: true, preserveInput: true, fallback: true },
    COMPLETED: { message: "报告已生成。", primaryAction: "查看依据", retry: false, preserveInput: true, fallback: false },
    EMPTY: { message: "暂无报告内容。", primaryAction: "重新起卦", retry: false, preserveInput: false, fallback: false },
    LOCKED: { message: "该报告暂不可查看。", primaryAction: "返回历史", retry: false, preserveInput: false, fallback: false },
    UNAUTHORIZED: { message: "需要重新确认访问权限。", primaryAction: "返回首页", retry: false, preserveInput: true, fallback: false },
    FORBIDDEN: { message: "当前无法访问该报告。", primaryAction: "返回历史", retry: false, preserveInput: false, fallback: false },
    FAILED: { message: "报告暂时无法打开。", primaryAction: "重试", retry: true, preserveInput: true, fallback: true },
    EXPIRED: { message: "报告访问已过期。", primaryAction: "重新起卦", retry: false, preserveInput: false, fallback: false },
    ARCHIVED: { message: "报告已归档。", primaryAction: "返回历史", retry: false, preserveInput: false, fallback: false },
    NOT_FOUND: { message: "未找到该报告。", primaryAction: "返回历史", retry: false, preserveInput: false, fallback: false },
    DELETED: { message: "报告可能已被清空。", primaryAction: "重新起卦", retry: false, preserveInput: false, fallback: false },
  },
});

export const PAGE_STATE_CONTRACT = Object.freeze({
  INITIAL: { message: "准备读取页面。", primaryAction: "开始", retry: false, preserveInput: true, fallback: false },
  LOADING: { message: "正在加载内容。", primaryAction: "等待", retry: false, preserveInput: true, fallback: false },
  PARSING: { message: "正在解析输入。", primaryAction: "等待", retry: false, preserveInput: true, fallback: false },
  NEEDS_CONFIRMATION: { message: "还需要确认部分信息。", primaryAction: "继续填写", retry: false, preserveInput: true, fallback: false },
  PROCESSING: { message: "正在处理请求。", primaryAction: "先查看已完成内容", retry: false, preserveInput: true, fallback: true },
  PARTIAL: { message: "部分内容暂不可用，核心功能仍可继续。", primaryAction: "继续使用", retry: true, preserveInput: true, fallback: true },
  COMPLETED: { message: "内容已就绪。", primaryAction: "继续下一步", retry: false, preserveInput: true, fallback: false },
  EMPTY: { message: "暂无可展示内容。", primaryAction: "返回起卦", retry: false, preserveInput: false, fallback: false },
  LOCKED: { message: "该内容暂不可查看。", primaryAction: "返回上一页", retry: false, preserveInput: false, fallback: false },
  UNAUTHORIZED: { message: "需要重新确认访问权限。", primaryAction: "返回首页", retry: false, preserveInput: true, fallback: false },
  FORBIDDEN: { message: "当前无法访问该内容。", primaryAction: "返回上一页", retry: false, preserveInput: false, fallback: false },
  FAILED: { message: "页面暂时无法完成操作。", primaryAction: "重试", retry: true, preserveInput: true, fallback: true },
  EXPIRED: { message: "内容访问已过期。", primaryAction: "重新开始", retry: false, preserveInput: false, fallback: false },
  ARCHIVED: { message: "内容已归档。", primaryAction: "返回上一页", retry: false, preserveInput: false, fallback: false },
  NOT_FOUND: { message: "未找到对应内容。", primaryAction: "返回上一页", retry: false, preserveInput: false, fallback: false },
  DELETED: { message: "内容可能已被清空。", primaryAction: "重新开始", retry: false, preserveInput: false, fallback: false },
});

export const PAGE_EXPERIENCE_CONTRACTS = Object.freeze({
  "casting.liuyao": {
    pageId: "casting.liuyao",
    pageGoal: "让用户以最少步骤完成六爻起卦。",
    primaryQuestion: "我想问什么，以及如何起卦？",
    primaryAction: "生成报告",
    visualHierarchy: {
      L1: ["question", "topic", "castInput", "generateReport"],
      L2: ["methodHint", "calendarContext", "inputValidation"],
      L3: ["settings", "historyLink"],
    },
    defaultState: "INITIAL",
    states: PAGE_STATE_CONTRACT,
  },
  "casting.meihua": {
    pageId: "casting.meihua",
    pageGoal: "让用户选择梅花起卦方式并生成统一报告。",
    primaryQuestion: "本次问题适合用哪种梅花起卦方式？",
    primaryAction: "生成报告",
    visualHierarchy: {
      L1: ["question", "method", "requiredInputs", "generateReport"],
      L2: ["methodHint", "calendarContext", "validation"],
      L3: ["settings", "historyLink"],
    },
    defaultState: "INITIAL",
    states: PAGE_STATE_CONTRACT,
  },
  "report.detail": REPORT_PAGE_EXPERIENCE,
  history: {
    pageId: "history",
    pageGoal: "让用户快速找回匿名本地报告。",
    primaryQuestion: "我要打开哪一份历史报告？",
    primaryAction: "打开报告",
    visualHierarchy: {
      L1: ["recentReports", "reportQuestion", "reportType", "openReport"],
      L2: ["createdAt", "evidenceCount", "export"],
      L3: ["clearHistory"],
    },
    defaultState: "EMPTY",
    states: PAGE_STATE_CONTRACT,
  },
  "content.knowledge": {
    pageId: "content.knowledge",
    pageGoal: "让用户围绕本次报告继续学习相关概念。",
    primaryQuestion: "我需要先理解哪个概念？",
    primaryAction: "查看知识",
    visualHierarchy: {
      L1: ["search", "recommendedKnowledge", "knowledgeTitle"],
      L2: ["summary", "relatedKnowledge", "learningPath"],
      L3: ["previewStatus", "seoMetadata"],
    },
    defaultState: "EMPTY",
    states: PAGE_STATE_CONTRACT,
  },
  "content.tutorial": {
    pageId: "content.tutorial",
    pageGoal: "让用户理解如何使用六爻和梅花工具。",
    primaryQuestion: "我应该如何开始并理解报告？",
    primaryAction: "开始起卦",
    visualHierarchy: {
      L1: ["tutorialSteps", "startLiuyao", "startMeihua"],
      L2: ["trustBoundary", "methodComparison", "faq"],
      L3: ["relatedKnowledge", "contentStatus"],
    },
    defaultState: "EMPTY",
    states: PAGE_STATE_CONTRACT,
  },
});

export const VISIBILITY_MATRIX = Object.freeze({
  Guided: {
    allowed: ["headline", "summary", "currentSituation", "mainSupports", "mainRisks", "changeDirection", "timingHint", "recommendedActions", "simplifiedEvidence", "nextActions"],
    forbidden: ["ruleCode", "ruleFindingId", "rawJson", "provider", "promptVersion", "requestId", "sourceVersions"],
  },
  Professional: {
    allowed: ["chartSummary", "relationships", "evidenceGroups", "timingCandidates", "knowledgeRefs"],
    forbidden: ["rawJson", "providerDebug", "promptVersion", "requestId", "stackTrace"],
  },
  Admin: {
    allowed: ["rawFacts", "sourceVersions", "provider", "model", "validation", "fallback", "latency", "debug"],
    forbidden: [],
  },
});
