import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { loadRuleProfile } from "@six/domain/production";

const rootDir = process.cwd();

function readJson(path: string) {
  return JSON.parse(readFileSync(resolve(rootDir, path), "utf8"));
}

function ruleKey(item: any) {
  return item.code ?? `${item.topic}:${item.subtype}`;
}

function assetIds(registry: any, key: string) {
  return new Set((registry.entries ?? []).map((item: any) => item[key]));
}

function bindingStatus(keys: Array<string | { key: string; label: string }>, bindings: Record<string, string>, validIds: Set<string>) {
  const bound = [];
  const unbound = [];
  const ambiguous = [];
  for (const item of keys) {
    const key = typeof item === "string" ? item : item.key;
    const label = typeof item === "string" ? item : item.label;
    const value = bindings[key];
    if (!value || value === "UNBOUND") {
      unbound.push(label);
    } else if (validIds.has(value)) {
      bound.push(label);
    } else {
      ambiguous.push({ key: label, value });
    }
  }
  return { bound, unbound, ambiguous };
}

function roleAsset(role: string) {
  return {
    parent: "PARENTS",
    sibling: "SIBLINGS",
    child: "OFFSPRING",
    child_grandchild: "OFFSPRING",
    wealth: "WEALTH",
    officer_ghost: "OFFICIAL_GHOST",
    world: "SHI",
    response: "YING",
  }[role] ?? role;
}

const profile = loadRuleProfile({ rootDir });
const findingRegistry = readJson("data/liuyao/interpretation-assets/liuyao-finding-explanation-registry-v1.0.json");
const relationshipRegistry = readJson("data/liuyao/interpretation-assets/liuyao-relationship-meaning-registry-v1.0.json");
const topicRegistry = readJson("data/liuyao/interpretation-assets/liuyao-question-topic-role-registry-v1.0.json");
const findingBindings = readJson("data/liuyao/rule-finding-bindings.json");
const relationshipBindings = readJson("data/liuyao/relationship-bindings.json");
const topicBindings = readJson("data/liuyao/question-topic-bindings.json");
const runtime = readJson("data/liuyao/product-closure-runtime.json");

const allRules = Object.values(profile.datasets).flatMap((dataset: any) => dataset.keyedItems.map(({ key, item }: any) => ({ key, item, ruleType: dataset.ruleType })));
const codeRules = allRules
  .filter((item: any) => item.ruleType !== "yongshen")
  .map((item: any) => ({ key: item.key, label: `${item.ruleType}:${item.key}` }));
const enabledRules = allRules.filter((item: any) => item.item.enabled_by_default === true);
const rulesWithPriority = allRules.filter((item: any) => item.item.priority || item.item.base_rank || item.item.defaultPriority);
const rulesWithSeverity = allRules.filter((item: any) => item.item.severity);
const findingCoverage = bindingStatus(codeRules, findingBindings.bindings ?? {}, assetIds(findingRegistry, "assetId"));

const topicById = new Map((topicRegistry.entries ?? []).map((item: any) => [item.topicId, item]));
const yongshenMappings = profile.datasets.yongshen.keyedItems.map(({ key, item }: any) => ({ key, item }));
const topicCoverage = yongshenMappings.map(({ key, item }: any) => {
  const topicId = topicBindings.bindings?.[key];
  const topic = topicById.get(topicId);
  const roles = [...(item.primary ?? []), ...(item.secondary ?? [])].map(roleAsset);
  const roleBound = Boolean(topic) && roles.every((role) => role === "SHI" || role === "YING" || Boolean(topic.liuqinRoleMap?.[role]));
  return {
    key,
    topicId: topic ?? null ? topicId : "UNBOUND",
    topicBound: Boolean(topic),
    roleBound,
    clarificationRequired: Boolean(topic?.clarificationTriggers?.length),
  };
});

const relationshipKeys = Object.keys(relationshipBindings.bindings ?? {});
const relationshipCoverage = bindingStatus(relationshipKeys, relationshipBindings.bindings ?? {}, assetIds(relationshipRegistry, "relationId"));

const timingRules = profile.datasets.timing.keyedItems.map(({ key, item }: any) => ({ key, item }));
const timingCoverage = timingRules.map(({ key, item }: any) => {
  const assetId = findingBindings.bindings?.[key];
  return {
    key,
    assetId: assetId ?? "UNBOUND",
    explanationReady: Boolean(assetId && assetId !== "UNBOUND" && assetIds(findingRegistry, "assetId").has(assetId)),
    broadOnly: assetId === "LYX_FIND_TIMING_BROAD_ONLY",
    insufficientByDesign: assetId === "LYX_FIND_TIMING_INSUFFICIENT",
    granularity: item.granularity,
  };
});

