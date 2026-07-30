// @ts-nocheck
const DIMENSION_CODES = Object.freeze([
  "subject_state",
  "target_state",
  "supporting_forces",
  "blocking_forces",
  "change_direction",
  "timing_state",
]);

const RANKING_ORDER = Object.freeze([
  "direct_target_fact",
  "world_response_fact",
  "strength_fact",
  "moving_change_fact",
  "support_block_signal",
  "symbolism",
]);

const PUBLIC_OUTPUT_ROLES = new Set(["FACT", "SIGNAL", "CANDIDATE_OR_GUARDRAIL"]);

export class ReportAggregationError extends Error {
  constructor(message, details = undefined) {
    super(message);
    this.name = "ReportAggregationError";
    this.details = details;
  }
}

function assert(condition, message, details = undefined) {
  if (!condition) {
    throw new ReportAggregationError(message, details);
  }
}

export function normalizeOutputRole(sourceRole, ruleType = undefined) {
  if (sourceRole === "FACT_OR_SIGNAL") {
    return ruleType === "timing" ? "CANDIDATE_OR_GUARDRAIL" : "FACT";
  }
  assert(PUBLIC_OUTPUT_ROLES.has(sourceRole), "Unsupported output role for public finding.", {
    sourceRole,
    ruleType,
  });
  return sourceRole;
}

export function createFindingFromRule({ ruleType, key, rule, dimension, summary, inputFacts = {}, evidenceKind, polarity, dedupeGroup, ruleVersion = "1.3.0" }) {
  const outputRole = normalizeOutputRole(rule.output_role ?? "FACT", ruleType);
  return {
    id: `${ruleType}:${key}`,
    rule_type: ruleType,
    rule_code: key,
    rule_version: rule.version ?? rule.rule_version ?? ruleVersion,
    output_role: outputRole,
    dimension: dimension ?? inferDimension({ rule_type: ruleType, output_role: outputRole, polarity }),
    summary: summary ?? rule.meaning_zh ?? rule.name_zh ?? rule.effect ?? key,
    input_facts: inputFacts,
    evidence_kind: evidenceKind ?? inferEvidenceKind({ rule_type: ruleType, rule_code: key, output_role: outputRole }),
    polarity,
    dedupe_group: dedupeGroup,
  };
}

function inferDimension(finding) {
  if (finding.output_role === "CANDIDATE_OR_GUARDRAIL" || finding.rule_type === "timing") {
    return "timing_state";
  }
  if (finding.rule_type === "dynamic") {
    return "change_direction";
  }
  if (finding.polarity === "blocking") {
    return "blocking_forces";
  }
  if (finding.polarity === "supporting") {
    return "supporting_forces";
  }
  if (finding.rule_type === "yongshen") {
    return "target_state";
  }
  return "target_state";
}

function inferEvidenceKind(finding) {
  if (finding.evidence_kind) {
    return finding.evidence_kind;
  }
  if (finding.rule_type === "yongshen") {
    return "direct_target_fact";
  }
  if (/WORLD|RESPONSE/u.test(finding.rule_code ?? "")) {
    return "world_response_fact";
  }
  if (finding.rule_type === "strength") {
    return "strength_fact";
  }
  if (finding.rule_type === "dynamic") {
    return "moving_change_fact";
  }
  if (finding.output_role === "SIGNAL") {
    return "support_block_signal";
  }
  return "symbolism";
}

function rankFinding(finding) {
  const rank = RANKING_ORDER.indexOf(finding.evidence_kind ?? inferEvidenceKind(finding));
  return rank === -1 ? RANKING_ORDER.length : rank;
}

function dedupeFindings(findings) {
  const seen = new Set();
  const result = [];
  for (const finding of findings) {
    const key = finding.dedupe_group ?? `${finding.dimension}:${finding.rule_code}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(finding);
  }
  return result;
}

function dimensionConfig(policy) {
  return new Map(policy.dimensions.map((dimension) => [dimension.code, dimension]));
}

function publicTimingCandidate(candidate) {
  assert(!candidate.guaranteed_date, "CORE_V1 timing cannot publish guaranteed dates.", candidate);
  assert(candidate.evidence || candidate.evidence_ids || candidate.rule_code, "Timing candidate must include evidence.", candidate);
  return {
    window: candidate.window,
    granularity: candidate.granularity,
    rank: candidate.rank ?? candidate.base_rank ?? 0,
    evidence: candidate.evidence ?? candidate.evidence_ids ?? [candidate.rule_code],
    limitation: candidate.limitation ?? "Candidate window only; not a guaranteed date.",
  };
}

function safetyBoundary(topic) {
  if (topic === "health") {
    return "健康类问题仅输出一般趋势、压力或恢复信号；不能替代医生诊断、治疗或用药建议。";
  }
  if (topic === "legal") {
    return "法律类问题仅输出纠纷趋势、沟通压力和程序信号；不能替代合格法律专业人士意见。";
  }
  return null;
}

export function aggregateCoreV1Report({ findings, timingCandidates = [], reportPolicy, questionContext = {} }) {
  assert(reportPolicy?.dimensions?.length === 6, "Report policy must define six dimensions.");
  const hardMaximum = 15;
  const policyHardMaximum = reportPolicy.hard_maximum ?? 15;
  assert(policyHardMaximum <= hardMaximum, "Evidence hard maximum cannot exceed 15.", { policyHardMaximum });

  const byDimension = new Map(DIMENSION_CODES.map((code) => [code, []]));
  const configs = dimensionConfig(reportPolicy);
  const normalized = findings.map((finding) => ({
    ...finding,
    output_role: normalizeOutputRole(finding.output_role, finding.rule_type),
    dimension: finding.dimension ?? inferDimension(finding),
    evidence_kind: finding.evidence_kind ?? inferEvidenceKind(finding),
  }));

  for (const finding of dedupeFindings(normalized).sort((a, b) => rankFinding(a) - rankFinding(b))) {
    assert(DIMENSION_CODES.includes(finding.dimension), "Finding has an unknown report dimension.", finding);
    const bucket = byDimension.get(finding.dimension);
    const maxEvidence = configs.get(finding.dimension)?.max_evidence ?? 2;
    if (bucket.length < maxEvidence) {
      bucket.push(finding);
    }
  }

  const evidence = [];
  for (const dimension of DIMENSION_CODES) {
    for (const finding of byDimension.get(dimension)) {
      if (evidence.length < hardMaximum) {
        evidence.push(finding);
      }
    }
  }

  const publicTimingCandidates = timingCandidates
    .map(publicTimingCandidate)
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 5);

  const hasSupport = (byDimension.get("supporting_forces") ?? []).length > 0;
  const hasBlock = (byDimension.get("blocking_forces") ?? []).length > 0;
  const boundary = safetyBoundary(questionContext.topic);

  return {
    dimensions: Object.fromEntries(byDimension),
    evidence,
    evidenceBudget: {
      recommendedMinimum: 6,
      recommendedMaximum: 12,
      hardMaximum,
      actual: evidence.length,
    },
    timingCandidates: publicTimingCandidates,
    conflict: {
      supportAndBlockingCoexist: hasSupport && hasBlock,
      note: hasSupport && hasBlock
        ? "支持与阻碍并存：报告保留双方证据，并优先说明更直接的事实来源与不确定性。"
        : null,
    },
    safetyBoundary: boundary,
  };
}
