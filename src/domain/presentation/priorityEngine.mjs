export const PRIORITY_VERSION = "RESULT_PRIORITY_ENGINE_V1";

const PRIORITY_WEIGHT = { P0: 0, P1: 1, P2: 2, P3: 3 };

export function assignPriority(item = {}) {
  if (item.priority) return item.priority;
  if (item.priorityHint) return item.priorityHint;
  if (item.polarity === "SUPPORT" || item.polarity === "RISK") return "P1";
  if (item.polarity === "TIMING" || item.dimension === "timing_state") return "P2";
  if (item.rawCode || item.evidenceKind === "rule") return "P2";
  return "P3";
}

export function prioritizeSignals(signals = []) {
  return signals
    .map((signal, index) => ({ ...signal, priority: assignPriority(signal), originalOrder: index }))
    .sort((a, b) => (PRIORITY_WEIGHT[a.priority] ?? 3) - (PRIORITY_WEIGHT[b.priority] ?? 3) || a.originalOrder - b.originalOrder);
}

export function guidedSignals(signals = [], { min = 6, max = 12, hardMax = 15 } = {}) {
  const prioritized = prioritizeSignals(signals).filter((signal) => ["P0", "P1"].includes(signal.priority));
  const filled = prioritized.length >= min ? prioritized : prioritizeSignals(signals);
  return filled.slice(0, Math.min(max, hardMax));
}

export function professionalSignals(signals = []) {
  return prioritizeSignals(signals).filter((signal) => ["P0", "P1", "P2"].includes(signal.priority));
}
