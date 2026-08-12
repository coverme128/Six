# Migration from Current Content Visuals

Current audited visual assets: **68**.

Migration is incremental:
1. keep Bxx-VIS IDs and content references,
2. read `integration/existing-visual-canonicalization-map.json`,
3. for mapped records, render educational/static variants from canonical VIS-LY component,
4. for editorial-template records, migrate layout/template only,
5. keep true one-off visuals standalone,
6. do not block content pages if a canonical component is not yet implemented.

This is a reuse program, not a destructive migration.
