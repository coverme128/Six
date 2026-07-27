# SIX CORE_V1 Production Scope

This repository now contains the v1.3 `LIUYAO_CORE_V1` production whitelist implementation.

Current local Web status: `LOCAL_PRODUCT_COMPLETE` for the W1 local-only product scope.

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

## Commands

```bash
npm run validate:v13
npm test
npm run test:e2e
npm run validate
npm run validate:w1
npm run dev
```

## Production Boundary

Production code executes rules only through `data/production/core-v1-rule-profile.json` and its `core-v1-*` datasets. Candidate rule pools are present only for whitelist traceability checks and remain outside the executable rule set.

The current calendar adapter is `CAL_STD_V1_LIGHT`: it covers timezone normalization and local MVP chart context, but it is not a full solar-term calendar provider for production astrology QA. Runtime history under `data/runtime/` is local development state and can be cleared without changing source seed data.
