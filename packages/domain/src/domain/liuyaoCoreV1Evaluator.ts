// @ts-nocheck
import { createFindingFromRule } from "../production/index.js";

const HARMONY_PAIRS = new Map([
  ["zi", "chou"], ["chou", "zi"],
  ["yin", "hai"], ["hai", "yin"],
  ["mao", "xu"], ["xu", "mao"],
  ["chen", "you"], ["you", "chen"],
  ["si", "shen"], ["shen", "si"],
  ["wu", "wei"], ["wei", "wu"],
]);

const CLASH_PAIRS = new Map([
  ["zi", "wu"], ["wu", "zi"],
  ["chou", "wei"], ["wei", "chou"],
  ["yin", "shen"], ["shen", "yin"],
  ["mao", "you"], ["you", "mao"],
  ["chen", "xu"], ["xu", "chen"],
  ["si", "hai"], ["hai", "si"],
]);

const RELATION_LABELS = {
  parent: "父母",
  sibling: "兄弟",
  child: "子孙",
  wealth: "妻财",
  officer_ghost: "官鬼",
};

export const CORE_V1_RULE_EXECUTION_COVERAGE = Object.freeze({
  strength: { executable: 24, expertBlocked: [] },
  dynamic: { executable: 14, expertBlocked: [] },
  pattern: {
    executable: 47,
    expertBlocked: [],
  },
  timing: {
    executable: 18,
    policyOnly: [
      "DAY_LEVEL_ONLY_WHEN_NEAR_TERM",
      "MONTH_LEVEL_FOR_MEDIUM_HORIZON",
      "YEAR_LEVEL_FOR_LONG_HORIZON",
      "NO_TIMING_WITHOUT_TARGET",
      "NO_SINGLE_CERTAIN_DATE",
      "RANK_DIRECT_TARGET",
      "RANK_MULTIPLE_EVIDENCE",
      "RANK_CONFLICT_PENALTY",
      "RANK_NEARER_PERIOD",
      "TWO_RULE_CONVERGENCE",
      "THREE_RULE_CONVERGENCE",
      "CONFLICTING_TARGETS_SPLIT",
      "NO_PAST_CANDIDATE",
      "MAX_CANDIDATES",
      "TIMEZONE_RENDERING",
      "SOLAR_MONTH_BOUNDARY",
    ],
  },
});

function elementInfluence(actorElement, targetElement, elementByCode) {
  if (actorElement === targetElement) return "same";
  const actor = elementByCode.get(actorElement);
  const target = elementByCode.get(targetElement);
  if (actor?.generates === targetElement) return "generates";
  if (target?.generates === actorElement) return "drains";
  if (actor?.controls === targetElement) return "controls";
  if (target?.controls === actorElement) return "resists";
  return "unknown";
}

function isHarmony(left, right) {
  return HARMONY_PAIRS.get(left) === right;
}

function uniqueLines(lines) {
  const byPosition = new Map();
  for (const line of lines.filter(Boolean)) byPosition.set(line.position, line);
  return [...byPosition.values()];
}

function primaryTargetLines(chart) {
  const primary = (chart.observationFocus?.roles ?? [])
    .filter((role) => role.importance === "primary")
    .flatMap((role) => role.lines ?? []);
  if (primary.length) return uniqueLines(primary.map((item) => chart.lines[item.position - 1]));
  return uniqueLines(chart.lines.filter((line) => line.isWorld || line.isResponse || line.moving));
}

function focusedLines(chart) {
  return uniqueLines([
    ...primaryTargetLines(chart),
    ...chart.lines.filter((line) => line.isWorld || line.isResponse || line.moving),
  ]);
}

function ruleFinding({ rules, ruleType, code, dimension, summary, inputFacts, evidenceKind, polarity, suffix }) {
  const rule = rules?.get(code);
  if (!rule) return null;
  const finding = createFindingFromRule({
    ruleType,
    key: code,
    rule,
    dimension,
    summary,
    inputFacts,
    evidenceKind,
    polarity,
    dedupeGroup: `${ruleType}:${code}:${suffix ?? "chart"}`,
  });
  return { ...finding, id: `${ruleType}:${code}:${suffix ?? "chart"}` };
}

