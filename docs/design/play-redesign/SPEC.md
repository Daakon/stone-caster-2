# Play screen redesign: spec

Status: design approved for build planning. **§11 (2026-09-30) records later design decisions and overrides earlier sections where they conflict.** Boards: `boards/*.png`. Tokens: `tokens.css`. Order of work: `ROADMAP.md`.

Goal: make the gameplay screen feel like a good RPG (a world that stays visible, characters you can inspect, typed dialogue and choices) with the richness of a good AI chat (one strong composer, follow-ups, streaming, actions on every response). Text is the primary delivery system, so the text layer is designed as carefully as the layout.

## 1. Principles

1. Story first. The reading column is central; rails and sheets support it.
2. The world stays visible. Location, time band and who is present are always one glance away.
3. Every name is a door. Names, places, objects and terms in the prose are interactive.
4. Show only what the player has learned. Facts carry a source and a turn. Unknown slots are visible but redacted.
5. Honest waiting, no cancelling. Turn processing shows named phases. There is no cancel button (per `docs/Chimera-Game-UX.md`); errors offer Try again only.
6. Built from the story. HUD modules come from the story's active rulesets. The shell never changes.
7. Thumb zone on mobile. Composer, chips and critical vitals live in the bottom third; everything else is a sheet.

## 2. Global rules

- Dark theme first; tokens in `tokens.css`. Violet is primary and the player's voice. Teal is mechanics, bonds, places and "learned". Red is health and combat only.
- Minimum text size 12px. Minimum interactive target 44x44px.
- Colour is never the only signal. Entity types differ by underline shape (see 6.2). Vitals show numbers, not just bars.
- Every icon-only control has an accessible name. All popovers, sheets and menus are keyboard reachable and trap focus correctly (use Radix-based shadcn primitives).
- Respect `prefers-reduced-motion`: replace pulses and the combat vignette animation with static equivalents.
- Sample content in boards (Kiera, Bram, Thessaly, Ryn, the Gilded Stag, sample numbers) is placeholder. Do not hardcode.

### 2.1 Transport for turns: no persistent WebSocket

Resolved 2026-09-26. Stonecaster is single-player: every screen update follows from a turn the player themselves submitted. Nothing needs to reach a client except in response to its own request (no other player, no GM/spectator view, no idle-tab push). That is the one condition that would justify a persistent, full-duplex WebSocket, and it doesn't hold here; a large share of the AI-RPG category (AI Dungeon included) started single-player and only bolted on multiplayer later, and multiplayer AI-DM products remain fragmented and unreliable industry-wide (context blowup, uneven "spotlight," turn collision) rather than a solved pattern worth architecting around pre-emptively.

So: the turn-in-progress card and streamed narration (Phase 1 and Phase 2) run over an HTTP-streamed response on the existing `POST /api/games/:gameId/turn` (chunked/fetch-stream, ordered JSON events, then the committed turn), not a separate WebSocket connection. For resilience, persist turn phase server-side keyed by `client_request_id` and add a plain `GET` status/poll endpoint a client can call if its stream drops (phone locked, network blip); it does not need to reconnect to a specific server instance, since nothing is pinned to a live socket. If genuine multiplayer or spectating is ever scoped in, treat it as its own initiative with its own transport decision, not something this redesign hedges for.

## 3. Component map (current to target)

