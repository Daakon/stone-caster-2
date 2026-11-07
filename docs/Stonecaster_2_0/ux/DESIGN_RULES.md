# Design rules for 2.0

These rules apply to every screen. Tokens are in `tokens/tokens.json` (source of truth, copied from the Stonecaster design system) and `tokens/tokens.css` (generated CSS variables for `packages/ui`). Product code uses tokens only; `pnpm design:check` should fail on raw colours.

## Look

- **Dark is the default theme**; light is a mapped companion with the same roles.
- **Violet (`sc-primary`)** = the player and primary actions (send, selected segment, player bubble label, focus ring). Text on violet uses `sc-on-primary`.
- **Teal (`sc-accent`)** = knowledge and change: change chips, places, costs, "learned", the player's own portrait ring.
- **Red (`sc-danger`)** = health/conditions and destructive actions only. **Amber (`sc-warn`)** = items, open threads, pending states.
- Surfaces step up `sc-bg-page → sc-bg-panel → sc-bg-card → sc-bg-raised`; separate with `sc-border` hairlines, not shadows. Shadows only on floating things (sheets, popovers).
- **Type:** Fraunces 600 for names and titles (one title per card) · Newsreader for story prose (17/1.65 phone, 19/1.7 desktop, 720 measure) · DM Sans for UI · JetBrains Mono for costs, turn sources, stats. Nothing below 12px.
- Radii: controls 10, cards 14, sheets 22, chips/avatars 999. 4px spacing scale. 16px phone gutter, 32px desktop.
- No gradients-as-decoration, no emoji, no left-border accent cards.

## Scrollbars

**No visible scrollbars anywhere.** Scrolling still works by touch, wheel, trackpad and keyboard. This follows the native phone convention (overlay scrollbars that stay hidden) and applies it on desktop too, so the app looks the same everywhere.

```css
* { scrollbar-width: none; -ms-overflow-style: none; }
*::-webkit-scrollbar { display: none; width: 0; height: 0; }
```

Compensate so content is still discoverable:

- Horizontal rails (`ChipRail`): `scroll-snap-type: x proximity`, children `scroll-snap-align: start`, an edge fade mask (16px left, 40px right), and the last item partly visible.
- Vertical feeds: sticky headers/composers make scroll position obvious; Play auto-scrolls to the newest turn and shows a "Jump to latest" pill when the player has scrolled up.
- `overscroll-behavior: contain` on sheets and rails so the page behind does not move.
- Keyboard: scroll containers that hold focusable content get `tabindex="0"` only when they have none.
- Never create horizontal page scroll: the 390 Playwright gate checks `scrollWidth <= clientWidth`.

## Images

Images are a first-class part of the experience: story covers, scene images, NPC and player portraits, and element images (places, items, factions). See the image-slot table in `COMPONENTS.md`.

- **Upload is free** (size and type limits, a content check). **Generation costs Stones** at a configurable per-image price. Show the cost on the button before the tap (`CostBadge`), reserve on start, settle on success, refund on failure.
- Images live in object storage (Supabase Storage or R2); rows store keys, not bytes. Serve resized variants (portrait 128/256, cover 800/1600) with `srcset`.
- Portrait rings carry meaning: violet NPC, teal the player's character, dashed grey unidentified. Ring is 2px.
- The reference SVGs in `reference/assets/` are **placeholder art** in the brand palette. Do not ship them as real content; they show crop, size and placement.

## Element links

Names in prose are links to elements. Each kind has a colour **and** an underline shape, so colour is never the only signal:

| Kind | Token | Underline |
| --- | --- | --- |
| Character | `sc-ent-npc` | dotted |
| Unidentified character | `sc-ent-unknown` | dotted grey, alias only |
| Place | `sc-ent-place` | dashed |
| Item | `sc-ent-item` | solid |
| Lore | `sc-ent-lore` | double |
| Faction | `sc-ent-faction` | wavy |

Underline offset 4px, thickness 1.5px.

## Words

- Second person, present tense in play. Sentence case everywhere. Buttons state the outcome ("Begin as Rowan", "Create Wren", "Make it playable").
- Player copy says **stories, characters, companions, party, worlds, Stones, templates**. Never "ruleset", "entity", "timeline", "scenario run", "compiled", "HUD" in player-facing text. Creator tools may say **elements**, **lore**, **story instructions**, **custom instructions**.
- Errors say what happened and what to do, without apology: "The scene didn't finish. Nothing was charged and your words are kept."

## Accessibility (gates from the implementation plan)

- 44px minimum targets at every size; 0 serious/critical axe violations at 390, 1100, 1440.
- Real `<button>`, `<a href>`, `<input>` + `<label>`; icon-only buttons have `aria-label`.
- 2px `sc-focus` ring with 2px offset on everything interactive.
- Sheets trap focus, close on Esc and scrim, return focus to the opener.
- `prefers-reduced-motion`: no pulses, typewriter reveal or animated rings.