function supportState(line) {
  const influences = [line.monthInfluence, line.dayInfluence].filter(Boolean);
  const support = influences.some((item) => item.isSame || item.effect === "generates") || line.changed?.returnInfluence?.code === "return_generate";
  const block = line.isVoid
    || influences.some((item) => item.isClash || ["controls", "drains", "resists"].includes(item.effect))
    || ["return_control", "outward_drain", "outward_control"].includes(line.changed?.returnInfluence?.code);
  return { support, block };
}

function addPeriodFindings(findings, { line, period, rules }) {
  const influence = period === "month" ? line.monthInfluence : line.dayInfluence;
  const prefix = period === "month" ? "MONTH" : "DAY";
  const periodName = period === "month" ? "月建" : "日辰";
  const branch = period === "month" ? line._calendarMonthBranch : line._calendarDayBranch;
  const lineLabel = `第 ${line.position} 爻（${line.sixRelationName} / ${line.branchName}）`;
  const entries = [];
  if (influence?.isSame) entries.push({ code: `${prefix}_SAME_BRANCH`, polarity: "supporting", text: `${lineLabel}与${periodName}同支，得到当前时令支持。` });
  if (influence?.isClash) entries.push({ code: `${prefix}_CLASH`, polarity: "blocking", text: `${lineLabel}受${periodName}冲动，需要作为不稳定因素观察。` });
  if (isHarmony(line.branch, branch)) entries.push({ code: `${prefix}_HARMONY`, polarity: "supporting", text: `${lineLabel}与${periodName}相合，形成协同信号。` });
  const relationCode = {
    generates: `${prefix}_GENERATES_LINE`,
    drains: `LINE_GENERATES_${prefix}`,
    controls: `${prefix}_CONTROLS_LINE`,
    resists: `LINE_CONTROLS_${prefix}`,
  }[influence?.effect];
  if (relationCode) {
    const supporting = influence.effect === "generates";
    entries.push({
      code: relationCode,
      polarity: supporting ? "supporting" : "blocking",
      text: `${periodName}作用于${lineLabel}：${influence.text}。`,
    });
  }
  for (const entry of entries) {
    const finding = ruleFinding({
      rules,
      ruleType: "strength",
      code: entry.code,
      dimension: entry.polarity === "supporting" ? "supporting_forces" : "blocking_forces",
      summary: entry.text,
      inputFacts: { period, linePosition: line.position, influence },
      evidenceKind: "strength_fact",
      polarity: entry.polarity,
      suffix: `line-${line.position}`,
    });
    if (finding) findings.push(finding);
  }
}

