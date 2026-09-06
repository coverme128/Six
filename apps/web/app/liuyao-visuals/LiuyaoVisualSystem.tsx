"use client";

import type { LiuyaoVisualizationBundle } from "../lib/api";
import type { ReactNode } from "react";

type VisualModel = Record<string, any>;

function visual(bundle: LiuyaoVisualizationBundle | null | undefined, id: string): VisualModel | null {
  return bundle?.viewModels?.[id] ?? null;
}

function LineGlyph({ line }: { line?: VisualModel }) {
  const broken = line?.yinYang === "阴" || line?.encodings?.lineShape === "broken";
  return (
    <span className={line?.moving ? "ly-line moving" : "ly-line"} aria-label={`${line?.label ?? "爻"} ${line?.yinYang ?? ""}${line?.moving ? " 动爻" : " 静爻"}`}>
      {broken ? (
        <>
          <i />
          <i />
        </>
      ) : (
        <i />
      )}
    </span>
  );
}

function Marker({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "moving" | "shi" | "ying" | "risk" | "support" }) {
  return <span className={`ly-marker ${tone}`}>{children}</span>;
}

function EmptyState({ text = "当前报告没有足够事实展示该视觉。" }: { text?: string }) {
  return <p className="ly-empty">{text}</p>;
}

