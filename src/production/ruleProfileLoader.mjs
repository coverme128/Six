import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export const DEFAULT_PROFILE_CODE = "LIUYAO_CORE_V1";

export const RELEASE_TIERS = Object.freeze([
  "CORE_V1",
  "ADVANCED_BETA",
  "REVIEW_REQUIRED",
  "DEPRECATED",
]);

const DATASET_TO_RULE_TYPE = Object.freeze({
  yongshen: "yongshen",
  strength: "strength",
  dynamic: "dynamic",
  patterns: "pattern",
  timing: "timing",
});

const COUNT_KEYS = Object.freeze({
  yongshen: "question_yongshen_mappings",
  strength: "strength_rules",
  dynamic: "dynamic_rules",
  patterns: "pattern_rules",
  timing: "timing_and_guardrail_rules",
});

const REQUIRED_DATASETS = Object.freeze([
  "question_topics",
  "yongshen",
  "strength",
  "dynamic",
  "patterns",
  "timing",
]);

const CANDIDATE_POOL_FILES = Object.freeze({
  question_topics: "question-topics-pro.json",
  yongshen: "yongshen-rules-pro.json",
  strength: "strength-rules-pro.json",
  dynamic: "dynamic-rules-pro.json",
  patterns: "pattern-rules-pro.json",
  timing: "timing-rules-pro.json",
});

const ALLOWED_SOURCE_OUTPUT_ROLES = new Set([
  "FACT",
  "SIGNAL",
  "CANDIDATE_OR_GUARDRAIL",
  "FACT_OR_SIGNAL",
]);

