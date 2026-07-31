// @ts-nocheck
import { readJson } from "../dataStore.js";

const FINDING_REGISTRY_PATH = "data/liuyao/interpretation-assets/liuyao-finding-explanation-registry-v1.0.json";
const RELATIONSHIP_REGISTRY_PATH = "data/liuyao/interpretation-assets/liuyao-relationship-meaning-registry-v1.0.json";
const TOPIC_REGISTRY_PATH = "data/liuyao/interpretation-assets/liuyao-question-topic-role-registry-v1.0.json";
const FINDING_BINDINGS_PATH = "data/liuyao/rule-finding-bindings.json";
const RELATIONSHIP_BINDINGS_PATH = "data/liuyao/relationship-bindings.json";
const TOPIC_BINDINGS_PATH = "data/liuyao/question-topic-bindings.json";

const ROLE_TO_ASSET = {
  parent: "PARENTS",
  sibling: "SIBLINGS",
  child: "OFFSPRING",
  child_grandchild: "OFFSPRING",
  wealth: "WEALTH",
  officer_ghost: "OFFICIAL_GHOST",
  world: "SHI",
  response: "YING",
};

function indexBy(items, key) {
  return new Map((items ?? []).map((item) => [item[key], item]));
}

export function loadLiuyaoInterpretationAssets(rootDir = process.cwd()) {
  const findingRegistry = readJson(FINDING_REGISTRY_PATH, rootDir);
  const relationshipRegistry = readJson(RELATIONSHIP_REGISTRY_PATH, rootDir);
  const topicRegistry = readJson(TOPIC_REGISTRY_PATH, rootDir);
  const findingBindings = readJson(FINDING_BINDINGS_PATH, rootDir);
  const relationshipBindings = readJson(RELATIONSHIP_BINDINGS_PATH, rootDir);
  const topicBindings = readJson(TOPIC_BINDINGS_PATH, rootDir);
  return {
    findingRegistry,
    relationshipRegistry,
    topicRegistry,
    findingBindings,
    relationshipBindings,
    topicBindings,
    findingById: indexBy(findingRegistry.entries, "assetId"),
    relationshipById: indexBy(relationshipRegistry.entries, "relationId"),
    topicById: indexBy(topicRegistry.entries, "topicId"),
  };
}

export function questionMappingCode(chart) {
  if (!chart?.topic || !chart?.subtype) return null;
  return `${chart.topic}:${chart.subtype}`;
}

function topicForChart(chart, assets) {
  const mappingCode = questionMappingCode(chart);
  const topicId = mappingCode ? assets.topicBindings.bindings?.[mappingCode] : null;
  const topic = topicId && topicId !== "UNBOUND" ? assets.topicById.get(topicId) : null;
  return { mappingCode, topicId: topic ? topicId : "UNBOUND", topic };
}

function topicRoleMeaning(topic, role) {
  const assetRole = ROLE_TO_ASSET[role] ?? role;
  if (assetRole === "SHI") return "当事人自身状态、主动性与承受力。";
  if (assetRole === "YING") return "对方、外部回应或当前问题的相对方。";
  return topic?.liuqinRoleMap?.[assetRole] ?? "本次问题中的专业角色，需结合问题场景理解。";
}

function publicLine(line) {
  return {
    position: line.position,
    branchName: line.branchName,
    sixRelationName: line.sixRelationName,
    moving: Boolean(line.moving),
    isWorld: Boolean(line.isWorld),
    isResponse: Boolean(line.isResponse),
    isVoid: Boolean(line.isVoid),
    monthText: line.monthInfluence?.text ?? line.monthText,
    dayText: line.dayInfluence?.text ?? line.dayText,
    changedText: line.changed?.returnInfluence?.text ?? line.changedText,
  };
}

export function resolveTopicRoleContext(chart, rootDir = process.cwd()) {
  const assets = loadLiuyaoInterpretationAssets(rootDir);
  const { mappingCode, topicId, topic } = topicForChart(chart, assets);
  const roles = (chart.observationFocus?.roles ?? []).map((role) => ({
    label: role.label,
    professionalRole: role.label,
    practicalMeaning: topicRoleMeaning(topic, role.role),
    importance: role.importance,
    lines: (role.lines ?? []).map(publicLine),
  }));
  const first = roles[0];
  const summary = topic
    ? `本次按「${topic.displayName}」理解，核心先看${first ? `「${first.practicalMeaning}」` : "问题主轴"}。`
    : "本次问题场景尚未绑定解释资产，报告会使用安全 fallback 说明。";
  return {
    mappingCode,
    topicId,
    displayName: topic?.displayName ?? "未绑定场景",
    summary,
    roles,
    clarificationTriggers: topic?.clarificationTriggers ?? [],
    safetyNotes: topic?.safetyNotes ?? [],
    bindingStatus: topic ? "BOUND" : "UNBOUND",
  };
}

