// @ts-nocheck
import { formatStatus } from "./terminologyFormatter.js";

export function outcomeStatus(facts) {
  const supports = facts.positiveSignals.length;
  const risks = facts.negativeSignals.length;
  if (supports >= risks + 2) return "FAVORABLE";
  if (risks >= supports + 2) return "CAUTIOUS";
  if (supports || risks) return "MIXED";
  return "UNCLEAR";
}

export function assembleHeadline(facts) {
  const status = outcomeStatus(facts);
  const label = formatStatus(status);
  const chartTitle = facts.chartSummary?.title ?? facts.situation.headline;
  if (status === "FAVORABLE") return `${label}：${chartTitle}，有推进空间，但仍要处理短期扰动。`;
  if (status === "CAUTIOUS") return `${label}：${chartTitle}，先稳住风险，再判断是否推进。`;
  if (status === "MIXED") return `${label}：${chartTitle}，支持与阻碍并存，适合分阶段观察。`;
  return `${label}：${chartTitle}，当前信号不够集中，需要补充背景再看。`;
}

export function recommendedActions(facts) {
  const status = outcomeStatus(facts);
  const common = ["先把问题对象、时间范围和你能主动调整的部分分清。"];
  if (status === "FAVORABLE") return [...common, "可以小步推进，但先为短期阻力预留缓冲。", "推进后保留一次复盘节点，观察动爻对应的变化是否出现。"];
  if (status === "CAUTIOUS") return [...common, "先处理最明显的阻碍，再决定是否继续投入。", "避免只凭一个有利信号做重大决定。"];
  if (status === "MIXED") return [...common, "把支持条件用起来，同时为主要风险设置检查点。", "适合分阶段判断，不宜一次性下定论。"];
  return [...common, "当前信号不够集中，建议补充背景或稍后重新观察。"];
}

export function timingHint(facts) {
  const first = facts.timingOrPriority[0];
  if (!first) return "暂无明确时间候选；本报告不提供保证日期。";
  return first.text;
}