export class RuleProfileLoadError extends Error {
  constructor(message, details = undefined) {
    super(message);
    this.name = "RuleProfileLoadError";
    this.details = details;
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function assert(condition, message, details = undefined) {
  if (!condition) {
    throw new RuleProfileLoadError(message, details);
  }
}

function isCoreDatasetFile(fileName) {
  return /^core-v1-[a-z0-9-]+\.json$/u.test(fileName);
}

export function getRuleKey(ruleType, item) {
  if (ruleType === "yongshen") {
    assert(item.topic && item.subtype, "Yongshen mapping is missing topic/subtype.", item);
    return `${item.topic}:${item.subtype}`;
  }
  assert(item.code, `Rule item is missing code for ${ruleType}.`, item);
  return item.code;
}

function getMatrixKey(item) {
  if (Array.isArray(item.key)) {
    return item.key.join(":");
  }
  return item.key;
}

function buildMatrixIndex(matrixItems) {
  const index = new Map();
  for (const item of matrixItems) {
    index.set(`${item.rule_type}:${getMatrixKey(item)}`, item);
  }
  return index;
}

function buildCandidatePoolIndex(dataDir) {
  const index = new Map();
  for (const [datasetName, fileName] of Object.entries(CANDIDATE_POOL_FILES)) {
    const pool = readJson(join(dataDir, fileName));
    assert(Array.isArray(pool.items), "Candidate rule pool is missing items array.", {
      datasetName,
      fileName,
    });
    const ruleType = DATASET_TO_RULE_TYPE[datasetName];
    const keys = new Set();
    for (const item of pool.items) {
      if (datasetName === "question_topics" || ruleType === "yongshen") {
        assert(item.topic && item.subtype, "Candidate topic mapping is missing topic/subtype.", {
          datasetName,
          fileName,
          item,
        });
        keys.add(`${item.topic}:${item.subtype}`);
      } else {
        assert(item.code, "Candidate rule item is missing code.", {
          datasetName,
          fileName,
          item,
        });
        keys.add(item.code);
      }
    }
    index.set(datasetName, keys);
  }
  return index;
}

function validateProfileShape(profile, profileCode) {
  assert(profile.profile_code === profileCode, "Unexpected rule profile code.", {
    expected: profileCode,
    actual: profile.profile_code,
  });
  assert(profile.version, "Rule profile is missing version.");
  assert(profile.rule_counts?.total_production_units === 148, "CORE_V1 manifest total must remain 148.", {
    total: profile.rule_counts?.total_production_units,
  });
  for (const datasetName of REQUIRED_DATASETS) {
    const fileName = profile.enabled_datasets?.[datasetName];
    assert(fileName, `Rule profile is missing enabled dataset ${datasetName}.`);
    assert(isCoreDatasetFile(fileName), "Production profile may only reference core-v1 dataset files.", {
      datasetName,
      fileName,
    });
  }
}

function validateRuleItem({ ruleType, item, key, matrixItem }) {
  assert(matrixItem, "Whitelisted rule is missing from release matrix.", { ruleType, key });
  assert(RELEASE_TIERS.includes(item.release_tier), "Rule has an unknown release tier.", {
    ruleType,
    key,
    release_tier: item.release_tier,
  });
  assert(item.release_tier === "CORE_V1", "Production profile may only load CORE_V1 rules.", {
    ruleType,
    key,
    release_tier: item.release_tier,
  });
  assert(item.enabled_by_default === true, "CORE_V1 production rule must be enabled by default.", {
    ruleType,
    key,
    enabled_by_default: item.enabled_by_default,
  });
  assert(item.status !== "REVIEW_REQUIRED", "REVIEW_REQUIRED rule leaked into production profile.", {
    ruleType,
    key,
    status: item.status,
  });
  assert(item.release_tier !== "DEPRECATED", "DEPRECATED rule cannot be loaded in production.", {
    ruleType,
    key,
  });
  assert(matrixItem.release_tier === "CORE_V1", "Release matrix disagrees with CORE_V1 whitelist.", {
    ruleType,
    key,
    matrixTier: matrixItem.release_tier,
    itemTier: item.release_tier,
  });
  assert(matrixItem.enabled_by_default === true, "Release matrix says this CORE_V1 item is not default-enabled.", {
    ruleType,
    key,
  });
  if (ruleType !== "yongshen") {
    assert(ALLOWED_SOURCE_OUTPUT_ROLES.has(item.output_role), "Rule has an unsupported output role.", {
      ruleType,
      key,
      output_role: item.output_role,
    });
  }
}

function validateDataset({ datasetName, dataset, profile, matrixIndex, candidatePoolIndex }) {
  assert(dataset.profile === DEFAULT_PROFILE_CODE, "Dataset profile does not match CORE_V1.", {
    datasetName,
    profile: dataset.profile,
  });
  assert(dataset.default_enabled === true, "CORE_V1 dataset must be default enabled.", {
    datasetName,
    default_enabled: dataset.default_enabled,
  });
  assert(Array.isArray(dataset.items), "Dataset is missing items array.", { datasetName });
  const expected = profile.rule_counts?.[COUNT_KEYS[datasetName]];
  assert(dataset.items.length === expected, "Dataset item count does not match profile manifest.", {
    datasetName,
    expected,
    actual: dataset.items.length,
  });

  const ruleType = DATASET_TO_RULE_TYPE[datasetName];
  const seen = new Set();
  const keyedItems = dataset.items.map((item) => {
    const key = getRuleKey(ruleType, item);
    assert(!seen.has(key), "Duplicate rule key in CORE_V1 dataset.", { datasetName, key });
    seen.add(key);
    assert(candidatePoolIndex.get(datasetName)?.has(key), "Whitelisted rule is missing from candidate rule pool.", {
      datasetName,
      ruleType,
      key,
      candidatePool: CANDIDATE_POOL_FILES[datasetName],
    });
    validateRuleItem({
      ruleType,
      item,
      key,
      matrixItem: matrixIndex.get(`${ruleType}:${key}`),
    });
    return { key, item };
  });

  return { ruleType, keyedItems };
}

export function loadRuleProfile(options = {}) {
  const rootDir = resolve(options.rootDir ?? process.cwd());
  const profileCode = options.profileCode ?? DEFAULT_PROFILE_CODE;
  const profilePath = resolve(options.profileFile ?? join(rootDir, "data/production/core-v1-rule-profile.json"));
  const dataDir = dirname(profilePath);

  const profile = readJson(profilePath);
  validateProfileShape(profile, profileCode);

  const matrix = readJson(join(dataDir, "all-rule-release-matrix-v1.3.json"));
  assert(Array.isArray(matrix.items), "Release matrix is missing items array.");
  const matrixIndex = buildMatrixIndex(matrix.items);
  const candidatePoolIndex = buildCandidatePoolIndex(dataDir);

  const reportPolicy = readJson(join(dataDir, "core-v1-report-policy.json"));
  assert(reportPolicy.profile === profileCode, "Report policy profile does not match CORE_V1.", {
    profile: reportPolicy.profile,
  });
  assert(Array.isArray(reportPolicy.dimensions) && reportPolicy.dimensions.length === 6, "Report policy must define six value dimensions.");

  const questionTopics = readJson(join(dataDir, profile.enabled_datasets.question_topics));
  assert(Array.isArray(questionTopics.items), "Question topics dataset is missing items array.");
  assert(questionTopics.items.length === profile.rule_counts.question_yongshen_mappings, "Question topics count must match yongshen mapping manifest.", {
    expected: profile.rule_counts.question_yongshen_mappings,
    actual: questionTopics.items.length,
  });
  for (const item of questionTopics.items) {
    const key = `${item.topic}:${item.subtype}`;
    assert(candidatePoolIndex.get("question_topics")?.has(key), "Whitelisted question topic is missing from candidate topic pool.", {
      key,
      candidatePool: CANDIDATE_POOL_FILES.question_topics,
    });
  }

  const datasetResults = {};
  for (const datasetName of ["yongshen", "strength", "dynamic", "patterns", "timing"]) {
    const dataset = readJson(join(dataDir, profile.enabled_datasets[datasetName]));
    datasetResults[datasetName] = {
      raw: dataset,
      ...validateDataset({ datasetName, dataset, profile, matrixIndex, candidatePoolIndex }),
    };
  }

  const counts = {
    yongshenMappings: datasetResults.yongshen.keyedItems.length,
    strengthRules: datasetResults.strength.keyedItems.length,
    dynamicRules: datasetResults.dynamic.keyedItems.length,
    patternRules: datasetResults.patterns.keyedItems.length,
    timingAndGuardrailRules: datasetResults.timing.keyedItems.length,
  };
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  assert(total === profile.rule_counts.total_production_units, "Loaded CORE_V1 total does not match manifest.", {
    counts,
    total,
    expected: profile.rule_counts.total_production_units,
  });

  const byType = new Map();
  for (const [datasetName, result] of Object.entries(datasetResults)) {
    byType.set(result.ruleType, new Map(result.keyedItems.map(({ key, item }) => [key, item])));
    result.datasetName = datasetName;
  }

  return {
    status: "CORE_V1_SCOPE_IMPLEMENTED",
    profile,
    profilePath,
    questionTopics,
    reportPolicy,
    datasets: datasetResults,
    rulesByType: byType,
    releaseMatrix: matrix,
    counts: {
      ...counts,
      total,
    },
  };
}

export function assertRuleInLoadedProfile(bundle, ruleType, ruleCode) {
  const rules = bundle.rulesByType.get(ruleType);
  assert(rules?.has(ruleCode), "Rule code is not loaded in the active production profile.", {
    ruleType,
    ruleCode,
  });
  return rules.get(ruleCode);
}
