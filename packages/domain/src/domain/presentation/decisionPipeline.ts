// @ts-nocheck

export const QUESTION_PROFILE_VERSION = "LIUYAO_QUESTION_PROFILE_V1";
export const TOPIC_LENS_VERSION = "LIUYAO_TOPIC_LENS_V1";
export const EVIDENCE_GRAPH_VERSION = "LIUYAO_EVIDENCE_GRAPH_V1";
export const DECISION_FACTS_VERSION = "LIUYAO_DECISION_FACTS_V1";

const JOIN_MODES = {
  EMPLOYMENT: { label: "入职", scope: "EMPLOYMENT" },
  PARTNERSHIP: { label: "合伙", scope: "PARTNERSHIP" },
  PROJECT_COOPERATION: { label: "项目合作", scope: "PROJECT_COOPERATION" },
  INVESTMENT: { label: "投资或带资源加入", scope: "INVESTMENT" },
  ADVISORY: { label: "兼职或顾问", scope: "ADVISORY" },
};

const ROLE_LENSES = {
  EMPLOYMENT: [
    ["officer_ghost", "岗位、职责与工作压力", "primary"],
    ["world", "你的状态与承受能力", "primary"],
    ["parent", "Offer、合同、手续与正式流程", "secondary"],
    ["wealth", "薪资与实际回报", "secondary"],
  ],
  PARTNERSHIP: [
    ["world", "你的投入、边界与主动性", "primary"],
    ["response", "合伙人与外部承诺", "primary"],
    ["wealth", "收益、股权与项目资源", "primary"],
    ["sibling", "同级利益、竞争与分配", "secondary"],
    ["parent", "协议、职责与退出约定", "secondary"],
  ],
  PROJECT_COOPERATION: [
    ["response", "朋友与项目方的实际落实", "primary"],
    ["world", "你的投入与承受边界", "primary"],
    ["parent", "合同、职责、验收与流程", "primary"],
    ["wealth", "项目资源与合作回报", "secondary"],
    ["officer_ghost", "项目责任、监管与执行压力", "secondary"],
  ],
  INVESTMENT: [
    ["wealth", "资金、回报与可得资源", "primary"],
    ["child", "项目产出与结果兑现", "primary"],
    ["sibling", "竞争、分配与资金消耗", "primary"],
    ["response", "项目方与外部承诺", "secondary"],
    ["parent", "协议、凭据与正式手续", "secondary"],
  ],
  ADVISORY: [
    ["world", "你的时间与专业投入", "primary"],
    ["response", "项目方的实际需求与配合", "primary"],
    ["parent", "顾问范围、交付与约定", "primary"],
    ["wealth", "费用与实际回报", "secondary"],
    ["officer_ghost", "责任边界与项目压力", "secondary"],
  ],
};

const ELEMENT_GENERATES = {
  wood: "fire",
  fire: "earth",
  earth: "metal",
  metal: "water",
  water: "wood",
};

function inferJoinMode(question = "") {
  if (/入职|上班|员工|职位|岗位|全职|offer/iu.test(question)) return "EMPLOYMENT";
  if (/合伙|合伙人|股权|共同创业|联合创始/iu.test(question)) return "PARTNERSHIP";
  if (/投资|出资|入股|投钱|带资/iu.test(question)) return "INVESTMENT";
  if (/顾问|兼职|咨询|外聘/iu.test(question)) return "ADVISORY";
  if (/项目合作|外包|承接|共同完成|协作项目/iu.test(question)) return "PROJECT_COOPERATION";
  return null;
}