function SixLineBoard({ model }: { model: VisualModel | null }) {
  if (!model?.lines?.length) return <EmptyState />;
  const hasMovingLines = model.lines.some((line: VisualModel) => line.moving);
  return (
    <div className="ly-board" aria-label="六爻盘面，上爻到初爻阅读">
      <div className="ly-board-head">
        <div>
          <span>本卦</span>
          <strong>{model.originalHexagram ?? "-"}</strong>
        </div>
        <b aria-hidden="true">{hasMovingLines ? "→" : "·"}</b>
        <div>
          <span>{hasMovingLines ? "变卦" : "当前状态"}</span>
          <strong>{hasMovingLines ? model.changedHexagram ?? "-" : "静卦，无变卦"}</strong>
        </div>
      </div>
      <div className="ly-board-lines" role="list">
        {model.lines.map((line: VisualModel) => (
          <div className="ly-board-line" role="listitem" key={`ly-line-${line.position}`}>
            <span className="ly-line-label">{line.label}</span>
            <LineGlyph line={line} />
            <span className="ly-line-main">
              <strong>{line.sixRelationName ?? "-"}</strong>
              <small>{[line.sixSpiritName, line.branchName, line.elementName].filter(Boolean).join(" / ") || "-"}</small>
            </span>
            <span className="ly-line-tags">
              {line.moving ? <Marker tone="moving">动</Marker> : null}
              {line.isWorld ? <Marker tone="shi">世</Marker> : null}
              {line.isResponse ? <Marker tone="ying">应</Marker> : null}
              {line.isVoid ? <Marker tone="risk">空</Marker> : null}
              {(line.roleLabels ?? []).slice(0, 2).map((role: VisualModel) => (
                <Marker key={`${line.position}-${role.label}`} tone={role.importance === "primary" ? "support" : "neutral"}>
                  {role.label}
                </Marker>
              ))}
            </span>
            <span className="ly-line-evidence">
              {[line.monthText, line.dayText, line.changedText].filter(Boolean).join("；") || "暂无补充状态"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PrimaryChanged({ model }: { model: VisualModel | null }) {
  const hasTransition = Boolean(model?.transitionNotes?.length);
  return (
    <div className="ly-card ly-card-compact">
      <div className="ly-card-title">
        <span>卦象变化</span>
        <strong>{hasTransition ? "本卦 / 变卦" : "静卦状态"}</strong>
      </div>
      <div className="ly-transition">
        <strong>{model?.originalHexagram ?? "-"}</strong>
        <span>{hasTransition ? "变化为" : "当前无动爻"}</span>
        <strong>{hasTransition ? model?.changedHexagram ?? "-" : "无变卦"}</strong>
      </div>
      {model?.transitionNotes?.length ? (
        <div className="ly-mini-list">
          {model.transitionNotes.map((item: VisualModel) => (
            <p key={`transition-${item.position}`}>
              {item.label}：{item.changedText ?? "动爻已记录"}
            </p>
          ))}
        </div>
      ) : (
        <EmptyState text="没有动爻变化说明。" />
      )}
    </div>
  );
}

function CastingSequence({ model }: { model: VisualModel | null }) {
  return (
    <div className="ly-card">
      <div className="ly-card-title">
        <span>生成记录</span>
        <strong>起卦序列</strong>
      </div>
      <div className="ly-cast-sequence" aria-label="从初爻到上爻的起卦序列">
        {(model?.lines ?? []).map((line: VisualModel) => (
          <div key={`cast-${line.position}`}>
            <LineGlyph line={line} />
            <strong>{line.label}</strong>
            <small>{[line.yinYang, line.value, line.moving ? "动" : "静"].filter(Boolean).join(" / ")}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function FocusPanel({ shiYing }: { shiYing: VisualModel | null }) {
  return (
    <div className="ly-card ly-focus-card">
      <div className="ly-card-title">
        <span>关系坐标</span>
        <strong>世应位置</strong>
      </div>
      <p>世爻标记主体位置，应爻标记相对方或外部位置。具体对应现实中的谁和什么事，由 AI 结合原始问题解释。</p>
      <div className="ly-shiying">
        <div>
          <Marker tone="shi">世</Marker>
          <strong>{shiYing?.world?.label ?? "-"}</strong>
          <small>{[shiYing?.world?.sixRelationName, shiYing?.world?.branchName].filter(Boolean).join(" / ")}</small>
        </div>
        <div>
          <Marker tone="ying">应</Marker>
          <strong>{shiYing?.response?.label ?? "-"}</strong>
          <small>{[shiYing?.response?.sixRelationName, shiYing?.response?.branchName].filter(Boolean).join(" / ")}</small>
        </div>
      </div>
    </div>
  );
}

function SixRelations({ model }: { model: VisualModel | null }) {
  return (
    <div className="ly-card">
      <div className="ly-card-title">
        <span>角色分布</span>
        <strong>六亲角色</strong>
      </div>
      <div className="ly-relation-map">
        {(model?.relations ?? []).map((relation: VisualModel) => (
          <div key={`relation-${relation.relationName}`}>
            <strong>{relation.relationName}</strong>
            <small>
              {(relation.lines ?? []).map((line: VisualModel) => `${line.label}${line.moving ? "动" : ""}`).join("、")}
            </small>
          </div>
        ))}
      </div>
    </div>
  );
}

type InfluenceTone = "support" | "risk" | "neutral";

function influenceStatus(influence: VisualModel | null | undefined, fallbackText?: string) {
  const text = influence?.text ?? fallbackText ?? "";
  if (influence?.isClash || text.includes("冲")) return { label: "冲", tone: "risk" as InfluenceTone };
  if (influence?.isSame || influence?.effect === "same" || text.includes("同气")) return { label: "同气", tone: "support" as InfluenceTone };
  if (influence?.effect === "generates" || text.includes("生扶")) return { label: "生扶", tone: "support" as InfluenceTone };
  if (influence?.effect === "controls" || text.includes("克制")) return { label: "受克", tone: "risk" as InfluenceTone };
  if (influence?.effect === "drains" || text.includes("泄气")) return { label: "泄气", tone: "risk" as InfluenceTone };
  if (influence?.effect === "resists" || text.includes("耗力")) return { label: "耗力", tone: "risk" as InfluenceTone };
  return { label: "待观察", tone: "neutral" as InfluenceTone };
}

function lineFocusLabels(line: VisualModel) {
  return [
    line.moving ? "动爻" : null,
    line.isWorld ? "世爻" : null,
    line.isResponse ? "应爻" : null,
    line.isVoid ? "空亡" : null,
    line.monthInfluence?.isClash || line.monthText?.includes("冲") ? "月冲" : null,
    line.dayInfluence?.isClash || line.dayText?.includes("冲") ? "日冲" : null,
  ].filter(Boolean) as string[];
}

function StrengthMatrix({ model, shiYing }: { model: VisualModel | null; shiYing: VisualModel | null }) {
  const states = (model?.lineStates ?? []).map((line: VisualModel) => ({
    ...line,
    isWorld: line.isWorld || Number(line.position) === Number(shiYing?.world?.position),
    isResponse: line.isResponse || Number(line.position) === Number(shiYing?.response?.position),
  }));
  const moving = states.filter((line: VisualModel) => line.moving);
  const world = states.find((line: VisualModel) => line.isWorld);
  const response = states.find((line: VisualModel) => line.isResponse);
  const special = states.flatMap((line: VisualModel) => lineFocusLabels(line)
    .filter((label) => !["动爻", "世爻", "应爻"].includes(label))
    .map((label) => `${line.label}${label}`));

  return (
    <div className="ly-card ly-wide-card">
      <div className="ly-card-title">
        <span>盘面状态</span>
        <strong>关键爻与月日作用</strong>
      </div>
      <div className="ly-state-focus" aria-label="盘面关注顺序">
        <div>
          <span>变化来源</span>
          <strong>{moving.length ? moving.map((line: VisualModel) => line.label).join("、") : "静卦"}</strong>
          <small>{moving.length ? "优先看动爻怎样变化" : "当前没有动爻"}</small>
        </div>
        <div>
          <span>主体与外部</span>
          <strong>{world ? `世 ${world.label}` : "世爻未标"} · {response ? `应 ${response.label}` : "应爻未标"}</strong>
          <small>先分清主体与相对位置</small>
        </div>
        <div>
          <span>特殊状态</span>
          <strong>{special.slice(0, 2).join("、") || "暂无"}</strong>
          <small>{special.length > 2 ? `另有 ${special.length - 2} 项` : "空亡与冲优先留意"}</small>
        </div>
      </div>
      <div className="ly-state-matrix" role="list" aria-label="六爻月建与日辰状态">
        {states.map((line: VisualModel) => {
          const focusLabels = lineFocusLabels(line);
          const month = influenceStatus(line.monthInfluence, line.monthText);
          const day = influenceStatus(line.dayInfluence, line.dayText);
          return (
            <div className={focusLabels.length ? "ly-state-row is-focus" : "ly-state-row"} role="listitem" key={`state-${line.position}`}>
              <div className="ly-state-identity">
                <span>{line.label}</span>
                <strong>{[line.relationName, line.branchName, line.elementName].filter(Boolean).join(" · ")}</strong>
                <span className="ly-state-tags">
                  {focusLabels.map((label) => <i className={`is-${label}`} key={`${line.position}-${label}`}>{label}</i>)}
                </span>
              </div>
              <div className="ly-state-influence">
                <span>月建</span>
                <strong className={`is-${month.tone}`}><i aria-hidden="true" />{month.label}</strong>
              </div>
              <div className="ly-state-influence">
                <span>日辰</span>
                <strong className={`is-${day.tone}`}><i aria-hidden="true" />{day.label}</strong>
              </div>
              <details className="ly-state-detail">
                <summary>关系明细</summary>
                <p>{[line.monthText, line.dayText].filter(Boolean).join("；") || "暂无月日关系说明。"}</p>
              </details>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Dynamics({ model }: { model: VisualModel | null }) {
  return (
    <div className="ly-card">
      <div className="ly-card-title">
        <span>动态信号</span>
        <strong>动爻变化</strong>
      </div>
      <p>{model?.summary ?? "本报告没有额外变化方向说明。"}</p>
      <div className="ly-mini-list">
        {(model?.movingLines ?? []).map((line: VisualModel) => (
          <p key={`moving-${line.position}`}>
            <Marker tone="moving">{line.label}</Marker>
            {line.relationName ?? "-"} / {line.branchName ?? "-"}：{line.changedText ?? "已发动"}
          </p>
        ))}
      </div>
    </div>
  );
}

export function LiuyaoVisualSystemPanel({ visualization }: { visualization?: LiuyaoVisualizationBundle | null }) {
  if (!visualization?.viewModels) return null;

  const board = visual(visualization, "VIS-LY-001");
  const movingLabels = (board?.lines ?? []).filter((line: VisualModel) => line.moving).map((line: VisualModel) => line.label);
  const staticSummary = [
    movingLabels.length
      ? `本卦${board?.originalHexagram ?? "未提供"}，变卦${board?.changedHexagram ?? "未提供"}。`
      : `本卦${board?.originalHexagram ?? "未提供"}，静卦，无变卦。`,
    `盘面按上爻到初爻阅读，共${board?.lines?.length ?? 0}爻。`,
    `动爻为${movingLabels.join("、") || "无"}。`,
    "以下展示卦象、动变、世应、六亲与力量状态。",
  ].join("");
  return (
    <section className="panel report-section ly-visual-system" aria-describedby="liuyao-visual-system-summary" aria-labelledby="liuyao-visual-system-title">
      <p className="sr-only" id="liuyao-visual-system-summary">{staticSummary}</p>
      <div className="ly-section-head">
        <div>
          <p className="eyebrow">专业盘面</p>
          <h2 id="liuyao-visual-system-title">六爻视觉解读</h2>
          <p className="section-kicker">先看本卦、动爻、变卦与世应位置，再阅读下方针对问题的 AI 解读。</p>
        </div>
      </div>

      <div className="ly-primary-layout">
        <SixLineBoard model={board} />
        <div className="ly-side-stack">
          <PrimaryChanged model={visual(visualization, "VIS-LY-002")} />
          <FocusPanel shiYing={visual(visualization, "VIS-LY-005")} />
        </div>
      </div>

      <details className="ly-extra-facts">
        <summary>力量状态、角色分布与起卦记录</summary>
      <div className="ly-visual-grid">
        <CastingSequence model={visual(visualization, "VIS-LY-003")} />
        <SixRelations model={visual(visualization, "VIS-LY-006")} />
        <StrengthMatrix model={visual(visualization, "VIS-LY-007")} shiYing={visual(visualization, "VIS-LY-005")} />
        <Dynamics model={visual(visualization, "VIS-LY-008")} />
      </div>
      </details>
    </section>
  );
}