function findingBindingFor(ruleCode, assets) {
  if (!ruleCode) return { status: "UNBOUND", asset: null, assetId: "UNBOUND" };
  const assetId = assets.findingBindings.bindings?.[ruleCode] ?? "UNBOUND";
  const asset = assetId !== "UNBOUND" ? assets.findingById.get(assetId) : null;
  return { status: asset ? "BOUND" : "UNBOUND", asset, assetId: asset ? assetId : "UNBOUND" };
}

export function resolveFindingExplanation(finding, chart, rootDir = process.cwd()) {
  const assets = loadLiuyaoInterpretationAssets(rootDir);
  const ruleCode = finding.rule_code ?? finding.rawCode ?? finding.code;
  const topicContext = resolveTopicRoleContext(chart, rootDir);
  if (finding.rule_type === "yongshen" || finding.evidenceKind === "direct_target_fact" || finding.evidence_kind === "direct_target_fact") {
    return {
      bindingStatus: topicContext.bindingStatus,
      assetId: topicContext.topicId,
      displayName: "核心事项",
      shortDescription: topicContext.summary,
      practicalMeaning: topicContext.roles.map((role) => `${role.label}：${role.practicalMeaning}`).join("；") || topicContext.summary,
      direction: "NEUTRAL",
      defaultPriority: "P0",
      source: "QuestionTopicRoleRegistry",
      limitations: topicContext.safetyNotes,
    };
  }
  const binding = findingBindingFor(ruleCode, assets);
  if (!binding.asset) {
    return {
      bindingStatus: "UNBOUND",
      assetId: "UNBOUND",
      displayName: finding.title ?? "专业依据",
      shortDescription: finding.text ?? finding.summary ?? "该依据已命中，但尚未绑定标准解释资产。",
      practicalMeaning: "该项会作为辅助依据保留，不单独决定结论。",
      direction: finding.polarity ?? "NEUTRAL",
      defaultPriority: finding.priorityHint ?? "P2",
      source: "SafeFallback",
      limitations: ["未绑定解释资产时不得放大为确定结论。"],
    };
  }
  return {
    bindingStatus: "BOUND",
    assetId: binding.assetId,
    displayName: binding.asset.displayName,
    shortDescription: binding.asset.shortDescription,
    practicalMeaning: binding.asset.practicalMeaning,
    direction: binding.asset.direction,
    defaultPriority: binding.asset.defaultPriority,
    source: "FindingExplanationRegistry",
    limitations: binding.asset.limitations ?? [],
  };
}

function relationshipBindingFor(code, assets) {
  const assetId = assets.relationshipBindings.bindings?.[code] ?? "UNBOUND";
  const asset = assetId !== "UNBOUND" ? assets.relationshipById.get(assetId) : null;
  return { status: asset ? "BOUND" : "UNBOUND", assetId: asset ? assetId : "UNBOUND", asset };
}

export function resolveRelationships(chart, rootDir = process.cwd()) {
  const assets = loadLiuyaoInterpretationAssets(rootDir);
  const relationships = [];
  for (const line of chart.lines ?? []) {
    const code = line.changed?.returnInfluence?.code === "return_generate"
      ? "RETURN_GENERATION"
      : line.changed?.returnInfluence?.code === "return_control"
        ? "RETURN_CONTROL"
        : null;
    if (!code) continue;
    const binding = relationshipBindingFor(code, assets);
    relationships.push({
      code,
      bindingStatus: binding.status,
      relationId: binding.assetId,
      title: binding.asset?.displayName ?? line.changed.returnInfluence.name ?? "动变关系",
      professionalMeaning: binding.asset?.professionalMeaning ?? line.changed.returnInfluence.text,
      guidedMeaning: binding.asset?.guidedMeaning ?? "变化关系已记录，但尚未绑定标准关系解释。",
      direction: binding.asset?.direction ?? "NEUTRAL",
      defaultPriority: binding.asset?.defaultPriority ?? "P2",
      limitation: binding.asset?.limitations?.[0] ?? "关系含义必须结合旺衰、动静、用神定位和问题主题判断。",
      linePosition: line.position,
    });
  }
  return relationships;
}
