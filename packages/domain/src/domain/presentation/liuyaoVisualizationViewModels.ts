// @ts-nocheck

export const LIUYAO_VISUAL_SYSTEM_VERSION = "LIUYAO_VISUAL_SYSTEM_V1";

export const LIUYAO_VISUAL_REGISTRY = [
  ["VIS-LY-001", "SixLineBoardViewModel", "P0", "六爻盘面"],
  ["VIS-LY-002", "PrimaryChangedHexagramViewModel", "P0", "本卦 / 变卦"],
  ["VIS-LY-003", "CastingSequenceViewModel", "P0", "起卦序列"],
  ["VIS-LY-004", "YongshenEvidenceViewModel", "P0", "核心焦点"],
  ["VIS-LY-005", "ShiYingRelationshipViewModel", "P0", "世应关系"],
  ["VIS-LY-006", "SixRelationsRoleMapViewModel", "P0", "六亲角色"],
  ["VIS-LY-007", "StrengthStateMatrixViewModel", "P0", "状态矩阵"],
  ["VIS-LY-008", "DynamicTransformationViewModel", "P0", "动爻变化"],
  ["VIS-LY-009", "EvidenceConflictViewModel", "P0", "证据冲突"],
  ["VIS-LY-010", "TimingTimelineViewModel", "P0", "时间线索"],
  ["VIS-LY-011", "SupportRiskDecisionViewModel", "P1", "支持 / 风险 / 行动"],
  ["VIS-LY-012", "PatternExplanationViewModel", "P1", "判断模式"],
  ["VIS-LY-013", "DecisionComparisonViewModel", "P1", "决策比较"],
  ["VIS-LY-014", "CalculationReasoningFlowViewModel", "P1", "推理链路"],
].map(([visualId, viewModel, priority, title]) => ({
  visualId,
  viewModel,
  priority,
  title,
  implementation: "react_svg",
  dataPolicy: "facts_only_no_recompute",
  contexts: ["guided", "professional", "report", "static_export"],
}));

const LINE_LABELS = {
  1: "初爻",
  2: "二爻",
  3: "三爻",
  4: "四爻",
  5: "五爻",
  6: "上爻",
};

function array(value) {
  return Array.isArray(value) ? value : [];
}

function displayLineName(position) {
  return LINE_LABELS[position] ?? `第 ${position ?? "-"} 爻`;
}

function visualState(required) {
  return required ? "ready" : "partial";
}

function normalizeEvidenceItem(item, polarity) {
  return {
    title: item?.title,
    text: item?.text,
    priority: item?.priority,
    evidenceKind: item?.evidenceKind,
    polarity,
  };
}

function roleLabelsForLine(observationFocus, position) {
  return array(observationFocus?.roles)
    .filter((role) => array(role.lines).some((line) => Number(line.position) === Number(position)))
    .map((role) => ({
      label: role.label,
      importance: role.importance,
      meaning: role.meaning,
    }));
}

function publicLine(line, observationFocus) {
  return {
    position: line?.position,
    label: displayLineName(line?.position),
    value: line?.value,
    yinYang: line?.yinYang,
    moving: Boolean(line?.moving),
    sixSpiritName: line?.sixSpiritName,
    sixRelationName: line?.sixRelationName,
    branchName: line?.branchName,
    elementName: line?.elementName,
    isWorld: Boolean(line?.isWorld),
    isResponse: Boolean(line?.isResponse),
    isVoid: Boolean(line?.isVoid),
    monthText: line?.monthText,
    dayText: line?.dayText,
    changedText: line?.changedText,
    roleLabels: roleLabelsForLine(observationFocus, line?.position),
    encodings: {
      lineShape: line?.yinYang === "阴" ? "broken" : "solid",
      movement: line?.moving ? "moving_marker" : "static_line",
      anchors: [line?.isWorld ? "shi" : null, line?.isResponse ? "ying" : null, line?.isVoid ? "void" : null].filter(Boolean),
    },
  };
}

