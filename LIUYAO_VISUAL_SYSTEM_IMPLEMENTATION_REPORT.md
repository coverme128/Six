# Liuyao Visual System Implementation Report

Date: 2026-08-19

Package: `liuyao-visual-system-and-asset-orchestration-v1.0`

## Status

`LOCAL_PRODUCT_AND_ASSET_COMPLETE_PRODUCTION_RELEASE_EXCLUDED`

This is not `PRODUCTION_READY`. P0 and P1 product visuals, editorial assets, all content visuals, distribution assets, static SVG/print/PDF export, and core user journeys are integrated and locally verified. Only environment-dependent production release gates remain open.

## Completed

- Imported the full visual system package into `data/liuyao/visual-system/`.
- Published the 14 reference SVG assets under `apps/web/public/liuyao-visual-system/reference-svg/`.
- Added `LIUYAO_VISUAL_REPOSITORY_AUDIT.md` before implementation, as required by the package.
- Added a Liuyao-only Visualization ViewModel layer in `packages/domain/src/domain/presentation/liuyaoVisualizationViewModels.ts`.
- Registered all 14 visual IDs:
  - P0: `VIS-LY-001` through `VIS-LY-010`
  - P1: `VIS-LY-011` through `VIS-LY-014`
- Attached `visualization` to `buildExperienceBundle()` for Liuyao reports.
- Exposed `experience.visualization` through public report APIs.
- Added runtime backfill for old Liuyao reports that do not yet have stored visualization bundles.
- Added Web API typing for the visualization bundle.
- Added the report UI component `LiuyaoVisualSystemPanel`.
- Replaced the Liuyao report's primary ad hoc chart table with canonical VIS-LY P0 visuals.
- Kept the old chart panel as fallback only when a report has no visualization bundle.
- Added package-aligned design tokens, semantic line encodings, responsive layouts, and reduced-motion support.
- Collapsed the home workbench into a Liuyao-only product entry; Meihua is no longer surfaced as a new user choice.
- Removed remaining Meihua branding and controls from public navigation, metadata, workbench, history, settings, and report presentation.
- Added homepage primary actions and direct scenario entry for relationship, career, wealth, and business questions.
- Added relationship-specific Guided presentation for direction, self state, other-party interaction, and immediate decision focus without changing formal assessment facts.
- Removed visual implementation IDs and package/readiness states from the public report UI.
- Replaced generic object dumping on content detail pages with explicit article, topic, and learning-path renderers.
- Published six reality-topic landing pages and the Liuyao Learn Hub path after completing their public presentation layer.
- Reduced mobile Learn Hub density with progressive library disclosure and shorter featured sections.
- Changed production readiness behavior so missing database or Redis configuration returns HTTP 503.
- Added tests for visual registry completeness, P0 IDs, board reading/casting order, no-recompute policy, and export status truthfulness.
- Generated and registered all 10 editorial assets `ED-LY-001` through `ED-LY-010`.
- Finished the editorial visual content package into 23 production-ready variants under `apps/web/public/liuyao-visual-system/editorial/final/`.
- Connected final editorial visuals to the Learn Hub, content cards, and content detail pages.
- Art-directed all existing 68 content-growth SVG assets under `apps/web/public/content-growth/visuals/` into seven semantic layout families while preserving their historical `Bxx-VIS-xx` IDs and paths.
- Integrated VIS-LY-011 through VIS-LY-014 as progressively disclosed P1 report evidence.
- Added same-ViewModel static SVG download and browser print/PDF output.
- Generated 72 social cards, 24 summary cards, 50 video covers and shootable storyboards, and 12 collection documents from the source registries.
- Added responsive visual regression at desktop and 360/390/430 widths plus semantic, keyboard, screen-reader-summary, asset-integrity, and PDF checks.

## Guardrails Preserved

