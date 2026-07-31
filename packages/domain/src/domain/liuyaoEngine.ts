// @ts-nocheck
import { createHash, randomInt } from "node:crypto";
import { buildCalendarContext } from "./calendar.js";
import { indexes, loadDomainData } from "./dataStore.js";
import { aggregateCoreV1Report, createFindingFromRule, loadRuleProfile } from "../production/index.js";

const LINE_MAP = {
  6: { name: "老阴", originalBit: "0", changedBit: "1", moving: true },
  7: { name: "少阳", originalBit: "1", changedBit: "1", moving: false },
  8: { name: "少阴", originalBit: "0", changedBit: "0", moving: false },
  9: { name: "老阳", originalBit: "1", changedBit: "0", moving: true },
};

const RELATION_ZH = {
  sibling: "兄弟",
  parent: "父母",
  child: "子孙",
  wealth: "妻财",
  officer_ghost: "官鬼",
};

const OBSERVATION_ZH = {
  sibling: "兄弟",
  parent: "父母",
  child: "子孙",
  child_grandchild: "子孙",
  wealth: "妻财",
  officer_ghost: "官鬼",
  world: "世爻",
  response: "应爻",
};

const OBSERVATION_MEANING = {
  sibling: "竞争、同辈、消耗或同类力量",
  parent: "文书、流程、凭据、保护条件",
  child: "结果表现、释放压力、产出与反馈",
  child_grandchild: "结果表现、释放压力、产出与反馈",
  wealth: "收益、资源、现实可得之物",
  officer_ghost: "目标压力、职位、约束、规则或风险",
  world: "当事人自身状态与主动性",
  response: "对方、外部回应或事件对象",
};

const CLASH_PAIRS = new Map([
  ["zi", "wu"],
  ["wu", "zi"],
  ["chou", "wei"],
  ["wei", "chou"],
  ["yin", "shen"],
  ["shen", "yin"],
  ["mao", "you"],
  ["you", "mao"],
  ["chen", "xu"],
  ["xu", "chen"],
  ["si", "hai"],
  ["hai", "si"],
]);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function normalizeCast(input) {
  if (Array.isArray(input?.coins) || Array.isArray(input?.coinRounds)) {
    const coins = input.coins ?? input.coinRounds;
    assert(coins.length === 6, "coins must contain six coin rounds from bottom to top.");
    const normalizedCoins = coins.map((round) => {
      assert(Array.isArray(round) && round.length === 3, "Each coin round must contain three coin values.");
      return round.map((coin) => {
        const numeric = Number(coin);
        assert([2, 3].includes(numeric), "Each coin value must be 2 or 3.");
        return numeric;
      });
    });
    return {
      values: normalizedCoins.map((round) => round.reduce((sum, value) => sum + value, 0)),
      coins: normalizedCoins,
      inputMode: "coins",
    };
  }
  if (Array.isArray(input?.values)) {
    assert(input.values.length === 6, "values must contain six line sums from bottom to top.");
    return {
      values: input.values.map((value) => {
        const numeric = Number(value);
        assert([6, 7, 8, 9].includes(numeric), "Each line sum must be 6, 7, 8, or 9.");
        return numeric;
      }),
      coins: null,
      inputMode: "values",
    };
  }
  const coins = Array.from({ length: 6 }, () => [randomInt(2, 4), randomInt(2, 4), randomInt(2, 4)]);
  return {
    values: coins.map((round) => round.reduce((sum, value) => sum + value, 0)),
    coins,
    inputMode: "random_coins",
  };
}

function elementRelation(selfElement, targetElement, elementByCode) {
  if (selfElement === targetElement) return "sibling";
  const self = elementByCode.get(selfElement);
  const target = elementByCode.get(targetElement);
  if (target.generates === selfElement) return "parent";
  if (self.generates === targetElement) return "child";
  if (self.controls === targetElement) return "wealth";
  if (target.controls === selfElement) return "officer_ghost";
  return "unknown";
}

function relationMeaning(relation, actorLabel, targetLabel) {
  const labels = {
    sibling: `${actorLabel}与${targetLabel}同气`,
    parent: `${actorLabel}生扶${targetLabel}`,
    child: `${targetLabel}泄于${actorLabel}`,
    wealth: `${targetLabel}受${actorLabel}制`,
    officer_ghost: `${actorLabel}克制${targetLabel}`,
    unknown: `${actorLabel}与${targetLabel}关系待定`,
  };
  return labels[relation] ?? labels.unknown;
}

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

