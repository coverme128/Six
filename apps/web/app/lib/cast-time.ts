export function wallTime(instant: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("sv-SE", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(instant));
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export function originalCastInstant(local: string, timezone: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) throw new Error("请填写原起卦日期与时间。");
  const approximate = Date.parse(local + ":00Z");
  if (!Number.isFinite(approximate)) throw new Error("起卦时间无效。");
  // Compare both sides of DST transitions; never silently pick an ambiguous local hour.
  const candidates = new Set<string>();
  for (const hours of [-36, 0, 36]) {
    const probe = approximate + hours * 3600000;
    const offset = Date.parse(wallTime(new Date(probe).toISOString(), timezone) + ":00Z") - probe;
    const candidate = new Date(approximate - offset).toISOString();
    if (wallTime(candidate, timezone) === local) candidates.add(candidate);
  }
  if (candidates.size !== 1) throw new Error("该时间处于夏令时跳转或重复时段，请改用 UTC 填写原起卦时间。");
  const value = [...candidates][0]!;
  if (Date.parse(value) > Date.now() + 60000) throw new Error("原起卦时间不能在未来。");
  return value;
}
