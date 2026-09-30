# Stonecaster style guide

The brand book for every screen in the app. Tokens: `docs/design/play-redesign/tokens.css`. Components: `COMPONENTS.md`. Screens: `docs/design/screens/`. Play-screen behaviour: `docs/design/play-redesign/SPEC.md` (its §11 wins over older boards).

Type styles referenced below (for example `sc-prose`) are the named sizes in the Type section, not CSS classes to copy.

Stonecaster is an AI tabletop storyteller: handcrafted worlds, story-level rulesets, and a narrator that adapts to the player. The interface should feel like **a tabletop you can read, with a companion you can talk to**. The story is the hero; everything else is one tap away.

This guide extends the approved play-screen redesign (`docs/design/play-redesign/tokens.css`, `SPEC.md`, boards) to the whole app: marketing, catalog, character creation, the Casting Circle, creator tools, account and Stones, and admin. Where this guide and `SPEC.md` disagree about the play screen, `SPEC.md` wins.

## Principles

1. **Story first.** The reading column is central. Rails, sheets and chrome support it and never compete.
2. **The world stays visible.** Location, time band and who is present are always one glance away in play.
3. **Every name is a door.** Characters, places, objects, lore and factions in prose are interactive (see EntityLink).
4. **Show only what the player has learned.** Facts carry a source and a turn. Unknown slots are visible but redacted. Never leak a true name.
5. **Honest waiting, no cancelling.** Running turns show real named phases. Errors offer Try again only.
6. **Built from the story.** HUD modules come from the story's active rulesets. The shell never changes; absent fields are absent, never defaulted to 100.
7. **Thumb zone on mobile.** Composer, chips and critical vitals live in the bottom third; everything else is a sheet.

## Voice and copy

- Speak to the player as "you". Second person, present tense in play ("You do", "What do you do?").
- Plain, warm, a little literary in story-facing places (titles, empty states, the landing page). Direct and exact in tools and admin.
- Sentence case for buttons, titles and menu items. Uppercase only for 12px overlines and speaker names, with 0.08em tracking.
- Name things the way players recognize them: *Stones*, *stories*, *saved games*, *characters*, *worlds*. Never *compiled story*, *game state*, *entity* or *ruleset template* in player copy. Creator tools may say *elements*, *forces*, *lore*; admin may use the system words.
- Buttons state the outcome: "Begin story", "Continue", "Bind fate", "Try again", "Delete saved game". No "OK", "Submit".
- Errors say what happened and what to do, with no apology: "The scene didn't finish. Nothing was charged and your words are kept."
- No emoji. Sample names in boards (Kiera, Bram, Thessaly, the Gilded Stag) are placeholders; never hardcode them.

## Colour

Dark is the primary theme and the default; Light is a mapped companion with the same roles.

- Surfaces step up in lightness: `--sc-bg-page` (ground) → `--sc-bg-panel` (rails, header, composer) → `--sc-bg-card` (cards, chips, inputs) → `--sc-bg-raised` (popovers, player bubble, selected). Separate surfaces with `--sc-border` hairlines, not shadows.
- Text: `--sc-text` for prose and primary labels, `--sc-text-soft` for secondary, `--sc-text-muted` for hints and meta. `--sc-text-faint` is decorative only.
- **Violet (`--sc-primary`) is the player and the primary action**: the send button, the active tab or segment, the player's bubble label, focus. Text on violet fills is `--sc-on-primary`, never literal white.
- **Teal (`--sc-accent`) is mechanics and knowledge**: rolls and receipts, bonds, places, "Learned", the Stones gem. Use `--sc-accent-soft` for teal text.
- **Red (`--sc-danger`) is health and combat only** in play, and destructive actions elsewhere. Never use red for "at cap" or pending states; that is `--sc-warn`.
- Amber (`--sc-warn`) marks items in prose, partial success, and states that need attention without being broken (Internal content, Read-only over cap, Starter grant pending).
- Entity kinds each have a colour token **and** an underline shape. Colour is never the only signal; vitals show numbers, pills carry words.
- Keyboard focus: 2px solid `--sc-focus` ring with a 2px offset on every interactive element.

## Type

