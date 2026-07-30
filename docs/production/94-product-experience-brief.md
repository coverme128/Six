# Liuyao & Meihua Product Experience Brief

Status: `ORIENTAL_PROFESSIONAL_EXPERIENCE_READY`

This brief records the product experience contract for the public Web application after the monorepo and PostgreSQL migration. It applies to `apps/web` and consumes the P4-X presentation bundle from the API.

## Experience Vision

Users should not need to understand the full Liuyao or Meihua professional structure before gaining value. The product first helps them understand the current situation, strongest support, strongest obstacle, likely change direction, and next action. When they need depth, the same report lets them expand professional evidence and related knowledge without entering an internal debugging surface.

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

- a first-screen casting workbench rather than a marketing page;
- guided report preview and report detail sections;
- a visible trust chain for deterministic charting, calendar, CORE_V1, evidence aggregation, and AI expression;
- collapsible professional evidence and content limitations;
- user-facing history, content, and settings language;
- calm paper/ink/stone/jade CSS tokens and responsive layout constraints.
