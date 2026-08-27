import type { LiuyaoVisualizationBundle } from "../lib/api";

type VisualModel = Record<string, any>;

function escapeXml(value: unknown) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function model(bundle: LiuyaoVisualizationBundle, id: string): VisualModel {
  return bundle.viewModels?.[id] ?? {};
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

export function renderLiuyaoVisualizationSvg(bundle: LiuyaoVisualizationBundle, reportTitle = "六爻报告") {
  const board = model(bundle, "VIS-LY-001");
  const shiYing = model(bundle, "VIS-LY-005");
  const lines = board.lines ?? [];
  const hasMovingLines = lines.some((line: VisualModel) => line.moving);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1120" role="img" aria-labelledby="title desc">
<title id="title">${escapeXml(reportTitle)}</title><desc id="desc">由报告 visualization ViewModel 生成的六爻静态报告</desc>
<rect width="1600" height="1120" fill="#F6F1E7"/><rect width="1600" height="22" fill="#496F63"/>
${text("六爻 · 可复核报告", 100, 105, { size: 24, weight: 700, fill: "#496F63" })}${text(reportTitle, 100, 182, { size: 48, weight: 760, max: 27, limit: 2 })}
<line x1="100" y1="245" x2="1500" y2="245" stroke="#CFC5B6"/>
<rect x="100" y="300" width="820" height="650" rx="8" fill="#FFFCF6" stroke="#CFC5B6"/>
${text("盘面", 140, 352, { size: 20, weight: 700, fill: "#5D5A54" })}${text(hasMovingLines ? `${board.originalHexagram ?? "-"} → ${board.changedHexagram ?? "-"}` : `${board.originalHexagram ?? "-"}（静卦，无变卦）`, 140, 410, { size: 34, weight: 700 })}
${lines.map((line: VisualModel, index: number) => {
    const y = 480 + index * 70;
    const broken = line.yinYang === "阴" || line.encodings?.lineShape === "broken";
    const glyph = broken ? `<line x1="270" y1="${y}" x2="350" y2="${y}" stroke="#171717" stroke-width="12"/><line x1="380" y1="${y}" x2="460" y2="${y}" stroke="#171717" stroke-width="12"/>` : `<line x1="270" y1="${y}" x2="460" y2="${y}" stroke="#171717" stroke-width="12"/>`;
    return `${text(line.label, 140, y + 8, { size: 20, weight: 700, fill: "#5D5A54" })}${glyph}${text(`${line.sixRelationName ?? "-"} · ${line.branchName ?? "-"}${line.moving ? " · 动" : ""}${line.isWorld ? " · 世" : ""}${line.isResponse ? " · 应" : ""}`, 510, y + 8, { size: 20, max: 26, limit: 1 })}`;
  }).join("")}
<rect x="960" y="300" width="540" height="650" rx="8" fill="#FFFCF6" stroke="#CFC5B6"/>
${text("世应位置", 1000, 352, { size: 20, weight: 700, fill: "#5D5A54" })}${text("世爻标记主体位置，应爻标记相对方或外部位置。", 1000, 420, { size: 24, max: 25, limit: 3 })}
${text(`世：${shiYing.world?.label ?? "-"} · ${shiYing.world?.sixRelationName ?? "-"}`, 1000, 565, { size: 22, weight: 700 })}${text(`应：${shiYing.response?.label ?? "-"} · ${shiYing.response?.sixRelationName ?? "-"}`, 1000, 620, { size: 22, weight: 700 })}
${text("盘面事实由确定性引擎生成；针对问题的综合判断与行动建议请阅读报告中的 AI 解读。", 1000, 750, { size: 20, fill: "#5D5A54", max: 25, limit: 4 })}
<line x1="100" y1="1020" x2="1500" y2="1020" stroke="#CFC5B6"/>${text("报告用于个人参考，不替代医疗、法律或投资等专业决策。", 100, 1075, { size: 20, fill: "#5D5A54", max: 62, limit: 1 })}
</svg>`;
}
