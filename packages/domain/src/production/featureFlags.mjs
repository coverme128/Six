import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export class FeatureFlagError extends Error {
  constructor(message, details = undefined) {
    super(message);
    this.name = "FeatureFlagError";
    this.details = details;
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function assert(condition, message, details = undefined) {
  if (!condition) {
    throw new FeatureFlagError(message, details);
  }
}

export function resolveFeatureFlags(options = {}) {
  const rootDir = resolve(options.rootDir ?? process.cwd());
  const environment = options.environment ?? "production";
  const overrides = options.overrides ?? {};
  const config = readJson(join(rootDir, "data/production/rule-feature-flags-v1.3.json"));
  const flags = {};

  for (const flag of config.flags) {
    const requested = Object.hasOwn(overrides, flag.code) ? overrides[flag.code] : flag.default;
    if (requested === true && !flag.environment.includes(environment)) {
      throw new FeatureFlagError("Feature flag cannot be enabled in this environment.", {
        code: flag.code,
        environment,
      });
    }
    flags[flag.code] = requested;
  }

  assert(flags["liuyao.core_v1"] === true, "CORE_V1 must be enabled.");
  assert(flags["liuyao.advanced_beta"] === false || environment !== "production", "Advanced Beta is closed for ordinary production users.");
  assert(flags["liuyao.review_required"] === false, "REVIEW_REQUIRED rules must never be executable.");
  assert(flags["liuyao.precise_timing"] === false, "Precise timing is outside CORE_V1 scope.");
  assert(flags["liuyao.health_diagnostic_language"] === false, "Diagnostic health language is outside CORE_V1 scope.");

  return {
    version: config.version,
    defaultProfile: config.default_profile,
    environment,
    flags,
  };
}
