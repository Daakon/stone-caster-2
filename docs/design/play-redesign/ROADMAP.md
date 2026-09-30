# Build order

Each phase ships on its own and leaves the screen working. Later phases depend on the ones before. Check the acceptance line before moving on.

## Phase 0: Tokens and mobile-first shell
Task brief: `PHASE0_BRIEF.md` (slices 0A tokens, 0B shell against fixtures, 0C backend play view). SPEC §11 applies.
Wire `tokens.css` into the shadcn variables and Tailwind. Build the play shell mobile first: at 390, the mobile header, vitals strip, cast stack and thumb-zone composer; at 768 and up, the top bar with panel toggles and Focus, a Character panel and a Here panel, each open, slim or hidden, and the story column. Render only modules the session's rulesets declare (no Health, no default 100s). Retire the unused `stone`/`magic` palettes or map them to the new tokens.
Closes gaps: navigation, brand, reading rhythm, header fallbacks, accessibility basics (44px targets, 12px minimum text, labelled icon buttons), fixed rails.
Accept: 390, 1100 and 1440 match `docs/design/screens/Play-Mobile.png`, `Play--slim-rails.png` and `Play.png` for layout and colour; panel toggles and Focus work by keyboard; no text under 12px; every icon-only button has an accessible name; `node scripts/check-design-tokens.mjs` passes.

## Phase 1: Composer and turn states
Do/Say/Look composer, single-tap chips that draft (no double-click), explicit send, slash commands, three-phase progress card, error with retry (no cancel), system lines and the resolution receipt as collapsible mono rows.
Closes gaps: chip gesture, waiting voices, system lines.
Accept: matches `R-States`; keyboard-only use works; a failed turn shows retry and never partial content.

## Phase 2: Typed narration and entity links (backend and frontend)
Introduce the shared block schema, tagged Narrator output, streaming parser, deterministic entity linker with alias table, and the `mentions` store. Frontend renders block components and entity link runs.
Closes gaps: entity links, reading rhythm.
Accept: see `R-Text` and `R-Text-Pipeline`; invented ids are stripped; first mention per paragraph only; density setting works; reloading a turn reproduces the same links.

## Phase 3: Peek, verbs and dossier
Peek popovers, verb menu, text selection bar, ambiguity chooser, NPC dossier (What you know, History, Rumors) backed by the per-entity knowledge log, locked and redacted slots, private notes.
Closes gaps: right rail, vitals/knowledge mismatch.
Dossier sections are assembled from the story's NPC rulesets (SPEC §11.4).
Accept: see `R-Text-Interact`, `R-Desktop-NPC`, `R-M3-Dossier`, `docs/design/screens/Play-Codex.png`, `Play-Codex--relationships-only.png` and `Play-Mobile-Dossier.png`. Facts show source and turn. Nothing appears that the player has not learned.

## Phase 4: Mobile sheets and thumb zone
Full bottom sheets for Here, Dossier and Character (the strip, cast stack and composer already ship in Phase 0); action tray; keyboard hides chips; critical vitals undock to a floating bar; Layout and HUD settings screen with presets and per-module Always / On change / Never (SPEC §11.2) if not already shipped after Phase 0.
Closes gaps: mobile.
Accept: `R-M1` to `R-M8` on a 390x844 viewport; sheets are reachable one-handed; no horizontal scroll.

## Phase 5: Conversation mode and Journal
Conversation mode with topics and typed responses; Codex modal with Journal, People, Character, Lore, Means.
Accept: `R-Conversation`, `R-M8-Conversation`, `R-Journal`.

## Phase 6: Ruleset-driven HUD
Per-ruleset HUD manifest and module registry; profiles for cozy, Chimera core, d20 and action-economy systems; custom fallback rows.
Accept: `R-Systems` and `docs/design/screens/Play-Systems.png`. Switching story profile changes modules only; the story column, composer, dossier and Here rail are unchanged.

## Phase 7: Combat and polish
Combat state (vignette, critical vitals, resolution ladder, combatants, ways out), sensory effect tiers, reader controls, reduced-motion support.
Accept: `R-Combat`, `R-M5-Combat`; all animation respects `prefers-reduced-motion`.
