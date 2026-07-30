# Calendar Provider Decision Record: CAL_STD_V1

Status: accepted for Phase P1 `PRODUCTION_CALENDAR_READY`

## Scope

This record governs the production calendar facts used by new Liuyao reports. It does not enable Advanced Beta rules, Review Required rules, account systems, billing, Admin, CMS, AI reporting, or production database persistence.

## Decisions

1. Default timezone source: the browser client uses `Intl.DateTimeFormat().resolvedOptions().timeZone` when the user has not saved a timezone.
2. Server fallback timezone: direct API calls without a calendar timezone use `Asia/Shanghai`.
3. Report persistence: every new Liuyao report stores the actual `timezone`, `calendarProvider`, `calendarVersion`, `calendarPolicy`, and `calculatedFactsSnapshot`.
4. Month pillar and month build: both are calculated by solar `jie` boundaries, not by civil month.
5. Day change: the day pillar changes at local civil midnight.
6. Zi-hour policy: `23:00-00:59` is zi hour. Early zi hour is `00:00-00:59`; late zi hour is `23:00-23:59`.
7. Late zi handling: late zi does not change the day pillar, but the hour pillar stem is calculated from the next day's zi-hour stem.
8. True solar time: `trueSolarTimeSupported = false`. No longitude correction is applied in Public Beta P1.
9. Supported date range: `1901-2099` local Gregorian years.
10. Library and version: primary provider is `lunar-javascript@1.7.7`.
11. Solar-term precision and source: second-level solar-term times from `lunar-javascript` ShouXing calculations, cross-checked against `lunar_python@1.4.8` fixtures for the Asia/Shanghai boundary set.

## Structured Output Contract

`buildCalendarContext()` returns structured facts:

- Gregorian local datetime, UTC instant, IANA timezone, and UTC offset.
- Year, month, day, and hour pillars as names plus stem/branch codes.
- Current solar term when the timestamp equals a term boundary.
- Previous/next `jie` and previous/next `jieqi` boundaries.
- Month build from the month pillar branch.
- Day chen from the day pillar branch.
- Day xun and xun-kong void branches.
- Day-change, zi-hour, late-zi, true-solar-time, and supported-range policy.
- Provider name, version, policy, cross-check source, and output hash.

## Compatibility

Existing reports with `CAL_STD_V1_LIGHT` remain readable and are not migrated or rewritten. New Liuyao reports use `CAL_STD_V1`.

## Golden QA

The production fixture is `fixtures/calendar/calendar-golden-cal-std-v1.json`.

It contains 240 cases:

- 144 Asia/Shanghai anchor and solar-term boundary cases cross-checked with `lunar_python@1.4.8`.
- 96 timezone, DST, leap-day, cross-day, cross-month, and cross-year cases.

Validation is implemented in `tests/calendar-provider.test.ts` and includes:

- Required output shape.
- 200+ fixture count.
- Solar-term boundary flips.
- IANA timezone and DST projections.
- Independent sexagenary day/hour arithmetic sanity checks.
- Independent xun-kong checks from `data/core/xun-kong.json`.
