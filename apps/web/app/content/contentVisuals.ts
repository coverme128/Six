import visualAudit from "../../../../data/liuyao/visual-system/integration/content-growth-68-svg-production-audit.json";
import type { ContentSummary } from "../lib/api";
import { topicProfileList, topicProfileFor } from "./topicProfiles";

export type ContentVisual = { src: string; alt: string; family: string };

const auditAssets = visualAudit.assets as Array<{
  visualAssetId: string;
  title: string;
  publicPath: string;
  articleRefs?: string[];
}>;

const moduleFallbacks: Record<string, ContentVisual> = {
  B01: { src: "/content-growth/visuals/B01-VIS-01.svg", alt: "从问题、排盘到可复核六爻报告的形成过程", family: "使用与可信" },
  B02: { src: "/content-growth/visuals/B02-VIS-01.svg", alt: "一次完整六爻起卦与排盘流程", family: "起卦与盘面" },
  B03: { src: "/content-growth/visuals/B03-VIS-01.svg", alt: "现实问题如何映射到六爻观察角色", family: "角色与关系" },
  B04: { src: "/content-growth/visuals/B04-VIS-01.svg", alt: "六爻力量、变化与时间的判断结构", family: "力量与时间" },
  B05: { src: "/content-growth/visuals/B05-VIS-01.svg", alt: "从现实问题到六爻决策报告的分析过程", family: "现实问题" },
  B06: { src: "/content-growth/visuals/B01-VIS-06.svg", alt: "按结论、依据与行动顺序阅读六爻报告", family: "报告阅读" },
  B07: { src: "/content-growth/visuals/B07-VIS-01.svg", alt: "六爻知识体系与学习入口总地图", family: "知识导览" },
};

function scenarioVisual(item: ContentSummary): ContentVisual | undefined {
  if (!item.contentId.startsWith("B05-A")) return undefined;
  const articleNumber = Number(item.contentId.replace("B05-A", ""));
  const scenario = articleNumber <= 5 ? "career" : articleNumber <= 10 ? "business" : articleNumber <= 15 ? "wealth" : articleNumber <= 20 ? "relationship" : articleNumber <= 25 ? "study" : "travel";
  const profile = topicProfileList.find((entry) => entry.id === scenario);
  return profile ? { src: profile.visual, alt: profile.visualAlt, family: profile.name } : undefined;
}

export function contentVisualFor(item: ContentSummary): ContentVisual {
  if (item.contentType === "LANDING_PAGE") {
    const profile = topicProfileFor(item.contentId);
    if (profile) return { src: profile.visual, alt: profile.visualAlt, family: profile.name };
  }

  const exactAsset = auditAssets.find((asset) => asset.articleRefs?.includes(item.contentId));
  if (exactAsset) return { src: exactAsset.publicPath, alt: exactAsset.title, family: exactAsset.visualAssetId.slice(0, 3) };

  const scenarioAsset = scenarioVisual(item);
  if (scenarioAsset) return scenarioAsset;

  if (item.contentId.includes("CASE")) {
    return { src: "/liuyao-visual-system/editorial/final/case-cover/ED-LY-003-teaching-case-cover-1200x900.png", alt: "六爻教学案例分析", family: "教学案例" };
  }
  if (item.contentType === "HEXAGRAM" || item.contentType === "TRIGRAM") {
    return { src: "/liuyao-visual-system/editorial/final/cultural-scene/ED-LY-008-historical-cultural-scene-1200x800.png", alt: "六爻卦象与传统参考资料", family: "卦象参考" };
  }
  if (item.contentType === "LEARNING_PATH") {
    return { src: "/liuyao-visual-system/editorial/final/lesson-cover/ED-LY-004-learn-lesson-cover-1080x1350.png", alt: "六爻循序学习路径", family: "学习路径" };
  }
  const prefix = item.contentId.slice(0, 3);
  if (moduleFallbacks[prefix]) return moduleFallbacks[prefix];
  if (item.contentType === "FAQ") {
    return { src: "/liuyao-visual-system/editorial/final/inline/ED-LY-010-trust-system-illustration-1200x630.svg", alt: "六爻系统可信边界", family: "常见问题" };
  }
  return { src: "/liuyao-visual-system/editorial/final/inline/ED-LY-002-concept-explainer-1200x630.svg", alt: "六爻概念结构说明", family: "概念解释" };
}
