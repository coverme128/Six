import collectionData from "../../../../data/content-growth/distribution/collections.json";

export type CollectionContentLink = { contentId: string; title: string; route: string; reviewStatus: string };
export type LearningCollection = {
  collection_id: string;
  slug: string;
  title: string;
  description: string;
  audience: string;
  outcome: string;
  group: "开始使用" | "理解盘面" | "建立判断" | "现实应用";
  duration: string;
  tool_cta: string;
  cover_path: string;
  recommended_content: CollectionContentLink[];
};

const profiles: Record<string, Omit<LearningCollection, "collection_id" | "title" | "tool_cta" | "cover_path" | "recommended_content">> = {
  "COL-01": { slug: "liuyao-getting-started", description: "先理解六爻能解决什么、报告如何形成，以及普通用户怎样开始阅读。", audience: "第一次接触六爻，希望先建立完整认识的人", outcome: "能判断一个问题是否适合六爻，并知道报告从哪里开始看", group: "开始使用", duration: "约 18 分钟" },
  "COL-02": { slug: "ask-a-clear-question", description: "从问题对象、具体事情和当前决定出发，写出一条可以被分析和复盘的问题。", audience: "问题很多、表达模糊，或容易反复起卦的人", outcome: "能把犹豫收束为一个清晰、可验证的核心问题", group: "开始使用", duration: "约 15 分钟" },
  "COL-03": { slug: "casting-and-chart", description: "认识六次起卦、自下而上记录，以及一张六爻盘面的基本组成。", audience: "想知道起卦和排盘到底发生了什么的人", outcome: "能看懂起卦顺序和盘面最基础的结构", group: "理解盘面", duration: "约 20 分钟" },
  "COL-04": { slug: "six-relations-and-yongshen", description: "理解六亲是作用角色，用神是当前问题的主要观察对象。", audience: "开始接触用神、六亲但容易按字面理解的人", outcome: "能根据问题区分主要观察角色和相关作用角色", group: "理解盘面", duration: "约 22 分钟" },
  "COL-05": { slug: "shi-ying-relationships", description: "通过世爻、应爻建立关系坐标，理解自己、对方和互动结构。", audience: "想读懂感情、合作和双方关系判断的人", outcome: "能区分自己、对方及两者关系中的主要信号", group: "理解盘面", duration: "约 18 分钟" },
  "COL-06": { slug: "strength-month-day", description: "从月建、日辰和现实条件理解旺衰，不把单个标签直接当结论。", audience: "已经认识基本盘面，准备学习力量判断的人", outcome: "能看懂力量判断来自哪些信息，以及怎样共同核验", group: "建立判断", duration: "约 24 分钟" },
  "COL-07": { slug: "moving-lines-and-change", description: "理解动爻、变爻与回头生克如何描述事情正在发生的变化。", audience: "想进一步理解变化方向和过程的人", outcome: "能把动变信息放回具体问题，而不是孤立读术语", group: "建立判断", duration: "约 22 分钟" },
  "COL-08": { slug: "timing-and-uncertainty", description: "把应期理解为带条件的观察窗口，并学会处理证据冲突与延误。", audience: "容易把时间提示当成确定日期，或被矛盾证据困扰的人", outcome: "能区分时间候选、条件变化和不可确定部分", group: "建立判断", duration: "约 20 分钟" },
  "COL-09": { slug: "read-a-liuyao-report", description: "按总体判断、支持、阻碍、变化、依据和行动的顺序阅读一份报告。", audience: "已经拿到报告，希望快速抓住重点并核验依据的人", outcome: "能先得到可行动信息，再按需进入专业盘面", group: "现实应用", duration: "约 20 分钟" },
  "COL-10": { slug: "career-and-business", description: "用工作机会、商业合作和项目推进三个问题练习现实决策分析。", audience: "正在面对工作、合作或项目选择的人", outcome: "能从机会、阻力、投入和验证动作组织判断", group: "现实应用", duration: "约 18 分钟" },
  "COL-11": { slug: "relationship-and-life-plans", description: "用感情、复合和出行安排理解关系变化与现实计划。", audience: "正在处理关系互动或重要人生安排的人", outcome: "能把情绪期待和现实条件分开，并形成下一步", group: "现实应用", duration: "约 18 分钟" },
  "COL-12": { slug: "trust-and-ai", description: "看清确定性排盘、规则判断与 AI 解释之间的边界，以及怎样判断报告是否可信。", audience: "关心系统如何工作、AI 是否会改变盘面的人", outcome: "能核对报告版本、事实依据、AI 边界和可信条件", group: "现实应用", duration: "约 16 分钟" },
};

export const learningCollections: LearningCollection[] = (collectionData as Array<{
  collection_id: string;
  title: string;
  tool_cta: string;
  cover_path: string;
  recommended_content: CollectionContentLink[];
}>).map((collection) => ({ ...collection, ...profiles[collection.collection_id]! }));

export function collectionForSlug(slug: string) {
  return learningCollections.find((collection) => collection.slug === slug);
}