function linesFrom(professionalViewModel) {
  return array(professionalViewModel?.auditChain?.lineDiagnostics).map((line) => ({ ...line }));
}

function evidenceFrom(professionalViewModel) {
  const groups = professionalViewModel?.evidenceGroups ?? {};
  return [
    ...array(groups.supports).map((item) => normalizeEvidenceItem(item, "support")),
    ...array(groups.risks).map((item) => normalizeEvidenceItem(item, "risk")),
    ...array(groups.other).map((item) => normalizeEvidenceItem(item, "neutral")),
  ];
}

function buildSixRelations(lines) {
  const map = new Map();
  for (const line of lines) {
    const key = line.sixRelationName ?? "未标注";
    const current = map.get(key) ?? { relationName: key, lines: [] };
    current.lines.push({
      position: line.position,
      label: displayLineName(line.position),
      branchName: line.branchName,
      elementName: line.elementName,
      moving: Boolean(line.moving),
      isWorld: Boolean(line.isWorld),
      isResponse: Boolean(line.isResponse),
    });
    map.set(key, current);
  }
  return Array.from(map.values());
}

function buildReasoningSteps(productResultFacts, professionalViewModel) {
  const audit = professionalViewModel?.auditChain ?? {};
  return [
    {
      label: "问题绑定",
      text: audit.question?.topic ?? productResultFacts?.questionContext?.topic,
      source: "questionContext",
    },
    {
      label: "取用神",
      text: audit.yongshenSelection?.explanation,
      source: "yongshenSelectionFacts",
    },
    {
      label: "盘面事实",
      text: professionalViewModel?.chartSummary?.title,
      source: "chartFacts",
    },
    {
      label: "证据整理",
      text: audit.evidenceResolution?.summary,
      source: "conflictResolutionFacts",
    },
    {
      label: "总体判断",
      text: audit.overallAssessment?.summary,
      source: "overallAssessmentFacts",
    },
    {
      label: "时间与行动",
      text: array(audit.timing)[0]?.explanation,
      source: "timingExplanationFacts",
    },
  ].filter((step) => step.text);
}