export function evaluateCoreV1StrengthFindings({ chart, bundle, idx }) {
  const rules = bundle.rulesByType.get("strength");
  const findings = [];
  const lines = focusedLines(chart).map((line) => ({
    ...line,
    _calendarMonthBranch: chart.calendar.monthBranch,
    _calendarDayBranch: chart.calendar.dayBranch,
  }));
  for (const line of lines) {
    addPeriodFindings(findings, { line, period: "month", rules });
    addPeriodFindings(findings, { line, period: "day", rules });
    if (line.isVoid) {
      const finding = ruleFinding({ rules, ruleType: "strength", code: "XUN_VOID", dimension: "blocking_forces", summary: `第 ${line.position} 爻当前处于空亡，相关信号尚未落实。`, inputFacts: { linePosition: line.position, branch: line.branch }, evidenceKind: "strength_fact", polarity: "blocking", suffix: `line-${line.position}` });
      if (finding) findings.push(finding);
    }
    if (line.moving) {
      const finding = ruleFinding({ rules, ruleType: "strength", code: "MOVING_LINE", dimension: "change_direction", summary: `第 ${line.position} 爻发动，相关事项进入变化过程。`, inputFacts: { linePosition: line.position }, evidenceKind: "moving_change_fact", suffix: `line-${line.position}` });
      if (finding) findings.push(finding);
      const changedCode = {
        return_generate: ["CHANGED_GENERATES_ORIGINAL", "supporting"],
        return_control: ["CHANGED_CONTROLS_ORIGINAL", "blocking"],
        outward_drain: ["ORIGINAL_GENERATES_CHANGED", "blocking"],
        outward_control: ["ORIGINAL_CONTROLS_CHANGED", "blocking"],
      }[line.changed?.returnInfluence?.code];
      if (changedCode) {
        const finding = ruleFinding({ rules, ruleType: "strength", code: changedCode[0], dimension: changedCode[1] === "supporting" ? "supporting_forces" : "blocking_forces", summary: `第 ${line.position} 爻动变：${line.changed.returnInfluence.text}`, inputFacts: { linePosition: line.position, originalElement: line.element, changedElement: line.changed.element }, evidenceKind: "moving_change_fact", polarity: changedCode[1], suffix: `line-${line.position}` });
        if (finding) findings.push(finding);
      }
    }
    const monthElement = idx.branchByCode.get(chart.calendar.monthBranch)?.element;
    if (line.element === monthElement) {
      const finding = ruleFinding({ rules, ruleType: "strength", code: "SEASONAL_SAME_ELEMENT", dimension: "supporting_forces", summary: `第 ${line.position} 爻与当前时令主导五行同气。`, inputFacts: { linePosition: line.position, monthElement }, evidenceKind: "strength_fact", polarity: "supporting", suffix: `line-${line.position}` });
      if (finding) findings.push(finding);
    } else if (elementInfluence(monthElement, line.element, idx.elementByCode) === "generates") {
      const finding = ruleFinding({ rules, ruleType: "strength", code: "SEASONAL_GENERATED_ELEMENT", dimension: "supporting_forces", summary: `第 ${line.position} 爻得到当前时令主导五行的辅助支持。`, inputFacts: { linePosition: line.position, monthElement }, evidenceKind: "strength_fact", polarity: "supporting", suffix: `line-${line.position}` });
      if (finding) findings.push(finding);
    }
    for (const other of chart.lines.filter((candidate) => candidate.moving && candidate.position !== line.position)) {
      const relation = elementInfluence(other.element, line.element, idx.elementByCode);
      const code = relation === "generates" ? "ACTIVE_PEER_GENERATES" : relation === "controls" ? "ACTIVE_PEER_CONTROLS" : null;
      if (!code) continue;
      const polarity = relation === "generates" ? "supporting" : "blocking";
      const finding = ruleFinding({ rules, ruleType: "strength", code, dimension: polarity === "supporting" ? "supporting_forces" : "blocking_forces", summary: `发动的第 ${other.position} 爻${relation === "generates" ? "支持" : "制约"}第 ${line.position} 爻。`, inputFacts: { sourceLine: other.position, targetLine: line.position }, evidenceKind: "moving_change_fact", polarity, suffix: `line-${other.position}-to-${line.position}` });
      if (finding) findings.push(finding);
    }
  }
  return findings;
}

