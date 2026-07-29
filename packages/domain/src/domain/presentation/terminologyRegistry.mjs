export const TERMINOLOGY_VERSION = "TERMINOLOGY_REGISTRY_V1";

const entries = [
  ["liuyao", "六爻", "六爻排盘", "以六个爻位组织卦象、六亲、世应和动变的判断结构。", "用于查看事情当前结构、支持阻碍和变化方向。", "method", "P0"],
  ["meihua", "梅花", "梅花易数", "以本卦、互卦、变卦与体用关系组织判断。", "用于快速观察事件态势和主客关系。", "method", "P0"],
  ["LIUYAO_THREE_COIN_V1", "铜钱起卦", "三枚铜钱起六爻", "以六轮三枚铜钱生成六个爻值。", "适合正式记录一次明确问题。", "method", "P1"],
  ["MEIHUA_TWO_NUMBER_V1", "两数起卦", "梅花两数起卦", "以上下两个数字生成本卦和动爻。", "适合用数字快速生成梅花结构。", "method", "P1"],
  ["MEIHUA_THREE_NUMBER_V1", "三数起卦", "梅花三数起卦", "以三个数字生成卦象和动爻。", "适合需要单独指定动爻来源的梅花输入。", "method", "P1"],
  ["MEIHUA_TIME_LUNAR_BRANCH_V1", "时间起卦", "梅花年月日时起卦", "以农历月日和地支序数生成梅花卦。", "适合围绕当下时间观察事件状态。", "method", "P1"],
  ["original_hexagram", "本卦", "起卦得到的初始卦象。", "判断的起点结构。", "先看当前状态。", "chart", "P0"],
  ["changed_hexagram", "变卦", "动爻变化后形成的卦象。", "呈现变化后的倾向。", "看后续发展方向。", "chart", "P0"],
  ["mutual_hexagram", "互卦", "梅花中的中间结构。", "用于观察内部过程和中间状态。", "看事情内部如何变化。", "chart", "P1"],
  ["moving_line", "动爻", "发生变化的爻位。", "提示变化重点所在。", "优先关注这个位置。", "chart", "P1"],
  ["world_line", "世爻", "代表主体或我方的位置。", "六爻中观察自身状态的核心位置。", "看自己或当前主体。", "liuyao", "P1"],
  ["response_line", "应爻", "代表对方或外部的位置。", "六爻中观察相对方或外部因素的位置。", "看对象或外部环境。", "liuyao", "P1"],
  ["useful_god", "用神", "围绕问题选出的主要观察对象。", "六爻判断中的主轴。", "先看它的状态。", "liuyao", "P0"],
  ["source_god", "原神", "生扶用神的力量。", "表示支持或资源来源。", "看帮助从哪里来。", "liuyao", "P1"],
  ["avoid_god", "忌神", "克制用神的力量。", "表示主要阻碍或压力来源。", "看风险在哪里。", "liuyao", "P1"],
  ["month_command", "月建", "起卦节令中的月令事实。", "用于判断爻的时令力量。", "看外部大环境是否支持。", "calendar", "P1"],
  ["day_influence", "日辰", "起卦当日的日令事实。", "用于判断爻与当天力量的关系。", "看当下即时影响。", "calendar", "P1"],
  ["xun_void", "旬空", "当旬中暂时落空的地支。", "提示某些信号暂时不实或未落地。", "把它当作保留信号。", "calendar", "P2"],
  ["month_break", "月破", "与月令相冲形成的弱化状态。", "提示当前受到大环境冲击。", "需要谨慎看待。", "calendar", "P2"],
  ["day_break", "日破", "与日辰相冲形成的短期冲击。", "提示当下有明显扰动。", "短期内更需确认。", "calendar", "P2"],
  ["return_generation", "回头生", "变爻反过来生扶原爻。", "表示变化后形成支持。", "变化可能带来帮助。", "relationship", "P1"],
  ["return_control", "回头克", "变爻反过来克制原爻。", "表示变化后形成压力。", "变化可能带来阻碍。", "relationship", "P1"],
  ["strength", "旺衰", "力量强弱状态。", "综合月日动静等判断有效性。", "看信号是否有力。", "liuyao", "P1"],
  ["six_relations", "六亲", "父母、兄弟、子孙、妻财、官鬼等角色。", "用于把爻位映射到事情角色。", "看谁代表什么。", "liuyao", "P2"],
  ["six_spirits", "六神", "青龙、朱雀、勾陈等辅助状态。", "补充状态表现，不单独决定结论。", "作为辅助线索。", "liuyao", "P2"],
  ["body_trigram", "体卦", "梅花中代表主体的一卦。", "用于观察自己或主体。", "看我方状态。", "meihua", "P1"],
  ["use_trigram", "用卦", "梅花中代表对象或外部的一卦。", "用于观察外部作用。", "看对方或环境。", "meihua", "P1"],
  ["body_generates_use", "体生用", "主体生外部。", "表示主体付出较多。", "注意消耗。", "relationship", "P1"],
  ["use_generates_body", "用生体", "外部生主体。", "表示外部对主体有支持。", "可借助外部资源。", "relationship", "P1"],
  ["body_controls_use", "体克用", "主体克外部。", "表示主体有掌控力。", "主动推进更合适。", "relationship", "P1"],
  ["use_controls_body", "用克体", "外部克主体。", "表示外部压力较强。", "先处理阻力。", "relationship", "P1"],
  ["same_element", "比和", "体用同类或相近。", "表示双方力量接近。", "适合协调推进。", "relationship", "P1"],
  ["external_sign", "外应", "外部现象线索。", "作为象义候选，不能单独保证结果。", "只能辅助参考。", "meihua", "P2"],
  ["FAVORABLE", "偏有利", "整体更偏支持。", "支持信号多于阻碍信号。", "可以推进，但仍要看风险。", "status", "P0"],
  ["MIXED", "有利有阻", "支持与阻碍并存。", "事情不是单向结果，需要分步处理。", "先处理关键阻碍。", "status", "P0"],
  ["CAUTIOUS", "需要谨慎", "阻碍或不确定性更明显。", "不适合贸然推进。", "先验证条件。", "status", "P0"],
  ["UNCLEAR", "尚不明朗", "现有信号不足以形成强判断。", "需要继续观察或补充信息。", "不要急着下结论。", "status", "P0"],
  ["PARTIAL", "部分完成", "核心结果可用，但有增强内容缺失。", "基础报告仍可阅读。", "先阅读可用部分，稍后可重试增强内容。", "status", "P1"],
  ["FALLBACK", "降级解读", "增强解读暂不可用。", "系统回到确定性报告。", "可以先看基础结果。", "status", "P1"],
  ["RATE_LIMITED", "请求过于频繁", "短时间请求太多。", "稍后重试，不影响已生成报告。", "稍后再试。", "status", "P1"],
  ["REPORT_NOT_FOUND", "报告不存在", "没有找到对应报告。", "可能已被清空或链接错误。", "返回历史或重新起卦。", "status", "P1"],
];

export const TERMINOLOGY_REGISTRY = Object.freeze(Object.fromEntries(entries.map(([internalCode, displayName, shortDescription, professionalDescription, practicalMeaning, category, priority]) => [
  internalCode,
  {
    internalCode,
    displayName,
    shortDescription,
    professionalDescription,
    practicalMeaning,
    category,
    priority,
    status: "ACTIVE",
    supportedLocales: ["zh-CN"],
    unknownFallback: "未命名术语",
  },
])));

export function lookupTerm(code) {
  const key = String(code ?? "");
  return TERMINOLOGY_REGISTRY[key] ?? TERMINOLOGY_REGISTRY[key.toLowerCase()] ?? null;
}
