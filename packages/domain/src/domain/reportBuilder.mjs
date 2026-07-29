const DIMENSION_TITLES = Object.freeze({
  subject_state: "主体状态",
  target_state: "目标状态",
  supporting_forces: "核心支持因素",
  blocking_forces: "核心阻碍因素",
  change_direction: "事情发展过程",
  timing_state: "时间候选",
});

function findingIds(findings = []) {
  return findings.map((finding) => finding.id).filter(Boolean);
}

function sentenceFromFindings(findings, fallback) {
  if (!findings?.length) return fallback;
  return findings.map((finding) => finding.summary).join("；");
}

function section({ code, title, text, findings = [], knowledgeIds = [] }) {
  return {
    code,
    title,
    text,
    findingIds: findingIds(findings),
    knowledgeIds,
  };
}

export function buildLiuyaoReport(result) {
  const { chart, report, engineVersions } = result;
  const dimensions = report.dimensions;
  const support = dimensions.supporting_forces ?? [];
  const blocking = dimensions.blocking_forces ?? [];
  const timing = dimensions.timing_state ?? [];

  const sections = [
    section({
      code: "overview",
      title: "一句话概览",
      text: `${chart.originalHexagram.name_zh}之${chart.changedHexagram.name_zh}，当前报告保留 ${report.evidenceBudget.actual} 条核心证据；${report.conflict.supportAndBlockingCoexist ? "支持与阻碍并存，需要同时观察。" : "暂未形成强制单一结论。"}`,
      findings: report.evidence.slice(0, 3),
    }),
    section({
      code: "chart_facts",
      title: "盘面事实摘要",
      text: `本卦${chart.originalHexagram.name_zh}，变卦${chart.changedHexagram.name_zh}；世爻在${chart.worldResponse.worldLine}爻，应爻在${chart.worldResponse.responseLine}爻；动爻为${chart.movingLines.length ? chart.movingLines.join("、") : "无"}.`,
      findings: report.evidence.filter((finding) => finding.evidence_kind === "world_response_fact"),
      knowledgeIds: [chart.originalHexagram.code, chart.changedHexagram.code],
    }),
    section({
      code: "support",
      title: "核心支持因素",
      text: sentenceFromFindings(support, "当前 CORE_V1 证据中没有明确支持项。"),
      findings: support,
    }),
    section({
      code: "blocking",
      title: "核心阻碍因素",
      text: sentenceFromFindings(blocking, "当前 CORE_V1 证据中没有明确阻碍项。"),
      findings: blocking,
    }),
    section({
      code: "change",
      title: "事情发展过程",
      text: sentenceFromFindings(dimensions.change_direction, "当前动变证据不足，变化方向需要继续观察。"),
      findings: dimensions.change_direction,
    }),
    section({
      code: "external",
      title: "对方或外部状态",
      text: sentenceFromFindings(dimensions.target_state, "目标侧证据较少，需结合问题类型继续确认。"),
      findings: dimensions.target_state,
    }),
    section({
      code: "timing",
      title: "时间候选",
      text: result.timingCandidates.length
        ? result.timingCandidates.map((candidate) => `${candidate.window}（${Array.isArray(candidate.granularity) ? candidate.granularity.join("/") : candidate.granularity}，${candidate.limitation}）`).join("；")
        : "当前没有公开应期候选。",
      findings: timing,
    }),
    section({
      code: "action",
      title: "行动建议",
      text: report.conflict.supportAndBlockingCoexist
        ? "先处理阻碍项对应的现实条件，再利用支持项推进；不要把信号解读成保证结果。"
        : "以盘面事实和已列证据为参考，优先做可验证、可调整的下一步。",
      findings: [...support, ...blocking].slice(0, 4),
    }),
    section({
      code: "evidence_versions",
      title: "证据与版本",
      text: `规则版本 ${engineVersions.rules}，六爻引擎 ${engineVersions.liuyao}，日历策略 ${chart.calendar.policyVersion}，报告模板 CORE_V1_REPORT_TEMPLATE_LIGHT。`,
      findings: report.evidence,
      knowledgeIds: ["CORE_V1_REPORT_TEMPLATE_LIGHT"],
    }),
  ];

  if (report.safetyBoundary) {
    sections.splice(1, 0, section({
      code: "safety",
      title: "安全边界",
      text: report.safetyBoundary,
    }));
  }

  return {
    reportTemplateVersion: "CORE_V1_REPORT_TEMPLATE_LIGHT",
    chartId: chart.id,
    type: "liuyao",
    sections,
    evidence: report.evidence,
    timingCandidates: result.timingCandidates,
    engineVersions,
  };
}

export function buildMeihuaReport(result) {
  const { chart, report, engineVersions } = result;
  return {
    reportTemplateVersion: "MEIHUA_REPORT_TEMPLATE_LIGHT",
    chartId: chart.id,
    type: "meihua",
    sections: [
      section({
        code: "overview",
        title: "一句话概览",
        text: report.oneSentenceSummary,
      }),
      section({
        code: "chart_facts",
        title: "盘面事实摘要",
        text: `本卦${chart.originalHexagram.name_zh}，互卦${chart.mutualHexagram.name_zh}，变卦${chart.changedHexagram.name_zh}；动爻为${chart.movingLine}爻。`,
        knowledgeIds: [chart.originalHexagram.code, chart.mutualHexagram.code, chart.changedHexagram.code],
      }),
      section({
        code: "body_use",
        title: "体用关系",
        text: `${chart.bodyTrigram.name_zh}为体，${chart.useTrigram.name_zh}为用，关系为${chart.bodyUseRelation?.meaning_zh ?? chart.bodyUseRelation?.code ?? "未定"}。`,
      }),
      section({
        code: "symbols",
        title: "象义参考",
        text: chart.symbolEvidence.slice(0, 4).map((item) => `${item.dimension}: ${item.symbols.join("、")}`).join("；"),
      }),
      section({
        code: "safety",
        title: "安全边界",
        text: report.safetyBoundary,
      }),
      section({
        code: "evidence_versions",
        title: "证据与版本",
        text: `梅花引擎 ${engineVersions.meihua}，报告模板 MEIHUA_REPORT_TEMPLATE_LIGHT。`,
        knowledgeIds: ["MEIHUA_REPORT_TEMPLATE_LIGHT"],
      }),
    ],
    evidence: report.evidence,
    engineVersions,
  };
}

