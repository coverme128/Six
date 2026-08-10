# Six Project Context Brief

Last reviewed: 2026-08-09

## One-Line Summary

Six is a TypeScript monorepo for Liuyao and Meihua divination products. Its first production-facing scope is a deterministic, auditable CORE_V1 rule system, with a public web workbench, report history/detail, grounded AI expression, content framework, Prisma persistence, and worker-backed AI jobs.

## Current Status

- Active stack: `pnpm@9.15.4`, Turborepo, TypeScript, Next.js 15, React 19, NestJS 10, Prisma/PostgreSQL, Redis/BullMQ, Zod, Vitest, Playwright.
- CORE_V1 status: production whitelist implemented and locally validated.
- Local product status: W1 local-only product scope is complete.
- Calendar status: `CAL_STD_V1` is accepted for Public Beta P1 and used by new Liuyao reports.
- AI status: grounded AI report code is implemented locally, but real OpenAI live smoke is still pending.
- Content status: content/SEO/growth framework is ready locally, but no real `PUBLICATION_READY` public content package has been imported.
- Staging status: local staging foundation exists, but HTTPS staging deployment evidence and live AI smoke remain pending.

## Product Boundary

The first product scope is not a full recreation of every traditional Liuyao rule. It is a controlled Public Beta scope focused on six user values:

1. Current situation.
2. Whether the situation favors the user.
3. Supporting factors.
4. Blocking factors.
5. Direction of change.
6. Candidate timing windows.

CORE_V1 must stay stable, traceable, and bounded. Advanced rules can exist as candidate data, but they are not loaded into production unless a later phase explicitly promotes them.

## Rule Boundary

Production execution loads only `data/production/core-v1-*.json` through `data/production/core-v1-rule-profile.json`.

CORE_V1 production units:

| Area | Count |
| --- | ---: |
| Question / yongshen mappings | 45 |
| Strength rules | 24 |
| Dynamic rules | 14 |
| Pattern and relationship rules | 47 |
| Timing and guardrail rules | 18 |
| Total | 148 |

Important guardrails:

- `REVIEW_REQUIRED` and `DEPRECATED` rules must not execute.
- Candidate `*-pro.json` pools are traceability sources only.
- Findings must preserve rule code, input facts, version, and output role.
- AI may explain validated facts, but must not create findings, timing, chart facts, or judgment ownership fields.
- Health and legal scenarios must keep non-diagnostic / non-decisive safety language.

## Runtime Architecture

```text
apps/web
  Next.js public workbench, report history/detail, content, settings, export

apps/admin
  Next.js internal admin shell, still mostly reserved for later governance work

apps/api
  NestJS API under /api/v1, creates reports, stores history, serves experience bundles,
  content, settings, export, and AI generation endpoints

apps/worker
  BullMQ worker for generate-ai-report jobs

packages/domain
  Deterministic Liuyao/Meihua engines, calendar, CORE_V1 loader, report aggregation,
  AI input/fidelity/safety pipeline, and P4-X presentation contracts

packages/database
  Prisma schema and seed path for reports, settings, and content entries

packages/queue
  Redis/BullMQ queue helper package

packages/shared
  Shared Zod schemas and product constants
```

Main data flow:

```text
User input
  -> Nest API validation
  -> @six/domain deterministic chart
  -> narrative report builder
  -> P4-X experience bundle
  -> Prisma persistence when DATABASE_URL exists
  -> memory fallback when database is absent or unavailable
  -> Next Web Guided / Professional UI
```

AI flow:

```text
Saved deterministic report
  -> grounded AI input construction
  -> provider from env, mock fallback available locally
  -> schema validation
  -> fact fidelity validation
  -> safety validation
  -> persisted aiReport bundle
  -> rebuilt experience bundle
```

## Public API Shape

The Nest app sets global prefix `api/v1`.

Key routes:

- `GET /api/v1/health`
- `GET /api/v1/ready`
- `GET /api/v1/metadata`
- `POST /api/v1/liuyao/charts`
- `POST /api/v1/meihua/charts`
- `GET /api/v1/reports`
- `GET /api/v1/reports/:id`
- `GET /api/v1/reports/:id/experience`
- `GET /api/v1/reports/:id/export`
- `POST /api/v1/reports/:id/ai`
- `POST /api/v1/reports/:id/ai/jobs`
- `GET /api/v1/content`
- `GET /api/v1/content/search`
- `GET /api/v1/content/:contentType/:slug`
- `GET /api/v1/knowledge`
- `GET /api/v1/settings`
- `PUT /api/v1/settings`

