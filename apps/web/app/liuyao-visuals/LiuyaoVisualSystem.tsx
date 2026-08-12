"use client";

import type { LiuyaoVisualizationBundle } from "../lib/api";
import type { ReactNode } from "react";

type VisualModel = Record<string, any>;

function itemText(item: any) {
  return item?.text ?? item?.title ?? item?.label ?? "";
}

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
  return (
    <div className="ly-board" aria-label="六爻盘面，上爻到初爻阅读">
      <div className="ly-board-head">
        <div>
          <span>本卦</span>
          <strong>{model.originalHexagram ?? "-"}</strong>
        </div>
        <b aria-hidden="true">→</b>
        <div>
          <span>变卦</span>
          <strong>{model.changedHexagram ?? "-"}</strong>
        </div>
      </div>
      <div className="ly-board-lines">
        {model.lines.map((line: VisualModel) => (
          <button className="ly-board-line" type="button" key={`ly-line-${line.position}`}>
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
          </button>
        ))}
      </div>
    </div>
  );
}

function PrimaryChanged({ model }: { model: VisualModel | null }) {
  return (
    <div className="ly-card ly-card-compact">
      <div className="ly-card-title">
        <span>VIS-LY-002</span>
        <strong>本卦 / 变卦</strong>
      </div>
      <div className="ly-transition">
        <strong>{model?.originalHexagram ?? "-"}</strong>
        <span>变化为</span>
        <strong>{model?.changedHexagram ?? "-"}</strong>
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
        <span>VIS-LY-003</span>
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

function FocusPanel({ yongshen, shiYing }: { yongshen: VisualModel | null; shiYing: VisualModel | null }) {
  return (
    <div className="ly-card ly-focus-card">
      <div className="ly-card-title">
        <span>VIS-LY-004 / 005</span>
        <strong>核心焦点与世应</strong>
      </div>
      <p>{yongshen?.explanation ?? yongshen?.observationSummary ?? "本次报告未返回核心焦点说明。"}</p>
      <div className="ly-role-grid">
        {(yongshen?.roles ?? []).slice(0, 4).map((role: VisualModel) => (
          <div key={`role-${role.label}`}>
            <strong>{role.label}</strong>
            <small>{role.practicalMeaning}</small>
            <span>{role.linePositions?.length ? `${role.linePositions.join("、")} 爻` : "未见对应爻"}</span>
          </div>
        ))}
      </div>
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
        <span>VIS-LY-006</span>
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

function StrengthMatrix({ model }: { model: VisualModel | null }) {
  return (
    <div className="ly-card ly-wide-card">
      <div className="ly-card-title">
        <span>VIS-LY-007</span>
        <strong>状态矩阵</strong>
      </div>
      <div className="ly-matrix">
        {(model?.lineStates ?? []).map((line: VisualModel) => (
          <div key={`state-${line.position}`}>
            <strong>{line.label}</strong>
            <small>{[line.relationName, line.branchName].filter(Boolean).join(" / ")}</small>
            <p>{[line.monthText, line.dayText, line.isVoid ? "空亡" : null, line.moving ? "发动" : null].filter(Boolean).join("；") || "暂无状态"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Dynamics({ model }: { model: VisualModel | null }) {
  return (
    <div className="ly-card">
      <div className="ly-card-title">
        <span>VIS-LY-008</span>
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

function EvidenceConflict({ model }: { model: VisualModel | null }) {
  const support = (model?.evidence ?? []).filter((item: VisualModel) => item.polarity === "support").slice(0, 2);
  const risk = (model?.evidence ?? []).filter((item: VisualModel) => item.polarity === "risk").slice(0, 2);
  return (
    <div className="ly-card ly-wide-card">
      <div className="ly-card-title">
        <span>VIS-LY-009</span>
        <strong>证据冲突</strong>
      </div>
      <div className="ly-conflict-summary">
        <Marker tone="neutral">{model?.conflictState ?? "MIXED"}</Marker>
        <p>{model?.summary ?? "支持与风险按事实并列展示。"}</p>
      </div>
      <div className="ly-evidence-columns">
        <div>
          <strong>支持</strong>
          {support.length ? support.map((item: VisualModel, index: number) => <p key={`support-${index}`}>{itemText(item)}</p>) : <EmptyState text="暂无明确支持证据。" />}
        </div>
        <div>
          <strong>风险</strong>
          {risk.length ? risk.map((item: VisualModel, index: number) => <p key={`risk-${index}`}>{itemText(item)}</p>) : <EmptyState text="暂无明确风险证据。" />}
        </div>
      </div>
    </div>
  );
}

function Timing({ model }: { model: VisualModel | null }) {
  return (
    <div className="ly-card">
      <div className="ly-card-title">
        <span>VIS-LY-010</span>
        <strong>时间线索</strong>
      </div>
      <div className="ly-timeline">
        {(model?.items ?? []).map((item: VisualModel, index: number) => (
          <div key={`timing-${item.title ?? index}`}>
            <span>{index + 1}</span>
            <strong>{item.title ?? item.window ?? "候选窗口"}</strong>
            <p>{item.text ?? item.explanation}</p>
          </div>
        ))}
      </div>
      <small className="ly-policy">时间只作为候选观察窗口，不是保证日期。</small>
    </div>
  );
}

export function LiuyaoVisualSystemPanel({ visualization }: { visualization?: LiuyaoVisualizationBundle | null }) {
  if (!visualization?.viewModels) return null;

  const board = visual(visualization, "VIS-LY-001");
  return (
    <section className="panel report-section ly-visual-system" aria-labelledby="liuyao-visual-system-title">
      <div className="ly-section-head">
        <div>
          <p className="eyebrow">Liuyao Visual System</p>
          <h2 id="liuyao-visual-system-title">六爻视觉解读</h2>
          <p className="section-kicker">同一份事实驱动盘面、焦点、世应、动变、证据和时间线索；视觉层只展示，不重新判断。</p>
        </div>
        <div className="ly-readiness">
          <span>{visualization.packageStatus ?? "DATA_IMPORTED"}</span>
          <strong>{visualization.readiness ?? "P0_READY_WITH_EXPORT_ALIGNMENT_PENDING"}</strong>
        </div>
      </div>

      <div className="ly-primary-layout">
        <SixLineBoard model={board} />
        <div className="ly-side-stack">
          <PrimaryChanged model={visual(visualization, "VIS-LY-002")} />
          <FocusPanel yongshen={visual(visualization, "VIS-LY-004")} shiYing={visual(visualization, "VIS-LY-005")} />
        </div>
      </div>

      <div className="ly-layer-tabs" aria-label="移动端视觉层级">
        <span>盘面</span>
        <span>焦点</span>
        <span>状态</span>
        <span>证据</span>
      </div>

      <div className="ly-visual-grid">
        <CastingSequence model={visual(visualization, "VIS-LY-003")} />
        <SixRelations model={visual(visualization, "VIS-LY-006")} />
        <StrengthMatrix model={visual(visualization, "VIS-LY-007")} />
        <Dynamics model={visual(visualization, "VIS-LY-008")} />
        <EvidenceConflict model={visual(visualization, "VIS-LY-009")} />
        <Timing model={visual(visualization, "VIS-LY-010")} />
      </div>
    </section>
  );
}
