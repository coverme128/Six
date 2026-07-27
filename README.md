# SIX CORE_V1 Production Scope

This repository now contains the v1.3 `LIUYAO_CORE_V1` production whitelist implementation.

Current local Web status: `LOCAL_PRODUCT_COMPLETE` for the W1 local-only product scope.

Current Public Beta P1 status: `PRODUCTION_CALENDAR_READY`.

Current Public Beta P2 implementation status: `GROUNDED_AI_REPORT_CODE_READY`.

Current Public Beta P2.1/P3-A status: `LIVE_PROVIDER_SMOKE_PENDING`. The local staging foundation is implemented, but a real OpenAI smoke run and a HTTPS staging deployment still require secure environment configuration outside Git.

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

## Commands

```bash
npm run validate:v13
npm test
npm run test:contract
npm run test:e2e
npm run test:ai
npm run test:calendar
npm run fixtures:calendar
npm run smoke:ai:live
npm run validate
npm run validate:p1
npm run validate:p2
npm run validate:w1
npm run dev
```

`npm run smoke:ai:live` exits as skipped when `OPENAI_API_KEY` is absent. A passing P2.1 run must execute all 8 live smoke cases and confirm `reportSource = OPENAI_LIVE` for successful outputs.

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
