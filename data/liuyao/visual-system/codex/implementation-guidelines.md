# Codex Implementation Guidelines

## Correct order
1. Read Batch 00 foundation contracts.
2. Audit current ProductResultFacts / DivinationResultFacts.
3. Read current Guided / Professional ViewModels.
4. Resolve repository adapters for each VIS-LY ViewModel.
5. Implement shared tokens and line encoding.
6. Implement P0 components first: VIS-LY-001..010.
7. Wire states + accessibility + reduced motion.
8. Add static renderer.
9. Apply existing-visual canonicalization to content pages without changing historical IDs.
10. Connect Batch 06 snippets to visual recommendations.
11. Add P1 components only where product usage exists.
12. Run visual/mobile/report regression.

## Architecture
`Professional Facts -> ProductResultFacts -> Presenter -> Visualization Adapter -> Typed ViewModel -> Component`

No component is allowed to import domain calculation code for the purpose of re-deriving professional conclusions.
