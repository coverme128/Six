# Liuyao Visual System Repository Audit

Audit date: 2026-08-12

Package: `/Users/goterra/Downloads/liuyao-visual-system-and-asset-orchestration-v1.0.zip`

Instruction source: `/Users/goterra/Downloads/Codex 执行任务｜Liuyao Visual System & Asset Orchestration v1.0 集成.md`

## Executive Summary

The repository already has a strong Liuyao deterministic and presentation foundation: chart casting, ProductResultFacts, Guided/Professional ViewModels, public report APIs, content snippets, and 68 existing content visuals are present. The main gap is that Liuyao has not yet been elevated into the package-defined registered visual system.

Current report rendering includes a local `ChartPanel` table, but it is not a canonical VIS-LY visual component, does not consume a dedicated Visualization ViewModel layer, and is not orchestrated across Guided, Professional, Report, Content, and Static Export contexts.

Production readiness must not be claimed yet. The correct status before implementation is `DATA_IMPORTED / READY_WITH_ALIGNMENT_PENDING`.

## Audit Matrix

| # | Area | Status | Evidence | Required Action |
|---|---|---|---|---|
| 1 | Liuyao casting and line facts | EXISTING | `packages/domain/src/domain/liuyaoEngine.ts` normalizes six bottom-to-top lines and produces line facts. | Preserve untouched. |
| 2 | Original/changed hexagram data | EXISTING | Chart facts expose original/changed hexagram, moving lines, Shi/Ying, and line metadata. | Map into VIS-LY-001/002 only. |
| 3 | ProductResultFacts | EXISTING | `packages/domain/src/domain/presentation/productResultFacts.ts` builds Liuyao product facts. | Use as canonical source for visual VMs. |
| 4 | DivinationResultFacts | EXISTING | `packages/domain/src/domain/presentation/divinationResultFacts.ts` exists for shared presentation contracts. | Do not alter rule semantics. |
| 5 | Guided ViewModel | EXISTING | `guidedViewModel.ts` powers user-facing summary and actions. | Attach Liuyao visualization bundle for Liuyao reports. |
| 6 | Professional ViewModel | EXISTING | `professionalViewModel.ts` exposes audit chain, evidence, timing, and knowledge refs. | Attach density-aware professional visual contexts. |
| 7 | Yongshen selection source | EXISTING | Product facts and observation focus expose selected role/focus without user confirmation. | VIS-LY-004 must display supplied evidence, not select Yongshen. |
| 8 | Shi/Ying source | EXISTING | Public chart view exposes `worldLine`, `responseLine`, `isWorld`, `isResponse`. | VIS-LY-005 and board labels can bind directly. |
| 9 | Six relations role map | EXISTING | Line records expose `sixRelationName`; role context exists in Guided/Professional. | Build VIS-LY-006 VM from existing labels. |
| 10 | Strength/state facts | PARTIAL | Month/day/void/return influence and evidence groups exist; no dedicated matrix visual VM. | Build VIS-LY-007 as presentation matrix without scoring. |
| 11 | Dynamic transformation facts | PARTIAL | Moving lines and changed line text exist; no registered flow visual. | Build VIS-LY-008 from supplied moving/change facts only. |
| 12 | Evidence/conflict facts | EXISTING | Product facts expose conflict/evidence resolution and grouped evidence. | VIS-LY-009 displays resolution state after rules resolve it. |
| 13 | Timing facts | EXISTING | Guided timing hint and Professional timing candidates are present. | VIS-LY-010 displays candidate windows with uncertainty language. |
| 14 | Pattern facts | EXISTING | Professional audit chain exposes pattern name and overall assessment. | P1 VIS-LY-012 can use these facts later. |
| 15 | Existing 68 content visuals | EXISTING | `apps/web/public/content-growth/visuals/*.svg` and `data/content-growth/visual-assets.json`. | Preserve IDs and map via package canonicalization. |
| 16 | Batch/content package storage | EXISTING | Batch content and content-growth data are already stored in repo data/content paths. | Keep content visuals separate from product visuals. |
| 17 | Visual design tokens | PARTIAL | `apps/web/app/globals.css` has local tokens but not package canonical tokens. | Add LIUYAO Visual System tokens and semantic color aliases. |
| 18 | Mobile/responsive behavior | PARTIAL | Existing report CSS collapses table rows but lacks Liuyao layer switcher/bottom-sheet pattern. | Add mobile-specific visual hierarchy for board/evidence. |
| 19 | Static/PDF export | PARTIAL | Public export is JSON/Markdown oriented; no same-VM static SVG/PDF provider. | Mark design-ready unless a renderer is implemented. |
| 20 | Tests | PARTIAL | Domain/presentation tests exist; no VIS-LY contract/responsive/static tests. | Add ViewModel contract tests and report integration checks. |
| 21 | Meihua surface | CONFLICT | UI/API/domain still support Meihua; latest product direction says only keep Liuyao. | Do not extend Meihua. New VIS-LY system is Liuyao-only. |

## P0 Gap

P0 is not more data ingestion. The package is complete enough to implement from local facts. The work needed is code alignment:

- Add a Liuyao Visualization ViewModel layer under presentation.
- Register VIS-LY-001 through VIS-LY-014 with P0/P1 priority and context metadata.
- Implement P0 components VIS-LY-001 through VIS-LY-010 in the report UI.
- Route report API public experience to include visualization facts for Liuyao.
- Replace the ad hoc report chart table with canonical Liuyao visuals.
- Add canonical tokens, semantic encodings, reduced-motion support, and mobile-specific layouts.
- Preserve existing content visuals and attach canonicalization metadata.
- Add tests that confirm visuals consume facts without recalculating casting, Yongshen, strength, dynamics, conflict, or timing.

## Non-Goals

- No edits to CAL_STD_V1, CORE_V1, Yongshen rules, strength rules, dynamic rules, pattern rules, timing rules, or action guidance logic.
- No deterministic visual facts from AI images.
- No deletion or renaming of existing Bxx content visual IDs.
- No production-ready claim before full staging validation, visual regression, accessibility, and export coverage.

## Starting Status

`READY_WITH_ALIGNMENT_PENDING`

