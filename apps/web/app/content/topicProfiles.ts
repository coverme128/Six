export type TopicProfile = {
  name: string;
  category: string;
  intro: string;
  visual: string;
  visualAlt: string;
  scenario: string;
  examples: string[];
  lenses: Array<{ title: string; detail: string }>;
};

export const topicProfiles: Record<string, TopicProfile> = {
  RELATIONSHIP: {
    name: "感情与关系",
    category: "感情与合作",
    intro: "看清关系正在靠近还是疏远、互动为什么反复，以及现在更适合沟通还是观察。",
    visual: "/liuyao-visual-system/topics/topic-relationship-field.svg",
    visualAlt: "双向关系场：从自己与对方的状态观察关系变化，再选择靠近、观察或设定边界。",
    scenario: "relationship",
    examples: [
      "这段关系接下来适合继续推进吗？",
      "我们最近反复拉扯的原因是什么？",
      "经历这次矛盾后，还有哪些修复条件？",
    ],
    lenses: [
      { title: "双方状态", detail: "分别看自己的投入、承受力与对方回应。" },
      { title: "互动卡点", detail: "识别沟通、距离或现实条件造成的阻力。" },
      { title: "关系变化", detail: "判断关系是在靠近、拉扯、停滞还是转向。" },
      { title: "当前选择", detail: "落到沟通、观察、设定边界等现实动作。" },
    ],
  },
  BUSINESS_PARTNERSHIP: {
    name: "合作与项目",
    category: "感情与合作",
    intro: "判断合作有没有推进基础、双方可能卡在哪里，以及下一步怎样验证投入与诚意。",
    visual: "/liuyao-visual-system/topics/topic-partnership-balance.svg",
    visualAlt: "合作投入平衡图：比较双方资源、目标、行动和责任，再核验合作基础。",
    scenario: "business",
    examples: [
      "这个合作方值得继续深入推进吗？",
      "这个项目接下来最可能卡在哪里？",
      "谈判僵持时，下一步应该先验证什么？",
    ],
    lenses: [
      { title: "合作基础", detail: "看目标、资源与现实条件是否支持继续。" },
      { title: "双方投入", detail: "区分承诺、行动与实际承担是否一致。" },
      { title: "推进阻力", detail: "识别合同、资源、沟通和节奏中的卡点。" },
      { title: "验证动作", detail: "形成继续、调整或暂缓前的核验步骤。" },
    ],
  },
  CAREER_WORK: {
    name: "事业与工作",
    category: "工作与钱",
    intro: "围绕换工作、面试、晋升与具体机会，先看机会质量，再找阻力和推进节奏。",
    visual: "/liuyao-visual-system/topics/topic-career-branch.svg",
    visualAlt: "工作决策树：比较继续争取与转向新机会两条路径，核验条件后再决定。",
    scenario: "career",
    examples: [
      "这次工作机会值得继续投入吗？",
      "未来三个月适合主动争取晋升吗？",
      "换工作前最需要验证哪个现实条件？",
    ],
    lenses: [
      { title: "机会质量", detail: "区分表面吸引力与真实发展条件。" },
      { title: "自身条件", detail: "看准备、资源和承受力是否匹配。" },
      { title: "阻力来源", detail: "定位竞争、流程或内部关系带来的影响。" },
      { title: "推进节奏", detail: "判断现在适合争取、补强还是观察。" },
    ],
  },
  FINANCE_PROJECT: {
    name: "资金与财务",
    category: "工作与钱",
    intro: "围绕收入、回款与资金安排，看资金能否按预期流动，以及需要防范什么风险。",
    visual: "/liuyao-visual-system/topics/topic-finance-cycle.svg",
    visualAlt: "现金流循环图：围绕可用现金检查收入、回款、支出和预留之间的阻塞。",
    scenario: "wealth",
    examples: [
      "这笔回款近期能否按计划推进？",
      "当前收入计划最需要防范什么？",
      "资金压力出现时，应该先处理哪一环？",
    ],
    lenses: [
      { title: "资金流向", detail: "看收入、支出或回收是否具备现实条件。" },
      { title: "回收阻力", detail: "识别流程、对方或时间带来的延迟。" },
      { title: "风险边界", detail: "区分可以观察的变化与必须回避的风险。" },
      { title: "行动余地", detail: "为催收、调整和保留现金流安排顺序。" },
    ],
  },
  EXAM_JOB_SEARCH: {
    name: "考试与求职",
    category: "工作与钱",
    intro: "把考试、申请和求职焦虑拆成准备状态、关键环节与接下来最值得补强的部分。",
    visual: "/liuyao-visual-system/topics/topic-exam-focus.svg",
    visualAlt: "准备聚焦图：从知识准备、临场表达、外部竞争和关键短板中找到优先补强项。",
    scenario: "study",
    examples: [
      "这次考试准备最应该补哪里？",
      "这项申请目前最欠缺什么条件？",
      "这次面试前应该优先准备哪个环节？",
    ],
    lenses: [
      { title: "准备状态", detail: "看当前积累是否足以支持目标。" },
      { title: "关键环节", detail: "定位考试、申请或面试中的薄弱点。" },
      { title: "发挥变量", detail: "区分可准备因素与暂时不可控因素。" },
      { title: "补强顺序", detail: "把有限时间优先用在影响最大的部分。" },
    ],
  },
  TRAVEL_PLANNING: {
    name: "出行与计划",
    category: "生活事务",
    intro: "梳理行程、签证与重要安排是否适合按计划推进，以及哪里需要准备替代方案。",
    visual: "/liuyao-visual-system/topics/topic-travel-route.svg",
    visualAlt: "行程节点图：检查手续、时间和资源节点，并为可能延误的位置准备替代路线。",
    scenario: "travel",
    examples: [
      "这次行程是否需要提前调整？",
      "签证或迁移计划最可能卡在哪里？",
      "重要安排延期时，应该先调整哪一步？",
    ],
    lenses: [
      { title: "计划稳定", detail: "看当前安排是否具备按期推进的条件。" },
      { title: "延误来源", detail: "识别手续、交通、人员或资源上的阻碍。" },
      { title: "时间节点", detail: "找到值得重点确认与复查的时点。" },
      { title: "替代方案", detail: "在条件变化前准备可以执行的调整。" },
    ],
  },
};

export function topicProfileFor(contentId: string) {
  return topicProfiles[contentId];
}
