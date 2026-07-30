# P4-X Upgrade Architecture Realignment

Status: `P4X_UPGRADE_RECHECKED_FOR_MONOREPO_STACK`

This audit rechecks `Web Product Experience Orchestration Upgrade v1.0` after the project moved to the pnpm/Turborepo, Next.js, NestJS, PostgreSQL, Prisma, Redis, and BullMQ architecture.

## Result

The upgrade still applies. Its product contract is unchanged:

```text
Deterministic result facts
        ↓
DivinationResultFacts
        ↓
Experience Orchestration
        ↓
Guided / Professional / Admin ViewModels
        ↓
UI
```

The implementation boundary changed:

```text
apps/web renders public Guided/Professional surfaces
apps/api creates and serves reports and experience bundles
apps/worker regenerates AI-enhanced experience bundles
packages/domain owns deterministic engines and P4-X presentation contracts
packages/database persists reports, AI report bundles, settings, and content entries
```

## Rebased Scope Matrix

| Upgrade area | Current status | Architecture note |
| --- | --- | --- |
| DivinationResultFacts | Implemented in `packages/domain/src/domain/presentation` | Built from deterministic results and narrative reports, not from UI code. |
| Priority and deduplication | Implemented in `packages/domain` | API/Web consume the bundle instead of re-ranking in components. |
| Guided ViewModel | Implemented | Used by Next Web workbench and report detail through `/experience`. |
| Professional ViewModel | Implemented | Used on report detail as a deeper reading surface without raw debug fields. |
| Admin ViewModel | Implemented as internal construction | Must stay behind internal/protected surfaces; it is not public report output. |
| Page experience contracts | Implemented | Covers casting, report, history, knowledge, and tutorial pages. |
| State contract | Rebased | Expanded to include the full upgrade states: `PARSING`, `NEEDS_CONFIRMATION`, `LOCKED`, `UNAUTHORIZED`, `FORBIDDEN`, `EXPIRED`, and `ARCHIVED`. Existing `NOT_FOUND` remains as an anonymous-report extension. |
| Visibility matrix | Implemented | Guided/Professional forbid raw JSON, provider debug, prompt versions, request IDs, and internal rule identifiers. |
| PostgreSQL persistence | Implemented by stack migration | `reports.experience` stores the P4-X bundle as a presentation artifact; deterministic result remains the source of truth. |
| Worker AI path | Implemented | Worker persists `aiReport`, attaches it to `result.aiReportBundle`, rebuilds `experience`, and updates Prisma. |
| Content package import | Framework ready only | System seed content is imported; real `PUBLICATION_READY` content package remains pending. |

## Data Boundary

P4-X does not move rule knowledge, calendar facts, or divination algorithms into PostgreSQL as executable logic. The database stores generated reports, generated experience bundles, public settings, AI bundles, and imported content entries.

Knowledge used for deterministic rule execution remains versioned source data and domain code. Public content that is meant to be indexed or browsed should be imported into `content_entries`. Sensitive or candidate rule datasets must stay outside public routes and must not be bundled into public Next.js client code.

## Required Changes From The Recheck

Completed in this rebase:

```text
P4-X documentation updated for the monorepo/Prisma/Worker runtime
Full upgrade-package page state set added to experience contracts
Presentation tests updated to assert the expanded state contract
```

Still intentionally pending:

```text
Real PUBLICATION_READY package import
Protected production Admin workflows
Auth/RBAC/payment/subscription policy
Production OpenAI live smoke with real secrets
HTTPS staging deployment evidence
Full historical report visual coverage inside apps/web
```

## Verification

Run:

```bash
pnpm run validate:experience
pnpm run typecheck
```

If API, Worker, PostgreSQL, and Redis are running, also smoke:

```text
POST /api/v1/liuyao/charts
GET  /api/v1/reports/:id/experience
POST /api/v1/reports/:id/ai/jobs
GET  /api/v1/reports/:id/experience
```

The second experience response should include the updated AI bundle while preserving the same deterministic result chain.
