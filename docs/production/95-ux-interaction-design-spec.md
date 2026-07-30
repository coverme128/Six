# Liuyao & Meihua UX Interaction Design Spec

Status: `PUBLIC_WEB_UX_INTERACTION_READY`

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

User expectation: understand whether to use Liuyao or Meihua and how to start.

System response: show the casting workbench immediately, with calm explanation and a clear primary action.

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