export function buildQuestionProfile(chart) {
  if (chart.questionProfile?.profileVersion === "LIUYAO_QUESTION_PROFILE_V2") {
    const profile = chart.questionProfile;
    return {
      ...profile,
      clarificationRequired: profile.status === "CLARIFY" || profile.status === "SPLIT",
      clarificationStatus: profile.status,
      possibleModes: [],
      joinModeLabel: JOIN_MODES[profile.joinMode]?.label ?? "按原问题理解",
    };
  }
  const question = String(chart.question ?? "");
  const suppliedMode = chart.questionProfile?.joinMode;
  const inferredMode = suppliedMode && JOIN_MODES[suppliedMode] ? suppliedMode : inferJoinMode(question);
  const isJoinQuestion = /加入|参与|跟(?:他|她|朋友|对方).{0,6}(?:做|干)|一起做/iu.test(question);
  const isCooperation = `${chart.topic}:${chart.subtype}` === "business:partnership";
  const clarificationRequired = isCooperation && isJoinQuestion && !inferredMode;
  const joinMode = inferredMode ?? (isCooperation && !isJoinQuestion ? "PROJECT_COOPERATION" : null);
  return {
    profileVersion: QUESTION_PROFILE_VERSION,
    primaryIntent: isCooperation ? "JOIN_OR_COOPERATE" : `${String(chart.topic ?? "general").toUpperCase()}_${String(chart.subtype ?? "decision").toUpperCase()}`,
    joinMode: joinMode ?? "UNCLARIFIED",
    joinModeLabel: joinMode ? JOIN_MODES[joinMode].label : "加入方式尚未明确",
    clarificationRequired,
    clarificationStatus: clarificationRequired ? "NEEDS_CLARIFICATION" : "RESOLVED",
    clarificationQuestion: clarificationRequired ? "你说的“加入”，主要指入职、合伙、项目合作、投资，还是兼职顾问？" : null,
    possibleModes: clarificationRequired
      ? Object.entries(JOIN_MODES).map(([code, item]) => ({ code, label: item.label }))
      : joinMode ? [{ code: joinMode, label: JOIN_MODES[joinMode].label }] : [],
    source: suppliedMode ? "USER_CONFIRMED" : inferredMode ? "QUESTION_CLASSIFIER" : "SCENARIO_DEFAULT",
  };
}

function roleLines(chart, role) {
  if (role === "world") return chart.lines.filter((line) => line.isWorld);
  if (role === "response") return chart.lines.filter((line) => line.isResponse);
  return chart.lines.filter((line) => line.sixRelation === role);
}

export function buildTopicLens(chart, questionProfile, topicRoleContext = null) {
  const modes = questionProfile.clarificationRequired
    ? ["EMPLOYMENT", "PARTNERSHIP", "PROJECT_COOPERATION", "INVESTMENT"]
    : questionProfile.joinMode !== "UNCLARIFIED" ? [questionProfile.joinMode] : [];
  const joinBranches = modes.map((mode) => ({
    mode,
    label: JOIN_MODES[mode]?.label ?? mode,
    roles: (ROLE_LENSES[mode] ?? []).map(([role, practicalMeaning, importance]) => ({
      role,
      practicalMeaning,
      importance,
      linePositions: roleLines(chart, role).map((line) => line.position),
    })),
  }));
  const branches = joinBranches.length ? joinBranches : [{
    mode: questionProfile.primaryIntent,
    label: topicRoleContext?.displayName ?? "当前问题",
    roles: (topicRoleContext?.roles ?? []).map((role) => ({
      role: role.label,
      practicalMeaning: role.practicalMeaning,
      importance: role.importance,
      linePositions: (role.lines ?? []).map((line) => line.position),
    })),
  }];
  const active = branches.length === 1 ? branches[0] : null;
  return {
    lensVersion: TOPIC_LENS_VERSION,
    status: questionProfile.clarificationRequired ? "BRANCHED" : "RESOLVED",
    activeMode: active?.mode ?? null,
    activeLabel: active?.label ?? "按不同加入方式分别理解",
    roles: active?.roles ?? [],
    branches,
  };
}

function linePositionsFromFinding(item) {
  const facts = item.inputFacts ?? {};
  return [...new Set([
    facts.linePosition,
    facts.sourceLine,
    facts.targetLine,
    ...(facts.linePositions ?? []),
    ...(facts.originLinePositions ?? []),
    ...(facts.tabooLinePositions ?? []),
    ...(facts.targetLinePositions ?? []),
  ].filter((value) => Number.isInteger(value)))];
}

