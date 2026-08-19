# Liuyao Public Beta Commercial Readiness

Last reviewed: 2026-08-19

Status: `LOCAL_SCOPE_COMPLETE_PRODUCTION_RELEASE_GATES_OPEN`

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
-> beginner entry or real-world topic
-> article/topic explanation
-> six-stage guided learning path
-> related content
-> Liuyao workbench
```

The hub must remain task-oriented and scannable. It must not degrade into a flat list of all repository content or expose ingestion metadata.

## Implemented Evidence

### Experience and content

- Homepage primary actions: `开始六爻分析` and `进入学习中心`.
- Direct shortcuts: relationship, career, wealth, and business.
- Relationship-specific Guided presentation implemented without modifying formal assessment facts.
- Dedicated Learn Hub implemented with starter content, six topic entries, learning columns, filters, and progressive disclosure.
- Six topic landing pages and one six-stage guided learning path are `PUBLICATION_READY`.
- Batch content: 445 Liuyao entries.
- Runtime catalog: 603 entries including 158 system seed entries.
- Public entries: 421.
- Historical Meihua seed records: 11, all non-public and outside the 421 public entries.
- Content QA: 0 errors, 0 warnings, 0 isolated, 0 missing incoming links, 0 missing outgoing links.

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
| HTTPS staging | Open | Deployed Web/API/Worker with stable URLs and secrets outside Git |
| Dependency readiness | Open | PostgreSQL and Redis configured; `/ready` returns 200 only when both are usable |
| Live AI provider | Open | Eight-case smoke with successful outputs reporting `OPENAI_LIVE`; fallback remains valid |
| Static report export | Complete locally | SVG/print/PDF generated from the same visualization ViewModels as the Web report |
| Visual regression | Complete locally | Approved snapshots for homepage, report, Learn Hub, article, glossary, and P1 visuals at desktop and 360/390/430 mobile |
| Accessibility | Complete locally | Keyboard flow, screen-reader summary, semantic roles, focus controls, reduced-motion, and non-color semantics verified |
| Performance | Open | Staging Web Vitals, image caching, route payload, and long-content performance evidence |
| Observability | Open | Error, readiness, AI fallback, content CTA, and report-creation monitoring with no sensitive payload leakage |
| Legacy boundary | Open | Meihua endpoints removed or explicitly isolated and covered as internal compatibility |

## Stop Lines

- Do not label local UI completion as `PRODUCTION_READY`.
- Do not expose `REVIEW_REQUIRED` or `DEMO_ONLY` content in production public APIs or sitemap.
- Do not add a new divination method to the public navigation without a new product decision.
- Do not let scenario UI reinterpret or recompute deterministic findings.
- Do not use editorial AI images to encode real chart facts.
- Do not report exact timing as guaranteed.
- Do not weaken `/ready` to appear healthy when required production dependencies are absent.

## Next Execution Order

1. Complete HTTPS staging with PostgreSQL, Redis, and live provider smoke.
2. Add production performance, caching, observability, and real-device evidence.
3. Resolve the backend Meihua compatibility boundary in a separately approved migration.

## Source Documents

- `docs/project-context-brief.md`
- `docs/production/61-core-value-scope-and-stop-line.md`
- `docs/production/94-product-experience-brief.md`
- `docs/production/95-ux-interaction-design-spec.md`
- `docs/content-growth/integration/full-content-growth-integration-report.md`
- `LIUYAO_VISUAL_SYSTEM_IMPLEMENTATION_REPORT.md`
- `data/liuyao/visual-system/qa/final-visual-readiness-report.md`
