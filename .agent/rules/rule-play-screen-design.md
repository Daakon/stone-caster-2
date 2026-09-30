---
trigger: always_on
---

When creating or modifying the gameplay ("play") screen, including its layout, HUD, narrative text rendering, entity links, dossiers, composer, combat state or mobile sheets, follow the approved redesign in `docs/design/play-redesign/`.

- Read `SPEC.md` first. **§11 (2026-09-30) overrides earlier sections and older boards**: mobile first; player-controlled panels (open/slim/hidden, focus, per-module Always/On change/Never, Layout and HUD settings); never invent stats (no ruleset declares Health, so show condition words and declared vitals only); the dossier and Character panel are assembled from the story's rulesets.
- Visual references: `docs/design/screens/Play*.png` and `HUD-Settings*.png` first, then the older `boards/` for detail they don't cover.
- Take colours, type and sizing from `tokens.css`, never hardcoded values (see `rule-design-system.md`).
- Build in the order in `ROADMAP.md`. The current phase's task brief is `PHASE0_BRIEF.md`.
- Render a HUD module or dossier section only when the session's pinned rulesets declare its fields. An absent field is absent, not a placeholder or a default of 100. The player sees only learned facts.
- Names and numbers in screens and boards are sample data and must not be hardcoded.
- If the spec conflicts with the current code or another rule, report the conflict instead of choosing silently.
