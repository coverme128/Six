import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { buildCalendarContext } from "@six/domain/calendar";
import { indexes, loadDomainData } from "@six/domain/data-store";
import { createLiuyaoChart } from "@six/domain/liuyao";
import { createMeihuaChart } from "@six/domain/meihua";

const ROOT = process.cwd();

function readJson(path) {
  return JSON.parse(readFileSync(join(ROOT, path), "utf8"));
}

function valuesFromBits(bits) {
  return bits.split("").map((bit) => bit === "1" ? 7 : 8);
}

function expectedLocalParts(expectedLocalDatetime) {
  const match = expectedLocalDatetime.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/u);
  assert.ok(match, `Invalid expected datetime ${expectedLocalDatetime}`);
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6]),
  };
}

function relationFromElements(selfElement, targetElement, elementByCode) {
  if (selfElement === targetElement) return "sibling";
  const self = elementByCode.get(selfElement);
  const target = elementByCode.get(targetElement);
  if (target.generates === selfElement) return "parent";
  if (self.generates === targetElement) return "child";
  if (self.controls === targetElement) return "wealth";
  if (target.controls === selfElement) return "officer_ghost";
  return "unknown";
}

test("v1.2 coin method fixtures produce deterministic hexagram bits and moving lines", () => {
  const fixture = readJson("fixtures/liuyao/coin-method-fixtures.json");
  for (const item of fixture.items) {
    const result = createLiuyaoChart({
      values: item.round_sums,
      topic: "career",
      subtype: "job_search",
      calendar: { instantUtc: "2026-07-21T01:00:00Z", timezone: "Asia/Shanghai" },
    }, ROOT);

    assert.equal(result.chart.originalBits, item.original_bits, item.id);
    assert.equal(result.chart.changedBits, item.changed_bits, item.id);
    assert.equal(result.chart.originalHexagram.code, item.original_hexagram, item.id);
    assert.equal(result.chart.changedHexagram.code, item.changed_hexagram, item.id);
    assert.deepEqual(result.chart.movingLines, item.moving_lines, item.id);
  }
});

test("three-coin round input is preserved and normalized to 6/7/8/9 values", () => {
  const coins = [[3, 2, 2], [3, 3, 2], [3, 3, 3], [3, 2, 2], [3, 3, 2], [2, 2, 2]];
  const result = createLiuyaoChart({
    coins,
    topic: "career",
    subtype: "job_search",
    calendar: { instantUtc: "2026-07-21T01:00:00Z", timezone: "Asia/Shanghai" },
  }, ROOT);

  assert.deepEqual(result.chart.rawCast.coins, coins);
  assert.deepEqual(result.chart.rawCast.values, [7, 8, 9, 7, 8, 6]);
  assert.equal(result.chart.rawCast.inputMode, "coins");
  assert.equal(result.chart.originalBits, "101100");
  assert.equal(result.chart.changedBits, "100101");
});

test("v1.2 najia pure-hexagram fixtures match stems, branches, elements and six relations", () => {
  const data = loadDomainData(ROOT);
  const idx = indexes(data);
  const fixture = readJson("fixtures/liuyao/najia-pure-hexagram-fixtures.json");

  for (const item of fixture.items) {
    const hexagram = idx.hexagramByCode.get(item.hexagram_code);
    assert.ok(hexagram, item.id);
    const result = createLiuyaoChart({
      values: valuesFromBits(hexagram.bits_bottom_up),
      topic: "career",
      subtype: "job_search",
      calendar: { instantUtc: "2026-07-21T01:00:00Z", timezone: "Asia/Shanghai" },
    }, ROOT);

    assert.equal(result.chart.palace.palace, item.palace, item.id);
    for (const expectedLine of item.lines) {
      const actual = result.chart.lines[expectedLine.position - 1];
      assert.equal(actual.stem, expectedLine.stem, `${item.id}:${expectedLine.position}:stem`);
      assert.equal(actual.branch, expectedLine.branch, `${item.id}:${expectedLine.position}:branch`);
      assert.equal(actual.element, expectedLine.element, `${item.id}:${expectedLine.position}:element`);
      assert.equal(actual.sixRelation, expectedLine.sixRelation, `${item.id}:${expectedLine.position}:sixRelation`);
    }
  }
});

test("v1.2 six relation matrix remains derivable from five-element relations", () => {
  const data = loadDomainData(ROOT);
  const idx = indexes(data);
  const fixture = readJson("fixtures/liuyao/six-relation-matrix-fixtures.json");

  for (const item of fixture.items) {
    assert.equal(
      relationFromElements(item.palace_element, item.line_element, idx.elementByCode),
      item.expected_relation,
      `${item.palace_element}:${item.line_element}`,
    );
  }
});

test("v1.2 six spirits fixture matches configured day-stem starts", () => {
  const spirits = readJson("data/liuyao/six-spirits.json");
  const fixture = readJson("fixtures/liuyao/six-spirit-fixtures.json");

  for (const item of fixture.items) {
    const start = spirits.day_stem_start[item.day_stem];
    const startIndex = spirits.sequence.indexOf(start);
    const actual = Array.from({ length: 6 }, (_, index) => spirits.sequence[(startIndex + index) % spirits.sequence.length]);
    assert.deepEqual(actual, item.spirits, item.day_stem);
  }
});

test("v1.2 timezone normalization fixtures produce expected local clock parts", () => {
  const data = loadDomainData(ROOT);
  const fixture = readJson("fixtures/calendar/timezone-normalization-fixtures.json");

  for (const item of fixture.items) {
    const context = buildCalendarContext({ instantUtc: item.instant_utc, timezone: item.timezone }, data);
    assert.deepEqual(context.local, expectedLocalParts(item.expected_local_datetime), item.case_id);
  }
});

test("v1.2 meihua casting fixtures cover two-number and lunar-branch time methods", () => {
  const fixture = readJson("fixtures/meihua/basic-casting-fixtures.json");

  for (const item of fixture.items) {
    const result = createMeihuaChart({ methodCode: item.methodCode, ...item.input }, ROOT);
    assert.equal(result.chart.methodCode, item.methodCode, item.id);
    assert.equal(result.chart.upperTrigram.code, item.expected.upper, item.id);
    assert.equal(result.chart.lowerTrigram.code, item.expected.lower, item.id);
    assert.equal(result.chart.movingLine, item.expected.movingLine, item.id);
    assert.equal(result.chart.originalHexagram.code, item.expected.originalHexagram, item.id);
    assert.equal(result.chart.changedHexagram.code, item.expected.changedHexagram, item.id);
    assert.equal(result.chart.body, item.expected.body, item.id);
    assert.equal(result.chart.use, item.expected.use, item.id);
  }
});