- **Fraunces** (`--sc-font-display`): names, titles, the wordmark. Semibold. Used with restraint: one title per card.
- **Newsreader** (`--sc-font-prose`): story text and blurbs. `sc-prose` (type style) 19/1.7 on desktop at a 720px measure (`--sc-measure`); `sc-prose-mobile` (type style) 17/1.65.
- **DM Sans** (`--sc-font-ui`): all interface text. `sc-body` (type style) 15/22, `sc-small` (type style) 13/18, `sc-overline` (type style) 12/16 uppercase.
- **JetBrains Mono** (`--sc-font-mono`): mechanics chips, rolls, receipts, Stones amounts in ledgers, content keys and hashes.
- **Nothing below 12px.** Tabular figures wherever numbers line up.
- Fonts load from Google Fonts until licensed local files are added to `frontend/public/fonts/`.

## Space, shape and layout

- 4px base: `--sc-space-1` (4) through `--sc-space-7` (56). Lay out siblings with `gap`.
- Every interactive target is at least `--sc-tap` (44px) on every device.
- Radii: `--sc-radius-control` (10) for buttons and inputs, `--sc-radius-card` (14) for cards and the composer, `--sc-radius-sheet` (22) for sheet tops and the Codex modal, `--sc-radius-chip` for pills, chips and avatars.
- Shadows only on things that float: `--sc-shadow-pop` (peek, menus, critical bar) and `--sc-shadow-sheet`. Cards stay flat.
- App pages: `--sc-header-h` (56px) header, content max 1200px, 32px desktop and 16px mobile gutter.
- Play at 1440: header 56, left rail `--sc-rail-left` 288, story column at `--sc-measure`, Here rail `--sc-rail-right` 328. These are defaults: the player can set each panel open, slim (64px) or hidden, or enter Focus (SPEC §11.2). Below 768 the panels become a vitals strip, a cast stack and bottom sheets. Design at 390 first.

## Imagery and marks

- The mark is a violet stone disc cast over teal ripple rings: `frontend/public/favicon.svg`. Use it at 28px in the header beside the wordmark set in Fraunces.
- The ripple is the recurring motif: concentric rings for loading, empty states and generated story art. Until real cover art exists, story and world art is a composition of token-coloured discs and rings, never stock gradients or AI-looking purple-blue washes.
- Portraits are round avatars with a 2px ring: violet for known characters, dashed grey for unidentified, teal for the player's own character in lists, red in combat.

## Iconography

- Lucide-style 24px line icons at 1.8 stroke, drawn with `currentColor`, shown at 16–18px. shadcn/lucide-react is already in the codebase.
- Common: heart (health), zap (stamina), utensils (satiety), eye (observe/look), message-circle (say/ask), bed (rest), clock (wait), book-open (Journal), map-pin (location), moon (time band), dice (checks), sparkles (learned), lock (locked/read-only), swords (combat).
- Every icon-only control has an accessible name.

## Motion

- Short and purposeful: 150–200ms fades for peeks and sheets, bar fills animate on vital change, one pulse when an entity gains information.
- Under `prefers-reduced-motion`, replace pulses, typewriter reveal and the combat vignette animation with static states.

## Surfaces across the app

| Area | Pattern |
|---|---|
| Landing | Display hero with the ripple mark, story cards as proof, three "how it plays" beats, request-access form. |
| Stories, Worlds | Filter chips over a grid of StoryCards; detail pages lead with art, blurb, the story profile (rulesets as HUD modules), then Begin. |
| Start and Character Forge | Choose a premade or your own character; the Forge is a stepper driven by the story's creation manifest. |
| Play | The redesign boards: top bar, character rail, story column, Here rail, composer. |
| Casting Circle | Six-step stepper (World, Forces, Elements, Lore, Narrative, Bind) with autosave state; missing references shown as Notices that block Bind. |
| My Stories, My Creations | Resume cards and owned content tabs, with tier usage meters and read-only pills. |
| Account and Stones | Balance card, per-turn price, ledger table, plan usage, active-item picker. |
| Admin | Panel sidebar, dense tables, release pills (Internal / Published), audited actions that require a reason. |
