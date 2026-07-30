# Six TypeScript Monorepo Stack Migration

Status: `PNPM_TURBO_TYPESCRIPT_STACK_READY` + `DOMAIN_TYPESCRIPT_PACKAGE_READY` + `API_REPORT_STORE_BRIDGE_READY` + `NEXT_WEB_CAST_WORKBENCH_READY` + `NEXT_WEB_HISTORY_DETAIL_READY` + `NEXT_WEB_CONTENT_SETTINGS_EXPORT_READY` + `PRISMA_PERSISTENCE_READY` + `API_WORKER_AI_REPORT_READY` + `LEGACY_MJS_RUNTIME_REMOVED`

This migration aligns Six with the professional workspace architecture used by the QI project. The active runtime is now the TypeScript monorepo stack.

## Target Stack

```text
Package manager: pnpm@9.15.4
Monorepo orchestration: Turborepo
Language: TypeScript
Frontend Web: Next.js 15 + React 19
Admin: Next.js 15 + React 19
API: NestJS 10
Database: PostgreSQL 16
ORM: Prisma
Queue/cache: Redis 7 + BullMQ
Validation: Zod
Testing: Vitest + Playwright
```

## Workspace Layout

```text
apps/web              Next.js public product shell
apps/admin            Next.js internal admin shell
apps/api              NestJS API service
apps/worker           BullMQ worker
packages/domain       TypeScript deterministic domain and presentation package
packages/shared       Zod schemas and shared constants
packages/database     Prisma schema and database package
packages/queue        Redis/BullMQ queue package
packages/ui           Shared React UI package
packages/testing      Shared test helpers
```

## Cutover Strategy

The deterministic domain code has been migrated into `@six/domain` as TypeScript source with `dist` package exports and generated declarations. Nest API, Worker, database seed, scripts, and tests consume the workspace package instead of the removed root runtime.

Playwright regression now starts the Nest API and Next Web app as separate services. API requests use `http://127.0.0.1:4100/api/v1`; browser navigation uses `http://127.0.0.1:3000`.

## Infrastructure

Local services are defined in `docker-compose.yml`:

```text
PostgreSQL 16: localhost:5434
Redis 7: localhost:6381
```

Environment placeholders are in `.env.example`:

```text
DATABASE_URL=postgresql://postgres:postgres@localhost:5434/six_professional
REDIS_URL=redis://localhost:6381
API_PORT=4000
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1
```

## Current API Migration State

`apps/api` is a NestJS service with:

```text
GET  /api/v1/health
GET  /api/v1/ready
GET  /api/v1/metadata
POST /api/v1/liuyao/charts
POST /api/v1/meihua/charts
POST /api/v1/reports/demo
GET  /api/v1/reports
GET  /api/v1/reports/:id
GET  /api/v1/reports/:id/experience
GET  /api/v1/reports/:id/export
POST /api/v1/reports/:id/ai
POST /api/v1/reports/:id/ai/jobs
GET  /api/v1/content
GET  /api/v1/content/search?q=
GET  /api/v1/content/:contentId/related
GET  /api/v1/content/:contentType/:slug
GET  /api/v1/knowledge
GET  /api/v1/knowledge/search?q=
GET  /api/v1/knowledge/:slug
GET  /api/v1/hexagrams/:slug
GET  /api/v1/glossary/:slug
GET  /api/v1/blog/posts
GET  /api/v1/blog/posts/:slug
GET  /api/v1/settings
PUT  /api/v1/settings
```

Report generation and history now run through `DivinationService` and `ReportStoreService`:

```text
Zod request validation
        ↓
@six/domain deterministic chart + narrative report builders
        ↓
P4-X experience bundle
        ↓
ReportStoreService Prisma persistence when DATABASE_URL is configured
        ↓
Memory fallback when PostgreSQL is unavailable
        ↓
Lightweight report summaries for GET /reports
```

When PostgreSQL is configured, new reports persist to `reports` with deterministic result, narrative report, P4-X experience bundle, chart hash, status, and timestamps. Report history, detail, experience, and export can reload those records after an API restart. When PostgreSQL is not configured or Prisma write fails, the API keeps serving through memory fallback instead of breaking the anonymous beta flow.

Content API routes are Prisma-first when `content_entries` is available, with the file-backed content repository retained as a fallback. Runtime public settings are stored in `app_settings` when Prisma is configured and fall back to process memory otherwise.

Grounded AI report generation is available through:

```text
POST /api/v1/reports/:id/ai       synchronous generation/reuse
POST /api/v1/reports/:id/ai/jobs  BullMQ enqueue with synchronous fallback if queue is unavailable
```

Both paths use the existing `generateGroundedAIReport` pipeline from `@six/domain/ai-report`, including AI input construction, provider selection, schema validation, fact fidelity validation, safety validation, deterministic fallback, and cache reuse. Generated bundles are persisted to `reports.aiReport`, attached to `result.aiReportBundle`, and reflected in the rebuilt P4-X experience bundle.

