# Play screen redesign

Design package for the gameplay screen (after a player picks a story). Created from a Claude Design session on 2026-09-24. It replaces the "as built" look and behaviour with a violet and teal, RPG-plus-chat experience that adapts to the story's rulesets.

Read in this order:

1. `SPEC.md` is the source of truth: what to build, per screen, with behaviour and acceptance criteria.
2. `boards/` holds a PNG of every board. Filenames match the board ids used in `SPEC.md`. Use them for layout, spacing and visual tone.
3. `tokens.css` holds colours, type and sizing. Wire these into `frontend/src/index.css` and `tailwind.config.js`; never hardcode hex in components.
4. `ROADMAP.md` is the phased build order with acceptance checks.
5. `sources/` holds the editable `.dc.html` boards. They are static inline-styled mockups made for Claude Design, not production code. Match their look and behaviour; do not copy the markup.
6. `boards/as-built/` shows the screen before the redesign, for comparison.

## Rules of thumb

- All names in the boards (Kiera, Bram, Thessaly, Ryn, the Gilded Stag) and all numbers are sample data. Never hardcode them.
- Where a board and `SPEC.md` disagree, `SPEC.md` wins. Raise the conflict rather than guessing.
- Follow the existing repo rules in `.agent/rules` (shadcn primitives first, accessibility first, scope adherence). Anything the spec needs that is not in `frontend/src/components/ui` should be added there as a primitive.
- Live boards (private canvas): https://claude.ai/artifact/6NdQ8F2omEHRKhYpS899CE