Public errors are normalized as `{ code, message, traceId }`.

## Web Experience Contract

The public app should feel clear, calm, ordered, trustworthy, restrained, and actionable.

Core principles:

- Start with the real casting workbench, not a marketing page.
- Show conclusion before details.
- Keep deterministic facts, rule judgment, and AI expression visibly separated.
- Translate professional concepts before exposing deep evidence.
- Put professional evidence and related knowledge on demand.
- Do not expose raw JSON, provider debug, prompt versions, internal IDs, request IDs, stack traces, or Admin ViewModels in public UI.

Current public pages:

- `/` casting workbench.
- `/history` report history.
- `/reports/[id]` Guided and Professional report detail.
- `/content` content and knowledge browsing.
- `/content/[type]/[slug]` content detail.
- `/settings` public runtime settings.

## Data And Persistence

Prisma models currently cover:

- anonymous devices
- reports
- content entries
- usage events
- app settings

When `DATABASE_URL` is configured, reports/settings/content are Prisma-backed. Without PostgreSQL, the API keeps anonymous beta flows available through memory fallback.

Local infrastructure:

- PostgreSQL 16 on `localhost:5434`
- Redis 7 on `localhost:6381`

## Validation And Test Commands

Common commands:

- `pnpm run validate:v13` validates the CORE_V1 production whitelist.
- `pnpm run validate` runs CORE_V1 validation, typecheck, domain tests, and API contract tests.
- `pnpm run validate:p1` adds calendar fixture generation.
- `pnpm run validate:p2` adds Playwright E2E.
- `pnpm run validate:p4-framework` adds content rehearsal, QA, SEO, and E2E.
- `pnpm run validate:experience` checks presentation contracts and E2E experience coverage.
- `pnpm run smoke:ai:live` requires `OPENAI_API_KEY`; without it, it should skip.

Current local check performed during this review:

```text
pnpm run validate:v13
V1.3 CORE SCOPE VALIDATION PASSED
counts: [45, 24, 14, 47, 18]
total: 148
fixtures: 168
```

Playwright default ports differ from `.env.example`:

- E2E API: `http://127.0.0.1:4100/api/v1`
- E2E Web: `http://127.0.0.1:3200`
- Normal local API default: `4000`
- Normal local Web default: `3000`

## Known Pending Work

- Run real OpenAI live smoke with secure `OPENAI_API_KEY` and confirm `reportSource = OPENAI_LIVE` for successful outputs.
- Deploy HTTPS staging and verify `/health`, `/ready`, protected internal status, E2E, and live AI checks.
- Import a real `PUBLICATION_READY` content package for public indexed content.
- Build protected Admin governance workflows.
- Add auth, RBAC, payment, subscription, or CMS only when a later phase explicitly authorizes it.
- Move fuller historical report visual coverage into `apps/web`.
- Keep AdminViewModel and internal presentation behind protected/internal surfaces.

## Watch Points For Future Work

- Do not promote candidate/pro/review rules while doing UI, API, or migration work.
- Do not move deterministic rule knowledge or chart algorithms into the database as executable logic.
- Do not let Web components re-rank or reinterpret deterministic findings; consume the P4-X bundle.
- Do not expose internal identifiers, raw RuleCode, provider metadata, prompt versions, or raw facts in public report views.
- Keep AI fallback usable; AI failure must not mark the deterministic report failed.
- Be careful with docs that still mention old route shapes such as `/api/content`; the current Nest prefix is `/api/v1`.
- `.env.example` must remain placeholders only and must not contain real secrets.

## Primary Source Documents

- `README.md`
- `docs/production/61-core-value-scope-and-stop-line.md`
- `docs/production/62-core-v1-rule-whitelist-contract.md`
- `docs/production/63-report-aggregation-and-evidence-budget.md`
- `docs/production/64-rule-lifecycle-and-feature-flags.md`
- `docs/production/65-core-v1-acceptance.md`
- `docs/production/70-calendar-provider-decision-record.md`
- `docs/production/80-p2.1-p3a-staging-runbook.md`
- `docs/production/90-p4-content-seo-growth-framework.md`
- `docs/production/92-monorepo-typescript-stack-migration.md`
- `docs/production/93-p4x-upgrade-architecture-realignment.md`
- `docs/production/94-product-experience-brief.md`
- `docs/production/95-ux-interaction-design-spec.md`
- `docs/audit/liuyao-core-product-closure-report.md`
- `docs/data/liuyao-core-interpretation-binding-audit.md`
