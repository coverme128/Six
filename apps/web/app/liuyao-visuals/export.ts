import type { LiuyaoVisualizationBundle } from "../lib/api";

type VisualModel = Record<string, any>;

function escapeXml(value: unknown) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function model(bundle: LiuyaoVisualizationBundle, id: string): VisualModel {
  return bundle.viewModels?.[id] ?? {};
}

function itemText(item: VisualModel) {
  if (typeof item === "string") return item;
  return item?.text ?? item?.title ?? item?.label ?? "";
}

function wrap(value: unknown, max = 32, limit = 3) {
  const chars = [...String(value ?? "").trim()];
  const lines: string[] = [];
  while (chars.length && lines.length < limit) lines.push(chars.splice(0, max).join(""));
  if (chars.length && lines.length) {
    const lastIndex = lines.length - 1;
    lines[lastIndex] = `${(lines[lastIndex] ?? "").slice(0, -1)}…`;
  }
  return lines;
}

function text(value: unknown, x: number, y: number, options: { size?: number; weight?: number; fill?: string; max?: number; limit?: number } = {}) {
  const size = options.size ?? 24;
  return `<text x="${x}" y="${y}" fill="${options.fill ?? "#171717"}" font-size="${size}" font-weight="${options.weight ?? 500}" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">${wrap(value, options.max ?? 32, options.limit ?? 3).map((line, index) => `<tspan x="${x}" dy="${index ? Math.round(size * 1.45) : 0}">${escapeXml(line)}</tspan>`).join("")}</text>`;
}

function list(items: VisualModel[], x: number, y: number, width: number, accent: string) {
  return items.slice(0, 4).map((item, index) => `<circle cx="${x}" cy="${y + index * 66 - 7}" r="7" fill="${accent}"/>${text(itemText(item), x + 22, y + index * 66, { size: 20, max: Math.floor(width / 20), limit: 2 })}`).join("");
}

export function renderLiuyaoVisualizationSvg(bundle: LiuyaoVisualizationBundle, reportTitle = "六爻报告") {
  const board = model(bundle, "VIS-LY-001");
  const focus = model(bundle, "VIS-LY-004");
  const shiYing = model(bundle, "VIS-LY-005");
  const conflict = model(bundle, "VIS-LY-009");
  const timing = model(bundle, "VIS-LY-010");
  const decision = model(bundle, "VIS-LY-011");
  const pattern = model(bundle, "VIS-LY-012");
  const reasoning = model(bundle, "VIS-LY-014");
  const lines = board.lines ?? [];
  const support = decision.supports ?? (conflict.evidence ?? []).filter((item: VisualModel) => item.polarity === "support");
  const risks = decision.risks ?? (conflict.evidence ?? []).filter((item: VisualModel) => item.polarity === "risk");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 2260" role="img" aria-labelledby="title desc">
<title id="title">${escapeXml(reportTitle)}</title><desc id="desc">由报告 visualization ViewModel 生成的六爻静态报告</desc>
<rect width="1600" height="2260" fill="#F6F1E7"/><rect width="1600" height="22" fill="#496F63"/>
${text("六爻 · 可复核报告", 100, 105, { size: 24, weight: 700, fill: "#496F63" })}${text(reportTitle, 100, 182, { size: 48, weight: 760, max: 27, limit: 2 })}
<line x1="100" y1="245" x2="1500" y2="245" stroke="#CFC5B6"/>
<rect x="100" y="300" width="820" height="650" rx="8" fill="#FFFCF6" stroke="#CFC5B6"/>
${text("盘面", 140, 352, { size: 20, weight: 700, fill: "#5D5A54" })}${text(`${board.originalHexagram ?? "-"} → ${board.changedHexagram ?? "-"}`, 140, 410, { size: 34, weight: 700 })}
${lines.map((line: VisualModel, index: number) => {
    const y = 480 + index * 70;
    const broken = line.yinYang === "阴" || line.encodings?.lineShape === "broken";
    const glyph = broken ? `<line x1="270" y1="${y}" x2="350" y2="${y}" stroke="#171717" stroke-width="12"/><line x1="380" y1="${y}" x2="460" y2="${y}" stroke="#171717" stroke-width="12"/>` : `<line x1="270" y1="${y}" x2="460" y2="${y}" stroke="#171717" stroke-width="12"/>`;
    return `${text(line.label, 140, y + 8, { size: 20, weight: 700, fill: "#5D5A54" })}${glyph}${text(`${line.sixRelationName ?? "-"} · ${line.branchName ?? "-"}${line.moving ? " · 动" : ""}${line.isWorld ? " · 世" : ""}${line.isResponse ? " · 应" : ""}`, 510, y + 8, { size: 20, max: 26, limit: 1 })}`;
  }).join("")}
<rect x="960" y="300" width="540" height="650" rx="8" fill="#FFFCF6" stroke="#CFC5B6"/>
${text("核心焦点与世应", 1000, 352, { size: 20, weight: 700, fill: "#5D5A54" })}${text(focus.explanation ?? focus.observationSummary ?? "本次报告未返回焦点说明", 1000, 420, { size: 24, max: 25, limit: 5 })}
${text(`世：${shiYing.world?.label ?? "-"} · ${shiYing.world?.sixRelationName ?? "-"}`, 1000, 610, { size: 22, weight: 700 })}${text(`应：${shiYing.response?.label ?? "-"} · ${shiYing.response?.sixRelationName ?? "-"}`, 1000, 665, { size: 22, weight: 700 })}
${text("判断模式", 1000, 760, { size: 20, weight: 700, fill: "#5D5A54" })}${text(pattern.patternName ?? "综合判断", 1000, 814, { size: 27, weight: 700 })}${text(pattern.summary ?? "", 1000, 865, { size: 20, max: 25, limit: 3 })}
<rect x="100" y="1000" width="680" height="430" rx="8" fill="#FFFCF6" stroke="#496F63" stroke-width="2"/>${text("主要支持", 140, 1060, { size: 26, weight: 700, fill: "#496F63" })}${list(support, 150, 1125, 570, "#496F63")}
<rect x="820" y="1000" width="680" height="430" rx="8" fill="#FFFCF6" stroke="#A33A2B" stroke-width="2"/>${text("主要风险", 860, 1060, { size: 26, weight: 700, fill: "#A33A2B" })}${list(risks, 870, 1125, 570, "#A33A2B")}
<rect x="100" y="1480" width="680" height="520" rx="8" fill="#FFFCF6" stroke="#9A7A43" stroke-width="2"/>${text("下一步", 140, 1540, { size: 26, weight: 700, fill: "#9A7A43" })}${list((decision.actions ?? []).map((value: string) => ({ text: value })), 150, 1605, 570, "#9A7A43")}
<rect x="820" y="1480" width="680" height="520" rx="8" fill="#FFFCF6" stroke="#48677A" stroke-width="2"/>${text("时间与复核顺序", 860, 1540, { size: 26, weight: 700, fill: "#48677A" })}${list([...(timing.items ?? []), ...(reasoning.steps ?? [])], 870, 1605, 570, "#48677A")}
<line x1="100" y1="2070" x2="1500" y2="2070" stroke="#CFC5B6"/>${text("时间只作为候选观察窗口，不是保证日期。报告用于个人参考，不替代医疗、法律或投资等专业决策。", 100, 2130, { size: 20, fill: "#5D5A54", max: 62, limit: 2 })}
</svg>`;
}
