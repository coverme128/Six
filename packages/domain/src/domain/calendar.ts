// @ts-nocheck
import { createHash } from "node:crypto";

import { LunarUtil, Solar } from "lunar-javascript";

const CALENDAR_POLICY = "CAL_STD_V1";
const PROVIDER_NAME = "lunar-javascript";
const PROVIDER_VERSION = "1.7.7";
const SUPPORTED_YEAR_RANGE = Object.freeze({ start: 1901, end: 2099 });

const STEM_ZH_TO_CODE = new Map([
  ["甲", "jia"], ["乙", "yi"], ["丙", "bing"], ["丁", "ding"], ["戊", "wu"],
  ["己", "ji"], ["庚", "geng"], ["辛", "xin"], ["壬", "ren"], ["癸", "gui"],
]);

const BRANCH_ZH_TO_CODE = new Map([
  ["子", "zi"], ["丑", "chou"], ["寅", "yin"], ["卯", "mao"], ["辰", "chen"], ["巳", "si"],
  ["午", "wu"], ["未", "wei"], ["申", "shen"], ["酉", "you"], ["戌", "xu"], ["亥", "hai"],
]);

const BRANCH_CODE_TO_ZH = new Map([...BRANCH_ZH_TO_CODE.entries()].map(([key, value]) => [value, key]));

function assertValidTimezone(timeZone) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date("2026-01-01T00:00:00Z"));
  } catch {
    const err = new Error("timezone must be a valid IANA timezone.");
    err.publicCode = "CALENDAR_CALCULATION_FAILED";
    throw err;
  }
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function localParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function offsetMinutes(date, parts) {
  const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return Math.round((localAsUtc - date.getTime()) / 60000);
}

function offsetText(minutes) {
  const sign = minutes >= 0 ? "+" : "-";
  const abs = Math.abs(minutes);
  return `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

function localIso(parts, offset) {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}${offsetText(offset)}`;
}

function splitPillar(name) {
  const stemName = name.slice(0, 1);
  const branchName = name.slice(1, 2);
  return {
    name,
    stem: STEM_ZH_TO_CODE.get(stemName),
    stemName,
    branch: BRANCH_ZH_TO_CODE.get(branchName),
    branchName,
  };
}

function parseVoidBranches(value) {
  return [...String(value)].map((branchName) => ({
    branch: BRANCH_ZH_TO_CODE.get(branchName),
    branchName,
  }));
}

function solarToStruct(solar) {
  return {
    year: solar.getYear(),
    month: solar.getMonth(),
    day: solar.getDay(),
    hour: solar.getHour(),
    minute: solar.getMinute(),
    second: solar.getSecond(),
    localDateTime: `${solar.toYmd()}T${pad(solar.getHour())}:${pad(solar.getMinute())}:${pad(solar.getSecond())}`,
  };
}

function termStruct(term) {
  if (!term) return null;
  return {
    name: term.getName(),
    isJie: term.isJie(),
    isQi: term.isQi(),
    local: solarToStruct(term.getSolar()),
  };
}

