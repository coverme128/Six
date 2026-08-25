# P4-X Product Presentation and UX Orchestration

Status: `PRODUCT_PRESENTATION_UX_ORCHESTRATION_READY` + `P4X_ARCHITECTURE_REBASE_READY`

This phase reorganizes existing deterministic chart, calendar, CORE_V1, evidence, timing, AI, and content facts into product-facing presentation contracts. It does not alter CAL_STD_V1, deterministic divination, CORE_V1 rule scope, AI fact validation, or timing semantics.

## Gap Audit

Before P4-X, report presentation logic was spread across the browser report route, narrative rendering helpers, evidence cards, timing cards, Meihua-specific cards, AI card rendering, history labels, and error panels. Page priority mostly followed source array order and component order. Rule codes, method codes, report versions, provider status, and evidence references could appear in user-facing report UI through legacy renderers or AI card details.

The implemented fix introduces a formal facts-to-viewmodel pipeline:

```text
Domain result
→ DivinationResultFacts
→ priority + dedup + terminology formatting
→ GuidedViewModel / ProfessionalViewModel / AdminViewModel
→ UI
```

## Architecture Rebase

The original P4-X upgrade package was written before the project moved to the pnpm/Turborepo, Next.js, NestJS, Prisma, PostgreSQL, Redis, and BullMQ architecture. The upgrade still applies, but its runtime boundary is now:

```text
apps/web / apps/admin
        ↓
apps/api NestJS endpoints
        ↓
packages/domain deterministic engines + P4-X presentation
        ↓
packages/database Prisma persistence
        ↓
apps/worker BullMQ AI regeneration path
```

`packages/domain/src/domain/presentation` remains the only implementation owner for DivinationResultFacts, priority, deduplication, terminology, ViewModels, visibility, and page experience contracts. Next.js pages and NestJS controllers consume the built experience bundle; they do not recalculate product priority or expose raw domain/debug fields.

When PostgreSQL is configured, `reports.experience` stores the generated P4-X bundle alongside the deterministic result and narrative report. The stored bundle is a cached presentation artifact. The source of truth remains the deterministic `result`, `narrativeReport`, validated `aiReport`, and versioned domain code. When the Worker updates `reports.aiReport`, it attaches the AI bundle to `result.aiReportBundle`, rebuilds the P4-X experience bundle through `buildExperienceBundle`, and writes both back through Prisma.

This means the upgrade requires documentation and contract updates after the architecture migration, but does not require changes to CAL_STD_V1, deterministic Liuyao/Meihua charting, CORE_V1 rules, AI fact validation, or timing semantics.

## Product Facts

`DivinationResultFacts` is built from existing chart facts, calendar facts, rule findings, narrative report sections, timing candidates, knowledge references, and AI report state. It only maps and normalizes existing facts. It does not recalculate hexagrams, calendar data, useful-god logic, rule matches, evidence, or timing windows.

Liuyao facts map original and changed hexagrams, moving lines, world/response lines, method, findings by dimension, narrative sections, timing candidates, and knowledge references. Meihua facts map original, mutual, and changed hexagrams, body/use trigrams, relationship, method, narrative sections, timing candidates, and knowledge references.

## Priority And Dedup

The result priority engine assigns:

```text
P0: headline-driving outcome and method/chart anchors
P1: signals that directly affect the current question
P2: supporting explanation and professional context
P3: internal or deep evidence
```

Guided mode shows P0 plus the strongest P1 signals, capped to avoid repetitive lists. Professional mode includes P0/P1 plus necessary P2 context. Admin mode can inspect the complete facts bundle.

The evidence deduplicator merges repeated user-facing signals by normalized text, polarity, and dimension. Merged entries keep their child `sourceRefs`, so presentation dedup never deletes underlying evidence.

## Terminology

The terminology registry contains 41 entries:

```text
calendar: 5
chart: 4
liuyao: 8
meihua: 3
method: 6
relationship: 7
status: 8
```

Formatters cover status, findings, evidence, timing, relationships, methods, and public errors. Unknown values fall back to user-readable text instead of raw internal codes.

## ViewModels

GuidedViewModel contains headline, summary, current situation, main supports, main risks, change direction, timing hint, recommended actions, simplified evidence, and next actions. It excludes rule codes, raw JSON, provider details, prompt versions, request IDs, and internal versions.

ProfessionalViewModel contains chart summary, relationships, grouped evidence, timing candidates, and knowledge references. It is intended for deeper reading, not developer debugging, and still excludes provider debug, prompt versions, stack traces, and raw JSON.

AdminViewModel contains raw fact references and source versions. It is only returned by protected `/internal/*` presentation routes or explicit internal construction.

## Page Contracts

Formal page experience contracts now cover:

```text
casting.liuyao
casting.meihua
report.detail
history
content.knowledge
content.tutorial
```

Each contract defines page goal, primary question, primary action, visual hierarchy, default state, loading, empty, error, and mobile-relevant behavior. The report page contract prioritizes: headline, current situation, main supports, main risks, change direction, and recommended actions.

## State And Visibility

The shared state contract now covers the full upgrade-package state set plus the existing anonymous-report extensions:

```text
INITIAL
LOADING
PARSING
NEEDS_CONFIRMATION
PROCESSING
PARTIAL
COMPLETED
EMPTY
LOCKED
UNAUTHORIZED
FORBIDDEN
FAILED
EXPIRED
ARCHIVED
NOT_FOUND
DELETED
```

Every state defines the user message, available action, retry behavior, input preservation, and fallback behavior.

Visibility remains:

```text
Guided: user summary and simplified evidence
Professional: chart structure and professional evidence
Admin/Internal: raw facts, versions, provider, validation, debug
```

No payment, entitlement, login, or RBAC is introduced by P4-X. The new Admin app and Prisma database exist as platform architecture, but public report presentation still defaults to Guided and Professional surfaces only. AdminViewModel must remain behind internal routes or future protected Admin surfaces.

## UX QA

`pnpm run validate:experience` covers:

```text
Internal leakage scan
Public/internal presentation separation
Duplicate presentation QA
Next action presence
10-second guided comprehension surface
Mobile comprehension at 360, 390, and 430 widths
```

The public report page now leads with the conclusion and next actions, folds professional evidence behind a details control, and keeps AI fallback flowing through the same product presentation surface.

## Verification

Run:

```bash
pnpm run validate:experience
pnpm run validate
pnpm run test:e2e
```

`pnpm run smoke:ai:live` remains dependent on the selected provider key; the current DeepSeek path uses `DEEPSEEK_API_KEY` and skips rather than blocking local P4-X validation when absent.

## Deferred Scope

After the monorepo migration, PostgreSQL/Prisma persistence, the Next.js Web shell, NestJS API, Redis/BullMQ Worker, and the Admin shell exist. They are architecture capabilities, not new P4-X fact rules.

Still deferred from the P4-X contract:

```text
Protected production Admin workflows
Login, RBAC, paid access, and subscriptions
Advanced Rules and Review Rules
New calendar algorithms
New divination algorithms
New CORE_V1 rules
Real PUBLICATION_READY content package import
Production OpenAI live smoke with secrets and HTTPS staging
```

The next product-content phase remains `P4-B | Production Content Package Import`; the next platform hardening phase is protected Admin/auth/RBAC only when explicitly authorized.
