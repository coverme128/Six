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
  return `${label}：${facts.situation.headline}`;
}

export function recommendedActions(facts) {
  const status = outcomeStatus(facts);
  const common = ["先确认本次问题的核心对象，再对照主要支持与阻碍。"];
  if (status === "FAVORABLE") return [...common, "可以小步推进，同时保留对阻碍项的观察。", "把关键证据导出或保存，便于之后复盘。"];
  if (status === "CAUTIOUS") return [...common, "先处理最明显的阻碍，再考虑是否推进。", "避免只凭一个有利信号做重大决定。"];
  if (status === "MIXED") return [...common, "把支持条件用起来，同时为主要风险设置检查点。", "需要分阶段判断，不宜一次性下定论。"];
  return [...common, "当前信号不够集中，建议补充背景或稍后重新观察。"];
}

export function timingHint(facts) {
  const first = facts.timingOrPriority[0];
  if (!first) return "暂无明确时间候选；本报告不提供保证日期。";
  return `${first.title}。${first.limitation}`;
}