function influenceLabel(code) {
  return {
    same: "同气",
    generates: "生扶",
    drains: "泄气",
    controls: "克制",
    resists: "耗力",
    unknown: "待定",
  }[code] ?? "待定";
}

function influenceText(code, actorLabel, targetLabel) {
  return {
    same: `${actorLabel}与${targetLabel}同气`,
    generates: `${actorLabel}生扶${targetLabel}`,
    drains: `${targetLabel}生${actorLabel}，自身有泄气`,
    controls: `${actorLabel}克制${targetLabel}`,
    resists: `${targetLabel}克${actorLabel}，需要主动耗力`,
    unknown: `${actorLabel}与${targetLabel}关系待定`,
  }[code] ?? `${actorLabel}与${targetLabel}关系待定`;
}

function branchInfluence(actorBranchCode, actorBranchName, targetLine, idx) {
  const actorBranch = idx.branchByCode.get(actorBranchCode);
  if (!actorBranch || !targetLine?.element) {
    return { effect: "unknown", effectName: "待定", isSame: false, isClash: false, text: `${actorBranchName ?? "时间"}作用待定` };
  }
  const isSame = actorBranchCode === targetLine.branch;
  const isClash = CLASH_PAIRS.get(actorBranchCode) === targetLine.branch;
  const effect = isSame ? "same" : elementInfluence(actorBranch.element, targetLine.element, idx.elementByCode);
  const effectName = isClash ? "冲" : (isSame ? "同支" : influenceLabel(effect));
  const prefix = actorBranchName ?? actorBranch.name_zh;
  const action = isClash ? `${prefix}冲${targetLine.branchName}` : influenceText(effect, prefix, targetLine.branchName);
  return {
    effect,
    effectName,
    isSame,
    isClash,
    text: action,
  };
}

function returnInfluence(originalLine, changedLine, idx) {
  if (!originalLine?.element || !changedLine?.element || originalLine.branch === changedLine.branch) {
    return { code: "unchanged", name: "不变", text: "本爻纳支未变。" };
  }
  const changedToOriginal = elementRelation(changedLine.element, originalLine.element, idx.elementByCode);
  if (changedToOriginal === "parent") return { code: "return_generate", name: "回头生", text: `变爻${changedLine.branchName}生扶原爻${originalLine.branchName}。` };
  if (changedToOriginal === "officer_ghost") return { code: "return_control", name: "回头克", text: `变爻${changedLine.branchName}克制原爻${originalLine.branchName}。` };
  if (changedToOriginal === "sibling") return { code: "return_same", name: "回头同气", text: `变爻${changedLine.branchName}与原爻${originalLine.branchName}同气。` };
  return { code: changedToOriginal, name: RELATION_ZH[changedToOriginal] ?? "回头关系", text: relationMeaning(changedToOriginal, changedLine.branchName, originalLine.branchName) };
}

function rotateSpirit(start, position, spirits) {
  const sequence = spirits.sequence;
  const index = sequence.indexOf(start);
  return sequence[(index + position - 1) % sequence.length];
}

function xunVoid(dayPillar, xunKong, sexagenary) {
  const names = sexagenary.map((item) => item.name_zh);
  const dayIndex = names.indexOf(dayPillar);
  if (dayIndex === -1) return [];
  const xunStartIndex = dayIndex - (dayIndex % 10);
  const xunStart = names[xunStartIndex];
  return xunKong.find((item) => item.xun_start === xunStart)?.void_branches ?? [];
}

function lineNajia(trigramCode, isOuter, lineIndex, najia) {
  const rule = najia.rules[trigramCode];
  const branches = isOuter ? rule.outer_branches : rule.inner_branches;
  return {
    stem: isOuter ? rule.outer_stem : rule.inner_stem,
    branch: branches[lineIndex],
  };
}

function buildLineNajiaFacts({ mapped, hexagram, palaceElement, idx, data }) {
  return mapped.map((line) => {
    const isOuter = line.position > 3;
    const trigramCode = isOuter ? hexagram.upper_trigram : hexagram.lower_trigram;
    const najia = lineNajia(trigramCode, isOuter, (line.position - 1) % 3, data.najia);
    const branch = idx.branchByCode.get(najia.branch);
    const relation = elementRelation(palaceElement, branch.element, idx.elementByCode);
    return {
      ...line,
      trigram: trigramCode,
      stem: najia.stem,
      branch: najia.branch,
      branchName: branch.name_zh,
      element: branch.element,
      elementName: idx.elementByCode.get(branch.element)?.name_zh ?? branch.element,
      sixRelation: relation,
      sixRelationName: RELATION_ZH[relation] ?? relation,
    };
  });
}

