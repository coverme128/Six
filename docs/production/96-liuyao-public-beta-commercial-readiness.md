# Liuyao Public Beta Commercial Readiness

Last reviewed: 2026-09-10

Status: `LOCAL_PRODUCT_COMPLETE_CONTENT_AND_PRODUCTION_GATES_OPEN`

## Decision

The current product has reached a coherent local Public Beta P0 experience for the two primary user intentions:

1. Solve a concrete relationship, career, wealth, business, exam/job-search, or travel question through Liuyao.
2. Learn how Liuyao works through a designed Learn Hub and structured learning path.

This status does not authorize a commercial production launch. It means the public information architecture, core journeys, visual language, content entry points, and deterministic report presentation are ready for staging validation.

## Public Product Boundary

- Public brand and product: Liuyao only.
- Public creation flow: three-coin or manual six-line Liuyao casting.
- Public result flow: Guided conclusion, scenario translation where available, action guidance, professional evidence, and visual board.
- Public content flow: Learn Hub, topic landings, articles, knowledge, FAQ, and learning path.
- AI role: explain and organize validated facts; never own or alter deterministic judgment.
- Legacy Meihua code/API: backward compatibility only; not linked, promoted, or described as a public capability.

## P0 User Journeys

### Question-to-report

```text
Homepage value statement
-> scenario shortcut or direct workbench
-> focused question and casting input
-> deterministic report creation
-> conclusion and next action
-> visual/professional evidence on demand
-> related learning or history
```

Acceptance:

- Liuyao is the only visible method.
- User can start without reading a marketing page.
- Input survives retryable API failure where possible.
- First result is understandable before professional terminology.
- Public UI does not expose RuleCode, internal IDs, provider/debug fields, package states, or raw structured data.

### Relationship scenario

```text
Relationship entry
-> relationship question preselected
-> cast and analyze
-> relationship direction
-> self-side signal
-> other-side / interaction signal
-> immediate decision focus
-> evidence and boundaries
```

The scenario presentation must be a translation of supplied ProductResultFacts and classified evidence. It must not infer private intent, hard-code Shi/Ying as people, recompute rules, or promise an outcome.

### Learn-to-use

```text
Learn Hub
-> start, real-world problem, or deep-learning goal
-> article/topic explanation
-> currently available guided learning stage
-> related content
-> Liuyao workbench
```

The hub must remain task-oriented and scannable. It must not degrade into a flat list of all repository content or expose ingestion metadata.

## Implemented Evidence

### Experience and content

- Homepage primary actions: `开始六爻分析` and `进入学习中心`.
- Direct shortcuts: relationship, career, wealth, and business.
- Relationship-specific Guided presentation implemented without modifying formal assessment facts.
- Dedicated Learn Hub implemented with three goal-led entries, five knowledge-navigation destinations, 12 secondary learning collections, six supported topic entries, five currently visible learning stages, combined filters, and progressive disclosure.
- Six topic landing pages and one learning path are `PUBLICATION_READY`; collections appear only when their three linked records are Runtime-visible.
- Batch content: 445 Liuyao entries.
- Runtime catalog: 603 entries including 158 system seed entries.
- Commercial-finalization governance: 536/536 decisions, 457 canonical assets, 57 aliases, 15 removals, 7 internal-only decisions, and 1193 graph edges.
- Runtime states: 7 `PUBLICATION_READY`, 493 `REVIEW_REQUIRED`, 88 `INTERNAL_ONLY`, and 15 `DEFERRED`.
- Development-visible entries: 500. Beta/production-visible entries: 7. No article, knowledge card, or FAQ is currently production-visible.
- Historical Meihua records remain non-public.
- Content QA: 0 errors, 0 warnings, 0 isolated, one expected no-incoming-link Learn Hub root, and 0 missing outgoing links.

### Visual system

- 14 registered Liuyao report visualization contracts; all 10 P0 visuals integrated.
- 10 editorial asset families delivered as 23 final variants.
- 68 historical content SVGs individually art-directed across seven semantic layouts with stable IDs preserved.
- P0 and P1 report visuals integrated with progressive disclosure.
- Same-ViewModel SVG download and print/PDF output implemented.
- 72 social cards, 24 summary cards, 50 video covers/storyboards, and 12 collection documents generated.
- Public report removes visual implementation IDs and readiness-state leakage.
- Local browser checks completed at 1440px desktop and 390px mobile without horizontal overflow.

