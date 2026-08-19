# Liuyao Product Experience Brief

Status: `LIUYAO_PUBLIC_BETA_EXPERIENCE_READY_LOCAL`

This brief records the product experience contract for the public Web application after the monorepo and PostgreSQL migration. It applies to `apps/web` and consumes the P4-X presentation bundle from the API.

## Experience Vision

Users should not need to understand the full Liuyao professional structure before gaining value. The product first helps them understand the current situation, strongest support, strongest obstacle, likely change direction, and next action. When they need depth, the same report lets them expand professional evidence and related knowledge without entering an internal debugging surface.

The active public product is Liuyao-only. Relationship, career, wealth, business, exam/job search, and travel are user-entry scenarios inside one Liuyao product, not separate engines or competing methods.

The desired feeling is:

```text
Clear
Calm
Ordered
Trustworthy
Restrained
Actionable
```

## Product Mental Model

This product is:

```text
Professional charting tool
+
Rule-based analysis system
+
AI plain-language explanation layer
```

This product is not:

```text
AI free-chat fortune telling
```

The AI layer may explain, summarize, and organize validated facts. It must not define chart facts, change deterministic findings, invent timing, or replace rule evidence.

## Experience Promises

1. Conclusion before details.
2. Priority before completeness.
3. Deterministic facts, rule judgment, and AI expression stay visibly separated.
4. Professional concepts are translated before they become blockers.
5. Evidence is available on demand, not forced into the first view.
6. Every result offers a next action.
7. Failure keeps the core chart/report readable and preserves user input where possible.

## Result Hierarchy

Public report pages follow:

```text
Conclusion
↓
Key factors
↓
Evidence
↓
Professional structure
```

The public UI must not expose raw JSON, provider debug, prompt versions, stack traces, or internal admin view models.

For relationship questions, the first result layer additionally follows:

```text
Relationship direction
↓
Self-side signal
↓
Other-side / interaction signal
↓
Immediate decision focus
↓
Professional evidence and boundaries
```

This scenario layer translates existing deterministic facts. It must not recompute strength, assign people to Shi/Ying without supplied context, invent the other party's intent, or turn timing candidates into promises.

## Visual Direction

The visual system uses modern professional UI language with restrained Eastern influence:

```text
Paper
Ink
Stone
Jade
Muted Vermilion
```

Eastern quality comes from order, spacing, rhythm, weak borders, calm contrast, precise copy, and clear hierarchy. It does not come from large decorative motifs, red/gold dominance, mystical effects, or calligraphy-heavy UI.

## Current Implementation

`apps/web/app` now implements this brief through:

- a value-led first screen that states the user outcome before exposing method detail;
- primary entry actions for Liuyao analysis and the Learn Hub;
- a three-screen question journey: choose a scenario, write one focused question, then complete casting;
- visually differentiated scenario cards organized by the user-facing domains `感情与合作 / 工作与钱 / 生活事务 / 健康与纠纷`, with immediate selection feedback;
- user-language outcome previews for direction, blockage, and next action instead of internal report labels;
- a visible AI boundary before casting, with detailed report traceability progressively disclosed at the same decision point;
- guided report preview and report detail sections;
- relationship-specific Guided presentation derived from the shared experience bundle;
- a goal-led Learn Hub with three user-intent entries, one interactive six-stage learning path, a fixed four-step report-reading course, six scenario-specific topic pages, and a module-filtered library;
- a visible trust chain for deterministic charting, calendar, CORE_V1, evidence aggregation, and AI expression;
- collapsible professional evidence and content limitations;
- user-facing history, content, and settings language;
- calm paper/ink/stone/jade CSS tokens and responsive layout constraints.

## Commercial Maturity Boundary

The current implementation is complete for local product validation, including static export parity, responsive visual regression, and screen-reader-summary/keyboard automation. It is not yet a commercial production release; HTTPS staging evidence, live provider smoke, configured dependency readiness, production performance, caching, observability, and real-device evidence remain open. The authoritative gate is `docs/production/96-liuyao-public-beta-commercial-readiness.md`.
