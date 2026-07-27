import test from "node:test";
import assert from "node:assert/strict";

import {
  AiInputValidationError,
  ReportAggregationError,
  aggregateCoreV1Report,
  createFindingFromRule,
  loadRuleProfile,
  validateAiInput,
} from "../src/production/index.mjs";

const ROOT = process.cwd();

function fixtureFindings() {
  const bundle = loadRuleProfile({ rootDir: ROOT });
  const strengthRules = [...bundle.rulesByType.get("strength").entries()].slice(0, 8);
  const patternRules = [...bundle.rulesByType.get("pattern").entries()].slice(0, 8);
  const dynamicRules = [...bundle.rulesByType.get("dynamic").entries()].slice(0, 5);
  const timingRules = [...bundle.rulesByType.get("timing").entries()].slice(0, 3);

  return [
    ...strengthRules.map(([key, rule], index) => createFindingFromRule({
      ruleType: "strength",
      key,
      rule,
      dimension: index % 2 === 0 ? "supporting_forces" : "blocking_forces",
      polarity: index % 2 === 0 ? "supporting" : "blocking",
      dedupeGroup: index < 3 ? "time-environment-support" : undefined,
    })),
    ...patternRules.map(([key, rule], index) => createFindingFromRule({
      ruleType: "pattern",
      key,
      rule,
      dimension: index % 3 === 0 ? "subject_state" : "target_state",
      polarity: index % 2 === 0 ? "supporting" : "blocking",
    })),
    ...dynamicRules.map(([key, rule]) => createFindingFromRule({
      ruleType: "dynamic",
      key,
      rule,
      dimension: "change_direction",
    })),
    ...timingRules.map(([key, rule]) => createFindingFromRule({
      ruleType: "timing",
      key,
      rule,
      dimension: "timing_state",
    })),
  ];
}

test("aggregates findings into six dimensions with evidence hard max and dedupe", () => {
  const bundle = loadRuleProfile({ rootDir: ROOT });
  const report = aggregateCoreV1Report({
    findings: fixtureFindings(),
    timingCandidates: Array.from({ length: 8 }, (_, index) => ({
      window: `candidate-${index + 1}`,
      granularity: "day",
      rank: 100 - index,
      rule_code: "TARGET_BRANCH_VALUE",
      evidence: ["TARGET_BRANCH_VALUE"],
    })),
    reportPolicy: bundle.reportPolicy,
    questionContext: { topic: "legal" },
  });

  assert.deepEqual(Object.keys(report.dimensions), [
    "subject_state",
    "target_state",
    "supporting_forces",
    "blocking_forces",
    "change_direction",
    "timing_state",
  ]);
  assert.ok(report.evidence.length <= 15);
  assert.ok(report.evidence.length >= 6);
  assert.equal(report.timingCandidates.length, 5);
  assert.equal(report.conflict.supportAndBlockingCoexist, true);
  assert.match(report.conflict.note, /支持与阻碍并存/u);
  assert.match(report.safetyBoundary, /法律/u);
  assert.ok(report.evidence.every((finding) => finding.rule_version === bundle.profile.version));

  const duplicateGroupCount = report.evidence.filter((finding) => finding.dedupe_group === "time-environment-support").length;
  assert.equal(duplicateGroupCount, 1);
});

test("health questions include a non-diagnostic safety boundary", () => {
  const bundle = loadRuleProfile({ rootDir: ROOT });
  const report = aggregateCoreV1Report({
    findings: fixtureFindings(),
    reportPolicy: bundle.reportPolicy,
    questionContext: { topic: "health" },
  });

  assert.match(report.safetyBoundary, /不能替代医生诊断/u);
});

test("timing candidates must stay candidates, not guaranteed dates", () => {
  const bundle = loadRuleProfile({ rootDir: ROOT });
  assert.throws(
    () => aggregateCoreV1Report({
      findings: fixtureFindings(),
      timingCandidates: [{
        window: "2026-08-01",
        granularity: "day",
        rank: 100,
        guaranteed_date: true,
        evidence: ["TARGET_BRANCH_VALUE"],
      }],
      reportPolicy: { dimensions: bundle.profile.user_value_dimensions.map((code) => ({ code, max_evidence: 2 })) },
    }),
    ReportAggregationError,
  );
});

test("AI input accepts only matched rule codes and explicit output roles", () => {
  const input = {
    question_context: { topic: "career" },
    chart_facts: [{ fact_id: "world-line", value: "present" }],
    matched_rule_findings: [
      { rule_code: "YONGSHEN_HOLDS_WORLD", output_role: "FACT" },
      { rule_code: "TARGET_BRANCH_VALUE", output_role: "CANDIDATE_OR_GUARDRAIL" },
    ],
    timing_candidates: [
      { window: "next-month", rule_code: "TARGET_BRANCH_VALUE" },
    ],
    knowledge_references: [],
    engine_versions: { rules: "1.3.0" },
  };

  const result = validateAiInput(input);
  assert.ok(result.matchedRuleCodes.has("YONGSHEN_HOLDS_WORLD"));
});

test("AI input rejects unhit rule codes, invented keys and ambiguous output roles", () => {
  assert.throws(
    () => validateAiInput({
      question_context: {},
      invented_source: {},
      matched_rule_findings: [],
    }),
    AiInputValidationError,
  );

  assert.throws(
    () => validateAiInput({
      question_context: {},
      matched_rule_findings: [{ rule_code: "KNOWN", output_role: "FACT" }],
      timing_candidates: [{ window: "later", rule_code: "UNMATCHED" }],
    }),
    AiInputValidationError,
  );

  assert.throws(
    () => validateAiInput({
      question_context: {},
      matched_rule_findings: [{ rule_code: "KNOWN", output_role: "FACT_OR_SIGNAL" }],
    }),
    AiInputValidationError,
  );
});
