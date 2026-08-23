export type TopicProfile = {
  id: string;
  slug: string;
  contentId?: string;
  name: string;
  category: string;
  intro: string;
  visual: string;
  visualAlt: string;
  scenario: string;
  boundary: string;
  examples: string[];
  lenses: Array<{ title: string; detail: string }>;
  recommendedContentIds: string[];
};

export const topicProfileList: TopicProfile[] = [
  {
    id: "relationship", slug: "relationship", contentId: "RELATIONSHIP", name: "感情与关系", category: "感情与合作",
    intro: "看清关系正在靠近还是疏远、互动为什么反复，以及现在更适合沟通还是观察。",
    visual: "/liuyao-visual-system/topics/topic-relationship-field.svg",
    visualAlt: "双向关系场：从自己与对方的状态观察关系变化，再选择靠近、观察或设定边界。",
    scenario: "relationship", boundary: "不替你决定一段关系，也不猜测他人隐私；重点是整理双方可观察的互动和你的下一步。",
    examples: ["这段关系接下来适合继续推进吗？", "我们最近反复拉扯的原因是什么？", "经历这次矛盾后，还有哪些修复条件？"],
    lenses: [
      { title: "双方状态", detail: "分别看自己的投入、承受力与对方回应。" },
      { title: "互动卡点", detail: "识别沟通、距离或现实条件造成的阻力。" },
      { title: "关系变化", detail: "判断关系是在靠近、拉扯、停滞还是转向。" },
      { title: "当前选择", detail: "落到沟通、观察、设定边界等现实动作。" },
    ], recommendedContentIds: ["B05-A16", "B05-A17", "B05-A19"],
  },
  {
    id: "business", slug: "business-partnership", contentId: "BUSINESS_PARTNERSHIP", name: "合作与项目", category: "感情与合作",
    intro: "判断合作有没有推进基础、双方可能卡在哪里，以及下一步怎样验证投入与诚意。",
    visual: "/liuyao-visual-system/topics/topic-partnership-balance.svg",
    visualAlt: "合作投入平衡图：比较双方资源、目标、行动和责任，再核验合作基础。",
    scenario: "business", boundary: "不替代合同、财务和尽调意见；重要承诺仍要落实到书面条款与现实证据。",
    examples: ["这个合作方值得继续深入推进吗？", "这个项目接下来最可能卡在哪里？", "谈判僵持时，下一步应该先验证什么？"],
    lenses: [
      { title: "合作基础", detail: "看目标、资源与现实条件是否支持继续。" },
      { title: "双方投入", detail: "区分承诺、行动与实际承担是否一致。" },
      { title: "推进阻力", detail: "识别合同、资源、沟通和节奏中的卡点。" },
      { title: "验证动作", detail: "形成继续、调整或暂缓前的核验步骤。" },
    ], recommendedContentIds: ["B05-A06", "B05-A08", "B05-A10"],
  },
  {
    id: "career", slug: "career-work", contentId: "CAREER_WORK", name: "事业与工作", category: "工作与钱",
    intro: "围绕换工作、面试、晋升与具体机会，先看机会质量，再找阻力和推进节奏。",
    visual: "/liuyao-visual-system/topics/topic-career-branch.svg",
    visualAlt: "工作决策树：比较继续争取与转向新机会两条路径，核验条件后再决定。",
    scenario: "career", boundary: "不替你做职业选择；岗位信息、薪酬条件和个人承受力仍需现实核验。",
    examples: ["这次工作机会值得继续投入吗？", "未来三个月适合主动争取晋升吗？", "换工作前最需要验证哪个现实条件？"],
    lenses: [
      { title: "机会质量", detail: "区分表面吸引力与真实发展条件。" },
      { title: "自身条件", detail: "看准备、资源和承受力是否匹配。" },
      { title: "阻力来源", detail: "定位竞争、流程或内部关系带来的影响。" },
      { title: "推进节奏", detail: "判断现在适合争取、补强还是观察。" },
    ], recommendedContentIds: ["B05-A01", "B05-A03", "B05-A05"],
  },
  {
    id: "wealth", slug: "finance-project", contentId: "FINANCE_PROJECT", name: "资金与财务", category: "工作与钱",
    intro: "围绕收入、回款与资金安排，看资金能否按预期流动，以及需要防范什么风险。",
    visual: "/liuyao-visual-system/topics/topic-finance-cycle.svg",
    visualAlt: "现金流循环图：围绕可用现金检查收入、回款、支出和预留之间的阻塞。",
    scenario: "wealth", boundary: "不提供收益承诺或投资建议；金额、合同、税务和风险应由相应专业人士核验。",
    examples: ["这笔回款近期能否按计划推进？", "当前收入计划最需要防范什么？", "资金压力出现时，应该先处理哪一环？"],
    lenses: [
      { title: "资金流向", detail: "看收入、支出或回收是否具备现实条件。" },
      { title: "回收阻力", detail: "识别流程、对方或时间带来的延迟。" },
      { title: "风险边界", detail: "区分可以观察的变化与必须回避的风险。" },
      { title: "行动余地", detail: "为催收、调整和保留现金流安排顺序。" },
    ], recommendedContentIds: ["B05-A11", "B05-A12", "B05-A15"],
  },
  {
    id: "study", slug: "exam-job-search", contentId: "EXAM_JOB_SEARCH", name: "考试与求职", category: "工作与钱",
    intro: "把考试、申请和求职焦虑拆成准备状态、关键环节与接下来最值得补强的部分。",
    visual: "/liuyao-visual-system/topics/topic-exam-focus.svg",
    visualAlt: "准备聚焦图：从知识准备、临场表达、外部竞争和关键短板中找到优先补强项。",
    scenario: "study", boundary: "不承诺分数、录取或录用结果；重点是发现准备缺口并安排下一步。",
    examples: ["这次考试准备最应该补哪里？", "这项申请目前最欠缺什么条件？", "这次面试前应该优先准备哪个环节？"],
    lenses: [
      { title: "准备状态", detail: "看当前积累是否足以支持目标。" },
      { title: "关键环节", detail: "定位考试、申请或面试中的薄弱点。" },
      { title: "发挥变量", detail: "区分可准备因素与暂时不可控因素。" },
      { title: "补强顺序", detail: "把有限时间优先用在影响最大的部分。" },
    ], recommendedContentIds: ["B05-A21", "B05-A22", "B05-A25"],
  },
  {
    id: "property", slug: "property-home", name: "房产与居所", category: "生活事务",
    intro: "把买卖、租住与搬迁计划拆成居住需求、手续资金、时间安排和退出边界。",
    visual: "/liuyao-visual-system/topics/topic-property-checkpoints.svg",
    visualAlt: "房产推进检查图：依次核对居住需求、资金手续、时间节点和退出边界。",
    scenario: "property", boundary: "不替代验房、产权、合同、贷款或法律审查；重大交易必须以专业核验为准。",
    examples: ["这次搬迁计划是否需要调整？", "当前这套房是否适合继续推进交易？", "签约前最需要再次核对什么？"],
    lenses: [
      { title: "真实需求", detail: "先区分自住、过渡、投资或家庭安排。" },
      { title: "手续资金", detail: "检查产权、合同、预算和现金流条件。" },
      { title: "推进节点", detail: "找出看房、谈判、签约和搬迁中的卡点。" },
      { title: "退出边界", detail: "提前定义延期、加价或条件变化时的止损动作。" },
    ], recommendedContentIds: ["B01-A02", "B04-A17", "B05-A30"],
  },
  {
    id: "legal", slug: "legal-dispute", name: "纠纷与协商", category: "健康与纠纷",
    intro: "整理争议双方、程序节点和升级风险，帮助判断何时协商、保留证据或寻求专业支持。",
    visual: "/liuyao-visual-system/topics/topic-legal-boundary.svg",
    visualAlt: "纠纷处理边界图：从事实证据出发，比较协商、等待和专业介入三种路径。",
    scenario: "legal", boundary: "不提供法律意见、胜诉判断或程序替代；请及时保留证据并咨询合格律师。",
    examples: ["这次争议更适合协商还是等待？", "当前冲突最可能在哪一步升级？", "我现在应先保存哪些现实证据？"],
    lenses: [
      { title: "事实证据", detail: "先区分已经发生的事实、推测和情绪反应。" },
      { title: "对方动作", detail: "观察对方是否有协商、拖延或升级行为。" },
      { title: "程序节点", detail: "明确时限、通知、材料与专业处理要求。" },
      { title: "安全边界", detail: "识别必须停止自行判断并寻求专业帮助的情况。" },
    ], recommendedContentIds: ["B01-A01", "B04-A17", "B01-A13"],
  },
  {
    id: "health", slug: "health-recovery", name: "健康与恢复", category: "健康与纠纷",
    intro: "只把六爻作为整理观察点的辅助工具，把症状变化、就医节点和恢复行动放在首位。",
    visual: "/liuyao-visual-system/topics/topic-health-observation.svg",
    visualAlt: "健康观察图：记录身体变化、专业诊疗、日常支持和需要及时就医的警示。",
    scenario: "health", boundary: "不用于诊断、治疗选择或延误就医；出现急性或持续不适时应立即联系医疗专业人士。",
    examples: ["这段恢复期应该重点记录哪些变化？", "近期安排是否需要为休养留出更多空间？", "哪些情况必须停止观察并及时就医？"],
    lenses: [
      { title: "身体变化", detail: "如实记录症状、频率和影响，不作自行诊断。" },
      { title: "专业诊疗", detail: "把医生建议、检查和复诊安排作为首要依据。" },
      { title: "日常支持", detail: "梳理休息、照护、工作和环境中的支持条件。" },
      { title: "及时升级", detail: "识别需要立即就医或联系专业人士的变化。" },
    ], recommendedContentIds: ["B01-A01", "B01-A12", "B05-A30"],
  },
  {
    id: "goods", slug: "goods-lost-item", name: "寻物与物品", category: "生活事务",
    intro: "把遗失、购买和交付问题转成地点、时间、经手人与可执行的排查顺序。",
    visual: "/liuyao-visual-system/topics/topic-goods-search.svg",
    visualAlt: "寻物排查图：按照最后确认、经手路径、重点区域和外部求助逐步排查。",
    scenario: "goods", boundary: "不承诺找回或交付结果；涉及盗窃、诈骗或重大损失时应及时报警或联系平台。",
    examples: ["这个遗失物品还有哪些寻找方向？", "这次购买或交付最容易卡在哪里？", "我应该按什么顺序继续排查？"],
    lenses: [
      { title: "最后确认", detail: "确认物品最后出现的时间、地点和状态。" },
      { title: "经手路径", detail: "按人员、移动路线和交付节点还原过程。" },
      { title: "排查顺序", detail: "先处理成本低、概率高且可以马上验证的方向。" },
      { title: "外部求助", detail: "明确联系物业、平台、警方或保险的时机。" },
    ], recommendedContentIds: ["B01-A02", "B04-A19", "B05-A30"],
  },
  {
    id: "travel", slug: "travel-planning", contentId: "TRAVEL_PLANNING", name: "出行与计划", category: "生活事务",
    intro: "梳理行程、签证与重要安排是否适合按计划推进，以及哪里需要准备替代方案。",
    visual: "/liuyao-visual-system/topics/topic-travel-route.svg",
    visualAlt: "行程节点图：检查手续、时间和资源节点，并为可能延误的位置准备替代路线。",
    scenario: "travel", boundary: "不替代交通、签证、安全和当地规定；出发前应以官方信息和现实条件为准。",
    examples: ["这次行程是否需要提前调整？", "签证或迁移计划最可能卡在哪里？", "重要安排延期时，应该先调整哪一步？"],
    lenses: [
      { title: "计划稳定", detail: "看当前安排是否具备按期推进的条件。" },
      { title: "延误来源", detail: "识别手续、交通、人员或资源上的阻碍。" },
      { title: "时间节点", detail: "找到值得重点确认与复查的时点。" },
      { title: "替代方案", detail: "在条件变化前准备可以执行的调整。" },
    ], recommendedContentIds: ["B05-A26", "B05-A27", "B05-A29"],
  },
];

const topicProfiles = Object.fromEntries(topicProfileList.filter((profile) => profile.contentId).map((profile) => [profile.contentId, profile])) as Record<string, TopicProfile>;

export function topicProfileFor(contentId: string) {
  return topicProfiles[contentId];
}

export function topicProfileForSlug(slug: string) {
  return topicProfileList.find((profile) => profile.slug === slug);
}