| Current file (frontend/src) | Change |
|---|---|
| `features/play/layout/ThreeColumnLayout.tsx` | Rebuild shell: top bar, left rail, centered story column (prose width about 720px), right Here rail. Right rail is a slim rail on laptop, never hidden below `lg` without a mobile equivalent. |
| `features/play/components/GameHeader.tsx` | Top bar: back, story title with save state and turn, location with time band and mood, Journal, search, menu. Fix title/location fallbacks (never show raw ids or "Unknown"). |
| `features/play/components/LeftSidebar.tsx`, `sidebar/VitalsPanel.tsx`, `sidebar/StatusBadges.tsx` | Character rail: portrait, vitals with numbers and delta chips, pillars, objective, means. Content driven by the HUD manifest (section 8). |
| `features/play/components/HUD/HudSidebar.tsx` | Becomes the Here rail: scene card, Present cast cards, lore surfaced. |
| `features/play/components/HUD/MobileVitalsBar.tsx` | Mini-bar strip under the header plus floating critical bar. |
| `features/play/components/Narrative/*` (`NarrativeStream`, `TurnBlock`, `StoryBlock`) | Render typed blocks (section 6). Entity runs become buttons. |
| `features/play/components/Deck/InputDeck.tsx`, `SuggestionRail.tsx` | Composer with Do/Say/Look, macros, slash commands, "Continue with" typed options. |
| `features/play/components/modals/EntityInspectorModal.tsx` | Replace with peek popover plus dossier (right pane on desktop, sheet on mobile). |
| `features/play/utils/entity-utils.ts` | Extend for alias resolution, entity kinds and link styling. |
| `stores/useActiveGameStore.ts` | Add turn phase, selected entity, draft, reader settings. |
| `components/ui` | Add missing primitives if absent: context menu, tabs, tooltip. Use existing `popover`, `sheet`, `dialog`, `command`, `dropdown-menu`, `collapsible`, `progress`. |

## 4. Desktop play (`R-Desktop`, `R-Combat`, `R-Journal`, `R-States`)

Layout at 1440: top bar 56px; left rail 288px; story column centered with 720px prose width; right rail 328px. At 1100 the right rail narrows to a slim rail of avatars that expands on hover or click.

Story column, top to bottom: turn divider ("Turn 14 · Deep Night"); player turn (right aligned bubble, labelled You do / You say); mono mechanics chips (Insight rolled 34 vs 45 · Success, Stamina -10, Kiera +2 warmer) each expandable; narration; message actions (copy, save to journal); "Continue with" chips; composer pinned at the bottom.

Composer: segmented Do / Say / Look; multi-line input; hint "Enter to send, Shift+Enter for new line, / for commands"; macro chips (Observe, Rest, Wait); violet send button that stays disabled until there is text. Single click on a suggestion chip drafts it into the composer; it sends only on the send button or Enter. Slash commands (/journal, /lore, /status, /who) open in a command palette.

Turn in progress (states board): three named phases (for example Reading the room, Resolving your action, Writing the scene). Composer is disabled. No cancel. Error state: message, Try again, and the draft preserved.

Vital hit feedback: the bar animates and a delta chip (-10) appears beside the label for the turn.

Combat (`R-Combat`, `R-M5-Combat`): red inset vignette, "In combat, Round N" pill, critical vitals enlarged and, on mobile, undocked into a floating bar above the composer. Resolution ladder card shows the four tiers, the roll versus target, and intended target versus actual target when they differ. Right rail shows combatants, bystanders and ways out. Chips become tactics.

Journal / Codex (`R-Journal`): modal over a dimmed scrim with left navigation Journal, People, Character, Lore, Means. Journal shows the objective with progress, clues, a suggested lead, saved moments and a note.

## 5. Mobile (`R-M1` to `R-M8`)

Viewport 390x844 baseline.

- `R-M1-Play`: header (back, location and time, Journal). Under it a vitals mini-bar strip (tap opens Character) and a cast avatar stack (tap opens Here). Feed. Composer in the thumb zone: chip row plus "+" button, input with an inline "Do" mode chip, send. Keyboard open hides the chips.
- `R-M2-Here`: bottom sheet at about 78% height with scene card, Present cast cards (48px avatar, name, role, disposition, count known), lore surfaced.
- `R-M3-Dossier`: 85% sheet. Header portrait and status, disposition meter, tabs Known / History / Rumors, facts with source and turn, a locked redacted row with a hint, "Still unknown" chips, sticky actions (Speak to, Look closer).
- `R-M4-Character`: sheet with tabs Character, Journal, People, Lore. Vitals with numbers, pillars, traits and quirk, objective.
- `R-M5-Combat`: vignette, combatants strip, collapsed receipt, floating critical bar above the composer, tactic chips.
- `R-M6-Tray`: the "+" sheet: quick actions (Observe, Rest, Wait), Open (Journal, Character, People, Lore), menu (Save and exit, Download transcript, Report a problem, Abandon with confirmation).
- `R-M7-Reading`: reading view with entity links and the peek sheet anchored above the composer (avatar, disposition, one fact, Speak to and Dossier).
- `R-M8-Conversation`: conversation mode on mobile (section 7).

