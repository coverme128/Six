import { createHash, randomInt } from "node:crypto";
import { buildCalendarContext } from "./calendar.mjs";
import { indexes, loadDomainData } from "./dataStore.mjs";
import { aggregateCoreV1Report, createFindingFromRule, loadRuleProfile } from "../production/index.mjs";

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
      summary: `用神建议：${[...(yongshen.primary ?? []), ...(yongshen.secondary ?? [])].slice(0, 4).join(" / ")}`,
      evidence_kind: "direct_target_fact",
      input_facts: { topic, subtype },
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
  if (strengthRules?.has("MONTH_SAME_BRANCH")) {
    findings.push(createFindingFromRule({
      ruleType: "strength",
      key: "MONTH_SAME_BRANCH",
      rule: strengthRules.get("MONTH_SAME_BRANCH"),
      dimension: "supporting_forces",
      polarity: "supporting",
      summary: "月建关系作为时间环境证据进入支持/阻碍判断。",
      inputFacts: { monthBranch: chart.calendar.monthBranch },
      dedupeGroup: "time-environment",
      ruleVersion: bundle.profile.version,
    }));
  }
  if (strengthRules?.has("DAY_CLASH")) {
    findings.push(createFindingFromRule({
      ruleType: "strength",
      key: "DAY_CLASH",
      rule: strengthRules.get("DAY_CLASH"),
      dimension: "blocking_forces",
      polarity: "blocking",
      summary: "日辰关系作为短期压力或扰动证据保留。",
      inputFacts: { dayBranch: chart.calendar.dayBranch },
      dedupeGroup: "daily-pressure",
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

  const lines = mapped.map((line) => {
    const isOuter = line.position > 3;
    const trigramCode = isOuter ? originalHexagram.upper_trigram : originalHexagram.lower_trigram;
    const najia = lineNajia(trigramCode, isOuter, (line.position - 1) % 3, data.najia);
    const branch = idx.branchByCode.get(najia.branch);
    const relation = elementRelation(palace.palace_element, branch.element, idx.elementByCode);
    const spiritCode = rotateSpirit(startSpirit, line.position, data.sixSpirits);
    const spirit = data.sixSpirits.items.find((item) => item.code === spiritCode);
    return {
      ...line,
      trigram: trigramCode,
      stem: najia.stem,
      branch: najia.branch,
      branchName: branch.name_zh,
      element: branch.element,
      sixRelation: relation,
      sixRelationName: RELATION_ZH[relation] ?? relation,
      sixSpirit: spiritCode,
      sixSpiritName: spirit?.name_zh ?? spiritCode,
      isWorld: palace.world_line === line.position,
      isResponse: palace.response_line === line.position,
      isVoid: voidBranches.includes(najia.branch),
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