Database seed currently writes:

```text
app_settings: 1 public settings record
content_entries: 158 system seed entries from the content framework
```

The content framework still keeps externally imported demo package entries as non-public unless a `PUBLICATION_READY` package is imported.

## Current Web Migration State

`apps/web` is a Next.js 15 + React 19 public product shell. It now includes a client-side API demo panel that calls:

```text
POST /api/v1/liuyao/charts
POST /api/v1/meihua/charts
GET  /api/v1/reports/:id/experience
```

The first screen now exposes a real casting workbench:

```text
Liuyao: question + six 6/7/8/9 line values
Meihua: question + two-number casting
Result: Guided ViewModel rendered from the Nest API experience endpoint
```

The panel renders the Guided ViewModel from the P4-X experience bundle, proving that the new Web app can consume the new Nest API without bypassing the deterministic fact chain. It also links into:

```text
/history       Report summary list from GET /api/v1/reports
/reports/[id]  Guided + Professional report detail from /experience
/content       Content and knowledge list/search from GET /api/v1/content
/content/[type]/[slug] Content detail from GET /api/v1/content/:contentType/:slug
/settings      Runtime settings editor from GET/PUT /api/v1/settings
```

Request validation failures now return HTTP 400 with `code: "VALIDATION_ERROR"` instead of a generic server error.

Public API errors are normalized by `PublicExceptionFilter` as:

```text
code
message
traceId
```

Report detail pages expose a JSON export entry that opens `GET /api/v1/reports/:id/export`. The export payload includes report metadata, chart hash, persistence mode, deterministic result, narrative report, and P4-X experience bundle.

Report detail pages also expose grounded AI generation. The UI calls `POST /api/v1/reports/:id/ai`, then renders the persisted AI bundle status and summary from the refreshed experience response.

## Current Worker Migration State

`apps/worker` consumes the shared BullMQ queue:

```text
queue: six-report-jobs
job: generate-ai-report
```

The worker reads the persisted report from Prisma, generates or reuses the grounded AI bundle, rebuilds the experience bundle, and writes the result back to `reports`. API reads are Prisma-first when `DATABASE_URL` is configured, so Worker updates become visible to `GET /api/v1/reports/:id/experience` without relying on process memory.

## Verification

The migration was verified with:

```bash
pnpm install --ignore-scripts
pnpm run db:generate
pnpm run db:migrate
pnpm run db:seed
pnpm run validate
pnpm run typecheck
pnpm run build
pnpm run lint
pnpm run test
pnpm run validate:experience
pnpm run test:e2e
```

Nest API smoke was also verified on port 4100:

```text
GET  /api/v1/health
GET  /api/v1/metadata
POST /api/v1/reports/demo
GET  /api/v1/reports/:id/experience
GET  /api/v1/reports/:id/export
POST /api/v1/reports/:id/ai
POST /api/v1/reports/:id/ai/jobs
GET  /api/v1/content
GET  /api/v1/content/KNOWLEDGE/core-yinyang
GET  /api/v1/hexagrams/feng
GET  /api/v1/settings
PUT  /api/v1/settings
```

The latest database smoke on port 4000 returned generated Liuyao and Meihua reports with `persistence: "prisma"`, loaded report export after an API restart, preserved `narrativeReport`, loaded persisted settings after restart, served 158 content entries through `GET /api/v1/content`, generated a grounded AI bundle synchronously, and generated another grounded AI bundle through the BullMQ Worker.

The Web workbench smoke additionally verified:

```text
POST /api/v1/liuyao/charts       generated Liuyao report + experience
POST /api/v1/meihua/charts       generated Meihua report + experience
POST /api/v1/liuyao/charts       invalid request returns 400 VALIDATION_ERROR
GET  /api/v1/reports/:id/experience works for both report types
```

Browser smoke with system Chrome verified:

```text
/history contains the generated report summary
/reports/:id renders Guided interpretation
/reports/:id renders Professional summary
/content lists knowledge/content cards
/content/knowledge/core-yinyang renders content detail
/settings loads and saves runtime preferences
/reports/:id can generate and render AI enhanced interpretation
```

## Deferred Cutovers

The stack is in place, but these are intentionally deferred to keep deterministic behavior stable:

```text
Move full historical report visual coverage into apps/web
Move AdminViewModel and content governance into apps/admin
Import a real `PUBLICATION_READY` content package for public indexed content
Run real OpenAI live smoke with production secrets and HTTPS staging
Add production auth/RBAC/payment only when a later phase explicitly allows it
```

Do not modify CAL_STD_V1, CORE_V1, deterministic chart engines, AI fact fidelity, or P4-X presentation semantics as part of this architecture migration.