## 6. Text system (`R-Text`, `R-Text-Interact`, `R-Text-Pipeline`)

### 6.1 Block types
Narration is a list of typed blocks, not a string:
`scene`, `narration`, `dialogue` (speaker, tone), `voice` (pillar, check result), `learned` (entity, fact), `player`, `choices`. Narration and dialogue text is a list of runs; a run is plain text or an entity reference. Rendering: prose in `--sc-font-prose`, speaker names uppercase 12px with tracking, tone notes italic muted, voice blocks as bordered cards with a pillar-coloured left edge and the roll in mono, "Learned" lines as dashed teal rows linking to the dossier.

### 6.2 Entity links
| Kind | Colour token | Underline | Opens |
|---|---|---|---|
| Character | `--sc-ent-npc` | dotted | Peek then dossier |
| Unidentified character | `--sc-ent-unknown` | dotted, grey | Peek showing only what is known |
| Place | `--sc-ent-place` | dashed | Peek with exits and who is present |
| Object | `--sc-ent-item` | solid | Peek with Examine, Take or Use as the ruleset allows |
| Lore term | `--sc-ent-lore` | double | Glossary card with source |
| Faction | `--sc-ent-faction` | wavy | Standing and known members |

A small teal dot marks a name not yet opened. Link the first mention per paragraph only; cap density; honour the reader setting Off / Key names / All. Unidentified entities link under the alias the player has seen, never the true name (no spoilers).

### 6.3 Interactions
Peek: hover on desktop (with 200ms delay), tap on mobile. Verb menu: right click or long press (Speak to, Look closer, Ask about, Add a note, Open dossier). Selection bar: selecting any text shows Ask about this, Save, Clue, Copy; Ask about this drafts a question into the composer with a context chip. Ambiguity: a phrase matching more than one entity opens a chooser instead of guessing. Reveal: a link pulses once when its entity gains information and a Learned line confirms it; respect reduced motion.

### 6.4 Reader controls
Highlights (Off, Key names, All), text size (four steps), font (Serif, Sans, Dyslexia-friendly), skill voices (Show, Collapse, Hide), reveal (Instant, Stream, Typewriter). Stored per user.

### 6.5 Pipeline (backend)
1. Narrator emits lightly tagged prose using ids supplied in its context (scene, say, voice, learned, entity refs, and `new:` refs for entities it introduces).
2. Streaming parser tolerates half-open tags; text streams immediately and tags are held until they close.
3. Deterministic linker validates every id against Tier 0 and Tier 1, strips invented ids, and scans untagged text against a per-story alias table (names, titles, nicknames, visibility flag) to link names the model forgot. Possessives and plurals match via stems.
4. Persist typed blocks and a `mentions` list per turn; mentions write to the per-entity knowledge log.
5. Client renders validated blocks only. Reloading replays stored blocks, not raw text.

Streaming rules: plain text first; links fade in when a paragraph finalises; blocks have ids and sequence numbers so late annotations patch the right place; a failed turn shows retry and never partial links.
Approach decision: hybrid. The model tags structure; the server validates and links; an optional background model pass can repair old turns. Client-side regex only as an offline fallback.

## 7. Conversation mode (`R-Conversation`, `R-M8-Conversation`)