export function evaluateCoreV1DynamicFindings({ chart, bundle }) {
  const rules = bundle.rulesByType.get("dynamic");
  const findings = [];
  for (const line of chart.lines.filter((item) => item.moving)) {
    const relationCode = {
      return_generate: "RETURN_GENERATION",
      return_control: "RETURN_CONTROL",
      outward_drain: "ORIGINAL_GENERATES_CHANGED",
      outward_control: "ORIGINAL_CONTROLS_CHANGED",
      return_same: "TRANSFORM_SAME_ELEMENT",
    }[line.changed?.returnInfluence?.code];
    const codes = relationCode ? [relationCode] : [];
    if (chart.calendar.xun?.voidBranches?.some((item) => item.branch === line.changed.branch)) codes.push("TRANSFORM_TO_VOID");
    if (line.changed.branch === chart.calendar.monthBranch || line.changed.branch === chart.calendar.dayBranch) {
      // Same-branch support is handled by strength rules, not a transformation rule.
    }
    if (CLASH_PAIRS.get(line.changed.branch) === chart.calendar.monthBranch) codes.push("TRANSFORM_TO_MONTH_BREAK");
    if (CLASH_PAIRS.get(line.changed.branch) === chart.calendar.dayBranch) codes.push("TRANSFORM_TO_DAY_CLASH");
    if (isHarmony(line.changed.branch, chart.calendar.dayBranch)) codes.push("TRANSFORM_TO_DAY_HARMONY");
    const changedRoleCode = {
      wealth: "RELATION_CHANGES_TO_WEALTH",
      officer_ghost: "RELATION_CHANGES_TO_OFFICER",
      parent: "RELATION_CHANGES_TO_PARENT",
      child: "RELATION_CHANGES_TO_CHILD",
      sibling: "RELATION_CHANGES_TO_SIBLING",
    }[line.changed.sixRelation];
    if (changedRoleCode) codes.push(changedRoleCode);
    for (const code of [...new Set(codes)]) {
      const polarity = code === "RETURN_GENERATION" || code === "TRANSFORM_TO_DAY_HARMONY" ? "supporting"
        : ["RETURN_CONTROL", "ORIGINAL_GENERATES_CHANGED", "ORIGINAL_CONTROLS_CHANGED", "TRANSFORM_TO_VOID", "TRANSFORM_TO_MONTH_BREAK", "TRANSFORM_TO_DAY_CLASH"].includes(code) ? "blocking" : undefined;
      const finding = ruleFinding({ rules, ruleType: "dynamic", code, dimension: "change_direction", summary: code === relationCode ? `第 ${line.position} 爻动变：${line.changed.returnInfluence.text}` : `第 ${line.position} 爻命中「${rules.get(code)?.meaning_zh ?? code}」变化信号。`, inputFacts: { linePosition: line.position, originalBranch: line.branch, changedBranch: line.changed.branch, originalElement: line.element, changedElement: line.changed.element }, evidenceKind: "moving_change_fact", polarity, suffix: `line-${line.position}` });
      if (finding) findings.push(finding);
    }
  }
  return findings;
}

