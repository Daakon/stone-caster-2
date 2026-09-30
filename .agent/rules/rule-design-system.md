---
trigger: always_on
---

For any frontend UI work (new screens, restyling, components), follow the design system in `docs/design/` (start at `docs/design/README.md`).

- Design and build mobile first at 390x844, then 1100 and 1440. Check the matching `*-Mobile.png` in `docs/design/screens/` before the desktop one.
- Take every colour, font, radius, spacing and layout size from `docs/design/play-redesign/tokens.css`, through the shadcn HSL variables, the `--sc-*` custom properties, or Tailwind theme entries that read them. Never add raw hex/rgb values or Tailwind palette classes (`text-cyan-400`, `bg-zinc-800`, `from-purple-900`) in new or changed code. Run `node scripts/check-design-tokens.mjs`.
- Colour roles: violet (`--sc-primary`) is the player and primary actions; teal (`--sc-accent`) is mechanics, knowledge, places and Stones; red (`--sc-danger`) is health, combat and destructive actions only; amber (`--sc-warn`) is pending, read-only and at-cap states. Colour is never the only signal.
- Fonts: Fraunces for names and titles, Newsreader for story prose, DM Sans for interface, JetBrains Mono for rolls, receipts, Stones amounts and keys.
- Minimum text 12px, minimum tap target 44px, visible focus ring (`--sc-focus`), labelled icon-only buttons, and `prefers-reduced-motion` respected.
- Use shadcn primitives from `frontend/src/components/ui` underneath. App-specific components go under `frontend/src/features/<area>/components`. `docs/design/style-guide/COMPONENTS.md` lists the intended components and their rules. `reference-components.css` is a visual reference only; never import it.
- Copy follows the voice in `STYLE_GUIDE.md`: second person, sentence case, verbs on buttons, no apologies in errors, player words (Stones, stories, saved games) rather than system words.
- If a screen, the style guide and `SPEC.md` disagree, SPEC wins. Report the conflict in your summary.