"Speak to X" switches the screen to a focused conversation. Desktop: left column with large portrait, disposition meter (Friendly +2, neutral tick), mood chips and "just learned"; centre transcript with the latest NPC line in full size and earlier lines dimmed; right column "Ask about" topics (new, available, locked with the unlock condition). Responses are typed options (Say, Do) tagged with a pillar or check, locked options show the requirement, and a free-text field is always present. Leave conversation is always visible. Mobile keeps a slim header with portrait and meter, a topics chip row, options as full-width buttons, and the composer set to Say.
Topics derive from what the player has learned; locked topics tell the player how to open them.

## 8. Story profiles and HUD modules (`R-Systems`)

The HUD is assembled from the story's active rulesets. Modules: bonds and disposition, vitals, pillars or ability scores, skills and proficiency, resources (slots, focus, hero points, mana), conditions, turn order and actions (combat only), dice and resolution (show, summary or hide). Profiles shown: lite/cozy (bonds and mood lead, no numbers), Chimera core (pillars, three vitals, objective), d20 classic (six abilities, HP and AC, slots, conditions, initiative), action-economy (three action pips, proficiency ranks, valued conditions). Custom systems compose modules; unknown ruleset fields fall back to a generic label and value row.
Bonds, dossiers, Journal, Here rail and composer exist in every profile.

Engine contract (proposed): each ruleset ships an HUD manifest beside its `state_readout` with module ids, field paths, labels, max values and display hints. The frontend renders manifests and never hardcodes a system.

## 9. Data and engine work required

These do not exist today and block the phases noted in `ROADMAP.md`:
- Per-entity knowledge log (fact, source, turn, revealed flag). Nothing currently records what the player has learned about each NPC. Blocks Phase 3.
- Alias table per story with visibility flag, plus ref ids in Narrator context. Blocks Phase 2.
- Shared block schema package for backend and frontend, and a `mentions` table (entity, turn, block, source).
- Provisional entities: the Director approves `new:` refs before they become real.
- Turn phase events over the HTTP-streamed turn response, with a status-poll endpoint for resume (see §2.1). No persistent WebSocket.
- Undiscovered-field list per entity with a hint per field, for redacted slots.
- Ruleset HUD manifest (Phase 6).

## 10. Open questions

- Can facts about an NPC be corrected or contradicted later, and how should History show that?
- Do private notes sync to the server or stay per device?
- Is a map out of scope, or does Here need a place graph later?
- Which sensory effect tiers ship first?
- Final tag syntax for Narrator output (the boards show an illustrative syntax); settle against how the Narrator output is parsed today.

Resolved: transport is HTTP-streamed, not WebSocket (see §2.1).

## 11. Design review decisions (2026-09-30)

These decisions came from the owner's review of the full-app designs (`docs/design/screens/`). They **supersede** earlier sections of this spec and the older boards wherever they conflict. Where a board still shows the old behaviour (for example a Health bar or fixed rails), follow this section.

### 11.1 Mobile first

Most players will be on phones. Design and build at 390x844 first, then enhance for 1100 and 1440. Every play screen has a mobile screen in `docs/design/screens/` (`*-Mobile.png`). The Phase 0 shell must ship the mobile header, vitals strip, cast stack and thumb-zone composer, not only the desktop rails. Mobile app navigation outside play is a bottom tab bar: Stories, My stories, Create, Stones, You.

### 11.2 Player-controlled layout (replaces the fixed rails in §4)

The player decides how much of the game surrounds the story, like a game HUD.

- Each side panel (Character on the left, Here on the right) has three states: **open** (288px / 328px), **slim** (64px icon rail with numbers), **hidden**. Toggle buttons for both live in the top bar.
- **Focus** hides both panels in one step and restores the previous states. In focus, a small pinned chip in the top bar shows only what the player chose to keep.
- Every module in a panel has its own hide control in its header.
- A module set to **On change** stays hidden until its value changes, then pops in as a small raised card and fades (static under reduced motion).
- A **Layout and HUD** settings screen (`HUD-Settings.png`, `HUD-Settings-Mobile.png`) holds:
  - presets: Immersive (panels hidden), Balanced (slim), Full HUD (open)
  - Open / Slim / Hidden for each panel
  - switches for "collapse panels while I type" and "pop in hidden stats when they change"
  - a per-module table for the current story, with where it sits (Character, Here, Top bar) and when it shows (Always / On change / Never). Receipts use Show / Summary / Hide.