function currentTerm(lunar, parts) {
  const table = lunar.getJieQiTable();
  const current = `${parts.year}-${pad(parts.month)}-${pad(parts.day)} ${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
  for (const [name, solar] of Object.entries(table)) {
    if (solar.toYmdHms() === current) return { name, solar };
  }
  return null;
}

function validateSupportedDate(parts) {
  if (parts.year < SUPPORTED_YEAR_RANGE.start || parts.year > SUPPORTED_YEAR_RANGE.end) {
    const err = new Error(`CAL_STD_V1 supports years ${SUPPORTED_YEAR_RANGE.start}-${SUPPORTED_YEAR_RANGE.end}.`);
    err.publicCode = "CALENDAR_CALCULATION_FAILED";
    throw err;
  }
}

function buildSnapshot(context) {
  return {
    gregorian: context.gregorian,
    timezone: context.timezone,
    pillars: context.pillars,
    solarTerm: context.solarTerm,
    monthBuild: context.monthBuild,
    dayChen: context.dayChen,
    xun: context.xun,
    dayChangePolicy: context.dayChangePolicy,
    provider: context.provider,
  };
}

export function buildCalendarContext({ instantUtc, timezone = "Asia/Shanghai" } = {}) {
  assertValidTimezone(timezone);
  const date = instantUtc ? new Date(instantUtc) : new Date();
  if (Number.isNaN(date.getTime())) {
    const err = new Error("instantUtc must be a valid ISO date string.");
    err.publicCode = "CALENDAR_CALCULATION_FAILED";
    throw err;
  }

  const parts = localParts(date, timezone);
  validateSupportedDate(parts);
  const offset = offsetMinutes(date, parts);
  const solar = Solar.fromYmdHms(parts.year, parts.month, parts.day, parts.hour, parts.minute, parts.second);
  const lunar = solar.getLunar();
  const eightChar = lunar.getEightChar();
  eightChar.setSect(2);

  const pillars = {
    year: splitPillar(eightChar.getYear()),
    month: splitPillar(eightChar.getMonth()),
    day: splitPillar(eightChar.getDay()),
    hour: splitPillar(eightChar.getTime()),
  };
  const xunName = LunarUtil.getXun(pillars.day.name);
  const xunKongName = LunarUtil.getXunKong(pillars.day.name);
  const current = currentTerm(lunar, parts);

  const context = {
    policyVersion: CALENDAR_POLICY,
    calendarPolicy: CALENDAR_POLICY,
    calendarProvider: PROVIDER_NAME,
    calendarVersion: PROVIDER_VERSION,
    instantUtc: date.toISOString(),
    timezone,
    local: parts,
    gregorian: {
      instantUtc: date.toISOString(),
      timezone,
      offsetMinutes: offset,
      offset: offsetText(offset),
      localDateTime: localIso(parts, offset),
      parts,
    },
    pillars,
    yearPillar: pillars.year.name,
    monthPillar: pillars.month.name,
    dayPillar: pillars.day.name,
    hourPillar: pillars.hour.name,
    yearStem: pillars.year.stem,
    yearBranch: pillars.year.branch,
    monthStem: pillars.month.stem,
    monthBranch: pillars.month.branch,
    dayStem: pillars.day.stem,
    dayBranch: pillars.day.branch,
    hourStem: pillars.hour.stem,
    hourBranch: pillars.hour.branch,
    solarTerm: {
      current: current ? { name: current.name, local: solarToStruct(current.solar) } : null,
      previousJie: termStruct(lunar.getPrevJie(false)),
      nextJie: termStruct(lunar.getNextJie(false)),
      previousJieQi: termStruct(lunar.getPrevJieQi(false)),
      nextJieQi: termStruct(lunar.getNextJieQi(false)),
      boundaryPrecision: "second",
      source: `${PROVIDER_NAME}@${PROVIDER_VERSION}`,
    },
    monthBuild: {
      branch: pillars.month.branch,
      branchName: pillars.month.branchName,
      source: "month_pillar_branch_by_solar_jie_boundary",
    },
    dayChen: {
      branch: pillars.day.branch,
      branchName: pillars.day.branchName,
      source: "day_pillar_branch",
    },
    xun: {
      name: xunName,
      voidBranches: parseVoidBranches(xunKongName),
      voidBranchNames: xunKongName,
    },
    dayChangePolicy: {
      dateChange: "midnight",
      ziHourStart: "23:00",
      earlyZiHour: "00:00-00:59",
      lateZiHour: "23:00-23:59",
      lateZiChangesDayPillar: false,
      lateZiHourPillarUsesNextDayStem: true,
      trueSolarTimeSupported: false,
      supportedYearRange: SUPPORTED_YEAR_RANGE,
    },
    provider: {
      name: PROVIDER_NAME,
      version: PROVIDER_VERSION,
      policyVersion: CALENDAR_POLICY,
      dataSource: "lunar-javascript ShouXing solar-term calculation",
      crossCheck: "fixtures/calendar/calendar-golden-asia-shanghai-v1.json lunar_python@1.4.8-crosscheck",
    },
  };
  context.calculatedFactsSnapshot = buildSnapshot(context);
  context.provider.outputHash = createHash("sha256").update(JSON.stringify(context.calculatedFactsSnapshot)).digest("hex");
  return context;
}

export const calendarProviderDecision = Object.freeze({
  policyVersion: CALENDAR_POLICY,
  provider: PROVIDER_NAME,
  providerVersion: PROVIDER_VERSION,
  defaultTimezoneSource: "browser_detected_iana_timezone",
  serverFallbackTimezone: "Asia/Shanghai",
  monthPillarBoundary: "solar_jie_boundary",
  dayChange: "midnight",
  lateZiChangesDayPillar: false,
  lateZiHourPillarUsesNextDayStem: true,
  trueSolarTimeSupported: false,
  supportedYearRange: SUPPORTED_YEAR_RANGE,
});

export { BRANCH_CODE_TO_ZH };