- No changes to CAL_STD_V1.
- No changes to CORE_V1.
- No changes to Yongshen selection logic.
- No changes to strength, dynamic, pattern, conflict, timing, or action rules.
- Components do not select Yongshen, compute strength scores, resolve evidence conflicts, or infer timing.
- Existing Bxx content visual assets were preserved.
- AI images remain outside deterministic Liuyao product visuals.

## Current User Experience

The report now leads with a mature Liuyao visual structure:

- Six-line board displayed top-to-bottom as `上爻 -> 初爻`.
- Casting/source order preserved as `初爻 -> 上爻`.
- Original/changed hexagram transition.
- Core focus/Yongshen evidence from supplied facts.
- Shi/Ying relationship display without hard-coded person assumptions.
- Six relations map.
- Qualitative strength/state matrix with no numeric score.
- Dynamic moving-line transformation display.
- Evidence conflict summary after deterministic resolution.
- Timing candidate timeline with uncertainty language.

Commercial experience P0 now also includes:

- A homepage choice between starting a Liuyao analysis and entering the Learn Hub.
- Direct relationship, career, wealth, and business scenario shortcuts.
- Relationship reports led by user-facing relationship direction and interaction guidance before professional terms.
- Dedicated topic landing pages with user questions, method explanation, examples, CTA, and related learning.
- A dedicated six-stage Learn Hub path rather than exposing structured package metadata.
- Production-only content filtering with 421 reviewed public package entries, including six topic pages and one learning path.

## Editorial Assets

`ED-LY-001` through `ED-LY-010` are now available in the project:

- Generated bitmap assets: article hero, teaching case cover, learn lesson cover, topic landing hero, historical/cultural scene.
- Deterministic SVG templates: concept explainer, social share card, short-video cover, report summary card, trust/system illustration.
- Output map: `data/liuyao/visual-system/editorial/generated/editorial-asset-output-map.json`.
- Final asset manifest: `data/liuyao/visual-system/editorial/generated/final-asset-manifest.json`.
- Final public directory: `apps/web/public/liuyao-visual-system/editorial/final/`.

AI-generated images are editorial-only. They do not encode real hexagram lines, moving lines, Shi/Ying, Yongshen, strength, evidence, pattern, timing, or action facts.

## Existing Content SVGs

The existing 68 `Bxx-VIS-xx` SVG assets are now individually art-directed and style-aligned:

- Historical filenames and IDs were preserved.
- Diagram text, title, description, and content semantics were reviewed and preserved.
- Each visual now uses the most suitable timeline, comparison, cycle, stack, relationship, flow, or matrix composition.
- Colors were normalized to the Liuyao visual token palette.
- Font family was normalized to the product system stack.
- Rounded rectangle radii were capped at 8px.
- Each SVG now carries `data-visual-system="LIUYAO_VISUAL_SYSTEM_V1"` and canonicalization metadata.
- Production audit: `data/liuyao/visual-system/integration/content-growth-68-svg-production-audit.json`.

## Validation

- `pnpm run test:experience` passed.
- `pnpm run typecheck` passed.
- `npm run build` passed.
- `pnpm run content:qa` passed with 0 errors, 0 warnings, and no isolated content.
- Browser and snapshot checks passed on desktop and 360/390/430 mobile without horizontal overflow or public implementation-state leakage.
- Static SVG download and print/PDF output passed same-ViewModel export checks.
- Production content filtering returned only `PUBLICATION_READY` entries; dependency readiness returned HTTP 503 when infrastructure was unavailable.

Known build notices are pre-existing project configuration warnings:

- Tailwind `content` option warning in admin build.
- Next.js ESLint plugin not detected warning.

## Remaining Production-Only Gates

- Deploy and verify HTTPS staging with production-like PostgreSQL and Redis.
- Run the live AI provider smoke suite with securely configured credentials.
- Capture staging performance, caching, observability, and real-device evidence.
- Keep legacy Meihua contracts isolated as internal compatibility or remove them in a separately approved backend migration; they are absent from the public product.

The consolidated ownership, evidence, and release decision are recorded in `docs/production/96-liuyao-public-beta-commercial-readiness.md`.
