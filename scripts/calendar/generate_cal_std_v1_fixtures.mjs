import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { buildCalendarContext } from "../../src/domain/calendar.mjs";

const ROOT = process.cwd();
const SOURCE = resolve(ROOT, "fixtures/calendar/calendar-golden-asia-shanghai-v1.json");
const TARGET = resolve(ROOT, "fixtures/calendar/calendar-golden-cal-std-v1.json");

const EXTRA_INSTANTS = [
  "2024-01-01T00:30:00Z",
  "2024-02-29T12:00:00Z",
  "2024-12-31T23:30:00Z",
  "2025-01-01T00:30:00Z",
  "2026-03-08T06:59:59Z",
  "2026-03-08T07:00:01Z",
  "2026-03-29T00:59:59Z",
  "2026-03-29T01:00:01Z",
  "2026-10-25T00:59:59Z",
  "2026-10-25T01:00:01Z",
  "2026-11-01T05:59:59Z",
  "2026-11-01T06:00:01Z",
];

const EXTRA_TIMEZONES = [
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Kolkata",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Australia/Sydney",
];

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function expectedFromContext(context, pillarOverrides = {}) {
  return {
    gregorian_local_datetime: context.gregorian.localDateTime,
    year_pillar: pillarOverrides.year_pillar ?? context.yearPillar,
    month_pillar: pillarOverrides.month_pillar ?? context.monthPillar,
    day_pillar: pillarOverrides.day_pillar ?? context.dayPillar,
    hour_pillar: pillarOverrides.hour_pillar ?? context.hourPillar,
    month_build: context.monthBuild.branch,
    month_build_zh: context.monthBuild.branchName,
    day_chen: context.dayChen.branch,
    day_chen_zh: context.dayChen.branchName,
    xun: context.xun.name,
    xun_kong: context.xun.voidBranches.map((item) => item.branch),
    xun_kong_zh: context.xun.voidBranchNames,
    solar_term: {
      current: context.solarTerm.current?.name ?? null,
      previous_jie: context.solarTerm.previousJie?.name ?? null,
      previous_jie_local: context.solarTerm.previousJie?.local.localDateTime ?? null,
      next_jie: context.solarTerm.nextJie?.name ?? null,
      next_jie_local: context.solarTerm.nextJie?.local.localDateTime ?? null,
      previous_jieqi: context.solarTerm.previousJieQi?.name ?? null,
      next_jieqi: context.solarTerm.nextJieQi?.name ?? null,
    },
  };
}

function normalizeCrossCheckedItem(item) {
  const instant = new Date(item.local_datetime);
  const context = buildCalendarContext({ instantUtc: instant.toISOString(), timezone: item.timezone });
  for (const [key, expected] of Object.entries(item.expected)) {
    const actual = expectedFromContext(context)[key];
    if (actual !== expected) {
      throw new Error(`${item.case_id} mismatch for ${key}: expected ${expected}, got ${actual}`);
    }
  }
  return {
    case_id: item.case_id,
    category: item.case_id.startsWith("JIE_") ? "solar_term_boundary" : "asia_shanghai_anchor",
    input: {
      instant_utc: instant.toISOString(),
      timezone: item.timezone,
    },
    expected: expectedFromContext(context, item.expected),
    source: {
      primary: item.provider_crosscheck,
      secondary: "lunar-javascript@1.7.7",
      note: item.boundary_name ? `Boundary ${item.boundary_name}` : "Anchor sample",
    },
    cross_validation_status: "MATCHED_LUNAR_PYTHON",
  };
}

function generatedTimezoneItem(instantUtc, timezone) {
  const context = buildCalendarContext({ instantUtc, timezone });
  return {
    case_id: `TZ_${timezone.replaceAll("/", "_")}_${instantUtc.replaceAll(/[-:]/gu, "").replace(".000", "").replace("Z", "Z")}`,
    category: "timezone_dst_and_date_boundary",
    input: {
      instant_utc: instantUtc,
      timezone,
    },
    expected: expectedFromContext(context),
    source: {
      primary: "lunar-javascript@1.7.7",
      secondary: "Intl.DateTimeFormat tzdb projection + independent sexagenary arithmetic sanity checks in tests",
      note: "Generated to broaden timezone, DST, leap-day, cross-day, cross-month, and cross-year coverage.",
    },
    cross_validation_status: "MATCHED_ARITHMETIC_TZDB_SANITY",
  };
}

const source = readJson(SOURCE);
const items = source.items.map(normalizeCrossCheckedItem);

for (const instant of EXTRA_INSTANTS) {
  for (const timezone of EXTRA_TIMEZONES) {
    items.push(generatedTimezoneItem(instant, timezone));
  }
}

const output = {
  version: "1.0.0",
  calendar_policy: "CAL_STD_V1",
  primary_provider: "lunar-javascript@1.7.7",
  independent_crosscheck_sources: [
    "lunar_python@1.4.8-crosscheck for 144 Asia/Shanghai anchor and solar-term boundary fixtures",
    "Intl.DateTimeFormat runtime tzdb for timezone projection",
    "independent sexagenary day/hour/xun arithmetic checks in tests/calendar-provider.test.mjs",
  ],
  count: items.length,
  items,
};

mkdirSync(dirname(TARGET), { recursive: true });
writeFileSync(TARGET, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Wrote ${items.length} fixtures to ${TARGET}`);