- Preferences are per user and apply to every story. A story lists only the modules its rulesets provide. Unknown ruleset fields fall back to a label/value row.
- Mobile keeps the same settings. There, "panels" are the vitals strip, the cast stack and the floating critical bar.

Store layout state in `useActiveGameStore` for Phase 0. Persist it to user preferences (`user_profiles.preferences.play_layout`) with the reader settings in Phase 7, or earlier if cheap.

### 11.3 Never invent stats (hardens §2 and PLAN's source-of-truth contract)

None of the 16 first-party rulesets declares hit points. What they actually provide:

| Ruleset | Player-visible state |
|---|---|
| `vitality-stamina-system` | `current_stamina` (0–100), `physical_condition` word (e.g. "Rested") |
| `needs-survival-basic` | `satiety` (0–100), `hunger_state` word (e.g. "Well Fed") |
| `cinematic-combat-lite` | `combat_condition` word (e.g. "Healthy", "Wounded"), `combat_prowess` number |
| `d100-5-pillars` | five `root_*` pillars |
| `wealth-capability-lite` | `wealth_tier`, `archetype_loadout` |
| `world-cycle-time-bands` | `time_band`, `current_tick` |
| `stamina-based-magic` | no state; `cast_spell` costs 25 stamina |

Rules:
- Do not render a Health bar or any 100/100 default unless a ruleset declares that field. Show condition as a word (a pill), not a bar.
- An action with no resource of its own (like Cast) is a macro chip under the composer ("Cast · −25 stamina"), not a panel row.
- The boards and the older `R-*` PNGs that show "Health 100/100" are wrong on this point.

### 11.4 Dossier and Character panel are assembled from rulesets (extends §6, §8 and Phase 3)

The People dossier (`Play-Codex.png`, `Play-Mobile-Dossier.png`) shows a section only when its ruleset is active in the story. Each section names its source ruleset in small muted text.

| Section | Source ruleset | Content |
|---|---|---|
| Relationship | `npc-relationships` | Nine axes from the relationship graph: trust, warmth, respect, romance, desire, awe, fear, resentment, suspicion. The graph is `engine_private`, so each axis shows as a **sensed band** ("Growing", "Low") and a number only after the player learns it; unlearned axes show "Not revealed". Also arc progress from `propose_relationship_arc` thresholds (e.g. Alliance needs trust 70 and respect 60) and "She remembers" from relationship memory tags. |
| Personality | `npc-personalities`, `npc-quirks-habits` | Known traits, active quirks, locked slot with hint. |
| Values and aims | `npc-values-motivations`, `npc-value-impact-tagging` | Known values, whether the player has violated one, current objective (locked until learned). |
| Likes and aversions | `npc-preferences-phobias` | Known interests and aversions. |
| What they want from you | `npc-plot-drivers` | Agenda and urgency (Passive / Suggestive / Demanding / Desperate). |
| Background | `npc-roles-background` | Occupation, origin. |
| Standing with factions | faction entities | Standing, or "Unknown". |

With only `npc-relationships` active, the dossier is the disposition meter plus learned facts (`Play-Codex--relationships-only.png`). Known facts, History, Rumors and Notes tabs exist in every profile. Everything is gated by the knowledge log (§9); the UI never receives raw NPC state.

`Play-Systems.png` shows the same Character panel for four rule mixes (Chimera core, social, combat, custom ruleset). Use it as the Phase 6 acceptance reference alongside `R-Systems`.

### 11.5 Where the new references live

- Full-app screens (desktop and mobile), rendered: `docs/design/screens/*.png`; static sources in `docs/design/screens/source/`.
- Style guide and component inventory: `docs/design/style-guide/`.
- Live canvas and style guide (private to the owner; ask for access): links in `docs/design/README.md`.
