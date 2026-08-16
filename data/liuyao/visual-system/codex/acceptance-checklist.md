# Acceptance Checklist

## Visual system
- [x] canonical tokens loaded
- [x] no independent style fork
- [x] Modern Eastern Analytical maintained

## Visualization
- [x] stable VIS-LY ID
- [x] typed ViewModel
- [x] no domain recalculation
- [x] Guided mode where required
- [x] Professional mode where required
- [ ] static/report mode: on-screen complete; same-ViewModel SVG/PDF pending
- [x] loading/partial/error/unsupported states

## Hexagram-specific
- [x] 初爻 bottom / 上爻 top
- [x] casting builds bottom-to-top
- [x] Yin/Yang not treated as good/bad
- [x] moving/static not treated as good/bad
- [x] Shi/Ying context not hardcoded
- [x] Yongshen selection not computed in visual layer
- [x] no invented strength score
- [x] Timing candidate never rendered as guaranteed date

## Accessibility / Responsive
- [x] keyboard/focus styles
- [x] non-color semantics
- [x] localized labels and baseline ARIA
- [x] reduced motion
- [~] 360 / 390 / 430 mobile layouts: responsive contract implemented; automated visual snapshots pending
- [x] no mechanically shrunken desktop board
- [ ] screen-reader narration automation

## Export
- [ ] SVG/print/PDF checked
- [ ] embedded legends in static exports
- [~] privacy-safe social export: contract and assets ready; end-to-end export pending

## Existing assets
- [x] historical Bxx-VIS stable IDs preserved
- [x] mapped visuals derive from canonical tokens and component language where practical
- [x] no mass rewrite of existing content pages solely for visual refactor

Legend: `[x]` complete, `[~]` partially verified, `[ ]` open release gate.
