# SIX CORE_V1 Production Scope

Current architecture status: `PNPM_TURBO_TYPESCRIPT_STACK_READY` + `API_REPORT_STORE_BRIDGE_READY` + `NEXT_WEB_CAST_WORKBENCH_READY` + `NEXT_WEB_HISTORY_DETAIL_READY` + `NEXT_WEB_CONTENT_SETTINGS_EXPORT_READY` + `PRISMA_PERSISTENCE_READY` + `API_WORKER_AI_REPORT_READY`.

This repository is now a `pnpm@9.15.4` + Turborepo TypeScript workspace with Next.js Web/Admin shells, a NestJS API, a BullMQ worker, Prisma/PostgreSQL migrations, Redis queue scaffolding, Zod shared schemas, Vitest workspace tests, and the existing Playwright regression suite. The new Nest API already generates Liuyao/Meihua reports through the shared deterministic domain package, persists reports/settings/content through Prisma when `DATABASE_URL` is configured, serves P4-X experience bundles, exposes content/knowledge/settings/export endpoints, generates grounded AI report bundles through the existing fact-fidelity pipeline, and keeps deterministic fallbacks available. The new Next Web entry has a real Liuyao/Meihua casting workbench, report history, report detail, content browsing, settings, AI report generation, and report JSON export wired to those API endpoints.

This repository now contains the v1.3 `LIUYAO_CORE_V1` production whitelist implementation.

Current local Web status: `LOCAL_PRODUCT_COMPLETE` for the W1 local-only product scope.

Current Public Beta P1 status: `PRODUCTION_CALENDAR_READY`.

Current Public Beta P2 implementation status: `GROUNDED_AI_REPORT_CODE_READY`.

Current Public Beta P2.1/P3-A status: `LIVE_PROVIDER_SMOKE_PENDING`. The local staging foundation is implemented, but a real OpenAI smoke run and a HTTPS staging deployment still require secure environment configuration outside Git.

Current P4-A content framework status: `CONTENT_SEO_GROWTH_FRAMEWORK_READY` for local framework readiness only. This does not change the pending P2.1/P3-A/P3-B deployment gates.

Live OpenAI smoke requires `OPENAI_API_KEY`; local regression uses the mock provider to validate success, failure, fallback, caching, health checks, readiness checks, rate limits, cost fallback, and UI behavior without external network dependency.

## Scope

- Explicit `RuleProfileLoader`, defaulting to `LIUYAO_CORE_V1`.
- CORE_V1 data import with 45/24/14/47/18 production units.
- Candidate rule-pool traceability checks for every CORE_V1 whitelist key.
- Release tier fail-fast checks for `CORE_V1`, `ADVANCED_BETA`, `REVIEW_REQUIRED`, and `DEPRECATED`.
- Default feature flags with Advanced Beta, Review Required, precise timing, and diagnostic health language closed.
- Six-dimension report aggregation with evidence deduplication, a hard evidence cap of 15, and at most 5 public timing candidates.
- AI input validation that only accepts matched rule codes and explicit `FACT`, `SIGNAL`, or `CANDIDATE_OR_GUARDRAIL` findings.
- v1.2 deterministic fixture coverage for coin casting, najia, six relations, six spirits, timezone normalization, and basic meihua casting.
- Local Web product with Liuyao casting, three-coin/manual line input, Liuyao board rendering, Meihua casting, formal report URLs, local history replay, settings, export/clear history, knowledge search, and CORE_V1 metadata.
- `/api/v1` compatibility routes for Liuyao casts/charts/analyze/report/yongshen, Meihua charts/analyze/report, unified report detail, settings, export, clear history, knowledge search/detail, hexagram/glossary detail, and blog post listing/detail.
- File-backed local history and report replay in `data/runtime/history.json`.
- Structured narrative reports with section-level `findingIds`, `knowledgeIds`, engine versions, and report template versions.
- Playwright E2E coverage for Liuyao coin/manual flows, invalid input, Meihua two-number/time flows, history replay, friendly errors, content detail routes, settings, export/clear history, and mobile viewports 360/390/430.
- Production calendar provider `CAL_STD_V1` with structured Gregorian, IANA timezone, four-pillar, solar-term boundary, month-build, day-chen, xun, xun-kong, day-change policy, provider version, and calculated-facts snapshot output.
- Calendar golden QA with 240 fixtures, including 144 `lunar_python@1.4.8` cross-checked Asia/Shanghai anchor/boundary cases and timezone/DST expansion cases.
- Grounded AI report pipeline with AI input contract, OpenAI provider, deterministic fallback provider, schema validation, fact fidelity validation, safety validation, anonymous rate limits, prompt versioning, report-level reuse, and fallback-safe UI.
- P2.1 audit fields on AI report bundles: `reportSource`, `latencyMs`, `tokenUsage`, `provider`, `model`, `promptVersion`, `aiSchemaVersion`, `fallbackUsed`, and `validationStatus`.
- P3-A local staging foundation with `GET /health`, `GET /ready`, protected-capable `GET /internal/status`, structured JSON logs, aggregate AI metrics, divination and AI rate limits, daily AI budget fallback, and AI concurrency fallback.
- P4-A content, SEO and growth framework with `CONTENT_SCHEMA_V1`, file-based content repository, content package importer, QA reports, CTA registry, analytics event allowlist, metadata/structured data helpers, `robots.txt`, `sitemap.xml`, content APIs, report-to-content recommendations, and noindex demo fixtures.
- P4-X product presentation orchestration with `DivinationResultFacts`, Guided/Professional/Admin ViewModels, terminology registry, priority/dedup, state contracts, and visibility matrix.
- Professional stack migration with `apps/web`, `apps/admin`, `apps/api`, `apps/worker`, and `packages/domain/shared/database/queue/ui/testing/legacy-server`.
- Nest API service/store bridge with Zod validation, deterministic chart/report generation, P4-X experience output, Prisma persistence, and memory fallback.
- Next Web casting workbench that calls Liuyao/Meihua Nest endpoints, reads `/experience`, and renders the Guided ViewModel.
- Next Web report history and detail pages backed by `GET /api/v1/reports` and `GET /api/v1/reports/:id/experience`.
- Next Web content, settings, and export paths backed by `GET /api/v1/content`, `GET /api/v1/content/:contentType/:slug`, `GET/PUT /api/v1/settings`, and `GET /api/v1/reports/:id/export`.
- PostgreSQL seed path for `app_settings` and 158 system `content_entries`, plus report persistence with deterministic result, narrative report, and P4-X experience.
- Grounded AI report generation through `POST /api/v1/reports/:id/ai` and BullMQ-backed `POST /api/v1/reports/:id/ai/jobs`, persisted in Prisma and rendered on the Next report detail page.

