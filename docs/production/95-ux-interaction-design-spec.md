# Liuyao UX Interaction Design Spec

Status: `LIUYAO_PUBLIC_WEB_UX_READY_LOCAL`

This spec defines the public Web interaction behavior aligned with the Oriental Professional experience standard.

## Interaction Model

Every core interaction follows:

```text
Trigger
↓
System response
↓
User feedback
↓
State transition
↓
Next action
```

## Core Moments

## First Entry

User expectation: quickly choose between solving a current question and learning how Liuyao works.

System response: state the core value in user language, show `开始六爻分析` and `进入学习中心`, provide direct scenario shortcuts, and keep the casting workbench in the first task flow.

Failure behavior: if downstream API is unavailable, keep the entered question and show a restrained retryable error.

## Submit Question

User expectation: know what input is required.

System response: keep the question field prominent, expose only necessary casting inputs, and avoid advanced settings by default.

Next action: generate report, clear result, or open history.

## Waiting

User expectation: system is processing without pretending to do steps it cannot verify.

System response: the primary button changes to "正在整理报告" and remains disabled while processing.

## First Result

User expectation: understand the report in under 10 seconds.

System response: show headline, current situation, change direction, timing hint, main support, main obstacle, and next actions before professional evidence.

For a relationship question, show relationship direction, the user's side, the other side or interaction signal, and the immediate decision focus before general evidence.

## Learn Hub Entry

User expectation: find a useful starting point without scanning the entire content inventory.

System response: present beginner entry, real-world topics, structured learning columns, filters, and an initially bounded library. Additional items appear only after `查看更多内容`.

Next action: open a topic page, continue the five-stage path, read an article, or return to the Liuyao workbench.

## Topic Landing

User expectation: understand whether Liuyao can help with a specific life situation.

System response: show common user questions, what Liuyao can clarify, example question formulations, method boundaries, a scenario-linked primary CTA, and related learning.

## Expand Evidence

User expectation: move from "what" to "why".

System response: professional evidence is behind a details control, grouped into support, risk, and other evidence. Related knowledge is also on demand.

## AI Enhancement

User expectation: understand whether AI changed the result.

System response: the UI states that AI only expresses validated facts, shows source and validation status, and preserves deterministic content if AI falls back.

## Return History

User expectation: feel like the anonymous workspace is still coherent.

System response: report history uses user-facing labels and clear empty state language.

## Interaction States

Buttons and links support default, hover, focus, loading, disabled, and mobile states. Inputs expose focus outlines. Errors use low-saturation vermilion and explain the failure without dramatizing it. Empty states always provide a reasonable next step.

## Mobile Contract

Mobile uses a single-column reading flow. Navigation remains horizontally usable, action groups wrap, form controls fill available width, and evidence/trust sections collapse into one column.

Repeated content sections are intentionally shortened on mobile and the general library starts with 24 items. Fixed-format boards, controls, and timelines must not create horizontal overflow at 360, 390, or 430 CSS pixels.

## Public Disclosure Boundary

Public pages must not render content review status codes, source batch fields, presentation configuration, provider/debug metadata, visual implementation IDs, or readiness labels. User-facing publication labels may be rendered only as plain language such as `已发布`.

## Release Acceptance

Local P0 acceptance requires homepage, scenario preselection, report, relationship result, Learn Hub, topic landing, and learning path checks on desktop and mobile with no horizontal overflow or internal metadata leakage. Commercial production acceptance additionally requires the gates defined in `docs/production/96-liuyao-public-beta-commercial-readiness.md`.