function normalizeObservationRole(role) {
  return role === "child_grandchild" ? "child" : role;
}

function matchingLinesForRole(role, lines) {
  const normalized = normalizeObservationRole(role);
  if (normalized === "world") return lines.filter((line) => line.isWorld);
  if (normalized === "response") return lines.filter((line) => line.isResponse);
  return lines.filter((line) => line.sixRelation === normalized);
}

function buildObservationFocus({ chart, yongshen }) {
  if (!yongshen) {
    return {
      topic: chart.topic,
      subtype: chart.subtype,
      primary: [],
      secondary: [],
      roles: [],
      summary: "系统暂未命中明确场景，先以世爻、应爻和动爻观察本次问题。",
      selectionSource: "system_default",
    };
  }
  const primary = yongshen.primary ?? [];
  const secondary = yongshen.secondary ?? [];
  const roles = [...primary, ...secondary].slice(0, 6).map((role, index) => {
    const lines = matchingLinesForRole(role, chart.lines).map((line) => ({
      position: line.position,
      branchName: line.branchName,
      sixRelationName: line.sixRelationName,
      isWorld: line.isWorld,
      isResponse: line.isResponse,
      moving: line.moving,
      isVoid: line.isVoid,
      monthInfluence: line.monthInfluence,
      dayInfluence: line.dayInfluence,
      changed: line.changed,
    }));
    return {
      role,
      label: OBSERVATION_ZH[role] ?? role,
      meaning: OBSERVATION_MEANING[role] ?? "本次问题的观察对象",
      importance: index < primary.length ? "primary" : "secondary",
      lines,
    };
  });
  const labels = roles.map((item) => item.label).filter(Boolean);
  return {
    topic: chart.topic,
    subtype: chart.subtype,
    primary,
    secondary,
    roles,
    summary: labels.length ? `系统按问题场景自动聚焦：${labels.join("、")}。` : "系统已自动确定本次观察重点。",
    selectionSource: "system_auto",
    userEditable: "professional_mode_only",
  };
}

function focusedLines(chart) {
  const positions = new Set();
  for (const role of chart.observationFocus?.roles ?? []) {
    for (const line of role.lines ?? []) positions.add(line.position);
  }
  const lines = chart.lines.filter((line) => positions.has(line.position));
  if (lines.length) return lines;
  return chart.lines.filter((line) => line.isWorld || line.isResponse || line.moving);
}

function influenceRuleCode(period, influence) {
  const prefix = period === "month" ? "MONTH" : "DAY";
  if (influence.isSame) return `${prefix}_SAME_BRANCH`;
  if (influence.isClash) return `${prefix}_CLASH`;
  if (influence.effect === "generates") return `${prefix}_GENERATES_LINE`;
  if (influence.effect === "controls") return `${prefix}_CONTROLS_LINE`;
  if (influence.effect === "drains") return period === "month" ? "LINE_GENERATES_MONTH" : "LINE_GENERATES_DAY";
  if (influence.effect === "resists") return period === "month" ? "LINE_CONTROLS_MONTH" : "LINE_CONTROLS_DAY";
  return null;
}

function influencePolarity(influence) {
  if (influence.isSame || influence.effect === "generates") return "supporting";
  if (influence.isClash || ["controls", "drains", "resists"].includes(influence.effect)) return "blocking";
  return null;
}

function timeFindingSummary(period, line, influence) {
  const label = period === "month" ? "月建" : "日辰";
  const role = line.isWorld ? "世爻" : line.isResponse ? "应爻" : line.sixRelationName;
  const suffix = influencePolarity(influence) === "supporting" ? "，形成可用支持。" : "，需要作为阻力观察。";
  return `${label}作用到第 ${line.position} 爻（${role} / ${line.branchName}）：${influence.text}${suffix}`;
}

function strongestTimeInfluences(chart) {
  const candidates = [];
  for (const line of focusedLines(chart)) {
    for (const period of ["month", "day"]) {
      const influence = period === "month" ? line.monthInfluence : line.dayInfluence;
      const polarity = influencePolarity(influence);
      const ruleCode = influenceRuleCode(period, influence);
      if (!polarity || !ruleCode) continue;
      const baseRank = line.isWorld ? 40 : line.isResponse ? 36 : line.moving ? 34 : 30;
      const forceRank = influence.isClash || influence.isSame ? 10 : influence.effect === "generates" || influence.effect === "controls" ? 8 : 5;
      candidates.push({ period, line, influence, polarity, ruleCode, rank: baseRank + forceRank });
    }
  }
  const bestByPolarity = new Map();
  for (const item of candidates.sort((a, b) => b.rank - a.rank)) {
    if (!bestByPolarity.has(item.polarity)) bestByPolarity.set(item.polarity, item);
  }
  return [...bestByPolarity.values()];
}

