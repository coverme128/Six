# Liuyao Visual System & Asset Orchestration Package v1.0

## Package role
This package is the canonical **visual implementation and asset orchestration contract** for the active public Liuyao product. Any remaining Meihua code is legacy compatibility and is outside this visual system's public scope.

It governs:
- product visual language,
- registered reusable visualizations,
- typed visualization ViewModels,
- Guided / Professional density rules,
- motion and responsive behavior,
- editorial asset templates,
- static/PDF/social export,
- existing Content Visual canonicalization,
- Explanation Snippet → Visualization mapping,
- visual fixtures,
- QA and Codex integration boundaries.

It does **not** modify CAL_STD_V1, CORE_V1, casting rules, Yongshen rules, Strength/Dynamic/Pattern/Timing rules, or Evidence Conflict logic.

## Source-of-truth direction
`Professional Facts / ProductResultFacts -> Presentation Facts -> Visualization ViewModel -> React/SVG`

Never reverse this relationship.

## Relationship with Content Growth Batch 00–07
Batch 00–07 own content, explanation, SEO and growth data. This package owns the visual execution contract and canonical reusable visualization layer. Existing Batch visual IDs remain stable; they are mapped to registered VIS-LY components or editorial templates rather than deleted or renumbered.