## Architecture

```text
pnpm workspace + Turborepo
        ↓
apps/web        Next.js 15 + React 19 public product shell
apps/admin      Next.js 15 + React 19 internal admin shell
apps/api        NestJS 10 API service
apps/worker     BullMQ worker
        ↓
packages/domain Existing deterministic Liuyao/Meihua/CAL/CORE/AI/presentation modules
packages/shared Zod schemas and shared constants
packages/database Prisma schema for PostgreSQL 16
packages/queue  Redis 7 + BullMQ helpers
packages/ui     Shared React UI package
packages/testing Shared test helpers
        ↓
src/server.mjs  Legacy local Public Beta server, retained for full regression compatibility
```

Local infrastructure:

```bash
docker compose up -d
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

## Commands

```bash
pnpm install
pnpm run dev
pnpm run dev:web
pnpm run dev:admin
pnpm run dev:api
pnpm run dev:worker
pnpm run dev:legacy
pnpm run build
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run validate:v13
pnpm run test:legacy
pnpm run test:contract
pnpm run test:e2e
pnpm run test:ai
pnpm run test:calendar
pnpm run fixtures:calendar
pnpm run smoke:ai:live
pnpm run content:validate
pnpm run content:dry-run
pnpm run content:import
pnpm run content:qa
pnpm run content:seo
pnpm run content:rehearsal
pnpm run validate
pnpm run validate:p1
pnpm run validate:p2
pnpm run validate:p4-framework
pnpm run validate:experience
pnpm run validate:w1
```

`pnpm run smoke:ai:live` exits as skipped when `OPENAI_API_KEY` is absent. A passing P2.1 run must execute all 8 live smoke cases and confirm `reportSource = OPENAI_LIVE` for successful outputs.

P4-A demo content under `fixtures/content/p4-demo-package/` is `DEMO_ONLY`, validates checksums, and is used for isolated import rehearsal. It is not indexed and is not published by default.

## Runtime Checks

- `GET /health` returns only `{ "status": "ok" }`.
- `GET /ready` checks app initialization, CORE_V1 loading, CAL_STD_V1 policy, AI provider configuration, and readable content data without returning secrets.
- `GET /internal/status` returns version, provider, prompt/schema versions, and aggregate metrics. In `APP_ENV=staging` or `APP_ENV=production`, set `INTERNAL_STATUS_TOKEN` and send it as `x-internal-status-token`, or protect the route at the deployment platform.

## Staging Environment

`.env.example` intentionally contains only the OpenAI provider placeholders required for local setup and must not contain real secrets. Staging should configure secrets and controls in the deployment platform:

```text
NODE_ENV=production
APP_ENV=staging
OPENAI_API_KEY
AI_PROVIDER=openai
AI_MODEL
AI_TIMEOUT_MS
AI_MAX_OUTPUT_TOKENS
AI_RATE_LIMIT_WINDOW_MS
AI_RATE_LIMIT_MAX
DIVINATION_RATE_LIMIT_MAX
AI_CONCURRENCY_MAX
AI_DAILY_BUDGET_LIMIT
INTERNAL_STATUS_TOKEN or platform basic auth
```

## Production Boundary

Production code executes rules only through `data/production/core-v1-rule-profile.json` and its `core-v1-*` datasets. Candidate rule pools are present only for whitelist traceability checks and remain outside the executable rule set.

New Liuyao reports use `CAL_STD_V1`. Historical reports that already contain `CAL_STD_V1_LIGHT` remain readable and are not rewritten. Runtime history under `data/runtime/` is local development state and can be cleared without changing source seed data.

## Migration Boundary

The new professional stack is available, but full Public Beta feature parity still runs through `src/server.mjs` during this migration. `apps/web` can now create Liuyao and Meihua reports through `apps/api`, list persisted report history, open Guided/Professional report details, generate grounded AI report bundles, browse Prisma-seeded content, edit persisted runtime settings, and export report JSON. Full legacy report parity, Admin governance, real `PUBLICATION_READY` content import, HTTPS staging, and live OpenAI smoke are later implementation steps. See [docs/production/92-monorepo-typescript-stack-migration.md](docs/production/92-monorepo-typescript-stack-migration.md).