function hexagramFromBits(bits, idx) {
  const hex = idx.hexagramByBits.get(bits);
  assert(hex, `Cannot find hexagram for bits ${bits}.`);
  return hex;
}

function chartHash(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function evaluateCoreFindings({ bundle, chart, topic, subtype }) {
  const findings = [];
  const yongshen = bundle.rulesByType.get("yongshen")?.get(`${topic}:${subtype}`);
  if (yongshen) {
    findings.push({
      id: `yongshen:${topic}:${subtype}`,
      rule_type: "yongshen",
      rule_code: `${topic}:${subtype}`,
      rule_version: bundle.profile.version,
      output_role: "FACT",
      dimension: "target_state",
      summary: chart.observationFocus?.summary ?? "系统已自动确定本次观察重点。",
      evidence_kind: "direct_target_fact",
      input_facts: {
        topic,
        subtype,
        primary: yongshen.primary ?? [],
        secondary: yongshen.secondary ?? [],
        roles: chart.observationFocus?.roles?.map((item) => ({
          label: item.label,
          importance: item.importance,
          linePositions: item.lines.map((line) => line.position),
        })) ?? [],
        selectionSource: chart.observationFocus?.selectionSource ?? "system_auto",
      },
    });
  }

  const patternRules = bundle.rulesByType.get("pattern");
  if (patternRules?.has("YONGSHEN_HOLDS_WORLD")) {
    findings.push(createFindingFromRule({
      ruleType: "pattern",
      key: "YONGSHEN_HOLDS_WORLD",
      rule: patternRules.get("YONGSHEN_HOLDS_WORLD"),
      dimension: "subject_state",
      summary: "世爻为主体位置，报告优先观察主体承受力与主动性。",
      inputFacts: { worldLine: chart.worldResponse.worldLine },
      evidenceKind: "world_response_fact",
      ruleVersion: bundle.profile.version,
    }));
  }

  const strengthRules = bundle.rulesByType.get("strength");
  const firstMoving = chart.lines.find((line) => line.moving);
  if (firstMoving && strengthRules?.has("MOVING_LINE")) {
    findings.push(createFindingFromRule({
      ruleType: "strength",
      key: "MOVING_LINE",
      rule: strengthRules.get("MOVING_LINE"),
      dimension: "change_direction",
      summary: `第 ${firstMoving.position} 爻发动，事情存在变化动力。`,
      inputFacts: { movingLines: chart.movingLines },
      evidenceKind: "moving_change_fact",
      ruleVersion: bundle.profile.version,
    }));
  }
  for (const item of strongestTimeInfluences(chart)) {
    if (!strengthRules?.has(item.ruleCode)) continue;
    findings.push(createFindingFromRule({
      ruleType: "strength",
      key: item.ruleCode,
      rule: strengthRules.get(item.ruleCode),
      dimension: item.polarity === "supporting" ? "supporting_forces" : "blocking_forces",
      polarity: item.polarity,
      summary: timeFindingSummary(item.period, item.line, item.influence),
      inputFacts: {
        period: item.period,
        linePosition: item.line.position,
        lineBranch: item.line.branch,
        lineRole: item.line.sixRelation,
        influence: item.influence,
      },
      dedupeGroup: `${item.period}-${item.polarity}-focus-line`,
      ruleVersion: bundle.profile.version,
    }));
  }

  const timingRules = bundle.rulesByType.get("timing");
  for (const code of ["TARGET_BRANCH_VALUE", "MOVING_LINE_VALUE", "VOID_FILLED"]) {
    if (timingRules?.has(code)) {
      findings.push(createFindingFromRule({
        ruleType: "timing",
        key: code,
        rule: timingRules.get(code),
        dimension: "timing_state",
        summary: `${code} 作为候选时间窗口依据。`,
        evidenceKind: "support_block_signal",
        ruleVersion: bundle.profile.version,
      }));
    }
  }
  return findings;
}

export function createLiuyaoChart(input = {}, rootDir = process.cwd()) {
  const data = loadDomainData(rootDir);
  const idx = indexes(data);
  const bundle = loadRuleProfile({ rootDir });
  const cast = normalizeCast(input);
  const values = cast.values;
  const mapped = values.map((value, index) => ({
    position: index + 1,
    sum: value,
    ...LINE_MAP[value],
  }));
  const originalBits = mapped.map((line) => line.originalBit).join("");
  const changedBits = mapped.map((line) => line.changedBit).join("");
  const originalHexagram = hexagramFromBits(originalBits, idx);
  const changedHexagram = hexagramFromBits(changedBits, idx);
  const palace = idx.palaceByHexagram.get(originalHexagram.code);
  assert(palace, `Missing palace data for ${originalHexagram.code}.`);
  const calendar = buildCalendarContext(input.calendar ?? {}, data);
  const startSpirit = data.sixSpirits.day_stem_start[calendar.dayStem] ?? "qinglong";
  const voidBranches = xunVoid(calendar.dayPillar, data.xunKong, data.sexagenary);

  const originalNajiaLines = buildLineNajiaFacts({ mapped, hexagram: originalHexagram, palaceElement: palace.palace_element, idx, data });
  const changedNajiaLines = buildLineNajiaFacts({ mapped, hexagram: changedHexagram, palaceElement: palace.palace_element, idx, data });

  const lines = originalNajiaLines.map((line, index) => {
    const spiritCode = rotateSpirit(startSpirit, line.position, data.sixSpirits);
    const spirit = data.sixSpirits.items.find((item) => item.code === spiritCode);
    const changed = changedNajiaLines[index];
    const monthInfluence = branchInfluence(calendar.monthBranch, calendar.monthBuild?.branchName, line, idx);
    const dayInfluence = branchInfluence(calendar.dayBranch, calendar.dayChen?.branchName, line, idx);
    const changedFact = {
      stem: changed.stem,
      branch: changed.branch,
      branchName: changed.branchName,
      element: changed.element,
      elementName: changed.elementName,
      sixRelation: changed.sixRelation,
      sixRelationName: changed.sixRelationName,
      returnInfluence: line.moving ? returnInfluence(line, changed, idx) : null,
    };
    return {
      ...line,
      sixSpirit: spiritCode,
      sixSpiritName: spirit?.name_zh ?? spiritCode,
      isWorld: palace.world_line === line.position,
      isResponse: palace.response_line === line.position,
      isVoid: voidBranches.includes(line.branch),
      monthInfluence,
      dayInfluence,
      changed: changedFact,
    };
  });

  const chart = {
    id: `ly_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    methodCode: "LIUYAO_THREE_COIN_V1",
    question: input.question ?? "",
    topic: input.topic ?? "career",
    subtype: input.subtype ?? "job_search",
    rawCast: { values, coins: cast.coins, inputMode: cast.inputMode, lineOrder: "bottom_up" },
    originalBits,
    changedBits,
    originalHexagram,
    changedHexagram,
    palace,
    worldResponse: { worldLine: palace.world_line, responseLine: palace.response_line },
    movingLines: lines.filter((line) => line.moving).map((line) => line.position),
    calendar,
    lines,
    generationEvidence: {
      dataVersion: "v1.3",
      ruleProfile: bundle.profile.profile_code,
      calendarPolicy: calendar.policyVersion,
      calendarProvider: calendar.calendarProvider,
      calendarVersion: calendar.calendarVersion,
      calculatedFactsSnapshot: calendar.calculatedFactsSnapshot,
      sourceFiles: ["hexagrams-64.json", "eight-palaces.json", "najia-rules.json", "six-spirits.json"],
    },
  };
  const yongshen = bundle.rulesByType.get("yongshen")?.get(`${chart.topic}:${chart.subtype}`);
  chart.observationFocus = buildObservationFocus({ chart, yongshen });
  chart.chartHash = chartHash(chart);

  const findings = evaluateCoreFindings({ bundle, chart, topic: chart.topic, subtype: chart.subtype });
  const timingCandidates = findings
    .filter((finding) => finding.output_role === "CANDIDATE_OR_GUARDRAIL")
    .map((finding, index) => ({
      window: index === 0 ? "近期同支日/月" : `候选窗口 ${index + 1}`,
      granularity: index === 0 ? ["day", "month"] : ["day"],
      rank: 90 - index * 5,
      rule_code: finding.rule_code,
      evidence: [finding.rule_code],
    }));
  const report = aggregateCoreV1Report({
    findings,
    timingCandidates,
    reportPolicy: bundle.reportPolicy,
    questionContext: { topic: chart.topic },
  });

  return { chart, findings, timingCandidates: report.timingCandidates, report, engineVersions: { liuyao: "LIUYAO_ENGINE_LIGHT_V1", rules: bundle.profile.version } };
}
