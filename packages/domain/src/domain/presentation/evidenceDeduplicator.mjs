export const DEDUP_VERSION = "EVIDENCE_DEDUPLICATOR_V1";

function normalizeText(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[，。！？、,.!?;；:：\s]+/gu, "")
    .replace(/当前|明显|主要|较为|比较|这个|本次/gu, "");
}

export function deduplicateSignals(signals = []) {
  const groups = new Map();
  for (const signal of signals) {
    const key = `${signal.polarity}:${signal.dimension}:${normalizeText(signal.title || signal.text).slice(0, 36)}`;
    const existing = groups.get(key);
    if (existing) {
      existing.sourceRefs.push(signal.sourceRef);
      existing.mergedCount += 1;
      existing.children.push(signal);
    } else {
      groups.set(key, { ...signal, sourceRefs: [signal.sourceRef].filter(Boolean), mergedCount: 1, children: [signal] });
    }
  }
  return [...groups.values()];
}

export function duplicatePresentationWarnings(viewModel = {}) {
  const texts = [
    viewModel.headline,
    viewModel.summary,
    viewModel.currentSituation,
    viewModel.changeDirection,
    ...(viewModel.mainSupports ?? []).map((item) => item.text),
    ...(viewModel.mainRisks ?? []).map((item) => item.text),
  ].filter(Boolean).map(normalizeText).filter((text) => text.length > 8);
  const seen = new Set();
  const duplicates = [];
  for (const text of texts) {
    if (seen.has(text)) duplicates.push(text);
    seen.add(text);
  }
  return duplicates;
}