const report = {
  generatedAt: new Date().toISOString(),
  coreV1: {
    totalRules: profile.counts.total,
    enabledRules: enabledRules.length,
    rulesWithPriority: rulesWithPriority.length,
    rulesWithSeverity: rulesWithSeverity.length,
    codeRules: codeRules.length,
    rulesBoundToFindingRegistry: findingCoverage.bound.length,
    unboundRules: findingCoverage.unbound,
    ambiguousBindings: findingCoverage.ambiguous,
  },
  questionYongshen: {
    totalMappings: yongshenMappings.length,
    topicBound: topicCoverage.filter((item) => item.topicBound).length,
    roleBound: topicCoverage.filter((item) => item.roleBound).length,
    selectionExplanationReady: topicCoverage.filter((item) => item.topicBound && item.roleBound).length,
    clarificationRequiredMappings: topicCoverage.filter((item) => item.clarificationRequired).map((item) => item.key),
  },
  relationships: {
    totalRelationshipFindings: relationshipKeys.length,
    boundRelationshipMeanings: relationshipCoverage.bound.length,
    unboundRelationshipMeanings: relationshipCoverage.unbound,
    ambiguousBindings: relationshipCoverage.ambiguous,
  },
  timing: {
    totalTimingPolicies: timingRules.length,
    explanationReady: timingCoverage.filter((item) => item.explanationReady).length,
    broadOnly: timingCoverage.filter((item) => item.broadOnly).length,
    insufficientByDesign: timingCoverage.filter((item) => item.insufficientByDesign).length,
    unboundTimingPolicies: timingCoverage.filter((item) => !item.explanationReady).map((item) => item.key),
  },
  runtime: {
    assessmentPatternsLoaded: (runtime.assessmentPatterns ?? []).length,
    conflictPoliciesLoaded: (runtime.conflictPolicies ?? []).length,
    actionGuidanceLoaded: (runtime.actionGuidance ?? []).length,
    overallAssessmentRuntimeEnabled: true,
    deterministicFallbackEnabled: true,
  },
};

mkdirSync(resolve(rootDir, "docs/audit"), { recursive: true });
writeFileSync(resolve(rootDir, "docs/audit/liuyao-core-product-closure-binding-audit.json"), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(resolve(rootDir, "docs/audit/liuyao-core-product-closure-binding-audit.md"), `# Liuyao Core Product Closure Binding Audit

Generated: ${report.generatedAt}

## CORE_V1

- totalRules: ${report.coreV1.totalRules}
- enabledRules: ${report.coreV1.enabledRules}
- rulesWithPriority: ${report.coreV1.rulesWithPriority}
- rulesWithSeverity: ${report.coreV1.rulesWithSeverity}
- codeRulesForFindingBinding: ${report.coreV1.codeRules}
- rulesBoundToFindingRegistry: ${report.coreV1.rulesBoundToFindingRegistry}
- unboundRules: ${report.coreV1.unboundRules.length}
- ambiguousBindings: ${report.coreV1.ambiguousBindings.length}

## Question / Yongshen

- totalMappings: ${report.questionYongshen.totalMappings}
- topicBound: ${report.questionYongshen.topicBound}
- roleBound: ${report.questionYongshen.roleBound}
- selectionExplanationReady: ${report.questionYongshen.selectionExplanationReady}
- clarificationRequiredMappings: ${report.questionYongshen.clarificationRequiredMappings.length}

## Relationships

- totalRelationshipFindings: ${report.relationships.totalRelationshipFindings}
- boundRelationshipMeanings: ${report.relationships.boundRelationshipMeanings}
- unboundRelationshipMeanings: ${report.relationships.unboundRelationshipMeanings.length}
- ambiguousBindings: ${report.relationships.ambiguousBindings.length}

## Timing

- totalTimingPolicies: ${report.timing.totalTimingPolicies}
- explanationReady: ${report.timing.explanationReady}
- broadOnly: ${report.timing.broadOnly}
- insufficientByDesign: ${report.timing.insufficientByDesign}
- unboundTimingPolicies: ${report.timing.unboundTimingPolicies.length}

## Runtime

- assessmentPatternsLoaded: ${report.runtime.assessmentPatternsLoaded}
- conflictPoliciesLoaded: ${report.runtime.conflictPoliciesLoaded}
- actionGuidanceLoaded: ${report.runtime.actionGuidanceLoaded}
- overallAssessmentRuntimeEnabled: ${report.runtime.overallAssessmentRuntimeEnabled}
- deterministicFallbackEnabled: ${report.runtime.deterministicFallbackEnabled}

## UNBOUND Rules

${report.coreV1.unboundRules.map((item) => `- ${item}`).join("\n") || "- None"}

## UNBOUND Relationships

${report.relationships.unboundRelationshipMeanings.map((item) => `- ${item}`).join("\n") || "- None"}

## UNBOUND Timing Policies

${report.timing.unboundTimingPolicies.map((item) => `- ${item}`).join("\n") || "- None"}
`);

console.log("LIUYAO_PRODUCT_CLOSURE_BINDING_AUDIT_WRITTEN");
console.log(JSON.stringify({
  coreV1Total: report.coreV1.totalRules,
  findingBound: report.coreV1.rulesBoundToFindingRegistry,
  findingUnbound: report.coreV1.unboundRules.length,
  topicBound: report.questionYongshen.topicBound,
  relationshipBound: report.relationships.boundRelationshipMeanings,
  timingReady: report.timing.explanationReady,
}, null, 2));