function categoryForFinding(item) {
  if (item.dimension === "blocking_forces" || item.polarity === "blocking") return "RISK";
  if (item.dimension === "supporting_forces" || item.polarity === "supporting") return "SUPPORT";
  return "NEUTRAL";
}

function lineSupported(line) {
  return [line.monthInfluence, line.dayInfluence].filter(Boolean)
    .some((item) => item.isSame || item.effect === "generates");
}

function linePressured(line) {
  return line.isVoid || [line.monthInfluence, line.dayInfluence].filter(Boolean)
    .some((item) => item.isClash || ["controls", "drains", "resists"].includes(item.effect));
}

function compositeNode({ id, category, meaning, factRefs, ruleId, scopes, weight = "PRIMARY", limitations = [] }) {
  return { id, nodeType: "COMPOSITE", category, meaning, factRefs, ruleId, scopes, weight, limitations };
}

export function buildEvidenceGraph({ chart, resolvedFindingFacts, questionProfile, topicLens }) {
  const atomicNodes = resolvedFindingFacts.map((item) => ({
    id: `evidence:${item.findingRef}`,
    nodeType: "ATOMIC",
    category: categoryForFinding(item),
    meaning: item.resolvedMeaning?.practicalMeaning ?? item.summary,
    factRefs: linePositionsFromFinding(item).map((position) => `line:${position}`),
    findingRefs: [item.findingRef],
    ruleId: item.ruleCode,
    scopes: topicLens.branches.map((branch) => branch.mode),
    weight: item.evidenceKind === "direct_target_fact" ? "CONTEXT" : "SECONDARY",
    limitations: item.resolvedMeaning?.limitations ?? [],
  }));
  const composites = [];
  const world = chart.lines.find((line) => line.isWorld);
  const response = chart.lines.find((line) => line.isResponse);
  const parents = chart.lines.filter((line) => line.sixRelation === "parent");
  const officers = chart.lines.filter((line) => line.sixRelation === "officer_ghost");

  if (world && response && world.branch === response.branch && world.sixRelation === response.sixRelation) {
    composites.push(compositeNode({
      id: "evidence:SHI_YING_SHARED_REALITY_FOCUS",
      category: linePressured(world) || linePressured(response) ? "MIXED" : "SUPPORT",
      meaning: "双方关注点都落在项目收益与现实资源，方向存在共同基础；但这不等于合作承诺已经落实。",
      factRefs: [`line:${world.position}`, `line:${response.position}`],
      ruleId: "SHI_YING_SAME_BRANCH_AND_RELATIVE",
      scopes: ["PARTNERSHIP", "PROJECT_COOPERATION", "ADVISORY"],
      limitations: ["同支同六亲只说明关注方向相近，不能推出对方可靠或合作必成。"],
    }));
  }
  if (parents.length && parents.some((line) => line.isVoid) && parents.some(lineSupported)) {
    composites.push(compositeNode({
      id: "evidence:CONTRACT_SUPPORTED_BUT_UNSETTLED",
      category: "MIXED",
      meaning: "合同、职责和正式流程具备形成条件，但当前仍未落实，不能只按有利支持理解。",
      factRefs: parents.map((line) => `line:${line.position}`),
      ruleId: "PARENT_SUPPORTED_AND_VOID",
      scopes: ["EMPLOYMENT", "PARTNERSHIP", "PROJECT_COOPERATION", "INVESTMENT", "ADVISORY"],
      limitations: ["受生与空亡必须同时保留，不把其中一项覆盖另一项。"],
    }));
  }
  if (officers.length && officers.some(lineSupported)) {
    composites.push(compositeNode({
      id: "evidence:RESPONSIBILITY_AND_RULE_PRESSURE_ACTIVE",
      category: "RISK",
      meaning: "岗位、政府项目责任、规则约束与执行压力是本题不可忽略的强信号。",
      factRefs: officers.map((line) => `line:${line.position}`),
      ruleId: "OFFICER_SUPPORTED_IN_JOIN_CONTEXT",
      scopes: ["EMPLOYMENT", "PROJECT_COOPERATION", "ADVISORY"],
      limitations: ["官鬼力量较强不等于事情必坏，重点是核实职责、权限和风险承担。"],
    }));
  }
  if (world && officers.length && officers.some((line) => ELEMENT_GENERATES[world.element] === line.element)) {
    composites.push(compositeNode({
      id: "evidence:SELF_INPUT_FEEDS_RESPONSIBILITY",
      category: "RISK",
      meaning: "加入后更可能需要你先投入能力、时间或资源并承担项目责任，而不是项目条件先来支持你。",
      factRefs: [`line:${world.position}`, ...officers.map((line) => `line:${line.position}`)],
      ruleId: "WORLD_GENERATES_OFFICER_IN_JOIN_CONTEXT",
      scopes: ["EMPLOYMENT", "PROJECT_COOPERATION", "ADVISORY"],
      limitations: ["这是投入方向判断，不代表现实职责已经确认。"],
    }));
  }
  composites.push(compositeNode({
    id: "evidence:STATIC_CHART",
    category: "NEUTRAL",
    meaning: chart.movingLines.length
      ? `本盘有 ${chart.movingLines.length} 个动爻，需要结合动变观察条件变化。`
      : "本盘没有动爻，当前尚未出现足以推动身份转换的明确变化信号。",
    factRefs: ["chart:moving_lines"],
    ruleId: chart.movingLines.length ? "MOVING_LINES_PRESENT" : "ALL_LINES_STATIC",
    scopes: topicLens.branches.map((branch) => branch.mode),
  }));

  const activeScopes = new Set(topicLens.branches.map((branch) => branch.mode));
  const nodes = [...atomicNodes, ...composites]
    .filter((node) => !node.scopes?.length || node.scopes.some((scope) => activeScopes.has(scope)));
  return {
    graphVersion: EVIDENCE_GRAPH_VERSION,
    status: questionProfile.clarificationRequired ? "BRANCHED" : "RESOLVED",
    nodes,
    decisionNodes: nodes.filter((node) => node.nodeType === "COMPOSITE"),
  };
}