export function buildLiuyaoVisualizationBundle({ productResultFacts, guidedViewModel, professionalViewModel }) {
  if (!productResultFacts) return null;

  const chart = professionalViewModel?.chartSummary ?? {};
  const lines = linesFrom(professionalViewModel);
  const readingLines = [...lines].sort((a, b) => Number(b.position ?? 0) - Number(a.position ?? 0));
  const castingLines = [...lines].sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0));
  const observationFocus = guidedViewModel?.observationFocus ?? professionalViewModel?.observationFocus;
  const selectedRoles = array(productResultFacts?.yongshenSelectionFacts?.selectedRoles);
  const evidenceItems = evidenceFrom(professionalViewModel);
  const movingLines = readingLines.filter((line) => line.moving);
  const worldLine = lines.find((line) => line.isWorld);
  const responseLine = lines.find((line) => line.isResponse);
  const timing = array(professionalViewModel?.timingCandidates).length
    ? array(professionalViewModel?.timingCandidates)
    : array(professionalViewModel?.auditChain?.timing).map((item) => ({ title: item.window, text: item.explanation }));

  const common = {
    visualSystemVersion: LIUYAO_VISUAL_SYSTEM_VERSION,
    registryVersion: "VISUALIZATION_REGISTRY_V1",
    sourcePolicy: "ProductResultFacts -> Presentation ViewModels -> Visualization ViewModels",
    noRecompute: true,
  };

  const viewModels = {
    "VIS-LY-001": {
      ...common,
      visualId: "VIS-LY-001",
      viewModel: "SixLineBoardViewModel",
      status: visualState(lines.length >= 6),
      title: "六爻盘面",
      originalHexagram: chart.originalHexagram,
      changedHexagram: chart.changedHexagram,
      movingLines: chart.movingLines ?? [],
      worldLine: chart.worldLine,
      responseLine: chart.responseLine,
      readingOrder: "top_to_bottom_display",
      castingOrder: "bottom_to_top_source",
      lines: readingLines.map((line) => publicLine(line, observationFocus)),
      legend: ["阳爻 / 阴爻", "动爻", "世", "应", "用神 / 观察角色", "空亡"],
    },
    "VIS-LY-002": {
      ...common,
      visualId: "VIS-LY-002",
      viewModel: "PrimaryChangedHexagramViewModel",
      status: visualState(chart.originalHexagram || chart.changedHexagram),
      title: "本卦与变卦",
      originalHexagram: chart.originalHexagram,
      changedHexagram: chart.changedHexagram,
      movingLines: chart.movingLines ?? [],
      summary: chart.title,
      transitionNotes: movingLines.map((line) => ({
        position: line.position,
        label: displayLineName(line.position),
        changedText: line.changedText,
      })),
    },
    "VIS-LY-003": {
      ...common,
      visualId: "VIS-LY-003",
      viewModel: "CastingSequenceViewModel",
      status: visualState(castingLines.length >= 6),
      title: "起卦序列",
      sourceOrder: "初爻到上爻",
      lines: castingLines.map((line) => ({
        position: line.position,
        label: displayLineName(line.position),
        value: line.value,
        yinYang: line.yinYang,
        moving: Boolean(line.moving),
      })),
    },
    "VIS-LY-004": {
      ...common,
      visualId: "VIS-LY-004",
      viewModel: "YongshenEvidenceViewModel",
      status: visualState(selectedRoles.length),
      title: "核心焦点",
      topic: productResultFacts?.yongshenSelectionFacts?.topic,
      explanation: productResultFacts?.yongshenSelectionFacts?.explanation,
      roles: selectedRoles,
      observationSummary: observationFocus?.summary,
    },
    "VIS-LY-005": {
      ...common,
      visualId: "VIS-LY-005",
      viewModel: "ShiYingRelationshipViewModel",
      status: visualState(worldLine || responseLine),
      title: "世应关系",
      world: worldLine ? publicLine(worldLine, observationFocus) : null,
      response: responseLine ? publicLine(responseLine, observationFocus) : null,
      summary: "世应只呈现盘面给出的主体/相对方位置，不硬编码为固定人称。",
    },
    "VIS-LY-006": {
      ...common,
      visualId: "VIS-LY-006",
      viewModel: "SixRelationsRoleMapViewModel",
      status: visualState(lines.length),
      title: "六亲角色",
      relations: buildSixRelations(readingLines),
    },
    "VIS-LY-007": {
      ...common,
      visualId: "VIS-LY-007",
      viewModel: "StrengthStateMatrixViewModel",
      status: visualState(lines.length),
      title: "状态矩阵",
      mode: "qualitative_no_score",
      lineStates: readingLines.map((line) => ({
        position: line.position,
        label: displayLineName(line.position),
        relationName: line.sixRelationName,
        branchName: line.branchName,
        monthText: line.monthText,
        dayText: line.dayText,
        isVoid: Boolean(line.isVoid),
        moving: Boolean(line.moving),
      })),
      categories: array(professionalViewModel?.auditChain?.strength),
    },
    "VIS-LY-008": {
      ...common,
      visualId: "VIS-LY-008",
      viewModel: "DynamicTransformationViewModel",
      status: visualState(movingLines.length),
      title: "动爻变化",
      movingLines: movingLines.map((line) => ({
        position: line.position,
        label: displayLineName(line.position),
        relationName: line.sixRelationName,
        branchName: line.branchName,
        changedText: line.changedText,
      })),
      summary: professionalViewModel?.auditChain?.overallAssessment?.dynamicDirection,
    },
    "VIS-LY-009": {
      ...common,
      visualId: "VIS-LY-009",
      viewModel: "EvidenceConflictViewModel",
      status: visualState(professionalViewModel?.auditChain?.evidenceResolution),
      title: "证据冲突",
      conflictState: professionalViewModel?.auditChain?.evidenceResolution?.conflictState,
      summary: professionalViewModel?.auditChain?.evidenceResolution?.summary,
      evidence: evidenceItems,
    },
    "VIS-LY-010": {
      ...common,
      visualId: "VIS-LY-010",
      viewModel: "TimingTimelineViewModel",
      status: visualState(timing.length),
      title: "时间线索",
      precisionPolicy: "candidate_window_not_guaranteed_date",
      items: timing,
    },
    "VIS-LY-011": {
      ...common,
      visualId: "VIS-LY-011",
      viewModel: "SupportRiskDecisionViewModel",
      status: visualState(guidedViewModel?.mainSupports || guidedViewModel?.mainRisks),
      title: "支持 / 风险 / 行动",
      supports: guidedViewModel?.mainSupports ?? [],
      risks: guidedViewModel?.mainRisks ?? [],
      actions: guidedViewModel?.recommendedActions ?? [],
    },
    "VIS-LY-012": {
      ...common,
      visualId: "VIS-LY-012",
      viewModel: "PatternExplanationViewModel",
      status: visualState(professionalViewModel?.auditChain?.overallAssessment),
      title: "判断模式",
      patternName: professionalViewModel?.auditChain?.overallAssessment?.patternName,
      summary: professionalViewModel?.auditChain?.overallAssessment?.summary,
      basis: professionalViewModel?.auditChain?.overallAssessment?.basis ?? [],
      boundary: professionalViewModel?.auditChain?.overallAssessment?.boundary,
    },
    "VIS-LY-013": {
      ...common,
      visualId: "VIS-LY-013",
      viewModel: "DecisionComparisonViewModel",
      status: visualState(guidedViewModel?.mainSupports || guidedViewModel?.mainRisks),
      title: "决策比较",
      columns: [
        { label: "可推进条件", items: guidedViewModel?.mainSupports ?? [] },
        { label: "需要处理的风险", items: guidedViewModel?.mainRisks ?? [] },
        { label: "建议动作", items: array(guidedViewModel?.recommendedActions).map((text) => ({ text })) },
      ],
    },
    "VIS-LY-014": {
      ...common,
      visualId: "VIS-LY-014",
      viewModel: "CalculationReasoningFlowViewModel",
      status: visualState(professionalViewModel?.auditChain),
      title: "推理链路",
      steps: buildReasoningSteps(productResultFacts, professionalViewModel),
    },
  };

  return {
    visualSystemVersion: LIUYAO_VISUAL_SYSTEM_VERSION,
    readiness: "P0_READY_WITH_EXPORT_ALIGNMENT_PENDING",
    packageStatus: "DATA_IMPORTED",
    registry: LIUYAO_VISUAL_REGISTRY,
    p0VisualIds: LIUYAO_VISUAL_REGISTRY.filter((item) => item.priority === "P0").map((item) => item.visualId),
    p1VisualIds: LIUYAO_VISUAL_REGISTRY.filter((item) => item.priority === "P1").map((item) => item.visualId),
    contextMapping: {
      guided: ["VIS-LY-001", "VIS-LY-002", "VIS-LY-004", "VIS-LY-005", "VIS-LY-008", "VIS-LY-009", "VIS-LY-010", "VIS-LY-011"],
      professional: ["VIS-LY-001", "VIS-LY-004", "VIS-LY-005", "VIS-LY-006", "VIS-LY-007", "VIS-LY-008", "VIS-LY-009", "VIS-LY-010", "VIS-LY-012", "VIS-LY-014"],
      report: ["VIS-LY-001", "VIS-LY-002", "VIS-LY-004", "VIS-LY-005", "VIS-LY-008", "VIS-LY-009", "VIS-LY-010"],
      staticExport: ["VIS-LY-001", "VIS-LY-002", "VIS-LY-004", "VIS-LY-005", "VIS-LY-009", "VIS-LY-010"],
    },
    staticExport: {
      status: "DESIGN_READY_IMPLEMENTATION_PENDING",
      contractPath: "data/liuyao/visual-system/export/static-export-contract.md",
    },
    viewModels,
  };
}

