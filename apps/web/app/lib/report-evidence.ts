import type { ChartViewModel } from "./api";

export type EvidenceSource = { ref: string; title: string; kind: "盘面事实" | "规则解释" | "观察窗口"; text: string; lines: number[] };
type RecordValue = Record<string, any>;
const positions = (values: unknown[]) => [...new Set(values.filter((n): n is number => Number.isInteger(n) && Number(n) >= 1 && Number(n) <= 6))];

function findingLines(facts: RecordValue = {}): number[] {
  return positions([facts.linePosition, facts.sourceLine, facts.targetLine,
    ...(facts.linePositions ?? []), ...(facts.originLinePositions ?? []),
    ...(facts.tabooLinePositions ?? []), ...(facts.targetLinePositions ?? []),
    ...(facts.roles ?? []).flatMap((role: RecordValue) => role.linePositions ?? [])]);
}

// Resolve stored identifiers only. Never infer a line number from AI prose or a rule name.
export function resolveReportEvidence(refs: string[], chart: ChartViewModel | undefined, raw: RecordValue | null) {
  const result = raw?.result ?? {};
  const facts = result.productResultFacts ?? raw?.experience?.productResultFacts ?? {};
  const nodes = facts.evidenceGraph?.nodes ?? [];
  const findings = [...(result.findings ?? []), ...(result.report?.evidence ?? [])];
  // v9 numbers the exact provider list after excluding role-selection rules.
  const providerFindings = (result.chart?.questionProfile?.profileVersion === "LIUYAO_QUESTION_PROFILE_V2"
    ? result.findings ?? result.report?.evidence ?? [] : result.report?.evidence ?? [])
    .filter((item: RecordValue) => item.rule_type !== "yongshen");
  const sources: EvidenceSource[] = [];
  const unresolved: string[] = [];
  const lines = chart?.type === "liuyao" ? chart.lines ?? [] : [];
  const moving = chart?.type === "liuyao" ? chart.movingLines ?? [] : [];
  const all = positions(lines.map(line => line.position));
  for (const ref of [...new Set(refs)]) {
    const base = { ref, kind: "盘面事实" as const };
    const providerFinding = raw?.aiReportBundle?.promptVersion === "liuyao-report-v9" && /^evidence:[1-9]\d*$/.test(ref)
      ? providerFindings[Number(ref.slice(9)) - 1] : null;
    if (providerFinding) {
      sources.push({ ref, kind: "规则解释", title: providerFinding.rule_code ?? "命中规则", text: providerFinding.summary,
        lines: findingLines(providerFinding.inputFacts ?? providerFinding.input_facts) });
      continue;
    }
    if (chart?.type === "liuyao" && ref.startsWith("chart:")) {
      const known: Record<string, { title: string; text: string; lines: number[] }> = {
        "chart:original_hexagram": { title: "本卦", text: chart.originalHexagram ?? "未记录", lines: all },
        "chart:changed_hexagram": { title: "动变", text: moving.length ? `${chart.originalHexagram} → ${chart.changedHexagram}` : "静卦，无变卦", lines: moving },
        "chart:moving_lines": { title: "动爻", text: moving.length ? `第 ${moving.join("、")} 爻发动` : "六爻皆静，无动爻", lines: moving },
        "chart:world_response": { title: "世应", text: `世爻：第 ${chart.worldLine} 爻；应爻：第 ${chart.responseLine} 爻`, lines: positions([chart.worldLine, chart.responseLine]) },
        "chart:line_facts": { title: "六爻记录", text: "本条引用完整六爻盘面，未指定单一爻位。", lines: all },
      };
      if (known[ref]) { sources.push({ ...base, ...known[ref] }); continue; }
    }
    const node = nodes.find((item: RecordValue) => item.id === ref);
    if (node) {
      const related = (node.factRefs ?? []).flatMap((fact: string) => /^line:[1-6]$/.test(fact) ? [Number(fact.slice(5))] : fact === "chart:moving_lines" ? moving : []);
      sources.push({ ref, kind: "规则解释", title: node.ruleId ?? "综合证据", text: node.meaning, lines: positions(related) });
      continue;
    }
    const matched = findings.filter((item: RecordValue) => ref === `rule:${item.rule_code}` || ref === `finding:${item.id}` || ref === `evidence:${item.id}`);
    if (matched.length) {
      sources.push({ ref, kind: "规则解释", title: matched[0].rule_code ?? "命中规则", text: [...new Set(matched.map((item: RecordValue) => item.summary))].join("；"), lines: positions(matched.flatMap((item: RecordValue) => findingLines(item.input_facts ?? item.inputFacts))) });
      continue;
    }
    const calendar = result.chart?.calendar;
    const calendarText: Record<string, string | undefined> = {
      "calendar:month_build": calendar?.monthBuild?.branchName,
      "calendar:day_chen": calendar?.dayChen?.branchName,
      "calendar:xun_kong": Array.isArray(calendar?.xun?.voidBranchNames) ? calendar.xun.voidBranchNames.join("、") : calendar?.xun?.voidBranchNames,
    };
    if (calendarText[ref]) {
      sources.push({ ...base, title: ({ "calendar:month_build": "月建", "calendar:day_chen": "日辰", "calendar:xun_kong": "旬空" })[ref]!, text: calendarText[ref]!, lines: [] });
      continue;
    }
    const timing = /^timing:[1-9]\d*$/.test(ref) ? result.timingCandidates?.[Number(ref.slice(7)) - 1] : null;
    if (timing) { sources.push({ ref, title: "候选观察窗口", kind: "观察窗口", text: [timing.window, timing.limitation].filter(Boolean).join("；"), lines: [] }); continue; }
    unresolved.push(ref);
  }
  return { sources, unresolved, lines: positions(sources.flatMap(source => source.lines)) };
}