export function evidenceNodesForScope(evidenceGraph, scope) {
  return evidenceGraph.nodes.filter((node) => !node.scopes?.length || node.scopes.includes(scope));
}

export function buildDecisionFacts({ questionProfile, topicLens, evidenceGraph, decisionSupportFacts }) {
  const activeScopes = new Set(topicLens.branches.map((branch) => branch.mode));
  const scopedNodes = evidenceGraph.nodes
    .filter((node) => !node.scopes?.length || node.scopes.some((scope) => activeScopes.has(scope)))
    .filter((node) => node.weight !== "CONTEXT" && ["SUPPORT", "RISK", "MIXED", "NEUTRAL"].includes(node.category));
  const allowedFindingRefs = [...scopedNodes]
    .sort((left, right) => Number(right.nodeType === "COMPOSITE") - Number(left.nodeType === "COMPOSITE"))
    .map((node) => node.id)
    .slice(0, 12);
  return {
    decisionFactsVersion: DECISION_FACTS_VERSION,
    status: questionProfile.clarificationRequired ? "BRANCHED_ASSESSMENT" : "READY",
    stance: questionProfile.clarificationRequired ? "CLARIFY_THEN_PROCEED" : decisionSupportFacts.decisionMode,
    headlineConstraint: decisionSupportFacts.directAnswer,
    requiredConditions: decisionSupportFacts.proceedConditions,
    stopConditions: decisionSupportFacts.holdConditions,
    allowedFindingRefs,
    branchScopes: topicLens.branches.map((branch) => ({ mode: branch.mode, label: branch.label })),
    prohibitedClaims: [
      "一定成功或一定失败",
      "对方必然可靠",
      "现实合同、职责或资源已经核实",
      "仅凭卦象建议用户放弃现有事业或投入全部资源",
      "排盘中不存在的动爻、关系或确定日期",
    ],
    boundary: "DecisionFacts只锁定结论方向、证据范围和禁止性边界，不预写AI的完整自然语言报告。",
  };
}