export function evaluateCoreV1PatternFindings({ chart, bundle, idx }) {
  const rules = bundle.rulesByType.get("pattern");
  const findings = [];
  const targets = primaryTargetLines(chart);
  const world = chart.lines.find((line) => line.isWorld);
  const response = chart.lines.find((line) => line.isResponse);
  const push = (code, options = {}) => {
    const finding = ruleFinding({ rules, ruleType: "pattern", code, dimension: options.dimension ?? "target_state", summary: options.summary ?? rules.get(code)?.name_zh ?? code, inputFacts: options.inputFacts ?? {}, evidenceKind: options.evidenceKind ?? "direct_target_fact", polarity: options.polarity, suffix: options.suffix });
    if (finding) findings.push(finding);
  };
  if (targets.some((line) => line.isWorld)) push("YONGSHEN_HOLDS_WORLD", { dimension: "subject_state", summary: "本次核心观察对象落在世爻，与用户自身状态和主动性直接相关。" });
  if (targets.some((line) => line.isResponse)) push("YONGSHEN_AT_RESPONSE", { summary: "本次核心观察对象落在应爻，需要重点核对对方或外部回应。" });
  if (world && response) {
    const relation = elementInfluence(world.element, response.element, idx.elementByCode);
    if (relation === "generates") push("WORLD_GENERATES_RESPONSE", { dimension: "blocking_forces", polarity: "blocking", summary: "世爻生应爻，用户一侧需要投入更多资源推动外部事项。", evidenceKind: "world_response_fact" });
    if (relation === "drains") push("RESPONSE_GENERATES_WORLD", { dimension: "supporting_forces", polarity: "supporting", summary: "应爻生世爻，外部回应对用户一侧形成支持。", evidenceKind: "world_response_fact" });
    if (relation === "controls") push("WORLD_CONTROLS_RESPONSE", { dimension: "blocking_forces", polarity: "blocking", summary: "世爻克应爻，推进外部事项需要用户主动耗力。", evidenceKind: "world_response_fact" });
    if (relation === "resists") push("RESPONSE_CONTROLS_WORLD", { dimension: "blocking_forces", polarity: "blocking", summary: "应爻克世爻，外部条件对用户一侧形成压力。", evidenceKind: "world_response_fact" });
    if (relation === "same") push("WORLD_RESPONSE_SAME_ELEMENT", { dimension: "supporting_forces", polarity: "supporting", summary: "世应五行同气，双方条件存在相互呼应的基础。", evidenceKind: "world_response_fact" });
    if (isHarmony(world.branch, response.branch)) push("WORLD_RESPONSE_HARMONY", { dimension: "supporting_forces", polarity: "supporting", summary: "世应相合，双方存在协同信号，仍需用现实行动验证。", evidenceKind: "world_response_fact" });
    if (CLASH_PAIRS.get(world.branch) === response.branch) push("WORLD_RESPONSE_CLASH", { dimension: "blocking_forces", polarity: "blocking", summary: "世应相冲，用户与外部条件之间存在明显分歧或变动。", evidenceKind: "world_response_fact" });
  }
  const targetStates = targets.map((line) => ({ line, ...supportState(line) }));
  const originLines = chart.lines.filter((line) => targets.some((target) => elementInfluence(line.element, target.element, idx.elementByCode) === "generates"));
  const tabooLines = chart.lines.filter((line) => targets.some((target) => elementInfluence(line.element, target.element, idx.elementByCode) === "controls"));
  if (originLines.some((line) => line.moving)) push("ORIGIN_SPIRIT_MOVING", { dimension: "supporting_forces", polarity: "supporting", summary: "支持核心事项的来源正在发生变化，需要观察它能否转成现实帮助。", inputFacts: { linePositions: originLines.filter((line) => line.moving).map((line) => line.position) }, evidenceKind: "moving_change_fact" });
  if (tabooLines.some((line) => line.moving)) push("TABOO_SPIRIT_MOVING", { dimension: "blocking_forces", polarity: "blocking", summary: "制约核心事项的因素正在发生变化，需要优先确认风险是否扩大。", inputFacts: { linePositions: tabooLines.filter((line) => line.moving).map((line) => line.position) }, evidenceKind: "moving_change_fact" });
  if (originLines.length) push("ORIGIN_GENERATES_YONGSHEN", { dimension: "supporting_forces", polarity: "supporting", summary: "盘面存在能够支持核心事项的来源，但仍要结合其当前强弱判断是否可用。", inputFacts: { originLinePositions: originLines.map((line) => line.position), targetLinePositions: targets.map((line) => line.position) }, evidenceKind: "support_block_signal" });
  if (tabooLines.length) push("TABOO_CONTROLS_YONGSHEN", { dimension: "blocking_forces", polarity: "blocking", summary: "盘面存在直接制约核心事项的因素，需要把它转成现实风险逐项核对。", inputFacts: { tabooLinePositions: tabooLines.map((line) => line.position), targetLinePositions: targets.map((line) => line.position) }, evidenceKind: "support_block_signal" });
  if (targets.some((line) => line.isVoid)) push("YONGSHEN_VOID", { dimension: "blocking_forces", polarity: "blocking", summary: "核心观察对象当前处于空亡，相关条件尚未落实。" });
  if (targets.some((line) => line.monthInfluence?.isClash)) push("YONGSHEN_MONTH_BREAK", { dimension: "blocking_forces", polarity: "blocking", summary: "核心观察对象受到月令冲动，当前稳定性不足。" });
  if (targets.some((line) => line.moving)) push("YONGSHEN_MOVING", { dimension: "change_direction", summary: "核心观察对象发动，所问事项正在进入变化。", evidenceKind: "moving_change_fact" });
  if (targets.some((line) => line.changed?.returnInfluence?.code === "return_generate")) push("YONGSHEN_RETURN_GENERATION", { dimension: "supporting_forces", polarity: "supporting", summary: "核心观察对象变化后得到反向支持。", evidenceKind: "moving_change_fact" });
  if (targets.some((line) => line.changed?.returnInfluence?.code === "return_control")) push("YONGSHEN_RETURN_CONTROL", { dimension: "blocking_forces", polarity: "blocking", summary: "核心观察对象变化后受到反向制约。", evidenceKind: "moving_change_fact" });
  if (targetStates.some((item) => item.support)) push("YONGSHEN_STRONG_SIGNAL", { dimension: "supporting_forces", polarity: "supporting", summary: "核心观察对象存在明确支持证据。", evidenceKind: "strength_fact" });
  if (targetStates.some((item) => item.block)) push("YONGSHEN_WEAK_SIGNAL", { dimension: "blocking_forces", polarity: "blocking", summary: "核心观察对象存在需要优先处理的压力证据。", evidenceKind: "strength_fact" });
  if (targets.some((line) => line.isVoid)) push("YONGSHEN_VOID_SIGNAL", { dimension: "blocking_forces", polarity: "blocking", summary: "核心观察对象的回应信号尚未稳定。", evidenceKind: "strength_fact" });
  if (targets.some((line) => line.monthInfluence?.isClash)) push("YONGSHEN_MONTH_BREAK_SIGNAL", { dimension: "blocking_forces", polarity: "blocking", summary: "核心观察对象受到当前阶段冲动，需要等待条件稳定。", evidenceKind: "strength_fact" });

  const movingCode = chart.movingLines.length === 0 ? "ALL_LINES_STATIC" : chart.movingLines.length === 1 ? "SINGLE_MOVING_LINE" : chart.movingLines.length === 2 ? "DOUBLE_MOVING_LINES" : "MULTIPLE_MOVING_LINES";
  push(movingCode, { dimension: "change_direction", summary: chart.movingLines.length ? `本盘有 ${chart.movingLines.length} 个动爻，变化信号需要按关键角色排序。` : "本盘六爻安静，当前更适合观察既有条件。", evidenceKind: "moving_change_fact" });
  const holdsCode = { parent: "PARENT_HOLDS_WORLD", sibling: "SIBLING_HOLDS_WORLD", child: "CHILD_HOLDS_WORLD", wealth: "WEALTH_HOLDS_WORLD", officer_ghost: "OFFICER_GHOST_HOLDS_WORLD" }[world?.sixRelation];
  if (holdsCode) push(holdsCode, { dimension: "subject_state", summary: `世爻临${world.sixRelationName}，用户自身状态与该角色直接关联。`, evidenceKind: "world_response_fact" });
  if (world?.isVoid) push("WORLD_VOID", { dimension: "blocking_forces", polarity: "blocking", summary: "世爻空亡，用户一侧的条件或承受力尚未稳定。", evidenceKind: "world_response_fact" });
  if (response?.isVoid) push("RESPONSE_VOID", { dimension: "blocking_forces", polarity: "blocking", summary: "应爻空亡，对方或外部回应尚未落实。", evidenceKind: "world_response_fact" });
  if (world?.monthInfluence?.isClash) push("WORLD_MONTH_BREAK", { dimension: "blocking_forces", polarity: "blocking", summary: "世爻受月令冲动，用户一侧当前承压。", evidenceKind: "world_response_fact" });
  if (response?.monthInfluence?.isClash) push("RESPONSE_MONTH_BREAK", { dimension: "blocking_forces", polarity: "blocking", summary: "应爻受月令冲动，对方或外部条件稳定性不足。", evidenceKind: "world_response_fact" });

  const sixClashPairs = [[0, 3], [1, 4], [2, 5]];
  const originalSixClash = sixClashPairs.every(([left, right]) => CLASH_PAIRS.get(chart.lines[left]?.branch) === chart.lines[right]?.branch);
  const changedSixClash = sixClashPairs.every(([left, right]) => CLASH_PAIRS.get(chart.lines[left]?.changed?.branch) === chart.lines[right]?.changed?.branch);
  if (originalSixClash) push("ORIGINAL_SIX_CLASH", { dimension: "change_direction", summary: "本卦内部存在成组冲动结构，当前局面更容易出现分离、反复或快速变化。", inputFacts: { hexagramCode: chart.originalHexagram?.code }, evidenceKind: "support_block_signal" });
  if (changedSixClash) push("CHANGED_SIX_CLASH", { dimension: "change_direction", summary: "变化后的结构仍存在成组冲动，需要把后续稳定性作为重点观察条件。", inputFacts: { hexagramCode: chart.changedHexagram?.code }, evidenceKind: "support_block_signal" });

  for (const [relation, label] of Object.entries(RELATION_LABELS)) {
    const states = chart.lines.filter((line) => line.sixRelation === relation).map((line) => supportState(line));
    if (states.some((item) => item.support)) push(`${relation === "officer_ghost" ? "OFFICER" : relation.toUpperCase()}_SUPPORTED_PRESENT`, { dimension: "supporting_forces", polarity: "supporting", summary: `${label}角色存在支持证据。`, evidenceKind: "strength_fact", suffix: relation });
    if (states.some((item) => item.block)) push(`${relation === "officer_ghost" ? "OFFICER" : relation.toUpperCase()}_SUPPRESSED_PRESENT`, { dimension: "blocking_forces", polarity: "blocking", summary: `${label}角色存在受制或不稳定证据。`, evidenceKind: "strength_fact", suffix: relation });
  }
  return findings;
}

