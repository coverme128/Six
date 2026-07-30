import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildCalendarContext, calendarProviderDecision } from "@six/domain/calendar";
import { loadDomainData } from "@six/domain/data-store";

const ROOT = process.cwd();

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sexagenaryIndex(cycle, pillar) {
  return cycle.findIndex((item) => item.name_zh === pillar);
}

function pillarName(item) {
  return item.name_zh;
}

function independentDayPillar(localDate, cycle) {
  const anchorUtc = Date.UTC(2025, 0, 1, 12);
  const localNoonUtc = Date.UTC(localDate.year, localDate.month - 1, localDate.day, 12);
  const offset = Math.round((localNoonUtc - anchorUtc) / 86400000);
  const anchorIndex = sexagenaryIndex(cycle, "庚午");
  return pillarName(cycle[((anchorIndex + offset) % 60 + 60) % 60]);
}

function independentHourBranch(hour) {
  return ["zi", "chou", "yin", "mao", "chen", "si", "wu", "wei", "shen", "you", "xu", "hai"][Math.floor(((hour + 1) % 24) / 2)];
}

function independentHourPillar(dayPillar, hourBranch, hour, cycle) {
  const dayIndex = sexagenaryIndex(cycle, dayPillar);
  const day = cycle[(dayIndex + (hour === 23 ? 1 : 0)) % 60];
  const stemStartByDayStem = {
    jia: 0,
    ji: 0,
    yi: 2,
    geng: 2,
    bing: 4,
    xin: 4,
    ding: 6,
    ren: 6,
    wu: 8,
    gui: 8,
  };
  const branches = ["zi", "chou", "yin", "mao", "chen", "si", "wu", "wei", "shen", "you", "xu", "hai"];
  const stems = ["jia", "yi", "bing", "ding", "wu", "ji", "geng", "xin", "ren", "gui"];
  const branchIndex = branches.indexOf(hourBranch);
  const stem = stems[(stemStartByDayStem[day.stem] + branchIndex) % 10];
  const branchZh = { zi: "子", chou: "丑", yin: "寅", mao: "卯", chen: "辰", si: "巳", wu: "午", wei: "未", shen: "申", you: "酉", xu: "戌", hai: "亥" }[hourBranch];
  const stemZh = { jia: "甲", yi: "乙", bing: "丙", ding: "丁", wu: "戊", ji: "己", geng: "庚", xin: "辛", ren: "壬", gui: "癸" }[stem];
  return `${stemZh}${branchZh}`;
}

function normalizeXunKong(value) {
  return [...value].sort().join("");
}

test("CAL_STD_V1 decision record is explicit about product defaults", () => {
  assert.equal(calendarProviderDecision.policyVersion, "CAL_STD_V1");
  assert.equal(calendarProviderDecision.defaultTimezoneSource, "browser_detected_iana_timezone");
  assert.equal(calendarProviderDecision.monthPillarBoundary, "solar_jie_boundary");
  assert.equal(calendarProviderDecision.dayChange, "midnight");
  assert.equal(calendarProviderDecision.lateZiChangesDayPillar, false);
  assert.equal(calendarProviderDecision.lateZiHourPillarUsesNextDayStem, true);
  assert.equal(calendarProviderDecision.trueSolarTimeSupported, false);
});

test("CAL_STD_V1 provider emits the required structured facts", () => {
  const context = buildCalendarContext({ instantUtc: "2026-07-21T01:00:00Z", timezone: "Asia/Shanghai" });
  assert.equal(context.policyVersion, "CAL_STD_V1");
  assert.equal(context.calendarProvider, "lunar-javascript");
  assert.equal(context.calendarVersion, "1.7.7");
  assert.equal(context.gregorian.localDateTime, "2026-07-21T09:00:00+08:00");
  assert.equal(context.yearPillar, "丙午");
  assert.equal(context.monthPillar, "乙未");
  assert.equal(context.dayPillar, "丙申");
  assert.equal(context.hourPillar, "癸巳");
  assert.equal(context.monthBuild.branch, "wei");
  assert.equal(context.dayChen.branch, "shen");
  assert.deepEqual(context.xun.voidBranches.map((item) => item.branch), ["chen", "si"]);
  assert.equal(context.dayChangePolicy.trueSolarTimeSupported, false);
  assert.ok(context.calculatedFactsSnapshot);
  assert.ok(context.provider.outputHash);
});

