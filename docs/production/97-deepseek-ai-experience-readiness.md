# DeepSeek AI Experience Readiness

Last verified: 2026-08-25

Status: `LOCAL_COMMERCIAL_EXPERIENCE_VERIFIED_PRODUCTION_RELEASE_EXCLUDED`

## User Promise

AI is an optional expression layer. It explains the existing Liuyao result in ordinary Chinese and must not recalculate the chart, change deterministic judgment facts, invent evidence, promise timing, or replace real-world professional advice.

## Input Boundary

- Send only the current question, necessary chart/calendar facts, matched public evidence, deterministic assessment facts, timing candidates, and allowed evidence refs.
- Do not send report id, input hash, or question digest to the provider.
- Redact common phone numbers, email addresses, and mainland identity-card numbers before provider use.
- Translate known professional grounding terms into plain language before sending them to the model.
- Keep API keys in the current shell or deployment secret store only.

## Output Gate

DeepSeek uses the official Responses API with `deepseek-v4-flash`, thinking disabled, and JSON Schema output. The server then enforces:

- exact chart and calendar fact fidelity;
- exact deterministic outcome label;
- evidence refs restricted to the request allow-list;
- timing restricted to supplied candidate refs and cautious language;
- health, legal, financial, certainty, and type-isolation safety checks;
- at least one visible evidence summary;
- no unexplained professional terminology or invented review interval;
- one validation retry before deterministic fallback.

The public disclaimer is server-owned and cannot be replaced by model wording.

## User Experience

- The deterministic conclusion remains visible before and during AI generation.
- The AI trigger states what data is used and that direct identifiers are redacted.
- Generation normally completes in roughly 7-16 seconds in local verification; the button exposes a working state and the page scrolls to the result when ready.
- Output is organized as conclusion, situation, supports, blockers, change, timing, actions, evidence, and limitations.
- Internal provider, prompt, rule, asset, and request identifiers are not shown in the report UI.
- Report-help copy, related-content labels, and professional audit headings are public-facing Chinese rather than batch or engineering metadata.

## Verification Evidence

- Five Liuyao live scenarios: career, payment collection, relationship, mixed support/block, and timing candidate.
- `pnpm run test:ai`: 15 passing tests.
- `pnpm run test:experience`: 9 passing tests.
- `pnpm run typecheck`: all workspace tasks passed.
- Playwright functional coverage passed for desktop and 360/390/430 mobile report flows.
- Approved report visual snapshots passed for desktop and 360/390/430 mobile.

## Remaining Production Gates

This evidence does not authorize production release. HTTPS staging, deployment secret rotation, PostgreSQL/Redis readiness, production rate/cost controls, observability, performance budgets, retention policy verification, and real-device testing remain required.
