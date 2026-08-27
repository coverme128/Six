import test from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  FeatureFlagError,
  RuleProfileLoadError,
  loadRuleProfile,
  resolveFeatureFlags,
} from "@six/domain/production";
import { CORE_V1_RULE_EXECUTION_COVERAGE } from "@six/domain/liuyao";

const ROOT = process.cwd();

function makeTempProject() {
  const root = mkdtempSync(join(tmpdir(), "six-core-v1-"));
  cpSync(join(ROOT, "data"), join(root, "data"), { recursive: true });
  return root;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

test("loads exactly the LIUYAO_CORE_V1 production whitelist", () => {
  const bundle = loadRuleProfile({ rootDir: ROOT });
  assert.equal(bundle.status, "CORE_V1_SCOPE_IMPLEMENTED");
  assert.deepEqual(bundle.counts, {
    yongshenMappings: 45,
    strengthRules: 24,
    dynamicRules: 14,
    patternRules: 47,
    timingAndGuardrailRules: 18,
    total: 148,
  });
  assert.equal(bundle.questionTopics.items.length, 45);

  for (const rules of bundle.rulesByType.values()) {
    for (const item of rules.values()) {
      assert.equal(item.release_tier, "CORE_V1");
      assert.equal(item.enabled_by_default, true);
      assert.notEqual(item.status, "REVIEW_REQUIRED");
    }
  }
});

test("every loaded CORE_V1 rule has an explicit runtime execution or policy path", () => {
  const coverage = CORE_V1_RULE_EXECUTION_COVERAGE;
  assert.equal(coverage.strength.executable, 24);
  assert.deepEqual(coverage.strength.expertBlocked, []);
  assert.equal(coverage.dynamic.executable, 14);
  assert.deepEqual(coverage.dynamic.expertBlocked, []);
  assert.equal(coverage.pattern.executable, 47);
  assert.deepEqual(coverage.pattern.expertBlocked, []);
  assert.equal(coverage.timing.executable, 18);
  assert.equal(coverage.timing.policyOnly.length, 16);
  assert.equal(45 + coverage.strength.executable + coverage.dynamic.executable + coverage.pattern.executable + coverage.timing.executable, 148);
});

test("every CORE_V1 whitelist key is traceable to the candidate rule pools", () => {
  const bundle = loadRuleProfile({ rootDir: ROOT });
  const candidateFiles = {
    yongshen: "yongshen-rules-pro.json",
    strength: "strength-rules-pro.json",
    dynamic: "dynamic-rules-pro.json",
    pattern: "pattern-rules-pro.json",
    timing: "timing-rules-pro.json",
  };

  for (const [ruleType, fileName] of Object.entries(candidateFiles)) {
    const pool = readJson(join(ROOT, "data/production", fileName));
    const keys = new Set(pool.items.map((item) => ruleType === "yongshen" ? `${item.topic}:${item.subtype}` : item.code));
    for (const key of bundle.rulesByType.get(ruleType).keys()) {
      assert.ok(keys.has(key), `${ruleType}:${key}`);
    }
  }

  const topicPool = readJson(join(ROOT, "data/production/question-topics-pro.json"));
  const topicKeys = new Set(topicPool.items.map((item) => `${item.topic}:${item.subtype}`));
  for (const topic of bundle.questionTopics.items) {
    assert.ok(topicKeys.has(`${topic.topic}:${topic.subtype}`), `${topic.topic}:${topic.subtype}`);
  }
});

test("fails fast when a CORE_V1 key cannot be found in the candidate rule pool", () => {
  const root = makeTempProject();
  const path = join(root, "data/production/strength-rules-pro.json");
  const data = readJson(path);
  data.items = data.items.filter((item) => item.code !== "MONTH_SAME_BRANCH");
  writeJson(path, data);

  assert.throws(
    () => loadRuleProfile({ rootDir: root }),
    (error) => error instanceof RuleProfileLoadError && /candidate rule pool/u.test(error.message),
  );
});

test("scope fixtures pass for CORE_V1 and blocked review cases stay unloaded", () => {
  const bundle = loadRuleProfile({ rootDir: ROOT });
  const fixtures = readJson(join(ROOT, "fixtures/production/core-v1-scope-contract-fixtures.json")).items;
  assert.equal(fixtures.length, 168);

  for (const fixture of fixtures) {
    const loadedRule = bundle.rulesByType.get(fixture.rule_type)?.get(fixture.key);
    if (fixture.expected_release_tier === "CORE_V1") {
      assert.ok(loadedRule, fixture.case_id);
      assert.equal(loadedRule.release_tier, "CORE_V1", fixture.case_id);
      assert.equal(loadedRule.enabled_by_default, true, fixture.case_id);
      assert.notEqual(loadedRule.status, fixture.must_not_have_status, fixture.case_id);
    } else if (fixture.expected_release_tier === "REVIEW_REQUIRED") {
      assert.equal(loadedRule, undefined, fixture.case_id);
    }
  }
});

test("fails fast when a REVIEW_REQUIRED rule is injected into a production dataset", () => {
  const root = makeTempProject();
  const path = join(root, "data/production/core-v1-strength-rules.json");
  const data = readJson(path);
  data.items[0].status = "REVIEW_REQUIRED";
  writeJson(path, data);

  assert.throws(
    () => loadRuleProfile({ rootDir: root }),
    (error) => error instanceof RuleProfileLoadError && /REVIEW_REQUIRED/u.test(error.message),
  );
});

test("rejects profile attempts to load non-core dataset files", () => {
  const root = makeTempProject();
  const path = join(root, "data/production/core-v1-rule-profile.json");
  const profile = readJson(path);
  profile.enabled_datasets.strength = "strength-rules-candidate.json";
  writeJson(path, profile);

  assert.throws(
    () => loadRuleProfile({ rootDir: root }),
    (error) => error instanceof RuleProfileLoadError && /core-v1/u.test(error.message),
  );
});

test("feature flags keep advanced, review and precise timing disabled by default", () => {
  const resolved = resolveFeatureFlags({ rootDir: ROOT, environment: "production" });
  assert.equal(resolved.defaultProfile, "LIUYAO_CORE_V1");
  assert.equal(resolved.flags["liuyao.core_v1"], true);
  assert.equal(resolved.flags["liuyao.advanced_beta"], false);
  assert.equal(resolved.flags["liuyao.review_required"], false);
  assert.equal(resolved.flags["liuyao.precise_timing"], false);
  assert.equal(resolved.flags["liuyao.health_diagnostic_language"], false);
});

test("production users cannot enable advanced beta or review-required flags", () => {
  assert.throws(
    () => resolveFeatureFlags({
      rootDir: ROOT,
      environment: "production",
      overrides: { "liuyao.advanced_beta": true },
    }),
    FeatureFlagError,
  );
  assert.throws(
    () => resolveFeatureFlags({
      rootDir: ROOT,
      environment: "production",
      overrides: { "liuyao.review_required": true },
    }),
    FeatureFlagError,
  );
});

test("profile file can be selected explicitly for whole-profile rollback", () => {
  const root = makeTempProject();
  const original = join(root, "data/production/core-v1-rule-profile.json");
  const rollback = join(root, "data/production/core-v1-rule-profile-rollback.json");
  const profile = readJson(original);
  profile.version = "1.2.99-rollback";
  writeJson(rollback, profile);

  const bundle = loadRuleProfile({ rootDir: root, profileFile: rollback });
  assert.equal(bundle.profile.version, "1.2.99-rollback");
  assert.equal(bundle.counts.total, 148);
});
