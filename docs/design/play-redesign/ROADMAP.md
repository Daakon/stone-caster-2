# Build order

Each phase ships on its own and leaves the screen working. Later phases depend on the ones before. Check the acceptance line before moving on.

## Phase 0: Tokens and shell
Wire `tokens.css` into the shadcn variables and Tailwind. Rebuild the layout shell (top bar, left rail, story column, right "Here" rail, mobile header) with the current data. Retire the unused `stone`/`magic` palettes or map them to the new tokens.
Closes gaps: navigation, brand, reading rhythm, header fallbacks, accessibility basics (44px targets, 12px minimum text, labelled icon buttons).
Accept: desktop XL, laptop and 390px mobile match `R-Desktop` and `R-M1-Play` for layout and colour; no text under 12px; every icon-only button has an accessible name.

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
Accept: see `R-Text-Interact`, `R-Desktop-NPC`, `R-M3-Dossier`. Facts show source and turn. Nothing appears that the player has not learned.

## Phase 4: Mobile sheets and thumb zone
Bottom sheets for Here, Dossier and Character; vitals mini strip; cast avatar stack; action tray; keyboard hides chips; critical vitals undock to a floating bar.
Closes gaps: mobile.
Accept: `R-M1` to `R-M8` on a 390x844 viewport; sheets are reachable one-handed; no horizontal scroll.

## Phase 5: Conversation mode and Journal
Conversation mode with topics and typed responses; Codex modal with Journal, People, Character, Lore, Means.
Accept: `R-Conversation`, `R-M8-Conversation`, `R-Journal`.

## Phase 6: Ruleset-driven HUD
Per-ruleset HUD manifest and module registry; profiles for cozy, Chimera core, d20 and action-economy systems; custom fallback rows.
Accept: `R-Systems`. Switching story profile changes modules only; the story column, composer, dossier and Here rail are unchanged.

## Phase 7: Combat and polish
Combat state (vignette, critical vitals, resolution ladder, combatants, ways out), sensory effect tiers, reader controls, reduced-motion support.
Accept: `R-Combat`, `R-M5-Combat`; all animation respects `prefers-reduced-motion`.