### Runtime readiness

- Production/beta readiness returns HTTP 503 when PostgreSQL or Redis dependencies are unavailable.
- Production content filtering exposes only `PUBLICATION_READY` entries.
- Production API and sitemap expose 7 entries; review/internal/alias/removed records and internal terminology are excluded.
- Deterministic report remains usable when AI falls back.

### Latest local validation

- `pnpm run test:experience`: passed, 9 tests.
- `pnpm run typecheck`: passed.
- `pnpm run content:qa`: passed with 0 errors and 0 warnings.
- `npm run build`: passed.
- Playwright visual regression: passed on desktop and 360/390/430 mobile.
- Accessibility/export automation: screen-reader summary, keyboard flow, semantics, SVG download, and PDF generation passed.
- `git diff --check`: passed at implementation completion.

## Production Release Gates

The product may be marked `PRODUCTION_READY` only after all P0 release gates below have evidence:

| Gate | Current state | Required evidence |
| --- | --- | --- |
| Commercial content review | Open | Resolve Batch 01 article review, Batch 02 editorial/domain review, 36 repeated FAQ sentence groups, and approve eligible records individually |
| HTTPS staging | Open | Deployed Web/API/Worker with stable URLs and secrets outside Git |
| Dependency readiness | Open | PostgreSQL and Redis configured; `/ready` returns 200 only when both are usable |
| Live AI provider | Complete locally | Five Liuyao scenarios validated with DeepSeek structured output, fact/evidence/safety/plain-language gates, automatic retry, and deterministic fallback; staging evidence remains open |
| Static report export | Complete locally | SVG/print/PDF generated from the same visualization ViewModels as the Web report |
| Visual regression | Complete locally | Approved snapshots for homepage, report, Learn Hub, article, glossary, and P1 visuals at desktop and 360/390/430 mobile |
| Accessibility | Complete locally | Keyboard flow, screen-reader summary, semantic roles, focus controls, reduced-motion, and non-color semantics verified |
| Performance | Open | Staging Web Vitals, image caching, route payload, and long-content performance evidence |
| Observability | Open | Error, readiness, AI fallback, content CTA, and report-creation monitoring with no sensitive payload leakage |
| Legacy boundary | Open | Meihua endpoints removed or explicitly isolated and covered as internal compatibility |

## Stop Lines

- Do not label local UI completion as `PRODUCTION_READY`.
- Do not expose `REVIEW_REQUIRED` or `DEMO_ONLY` content in production public APIs or sitemap.
- Do not bulk-promote the 240 editorially complete candidates without deterministic professional approval.
- Do not add a new divination method to the public navigation without a new product decision.
- Do not let scenario UI reinterpret or recompute deterministic findings.
- Do not use editorial AI images to encode real chart facts.
- Do not report exact timing as guaranteed.
- Do not weaken `/ready` to appear healthy when required production dependencies are absent.

## Next Execution Order

1. Complete independent editorial and Liuyao domain review; remove the remaining FAQ template repetition and promote approved records individually.
2. Complete HTTPS staging with PostgreSQL, Redis, and live provider smoke.
3. Add production performance, caching, observability, and real-device evidence.
4. Resolve the backend Meihua compatibility boundary in a separately approved migration.

## Source Documents

- `docs/project-context-brief.md`
- `docs/production/61-core-value-scope-and-stop-line.md`
- `docs/production/94-product-experience-brief.md`
- `docs/production/95-ux-interaction-design-spec.md`
- `docs/content-growth/integration/full-content-growth-integration-report.md`
- `docs/content-growth/LIUYAO_CONTENT_COMMERCIAL_CLOSURE_IMPLEMENTATION_REPORT.md`
- `LIUYAO_VISUAL_SYSTEM_IMPLEMENTATION_REPORT.md`
- `data/liuyao/visual-system/qa/final-visual-readiness-report.md`
