# Liuyao Core Interpretation Binding Audit

Status: LIUYAO_CORE_INTERPRETATION_ASSETS_INTEGRATION_AUDIT

Asset package: `liuyao-core-interpretation-assets@1.0.0`

## Scope

This audit binds presentation-only interpretation assets to existing CORE_V1 facts. It does not modify CAL_STD_V1, casting, Najia, eight palaces, world/response, six relations, six spirits, yongshen selection, strength semantics, dynamic semantics, timing guardrails, or CORE_V1 rule definitions.

## Source Assets

- Finding Explanation Registry: 37 entries
- Relationship Meaning Registry: 18 entries
- Question Topic Role Registry: 15 entries

Copied under `data/liuyao/interpretation-assets/`.

## Existing CORE_V1 Codes Audited

- Question/Yongshen mappings: 45
- Strength rules: 24
- Dynamic rules: 14
- Pattern rules: 47
- Timing/guardrail rules: 18
- Total production units: 148

Source of truth: `data/production/core-v1-rule-profile.json` and its enabled datasets.

## Binding Files

- `data/liuyao/rule-finding-bindings.json`
- `data/liuyao/relationship-bindings.json`
- `data/liuyao/question-topic-bindings.json`

## Bound Public Finding Semantics

The deterministic report currently emits these public finding groups:

- Question topic/yongshen finding: resolved through Question Topic Role Registry.
- Month/day influence findings: resolved through Finding Explanation Registry when the rule code has a confirmed asset match.
- World/subject finding: `YONGSHEN_HOLDS_WORLD` binds to `LYX_FIND_YONGSHEN_AT_SHI`.
- Timing candidates: broad timing semantics bind to timing explanation assets.
- Dynamic moving-line summary: `MOVING_LINE` remains `UNBOUND` because the CORE_V1 code means any moving line, while the available asset `LYX_FIND_YONG_MOVING` means yongshen moving specifically.

Unbound public items use safe fallback copy and must not be amplified into final conclusions.

## Question Topic Binding

All 45 existing question/yongshen mapping codes are explicitly mapped to one of the 15 topic role assets. Examples:

- `career:job_search` -> `JOB_SEARCH`
- `wealth:income` -> `INCOME_WEALTH`
- `relationship:relationship_stability` -> `RELATIONSHIP`
- `legal:dispute` -> `LEGAL_DISPUTE`
- `health:self_health` -> `HEALTH_REFLECTION`

This binding controls user-facing role meaning. For example, `官鬼` in job search is presented as target job/opportunity, while in wealth topics it is presented as responsibility, rule pressure, risk, or constraint.

## Relationship Binding

Confirmed relationship bindings include:

- Return generation/control -> `LYX_REL_RETURN_GENERATE` / `LYX_REL_RETURN_CONTROL`
- Yongshen at world/response -> `LYX_REL_YONG_AT_SHI` / `LYX_REL_YONG_AT_YING`
- Origin/taboo relations where existing rule codes are available -> `LYX_REL_YUAN_GENERATES_YONG` / `LYX_REL_JI_CONTROLS_YONG`

Directional world/response generate/control codes remain `UNBOUND` until the engine surfaces a matched relationship fact with direction-safe semantics. Relationship meanings include limitations and must not be interpreted apart from strength, movement, yongshen position, and topic.

## QA

Added:

```text
pnpm run validate:liuyao-interpretation-assets
```

It validates:

- Registry IDs unique
- Binding keys point to real CORE_V1 codes
- Binding values point to real asset IDs or explicit `UNBOUND`
- All 45 question mappings are covered
- Guided output does not leak raw RuleCode
- Topic role meanings vary by topic
- AI input includes resolved findings, relationships, and topic roles
- Health topic keeps topic-specific safety context

## Completion Status

`LIUYAO_CORE_INTERPRETATION_ASSETS_INTEGRATED`
