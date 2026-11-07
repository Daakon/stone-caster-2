# Stonecaster 2.0 — UX design pack (for coding agents)

Updated 2026-11-01. This folder is the **player-facing design authority** for 2.0: what the product looks like, how a stranger becomes a paying player, and how play, characters and creation work on screen. It sits beside the architecture docs in this folder (`stonecaster2-design/`, `STONECASTER_2_IMPLEMENTATION_PLAN.md`, `STONECASTER_2_PHASE_BREAKDOWN.md`).

## Read in this order

1. **`PRODUCT_FLOW_PLAN.md`** — the why: positioning, site map, conversion funnel, first session, play levels, creation, characters, monetization, build order. Decisions in it are product decisions.
2. **`SCREENS.md`** — one spec per screen: route, layout, states, behaviour, data, analytics.
3. **`COMPONENTS.md`** — the reusable pieces and their props, plus image slots.
4. **`DESIGN_RULES.md`** — colour, type, scrollbars, images and costs, element links, copy, accessibility.
5. **`screens.manifest.json`** — the same screens as data (IDs, routes, files, build phase).

Look at `screenshots/<id>.png` for the target; open `reference/<id>.html` in a browser for exact spacing, sizes and markup structure.

## What's in the folder

```
ux/
  README.md                this file
  PRODUCT_FLOW_PLAN.md     product and flow plan (export of the living doc)
  SCREENS.md               per-screen specs
  COMPONENTS.md            component inventory and image slots
  DESIGN_RULES.md          visual, scrollbar, image, copy and a11y rules
  screens.manifest.json    machine-readable screen list
  tokens/
    tokens.json            design tokens (source of truth, from the Stonecaster design system)
    tokens.css             generated --sc-* variables, dark default + light
  reference/               static HTML for each screen + sc.css + placeholder art in assets/
  screenshots/             PNG renders (390×844 @2x for phone screens; landing at 1440 and 390)
```

## How to use the reference HTML

- It is a **visual and structural reference, not production code.** It uses inline styles and raw hex values so it renders on its own. Product code must use the `--sc-*` tokens through `packages/ui` and pass `pnpm design:check`.
- Translate each screen into components from `COMPONENTS.md`; don't copy markup wholesale.
- Sample names (Rowan, Lyra, Tessa, Provost Merin, Emberlight Academy, The Vanished Bond, Ashfall Expedition, Saltmere) are fixture content. Never hardcode them; load from data or test fixtures.
- `[Bracketed]` text is an open value (prices, Stones amounts, creator names). Leave it configurable.
- `reference/assets/*.svg` are placeholder art. They show image placement, crop and size, not final art.
- The editable source of these screens is the design canvas: https://claude.ai/artifact/Y6nuHfyRaCGK1GqAz2s8G6. The living plan doc is https://claude.ai/artifact/NBcg1TdTHQKp3YZxZiyvqo. If they change, this folder is re-exported; don't edit the exports by hand.

## Non-negotiables for every screen

- Phone first at **390×844**; must also pass at **1100** and **1440** with 0 serious/critical axe violations and no horizontal scroll.
- **No visible scrollbars**; rails snap and fade at the edge (`DESIGN_RULES.md`).
- **Images everywhere they belong**: story covers, scene images, NPC and player portraits, element images. **Uploading is free; generating costs Stones**, shown on the button before the tap.
- **Element names in prose are tappable** and styled by kind (colour + underline shape).
- **No jargon in player copy**: no "ruleset", "entity", "timeline", "HUD", "scenario run".
- **Guest play first**: Play works without an account; the save prompt arrives at turn 5.
- **Characters change with the story**: committed turns add "From your stories" entries that show as change chips in Play and on the character page.

## Product decisions that override older docs

Ed made these decisions on 2026-11-01. Where an older document in this folder says otherwise, **these win**; flag the conflict in your PR rather than building the older version.

| Decision | Overrides |
| --- | --- |
| **No deterministic engine of any kind.** Stats, dice, checks and systems live in story, element and character text (custom instructions and templates). The server parses the storyteller's structured output, validates it and commits it; it never computes an outcome. | `STONECASTER_2_IMPLEMENTATION_PLAN.md` D4 "Mode 2 Deterministic TypeScript CapabilityProvider" and the P5 "Mode 2 TypeScript System Proof"; any coded RPG system providers. |
| **Characters are persona-style** (face, name, one line; optional personality, appearance, custom instructions) with **templates** instead of stat sheets. No system-specific character sheet or validation. | Character Forge steppers, per-ruleset creation manifests, stat-sheet forms. |
| **Rules are text, not configurable platform systems.** A story's style is Story / Light RPG / Full RPG plus story instructions. | Creator-facing "rule pack" / "system pack" builders as a separate content type in player or creator UI (P3.4, P4.1 `draft_system_pack`). Internal prompt modules that the platform itself maintains are fine. |
| **Status card instead of a HUD.** Values a template asks to track are returned by the storyteller each turn and saved with the committed turn. | HUD manifests, vitals strips, `CapabilityModuleView` as gameplay state. |
| **Elements** (characters, places, factions, items, lore) are the building blocks of worlds and the targets of tappable names; their text is indexed for retrieval. | — (keeps the earlier element vocabulary) |

The plan doc's "Architecture implications" section lists the remaining decisions (guest play via Supabase anonymous sign-in, undo/retry, crawlable public pages, versioned cache keys, analytics events).

## Build order

Phase A (front door) first: landing, story page, pick-character, Play at Story level, guest save, starter + daily Stones, analytics. Then B (party, recap, characters), C (create), D (status card templates, paid plans). `screens.manifest.json` tags each screen with its phase.

## Not designed yet

Browse, world page, public character page, pricing page, signed-in Home, Library, Account and Stones, Stones-low sheet, publish sheet, guided edit sheet, and Play at 1100/1440. Build them from the components and rules here; ask for a design pass before inventing a new pattern.
