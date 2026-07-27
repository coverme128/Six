import { createHash } from "node:crypto";

const STEM_ZH = new Map([
  ["jia", "甲"], ["yi", "乙"], ["bing", "丙"], ["ding", "丁"], ["wu", "戊"],
  ["ji", "己"], ["geng", "庚"], ["xin", "辛"], ["ren", "壬"], ["gui", "癸"],
]);

const BRANCH_ZH = new Map([
  ["zi", "子"], ["chou", "丑"], ["yin", "寅"], ["mao", "卯"], ["chen", "辰"], ["si", "巳"],
  ["wu", "午"], ["wei", "未"], ["shen", "申"], ["you", "酉"], ["xu", "戌"], ["hai", "亥"],
]);

function mod(value, base) {
  return ((value % base) + base) % base;
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

function sexagenaryAt(sexagenary, indexOneBased) {
  return sexagenary[mod(indexOneBased - 1, 60)];
}

function pillarName(item) {
  return `${STEM_ZH.get(item.stem)}${BRANCH_ZH.get(item.branch)}`;
}

function hourBranch(hour) {
  const branches = ["zi", "chou", "yin", "mao", "chen", "si", "wu", "wei", "shen", "you", "xu", "hai"];
  return branches[Math.floor(((hour + 1) % 24) / 2)];
}

export function buildCalendarContext({ instantUtc, timezone = "Asia/Shanghai" }, data) {
  const date = instantUtc ? new Date(instantUtc) : new Date();
  if (Number.isNaN(date.getTime())) {
    throw new Error("instantUtc must be a valid ISO date string.");
  }

  const parts = localParts(date, timezone);
  const localNoonUtc = Date.UTC(parts.year, parts.month - 1, parts.day, 12);
  const anchorNoonUtc = Date.UTC(2025, 0, 1, 12);
  const dayOffset = Math.round((localNoonUtc - anchorNoonUtc) / 86400000);
  const anchorIndex = 7; // 2025-01-01 fixture is 庚午.
  const dayPillar = sexagenaryAt(data.sexagenary, anchorIndex + dayOffset);

  const monthBranchByCivilMonth = ["chou", "yin", "mao", "chen", "si", "wu", "wei", "shen", "you", "xu", "hai", "zi"];
  const monthBranch = monthBranchByCivilMonth[parts.month - 1];
  const hour = hourBranch(parts.hour);
  const hash = createHash("sha256").update(JSON.stringify({ instantUtc: date.toISOString(), timezone, parts, dayPillar })).digest("hex");

  return {
    policyVersion: "CAL_STD_V1_LIGHT",
    note: "Lightweight calendar adapter for local MVP. Replace with CalendarProviderAdapter before production astrology QA.",
    instantUtc: date.toISOString(),
    timezone,
    local: parts,
    year: parts.year,
    monthBranch,
    dayStem: dayPillar.stem,
    dayBranch: dayPillar.branch,
    dayPillar: pillarName(dayPillar),
    hourBranch: hour,
    provider: {
      name: "six-light-calendar",
      version: "1.0.0",
      outputHash: hash,
    },
  };
}
