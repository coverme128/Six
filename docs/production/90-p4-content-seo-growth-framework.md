# P4-A Content, SEO and Growth Framework

Status: `CONTENT_SEO_GROWTH_FRAMEWORK_READY`

This status covers the local framework only. It does not mark `PUBLIC_BETA_READY`, `PRODUCTION_READY`, or resolve the earlier `LIVE_PROVIDER_SMOKE_PENDING` and staging deployment gates.

## Architecture

- Schema: `CONTENT_SCHEMA_V1`
- Repository: `HybridContentRepository`, composed of file-based `content/` entries plus existing seed data converted to `DEMO_ONLY` preview entries.
- Public status: only `PUBLICATION_READY` is visible through public content APIs and sitemap.
- Non-public statuses: `DRAFT`, `REVIEW_REQUIRED`, `REVIEWED`, `DEFERRED`, and `DEMO_ONLY` remain noindex and excluded from sitemap.
- Importer: `ContentPackageImporter` with `validate-only`, `dry-run`, and `apply`.

## Routes

Framework pages are wired for landing, trust, tutorial, Blog, Knowledge, Glossary, Trigram, Hexagram, FAQ-ready blocks, and learning-path/search surfaces. When no `PUBLICATION_READY` package is imported, pages show a formal empty state and point users back to the Liuyao and Meihua tools.

Content APIs:

```text
GET /api/content
GET /api/content/search
GET /api/content/:type/:slug
GET /api/content/:id/related
GET /api/content-preview/:id
GET /api/learning-paths/:id
GET /api/reports/:id/content-recommendations
GET /robots.txt
GET /sitemap.xml
```

Preview content is disabled for beta/production app environments unless protected by the deployment environment.

## SEO

- Development and staging robots block all crawling.
- Beta robots block API, internal status, report URLs, and preview paths.
- Sitemap includes only `PUBLICATION_READY` entries with `index=true`.
- Report pages are excluded by design because they can contain user-private content.
- Metadata and structured data helpers are type-aware and avoid generating FAQ/Article data for invisible content.

## Growth

- CTA codes are registered centrally: `START_LIUYAO`, `START_MEIHUA`, `CHOOSE_METHOD`, `READ_TUTORIAL`, `VIEW_KNOWLEDGE`, `CONTINUE_LEARNING`, `VIEW_RELATED_REPORT_GUIDE`, `EXPORT_REPORT`, `SUBMIT_FEEDBACK`, and `SHARE_ANONYMOUS_CARD`.
- Analytics events are allowlisted and explicitly exclude full questions, full reports, contact data, IP detail, and device fingerprints.
- Report recommendations are deterministic: actual knowledge references first, then rule/type/topic fallbacks. Random recommendations are not used.

## Import Handoff

Future P4-B content packages must provide:

```text
import/content-entries.json
import/faq-entries.json
import/learning-paths.json
import/content-import-manifest.json
```

Optional future files can include:

```text
import/knowledge-nodes.json
import/glossary-entries.json
import/content-knowledge-links.json
import/content-clusters.json
import/landing-pages.json
import/seo-metadata.json
import/internal-link-map.json
import/conversion-map.json
import/analytics-event-map.json
```

The manifest must include `schemaVersion`, `packageVersion`, file list, file kind, and SHA-256 checksums. Apply imports publish only `PUBLICATION_READY` content. Any blocking conflict fails the apply step before partial publication.

## Verification

Run:

```bash
npm run validate:p4-framework
```

The command aggregates CORE_V1, CAL_STD_V1, AI schema/fidelity/safety unit tests, synthetic content import rehearsal, content QA, SEO checks, and Playwright desktop/mobile regression.

Generated reports:

```text
reports/content/content-coverage-report.json
reports/content/keyword-cannibalization-report.json
```

Current coverage contains existing seed content converted as `DEMO_ONLY`; sitemap URL count is intentionally `0` until an external `PUBLICATION_READY` content package is imported.