function questionHorizon(question = "") {
  if (/今天|明天|本周|这周|近期|一个月内|30\s*天/u.test(question)) return "near";
  if (/今年|本年|几个月|半年|一年内|202\d/u.test(question)) return "medium";
  if (/明年以后|未来几年|长期|一年以上/u.test(question)) return "long";
  return "unknown";
}

export function buildCoreV1TimingCandidates({ chart, bundle }) {
  const rules = bundle.rulesByType.get("timing");
  const targets = primaryTargetLines(chart);
  if (!targets.length || !rules?.has("TARGET_BRANCH_VALUE")) return [];
  const horizon = questionHorizon(chart.question);
  const granularity = horizon === "near" ? ["day"] : horizon === "long" ? ["year"] : ["day", "month"];
  const candidates = new Map();
  for (const line of targets) {
    const key = line.branch;
    const evidence = ["TARGET_BRANCH_VALUE"];
    if (line.isVoid && rules.has("VOID_FILL")) evidence.push("VOID_FILL");
    const rank = Number(rules.get("TARGET_BRANCH_VALUE")?.base_rank ?? 80) + (evidence.length > 1 ? 15 : 0);
    candidates.set(key, {
      window: `${line.branchName}支对应的后续${granularity.includes("month") ? "日/月" : granularity.includes("year") ? "年度" : "日期"}窗口`,
      granularity,
      rank,
      rule_code: evidence.length > 1 ? "TWO_RULE_CONVERGENCE" : "TARGET_BRANCH_VALUE",
      evidence,
      limitation: "仅作为候选观察窗口，不代表结果日期；必须结合现实进展复核。",
      target: { linePosition: line.position, branch: line.branch, isVoid: line.isVoid },
    });
  }
  return [...candidates.values()].sort((a, b) => b.rank - a.rank).slice(0, 5);
}
