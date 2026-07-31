import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildAIReportInput } from "@six/domain/ai-report";
import { createLiuyaoChart } from "@six/domain/liuyao";
import { buildExperienceBundle } from "@six/domain/presentation";
import { buildLiuyaoReport } from "@six/domain/report-builder";

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function unique(items: string[]) {
  return new Set(items).size === items.length;
}

function coreCodes() {
  const profile = readJson("data/production/core-v1-rule-profile.json");
  const codes = new Set<string>();
  const questionMappings = new Set<string>();
  for (const [dataset, file] of Object.entries(profile.enabled_datasets)) {
    const data = readJson(`data/production/${file as string}`);
    for (const item of data.items ?? []) {
      if (dataset === "question_topics" || dataset === "yongshen") {
        questionMappings.add(`${item.topic}:${item.subtype}`);
        if (dataset === "yongshen") codes.add(`${item.topic}:${item.subtype}`);
      } else {
        codes.add(item.code);
      }
    }
  }
  return { codes, questionMappings };
}

function liuyaoResult(topic: string, subtype: string) {
  const result = createLiuyaoChart({
    question: "这次事情应该怎么看？",
    topic,
    subtype,
    values: [7, 8, 9, 7, 8, 6],
    calendar: { timezone: "Asia/Shanghai", instantUtc: "2026-07-30T08:17:50.837Z" },
  });
  result.narrativeReport = buildLiuyaoReport(result);
  return result;
}

const findingRegistry = readJson("data/liuyao/interpretation-assets/liuyao-finding-explanation-registry-v1.0.json");
const relationshipRegistry = readJson("data/liuyao/interpretation-assets/liuyao-relationship-meaning-registry-v1.0.json");
const topicRegistry = readJson("data/liuyao/interpretation-assets/liuyao-question-topic-role-registry-v1.0.json");
const findingBindings = readJson("data/liuyao/rule-finding-bindings.json");
const relationshipBindings = readJson("data/liuyao/relationship-bindings.json");
const topicBindings = readJson("data/liuyao/question-topic-bindings.json");

const findingIds = findingRegistry.entries.map((item: any) => item.assetId);
const relationIds = relationshipRegistry.entries.map((item: any) => item.relationId);
const topicIds = topicRegistry.entries.map((item: any) => item.topicId);
assert.ok(unique(findingIds), "Finding asset IDs must be unique.");
assert.ok(unique(relationIds), "Relationship asset IDs must be unique.");
assert.ok(unique(topicIds), "Topic asset IDs must be unique.");

const { codes, questionMappings } = coreCodes();
for (const [code, assetId] of Object.entries(findingBindings.bindings)) {
  assert.ok(codes.has(code), `Finding binding uses non-existing CORE_V1 rule code: ${code}`);
  assert.ok(assetId === "UNBOUND" || findingIds.includes(assetId as string), `Finding binding points to missing asset: ${assetId}`);
}
for (const [code, relationId] of Object.entries(relationshipBindings.bindings)) {
  assert.ok(codes.has(code), `Relationship binding uses non-existing CORE_V1 code: ${code}`);
  assert.ok(relationId === "UNBOUND" || relationIds.includes(relationId as string), `Relationship binding points to missing asset: ${relationId}`);
}
assert.equal(Object.keys(topicBindings.bindings).length, 45, "Topic bindings must cover all 45 CORE_V1 mappings.");
for (const [code, topicId] of Object.entries(topicBindings.bindings)) {
  assert.ok(questionMappings.has(code), `Topic binding uses non-existing mapping code: ${code}`);
  assert.ok(topicIds.includes(topicId as string), `Topic binding points to missing topic asset: ${topicId}`);
}

const wealth = liuyaoResult("wealth", "income");
const career = liuyaoResult("career", "job_search");
const wealthBundle = buildExperienceBundle({ result: wealth, type: "liuyao" });
const careerBundle = buildExperienceBundle({ result: career, type: "liuyao" });
const guidedText = JSON.stringify(wealthBundle.guidedViewModel);
for (const forbidden of ["MONTH_GENERATES_LINE", "DAY_CONTROLS_LINE", "YONGSHEN_HOLDS_WORLD", "TARGET_BRANCH_VALUE", "ruleCode", "rawCode"]) {
  assert.ok(!guidedText.includes(forbidden), `Guided output leaked raw code: ${forbidden}`);
}
assert.notEqual(
  wealthBundle.guidedViewModel.coreMatter.roles.find((item: any) => item.label === "官鬼")?.practicalMeaning,
  careerBundle.guidedViewModel.coreMatter.roles.find((item: any) => item.label === "官鬼")?.practicalMeaning,
  "Topic-specific role meanings must vary by topic."
);
assert.ok(wealthBundle.guidedViewModel.coreMatter.summary.includes("收入"), "Guided core matter should use topic role registry.");

const aiInput = buildAIReportInput({ result: wealth, type: "liuyao" });
assert.ok(aiInput.resolvedFindings.length > 0, "AI input must include resolvedFindings.");
assert.ok(aiInput.resolvedTopicRoles?.roles?.length > 0, "AI input must include resolvedTopicRoles.");
assert.ok(Array.isArray(aiInput.resolvedRelationships), "AI input must include resolvedRelationships array.");
assert.ok(aiInput.resolvedFindings.some((item: any) => item.bindingStatus === "BOUND"), "AI fallback must have bound resolved finding semantics.");

const health = buildExperienceBundle({ result: liuyaoResult("health", "self_health"), type: "liuyao" });
assert.ok(JSON.stringify(health.guidedViewModel.coreMatter).includes("健康"), "Health topic must keep a topic-specific context.");

console.log("LIUYAO_INTERPRETATION_ASSETS_VALIDATION_PASSED");
