UPDATE "content_entries"
SET
  "status" = 'INTERNAL_ONLY',
  "payload" = jsonb_set(
    jsonb_set("payload", '{reviewStatus}', '"INTERNAL_ONLY"'::jsonb, true),
    '{seoMetadata,index}',
    'false'::jsonb,
    true
  ),
  "publishedAt" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" ~ '^B0[56]-CASE-';
