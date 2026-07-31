# Liuyao Core Product Closure Report

Status: `LIUYAO_CORE_V1_PRODUCT_COMPLETE`

## Executive Summary

Phase 5 is complete for Liuyao CORE_V1 product closure. The implementation does not add or promote CORE_V1 rules. It adds a runtime product facts layer, real binding audit, deterministic assessment closure, AI boundary enforcement, export/history snapshot support, and QA gates around Guided, Professional, AI fallback, E2E, mobile, and regression.

## Real Binding Audit

See `docs/audit/liuyao-core-product-closure-binding-audit.json`.

- CORE_V1 totalRules: 148
- enabledRules: 148
- Finding binding: 44 bound / 59 unbound code-rule units
- Question/Yongshen mappings: 45 / 45 topic bound, 45 / 45 role bound
- Relationship meanings: 11 bound / 4 unbound
- Timing policies: 18 / 18 explanation ready

UNBOUND items are intentionally retained as safe fallback gaps. They are not guessed or silently promoted.

## Runtime Architecture

Runtime chain:

`CORE_V1 -> ProductResultFacts Normalize -> Evidence Grouping -> Dedup in ViewModels -> Conflict Resolution -> Assessment Pattern -> OverallAssessmentFacts -> Guided / Professional / AI / Export / History`

The new single Liuyao source is `LiuyaoProductResultFacts` in `packages/domain/src/domain/presentation/productResultFacts.ts`.

## ProductResultFacts

`LiuyaoProductResultFacts` contains:

- reportIdentity
- questionContext
- calendarFacts
- chartFacts
- yongshenSelectionFacts
- lineAssessmentFacts
- resolvedFindingFacts
- resolvedRelationshipFacts
- evidenceGroupingFacts
- conflictResolutionFacts
- overallAssessmentFacts
- timingExplanationFacts
- actionGuidanceFacts
- knowledgeReferences
- versionSnapshot

## Assessment Runtime

Assessment runtime is enabled through `data/liuyao/product-closure-runtime.json`.

- baseState and dynamicDirection are separated.
- overallState allows `FAVORABLE`, `MIXED`, `TRANSITIONAL`, `CAUTIOUS`, and `UNCLEAR`.
- Conflict resolution does not collapse evidence to a pure numeric support/block score.
- OverallAssessmentFacts are generated before AI.

## Guided Experience

Guided now prioritizes:

1. 总体判断
2. 核心事项
3. 当前基础状态
4. 主要支持
5. 主要阻碍
6. 变化方向
7. 时间提示
8. 建议关注
9. 为什么这样判断

Guided does not display raw RuleCode, provider, prompt version, request ID, or internal IDs.

## Professional Auditability

Professional includes:

- Question / Topic
- Yongshen selection
- Calendar context
- Line diagnostics
- Strength / dynamics grouping
- Relationships
- Pattern findings
- Evidence resolution
- Overall assessment
- Timing explanation
- Limitations

Professional remains a reviewable product view, not Admin Debug.

## AI Boundary

AI input includes:

- overallAssessmentFacts
- yongshenSelectionFacts
- resolved finding / relationship / topic semantics
- conflictResolutionFacts
- timingExplanationFacts
- actionGuidanceFacts
- deterministicJudgmentSignature

AI output is forbidden from returning judgment ownership fields such as `overallState`, `baseState`, `dynamicDirection`, `conflictState`, and `dominantFindingRefs`.

## Fallback

AI timeout, invalid output, or provider failure returns `PARTIAL_AI_UNAVAILABLE` and keeps the deterministic report usable. The report is not marked failed.

## History / Versioning

Saved report experience now carries `productResultFacts` with a versionSnapshot. AI generation reuses the saved snapshot rather than silently recalculating deterministic judgment facts.

## Tests

Passed:

- `pnpm run validate:liuyao-product-closure`
- `pnpm run validate:liuyao-interpretation-assets`
- `pnpm run test:e2e`
- `pnpm run validate`
- `pnpm run lint`

## E2E / Mobile

Playwright passed desktop and mobile 360 / 390 / 430 report experience checks.

## Unbound / Review Required

Unbound CORE_V1 code-rule units and relationship codes are listed in the binding audit. They are treated as explanation coverage gaps with safe fallback behavior, not as invented bindings.

## Deferred Scope

No work was done on Advanced Rules, REVIEW_REQUIRED promotion, multi-school logic, new calendar rules, new charting rules, precise timing expansion, Meihua asset expansion, PostgreSQL, login, billing, CMS, golden case mass production, or outcome datasets.

## Final Status

`LIUYAO_CORE_V1_PRODUCT_COMPLETE`
