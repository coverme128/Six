# Export Audit

SVG-first contract defined; PDF/report/social export contracts complete; 14 reference SVGs parse successfully. Web report visuals now consume typed visualization ViewModels, but the static renderer does not yet consume those same ViewModels.

Required completion evidence:

- deterministic SVG generated from the same ViewModels used by the Web report;
- print layout with embedded line/role/timing legends;
- PDF rendering and visual comparison against the Web report;
- privacy-safe social export with no question text or report identifiers unless explicitly selected;
- regression fixtures for partial and unsupported states.

Status: `CONTRACT_READY_RENDERER_INTEGRATION_PENDING`.