test("CAL_STD_V1 golden fixtures cover 200+ cross-checked calendar cases", () => {
  const data = loadDomainData(ROOT);
  const fixture = readJson("fixtures/calendar/calendar-golden-cal-std-v1.json");
  assert.equal(fixture.calendar_policy, "CAL_STD_V1");
  assert.ok(fixture.count >= 200);
  assert.equal(fixture.items.length, fixture.count);
  assert.ok(fixture.items.filter((item) => item.cross_validation_status === "MATCHED_LUNAR_PYTHON").length >= 144);

  for (const item of fixture.items) {
    const context = buildCalendarContext({ instantUtc: item.input.instant_utc, timezone: item.input.timezone });
    assert.equal(context.gregorian.localDateTime, item.expected.gregorian_local_datetime, item.case_id);
    assert.equal(context.yearPillar, item.expected.year_pillar, item.case_id);
    assert.equal(context.monthPillar, item.expected.month_pillar, item.case_id);
    assert.equal(context.dayPillar, item.expected.day_pillar, item.case_id);
    assert.equal(context.hourPillar, item.expected.hour_pillar, item.case_id);
    assert.equal(context.monthBuild.branch, item.expected.month_build, item.case_id);
    assert.equal(context.dayChen.branch, item.expected.day_chen, item.case_id);
    assert.equal(context.xun.name, item.expected.xun, item.case_id);
    assert.deepEqual(context.xun.voidBranches.map((branch) => branch.branch), item.expected.xun_kong, item.case_id);
    assert.equal(context.solarTerm.current?.name ?? null, item.expected.solar_term.current, item.case_id);
    assert.equal(context.solarTerm.previousJie?.name ?? null, item.expected.solar_term.previous_jie, item.case_id);
    assert.equal(context.solarTerm.nextJie?.name ?? null, item.expected.solar_term.next_jie, item.case_id);

    assert.equal(independentDayPillar(context.local, data.sexagenary), context.dayPillar, item.case_id);
    assert.equal(independentHourBranch(context.local.hour), context.hourBranch, item.case_id);
    assert.equal(independentHourPillar(context.dayPillar, context.hourBranch, context.local.hour, data.sexagenary), context.hourPillar, item.case_id);
    const xun = data.xunKong.find((entry) => entry.xun_start === context.xun.name);
    assert.deepEqual([...xun.void_branches].sort(), context.xun.voidBranches.map((branch) => branch.branch).sort(), item.case_id);
  }
});

test("CAL_STD_V1 keeps solar-term boundary flips reproducible", () => {
  const fixture = readJson("fixtures/calendar/calendar-golden-cal-std-v1.json");
  const before = fixture.items.find((item) => item.case_id === "JIE_2026_立春_BEFORE");
  const at = fixture.items.find((item) => item.case_id === "JIE_2026_立春_AT");
  const after = fixture.items.find((item) => item.case_id === "JIE_2026_立春_AFTER");

  assert.equal(buildCalendarContext({ instantUtc: before.input.instant_utc, timezone: before.input.timezone }).monthPillar, "己丑");
  assert.equal(buildCalendarContext({ instantUtc: at.input.instant_utc, timezone: at.input.timezone }).monthPillar, "庚寅");
  assert.equal(buildCalendarContext({ instantUtc: after.input.instant_utc, timezone: after.input.timezone }).yearPillar, "丙午");
});
