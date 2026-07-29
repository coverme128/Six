import { lookupTerm } from "./terminologyRegistry.mjs";

function titleFromCode(code) {
  return String(code ?? "")
    .replace(/^core-v\d+-/u, "")
    .replace(/^liuyao-|^meihua-/u, "")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .trim() || "未命名信息";
}

export function formatTerm(code, fallback = "未命名信息") {
  return lookupTerm(code)?.displayName ?? fallback;
}

export function formatStatus(code) {
  return lookupTerm(code)?.displayName ?? "状态待确认";
}

export function formatError(code) {
  return lookupTerm(code)?.displayName ?? "暂时无法完成操作";
}

export function formatRelationship(code, fallback = "") {
  return lookupTerm(code)?.displayName ?? (fallback || titleFromCode(code));
}

export function formatTiming(candidate = {}) {
  if (!candidate) return "暂无明确时间提示";
  return `${candidate.window ?? "时间候选"}：${candidate.limitation ?? "仅作为候选窗口，不是保证日期。"}`;
}

export function formatFinding(finding = {}) {
  const known = lookupTerm(finding.rule_type) ?? lookupTerm(finding.code) ?? lookupTerm(finding.ruleCode);
  return {
    title: finding.summary || known?.displayName || titleFromCode(finding.rule_type ?? finding.code ?? finding.ruleCode),
    description: known?.practicalMeaning ?? finding.summary ?? "这是一条用于理解结果的证据。",
    category: known?.category ?? "evidence",
  };
}

export function formatEvidence(signal = {}) {
  return {
    title: signal.title || titleFromCode(signal.kind ?? signal.id),
    text: signal.text || signal.detail || signal.summary || "该证据用于辅助理解结果。",
  };
}

export function formatMethod(code, type = "") {
  if (code) return formatTerm(code, type === "meihua" ? "梅花起卦" : "六爻起卦");
  return type === "meihua" ? "梅花起卦" : "六爻起卦";
}
