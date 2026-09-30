# Design sources

Everything an agent or developer needs to build the UI. Read in this order:

1. `play-redesign/SPEC.md`: behaviour and acceptance, including **§11**, the newest decisions (mobile first, player-controlled panels, no invented stats, ruleset-driven dossier).
2. `style-guide/STYLE_GUIDE.md`: voice, colour, type, spacing, iconography, motion.
3. `play-redesign/tokens.css`: the only source of colours, fonts and sizes.
4. `style-guide/COMPONENTS.md`: component inventory and rules. `style-guide/reference-components.css` has exact visual values for reference only.
5. `screens/README.md`: rendered screens for every page, mobile and desktop.
6. `play-redesign/ROADMAP.md`, `PLAN.md` and `PHASE0_BRIEF.md`: build order and the current phase's tasks.

Order of authority when sources disagree: SPEC.md (§11 first) > PLAN.md > screens > older boards. Report conflicts instead of choosing silently.

## Live design files (private)

The screens are exported from a live design canvas, and the style guide from a live design system. Both are private to the project owner and are not needed to do the work. The PNGs and markdown here are the reference.

- Design canvas "Stonecaster Experience": https://claude.ai/artifact/YEutJpuzi9y5tsg1wwGybe
- Style guide "Stonecaster": https://claude.ai/artifact/8Xf3Xeq2hJFwG7Pv3883Wn

When a design changes, the owner re-exports the PNGs into `screens/`. Code that needs a design change should be raised in the PR, not decided in code.
