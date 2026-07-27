import { createHash } from "node:crypto";
import { indexes, loadDomainData } from "./dataStore.mjs";

function modOne(value, base) {
  const remainder = value % base;
  return remainder === 0 ? base : remainder;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function flipBit(bit) {
  return bit === "1" ? "0" : "1";
}

function relation(bodyElement, useElement, elements) {
  if (bodyElement === useElement) return "SAME_ELEMENT";
  const body = elements.get(bodyElement);
  const use = elements.get(useElement);
  if (use.generates === bodyElement) return "USE_GENERATES_BODY";
  if (body.generates === useElement) return "BODY_GENERATES_USE";
  if (body.controls === useElement) return "BODY_CONTROLS_USE";
  if (use.controls === bodyElement) return "USE_CONTROLS_BODY";
  return "UNKNOWN";
}

export function createMeihuaChart(input = {}, rootDir = process.cwd()) {
  const data = loadDomainData(rootDir);
  const idx = indexes(data);
  const methodCode = input.methodCode ?? input.method_code ?? "MEIHUA_TWO_NUMBER_V1";
  let numberA;
  let numberB;
  let movingBase;

  if (methodCode === "MEIHUA_TIME_LUNAR_BRANCH_V1") {
    const yearBranchOrdinal = Number(input.year_branch_ordinal ?? input.yearBranchOrdinal);
    const lunarMonth = Number(input.lunar_month ?? input.lunarMonth);
    const lunarDay = Number(input.lunar_day ?? input.lunarDay);
    const hourBranchOrdinal = Number(input.hour_branch_ordinal ?? input.hourBranchOrdinal);
    for (const [name, value] of Object.entries({ yearBranchOrdinal, lunarMonth, lunarDay, hourBranchOrdinal })) {
      assert(Number.isFinite(value) && value > 0, `${name} must be a positive number.`);
    }
    numberA = yearBranchOrdinal + lunarMonth + lunarDay;
    numberB = numberA + hourBranchOrdinal;
    movingBase = numberB;
  } else {
    numberA = Number(input.number_a ?? input.numberA ?? 1);
    numberB = Number(input.number_b ?? input.numberB ?? 1);
    assert(Number.isFinite(numberA) && numberA > 0, "number_a must be a positive number.");
    assert(Number.isFinite(numberB) && numberB > 0, "number_b must be a positive number.");
    movingBase = numberA + numberB;
  }

  const upperNumber = modOne(numberA, 8);
  const lowerNumber = modOne(numberB, 8);
  const movingLine = modOne(movingBase, 6);
  const upper = data.trigrams.find((item) => item.meihua_number === upperNumber);
  const lower = data.trigrams.find((item) => item.meihua_number === lowerNumber);
  const originalBits = `${lower.bits_bottom_up}${upper.bits_bottom_up}`;
  const changedBits = originalBits.split("");
  changedBits[movingLine - 1] = flipBit(changedBits[movingLine - 1]);
  const mutualBits = `${originalBits.slice(1, 4)}${originalBits.slice(2, 5)}`;
  const originalHexagram = idx.hexagramByBits.get(originalBits);
  const changedHexagram = idx.hexagramByBits.get(changedBits.join(""));
  const mutualHexagram = idx.hexagramByBits.get(mutualBits);
  assert(originalHexagram && changedHexagram && mutualHexagram, "Cannot resolve meihua hexagrams.");

  const bodyUseCase = data.meihuaBodyUse.cases.find((item) => movingLine >= item.moving_line_range[0] && movingLine <= item.moving_line_range[1]);
  const bodyTrigram = bodyUseCase.body === "upper_trigram" ? upper : lower;
  const useTrigram = bodyUseCase.use === "upper_trigram" ? upper : lower;
  const relationCode = relation(bodyTrigram.element, useTrigram.element, idx.elementByCode);
  const relationInfo = data.meihuaBodyUse.relations.find((item) => item.code === relationCode);
  const symbols = data.meihuaSymbolism.filter((item) => [bodyTrigram.code, useTrigram.code].includes(item.trigram)).slice(0, 8);

  const chart = {
    id: `mh_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    methodCode,
    question: input.question ?? "",
    input: { number_a: numberA, number_b: numberB },
    upperTrigram: upper,
    lowerTrigram: lower,
    movingLine,
    originalBits,
    changedBits: changedBits.join(""),
    mutualBits,
    originalHexagram,
    mutualHexagram,
    changedHexagram,
    body: bodyUseCase.body,
    use: bodyUseCase.use,
    bodyTrigram,
    useTrigram,
    bodyUseRelation: relationInfo,
    symbolEvidence: symbols,
    chartHash: "",
  };
  chart.chartHash = createHash("sha256").update(JSON.stringify(chart)).digest("hex");

  return {
    chart,
    report: {
      oneSentenceSummary: `${bodyTrigram.name_zh}为体，${useTrigram.name_zh}为用，${relationInfo?.meaning_zh ?? relationCode}。`,
      evidence: [
        { code: "ORIGINAL_HEXAGRAM", label: "本卦", value: originalHexagram.name_zh },
        { code: "MUTUAL_HEXAGRAM", label: "互卦", value: mutualHexagram.name_zh },
        { code: "CHANGED_HEXAGRAM", label: "变卦", value: changedHexagram.name_zh },
        { code: relationCode, label: "体用关系", value: relationInfo?.meaning_zh ?? relationCode },
      ],
      safetyBoundary: "梅花报告为传统文化解释，不输出确定性保证。",
    },
    engineVersions: { meihua: "MEIHUA_ENGINE_LIGHT_V1" },
  };
}
