# StoneCaster 2.0 — UX Design Pack Reconciliation (`P0–P8` vs. `ux/`)

**Date:** 2026-11-01  
**UX Pack Evaluated:** `C:\Dev\Stone Caster\stone-caster-2\docs\Stonecaster_2_0\ux\` (read-only; zero edits made)  
**Planning Baseline Compared:** `STONECASTER_2_IMPLEMENTATION_PLAN.md`, `STONECASTER_2_PHASE_BREAKDOWN.md`, `stonecaster2-design/00..09`  
**Live Clean-Slate Repository Compared:** `C:\Dev\StoneCaster-2` (`main` @ commit `240f7a0`, Phases **P0–P8** complete; `110/110` Vitest tests + `27/27` Playwright + `axe` tests passing across `390×844`, `1100×800`, and `1440×900`)

---

## 0. Full-Context Orientation: What Actually Exists vs. What the UX Pack Author Saw

The UX pack (`PRODUCT_FLOW_PLAN.md` §"Review of the two designs") was authored against two static document sets in `C:\Dev\Stone Caster\stone-caster-2`:
1. An older v1 `Play-redesign PLAN` (`F0b` 1M-owner invalidation outboxes, 16 coded rulesets, `CharacterForge`, `Director → Engine → Narrator`, WebSockets, cross-device preview caches, `server/gameEngine.ts`).
2. The initial `STONECASTER_2_IMPLEMENTATION_PLAN.md` (`P0–P5` roadmap).

Because the UX pack author did **not** have visibility into the live sibling monorepo `C:\Dev\StoneCaster-2`, three major facts change the reconciliation picture in our favor:

1. **Zero legacy v1 / `Play-redesign PLAN` over-engineering exists in `C:\Dev\StoneCaster-2`.** We never built `GameEngine`, `CharacterForge` steppers, 16 coded rulesets, WebSockets, cross-device preview caches, or `F0b` owner outboxes. The clean-slate repo already runs Fastify 5 HTTP POST + SSE turn streaming, single-call `SingleSceneOrchestrator`, Postgres 17 + RLS, and harvested `--sc-*` tokens.
2. **Phase P7 (Closed vs. Open-Ended Scenario Chapters & Permanent Session Locking) is already built (`005_closed_scenarios_and_character_chronicle.sql`).** Scenarios already support true endings that permanently lock a run at both the domain and SQL trigger layers, record `character_scenario_results`, and unlock sequel chapters—a core product requirement not reflected in the UX pack's open-ended `session-recap` mock.
3. **Phase P8 (Output-Parsed, Token-Frugal `character_event_timeline`) is already built (`006_character_event_timeline.sql`).** Without any deterministic engine math, `output-event-parser.ts` already parses structured beats from strong or weak models, compacts older history losslessly, indexes `'character_event'` chunks into Hybrid RRF RAG, and caps injected character memory at `<= 320` tokens—directly solving the long-horizon Rubii memory collapse that the UX pack's *"From your stories"* living layer needs under the hood.

---

## 1. Work Already Done (`P0–P8`) That the UX Pack Supports — **Leave It Alone**

The following architecture, persistence, runtime, and UI foundations in `C:\Dev\StoneCaster-2` align directly with `ux/` and should remain untouched:

| Area | Built in `C:\Dev\StoneCaster-2` | How the UX Pack Supports It |
| --- | --- | --- |
| **Clean-Slate Stack & Cloud Topology (`D1`, `D5`, `D10`)** | `Node 24`, `pnpm` + `Turborepo`, `TypeScript 5.9 strict`, `React 19 + Vite 7` (`apps/web`, Cloudflare Worker `wrangler.toml`), `Fastify 5` (`apps/api`, Fly.io `Dockerfile` + `fly.toml`), `Supabase Postgres 17 + pgvector` + hard v1 Supabase project deny-list (`obfadjnywufemhhhcxiy`). | Matches `PRODUCT_FLOW_PLAN.md` lines 27, 289, 304 ("Wipe" legacy saves; React + Supabase + Node on Fly + AI provider APIs; one clean repo truth). |
| **Timeline, Persistent Companions & Portable Party (`P1`)** | `001_initial_schema.sql`: immutable content revisions (`world_revisions`, `npc_definition_revisions`, `scenario_definition_revisions`) + `player_characters`, `timelines`, `npc_instances` (`UNIQUE (timeline_id, npc_definition_id)`), `party_memberships`, `relationships`, `scenario_runs`, `scenario_cast_bindings`, `turn_commits`, optimistic `expectedTurnSequence`, `idempotencyKey`, and per-transaction RLS (`withRlsTransaction`). | Matches `PRODUCT_FLOW_PLAN.md` Decision 2 ("Timeline and companions on top of compiled stories... A story run references the timeline; it never owns the character or companions"). |
| **Two-Knower Epistemics (`D9`, `P1`, `P3`)** | `epistemic_records` (`world_fact`, `timeline_fact`, `character_claim`, `pc_known`, `player_reveal`, `creator_secret`) + pre-retrieval SQL ACLs ensuring unrevealed secrets and unidentified true names never leak to PC context or player UI. | Powers `NameCardSheet` ("What you know" with source turn + "`N` still unknown") and `ElementLink` rule ("true names of unidentified characters are never shown", `SCREENS.md` line 106). |
| **Scoped Hybrid RRF Retrieval (`P3.1–P3.3`)** | `002_hybrid_knowledge_rag.sql` (`knowledge_chunks` with `tsvector` GIN + `pgvector` HNSW + Reciprocal Rank Fusion) + untrusted XML framing (`<untrusted_world_lore>`, `<untrusted_retrieved_memory>`) + idempotent `MemoryWorker`. | Matches `PRODUCT_FLOW_PLAN.md` Decision 1 ("retrieved from a world- and story-scoped index (Postgres full-text and pgvector), filtered by what the player has unlocked") and character instruction sandboxing (line 260). |
| **Single-Call `ModelGateway` & HTTP SSE Turn Transport (`D6`, `P2`)** | `packages/model-gateway` (`OpenAI`, `Anthropic`, `Google`, `OpenRouter`, deterministic `Mock`, `ModelCostLedger`), `SingleSceneOrchestrator` (1 routine call + max 1 bounded repair, zero synthetic fallback prose), and Fastify SSE-over-POST (`/api/v2/runs/:id/turns/stream`) with real phase events (`validating`, `scene_generation`, `committing`, `committed`). | Matches `PRODUCT_FLOW_PLAN.md` Decision 4 & `SCREENS.md` §4 (single transport over HTTP POST, real server phase labels, zero WebSockets, zero synthetic fallback fiction). |
| **Closed Scenario Chapters & Session Locking (`P7`)** | `005_closed_scenarios_and_character_chronicle.sql` (`completion_mode`, `outcomes`, `next_scenario_ids`, SQL immutability triggers locking concluded runs, `character_scenario_results`, `'scenario_result'` RAG chunks). | Preserves user-mandated closed vs. open-ended chapter arcs and permanent session locking; slots cleanly into `session-recap` and the `Character Page -> Journey` tab (see Recommendation R2). |
| **Output-Parsed, Token-Frugal Character Event Timelines (`P8`)** | `006_character_event_timeline.sql` + `output-event-parser.ts` (zero deterministic engine math; resilient parser for strong/weak models; `<= 320`-token `packCharacterMemoryDigest`; rollup compaction; `'character_event'` RAG chunks). | Directly backs the UX pack's *"From your stories"* living entries, turn `ChangeChip`s, and cross-story companion memory while preventing token bloat (see Recommendation R1). |
| **Playtest Sandboxes & Immutable Revisions (`P4`)** | `playtest_sandboxes` (`003_creator_studio_and_quotas.sql`) providing isolated scratch timelines with instant `Reset` + `suggest_revision` natural-language patcher. | Directly powers `PRODUCT_FLOW_PLAN.md` line 196 ("A draft runs on the normal play screen with an *Edit* button and a *Restart* button... the creator types what they want... and the assistant proposes a change"). |
| **Design Token Guardrail & Responsive A11y Harness (`P0`, `P6`)** | `packages/ui/src/styles/tokens.css`, `scripts/check-design-tokens.mjs` (`0` raw colours allowed), `ThreeColumnLayout` / `SlimRail` / `Sheet`, and `390×844` + `1100×800` + `1440×900` Playwright + `@axe-core/playwright` gates. | Matches `ux/README.md` & `DESIGN_RULES.md` non-negotiables (`--sc-*` tokens only, `pnpm design:check`, 44px targets, 3-viewport `axe` gates). |
| **Secret Redaction & Cost/Latency Telemetry (`P5.4`)** | `packages/contracts/src/redaction.ts` + `ModelCostLedger` (`p50`/`p95`, cached prompt tokens, per-call cost). | Supports operational margin measurement (`Cost per committed turn`, `PRODUCT_FLOW_PLAN.md` line 331) and privacy rules. |

---

## 2. Conflicts Between Built Work (`P0–P8`) and the UX Pack

*( Note on items listed in prompt that do **not** exist in `C:\Dev\StoneCaster-2`: **`CharacterForge`** steppers and v1 **`MobileVitalsStrip` / 16 coded rulesets** were never ported into `C:\Dev\StoneCaster-2`, so they require zero cleanup. )*

| ID | Conflicting Built Work (`C:\Dev\StoneCaster-2`) | UX Pack Override | Smallest Change to Align | Effort | Risk |
| --- | --- | --- | --- | --- | --- |
| **C1** | **`D4` / `P5.2` Mode 2 Deterministic TypeScript `CapabilityProvider`s & Coded Resource Math** (`packages/sparkbinder-systems/src/reference/{energy-provider,inventory-provider}.ts`, `SceneOrchestrator` lines 1010–1061 & 1297–1350 hydrating/committing `sparkbinder.resource:energy@1` & `sparkbinder.inventory:reservation@1`, `AiTurnRequest.resourceRequirement`, `PlayShell` `TurnEffortMode` `"prepared-stride" \| "signal-torch"` selector, and Mode 2 cases in `p5-eval-matrix.test.ts`). | **Zero deterministic engine of any kind.** Stats, dice, checks, and systems live in story, element, and character text. Server parses, validates, and commits storyteller output; it never computes an outcome (`ux/README.md` line 57). | 1. Remove Mode 2 provider hydration/execution/slice-synthesis from `SceneOrchestrator`, `AiTurnRequestSchema`, `PlayShell` (`TurnEffortMode`), and `p5-eval-matrix.test.ts`.<br>2. Add `statusValues?: Array<{ key, label, value, delta? }>` to `StructuredSceneModelOutput.effects` so template-tracked values are parsed from storyteller output and saved on `turn_commits` / character state.<br>3. *(Optional per Decision D1 below)* Keep `packages/sparkbinder-systems`'s Mode 2 classes isolated inside `@sparkbinder/systems` solely if lifting to `C:\Dev\SparkBinder`, or delete them if no longer needed there. | **S** | **Low** — `capability_state_slices` table can stay idle or store parsed `statusValues` JSON; zero impact on `Timeline`, `Party`, `Epistemics`, or `P7`/`P8`. |
| **C2** | **`P3.4` / `P4.1` Creator- & Player-Facing "System Packs"** (`draft_system_pack` in `CreatorStudioService` + `/api/v2/studio/drafts/system-pack`, `CreationTab = "system_pack"` in `CreatorStudioView.tsx`, System Pack badges in Scenario Preflight `App.tsx`, and `GET /api/v2/systems` exposed to UI). | **No creator-facing "system pack" content type.** A story's style is `Story \| Light RPG \| Full RPG` plus `storyInstructions`. *"Internal prompt modules that the platform itself maintains are fine"* (`ux/README.md` line 59). | 1. Add `style: "story" \| "light_rpg" \| "full_rpg"` and `storyInstructions?: string` to `ScenarioDefinitionRevision` & scenario drafts.<br>2. Map `style` internally in `compileScenePrompt` to platform-maintained Mode 1 prompt directives (`Story` → agency + epistemics + social; `Light RPG` → adds plain-line check guidance; `Full RPG` → adds `StatusCard` & template tracking guidance).<br>3. Remove the `"system_pack"` tab from `CreatorStudioView`, remove System Pack badges from player UI, and deprecate `/api/v2/studio/drafts/system-pack` (leaving `system_package_revisions` internal-only). | **S** | **Low** — Internal prompt guardrails (`RULE-01`, `RULE-02`, `KNOW-01`) remain intact behind `style`. |
| **C3** | **HUD Manifests, Vitals Meters & `CapabilityModuleView` Layout Policies** (`VitalMeterFieldSchema` + `CapabilityModuleViewSchema` in `play-view.ts`, `MeterRow.tsx`, `ModuleCard.tsx`, `PopInCard.tsx`, `"Frontier Stamina"` / `"Expedition Supplies"` modules in `scene-orchestrator.ts` lines 672–738, and `Layout and HUD` per-module `always \| on_change \| never` drawer in `PlayShell.tsx`). | **Status card replaces HUD manifests and vitals.** One Play screen with **3 display levels** (`Story`, `Story + Party`, `Full` — defaulted from story `style`, overridable in menu) + simple `StatusCard` + post-turn `ChangeChip`s (`ux/README.md` line 60, `SCREENS.md` §4). | 1. Replace `PlayLayoutState.modules` (`always \| on_change \| never`) and `MeterRow`/`ModuleCard`/`PopInCard` with `displayLevel: "story" \| "story_party" \| "full"` in `usePlayLayoutStore` + `PlayShell`.<br>2. Build `StatusCard` (`packages/ui`) rendering committed `statusValues` (`label`, `value`, `delta?`, `templateName`) under header on `390px` (`Full`) and in `CharacterRail` (`288px`) on `1440px`.<br>3. Render turn mutations inline in `PlayTranscript` as tappable `ChangeChip`s instead of floating `PopInCard`s. | **M** | **Low** — `ThreeColumnLayout`, `SlimRail`, `CharacterRail`, `HereRail`, and `Sheet` (`P0.6`) reuse cleanly per `SCREENS.md` line 120. |
| **C4** | **Character Form (`traits[]`/`abilities[]`/`maxPartySize`) & Exposed `Timeline Hub` UI** (`PlayerCharacterSchema` in `domain.ts`, `App.tsx` combined "Create Character & Timeline" form with comma-separated traits/abilities + `Timeline Hub` screen). | **Persona-style characters + Templates + Invisible Save Model.** Fields: `portrait` (optional at create), `name`, `oneLine` (required), plus collapsed `personalityBackground`, `appearance`, `customInstructions`, and shareable text `templates`. One character = one continuous history in that world (`Characters Hub` + 4-tab `Character Page`; `"Start fresh"` duplicates character) (`ux/README.md` line 58, `PRODUCT_FLOW_PLAN.md` lines 208–260). | 1. Additive migration `007_personas_templates_and_elements.sql`: add `one_line`, `portrait_key`, `personality_background`, `appearance`, `custom_instructions`, `template_id`, `private_notes`, `archived_at` to `player_characters` + create `character_templates` table.<br>2. Auto-create 1 hidden `timeline` whenever `createCharacter` runs; implement `"Start fresh"` by cloning `player_character` + fresh `timeline` (keeping all `timeline_id` FKs & RLS untouched!).<br>3. Replace `Timeline Hub` screen in `apps/web` with `pick-character`, `characters-hub`, `character-page` (`Profile`, `Companions`, `Journey`, `Notes`), and `new-character`. | **M** | **Low** — Keeping 1:1 hidden `timelines` in Postgres preserves 100% of `P1–P8` companion/RAG/chronicle queries with zero FK churn. |
| **C5** | **Wizard-First `CreatorStudioView` (`scenario \| npc \| world \| system_pack \| seed_doc` tabs) & NPC-Only World Entities** (`CreatorStudioView.tsx`, `npc_definition_revisions` as the only typed card table, exposed `contributionPolicy` & `seed_doc` tab). | **Play-First `Quick Create` + Generalized `Elements` (`character`, `place`, `faction`, `item`, `lore`) + 1-Sheet `Publish` + `Remix`.** Type 1 sentence + pick World + pick Style → `Make it playable` → `Play draft` (`Edit` + `Restart` in Play header, `Guided` 5-question sheet, `Advanced` tabs without JSON). Defer world permission queues & seed-doc UI (`PRODUCT_FLOW_PLAN.md` lines 178–206, `SCREENS.md` §10). | 1. Add `world_element_revisions` (or generalize elements across `character`, `place`, `faction`, `item`, `lore` with `image_key`, `one_line`, `description`, `custom_instructions`, indexed into `knowledge_chunks`).<br>2. Build `/create` (`Quick Create` screen) generating starter story + typed elements from 1 sentence and opening `Play` in draft mode backed by our existing `playtest_sandboxes` (`Edit` opens `GuidedEditSheet` / `Advanced` tabs; `Restart` calls sandbox reset).<br>3. Add 1-sheet `PublishSheet` + `forked_from_story_id` (`Remix`). Hide `seed_doc` upload and `approval-required` UI from launch screens (leaving backend tables dormant). | **M** | **Medium** — Generalizing `Elements` beyond NPCs touches `CreatorStudioService`, `NameCardSheet`, and `knowledge_chunks` indexing; keep `npc_definition_revisions` for recruitable/cast characters or unify via element view. |
| **C6** | **Composer Mode (`Do` only), Missing Client Router, Visible Scrollbars, Player Jargon & Minor `tokens.css` Drift** (`PlayComposer.tsx` static `"Do"` label, `App.tsx` in-memory `ScreenMode` state without URL routes, no global scrollbar hide rule, player copy mentioning `"Timeline"` / `"Scenario Run"` / `"HUD"`, and `.dark` vs. `[data-theme="dark"]` selector in `tokens.css`). | **`Do / Say / Look` `Segmented` control, URL routes (`/`, `/s/:storySlug`, `/play/:runId`, etc.), Global Hidden Scrollbars + `ChipRail` snap/fade, Zero Jargon, and `tokens/tokens.css` parity** (`SCREENS.md`, `COMPONENTS.md`, `DESIGN_RULES.md`). | 1. Add `Do \| Say \| Look` `Segmented` control + `ChipRail` (pre-moded chips that fill & send) to `Composer`.<br>2. Add URL routing (`react-router` or TanStack Router) matching `screens.manifest.json` routes.<br>3. Add global hidden-scrollbar CSS + `ChipRail` edge-fade masks + `"Jump to latest"` pill in `packages/ui`.<br>4. Support both `:root, :root[data-theme="dark"]` and `.dark` in `tokens.css` (keeping WCAG AA verified `--sc-text-muted` contrast) and audit all UI strings to ban `"ruleset"`, `"entity"`, `"timeline"`, `"scenario run"`, `"compiled"`, `"HUD"`. | **M** | **Low** — Pure UI/routing/CSS layer; enforceable via `check-design-tokens.mjs` + a new player-jargon lint check + Playwright `390/1100/1440` gates. |

---

## 3. Screen Mapping (`screens.manifest.json`) & New UX Pack Work Items

### 3.1 Where Every Screen Fits (`P0–P8` → UX Build Order `Phase A–D`)

The UX pack reorganizes delivery into four conversion-led milestones (**Phase A: Front door**, **Phase B: Party & return**, **Phase C: Create**, **Phase D: Depth & plans**). Below is how every screen in `screens.manifest.json` (both `screens[]` and `notDrawnYet[]`) maps to our already-built `P0–P8` backend/UI work:

| Screen ID | Route | UX Phase | Current `P0–P8` Coverage in `C:\Dev\StoneCaster-2` | Work Needed (`S/M/L`) |
| --- | --- | --- | --- | --- |
| **`landing`** | `/` (public, crawlable) | **A** | None (currently boots straight into `LiveStoneCasterApp` world list). | **M** — Build 9-section responsive Landing (`1440` + `390`), live interactive hero sample (`ElementLink` demo + 3 guest-start action chips), 3 flagship story cards, companion 2-panel strip, creator teaser, pricing teaser, and SSR/edge meta tags. |
| **`story-page`** | `/s/:storySlug` (public, crawlable) | **A** | Scenario metadata exists in `scenario_definition_revisions` (`getWorldDetail`), no standalone public route or `slug`/`cover`/`rating`/`lengthEstimate`. | **S–M** — Add `slug`, `coverKey`, `style`, `contentRating`, `estimatedMinutes` to scenarios; build full-bleed cover + tags + cast faces + opening excerpt + sticky `Play` / `Play as {name}` bar + Web Share + OG meta. |
| **`pick-character`** | `/s/:storySlug/start` | **A** | Partial: `App.tsx` has character creation + companion checkboxes on `Timeline Hub`, but split across two screens. | **S–M** — Consolidate into single 1-tap `pick-character` screen: `Your characters in {world}` (with per-run `Leave behind` companion toggles) → `Or play as` (≤3 story premades) → inline `Make me someone` (`Name` + `One line`) + template recommendation banner + sticky `Begin as {name}`. |
| **`play`** + **`play-namecard-open`** | `/play/:runId` (guest allowed) | **A** *(Story)*<br>**B** *(Story+Party, Undo/Retry)*<br>**D** *(Full + StatusCard)* | **70% built** (`PlayShell`, `ThreeColumnLayout`, `SlimRail`, `PlayTranscript`, `PlayComposer`, SSE phase states, P7 locked chapter banner). | **M** — Add `Scene image` slot, inline `<ElementLink>` rendering in prose, `NameCardSheet` (`What you know` + `Talk to them` + `More`), `Do/Say/Look` `Segmented` composer + `ChipRail`, post-turn `ChangeChip`s, `Undo`/`Retry` on last turn, and 3 display levels (`Story`, `Story + Party`, `Full` w/ `StatusCard`). |
| **`guest-save`** | Overlay sheet on `/play/:runId` | **A** | None (`apps/api` currently uses header/Bearer user ID). | **M** — Trigger bottom `Sheet` after committed Turn 5 for `is_anonymous` users (player + primary NPC portraits over ripple rings, Google / Apple / Email link, dismissable twice with remaining-turn counter, grants starter Stones on identity link). |
| **`session-recap`** | `/play/:runId/recap` | **B** | Backend data **80% built** via `P7` (`character_scenario_results`) + `P8` (`synthesizeRunSummaryFromEvents` + `character_event_timeline` + open threads). | **S–M** — Build `/play/:runId/recap` view caching 3-line recap + headline + `ChangeChip`s + `"Still open"` amber card + `"Continue this story"` (or P7 locked chapter sequel CTA) + `"Take {companion} into a new story"` suggestion card. |
| **`characters-hub`** | `/characters?world=:worldSlug` | **B** | Backend list ops exist (`listCharacters`, `listTimelines`, `activeParty`); UI currently shows `Timeline Hub`. | **S–M** — Build world `ChipRail` switcher + `CharacterCard` list (teal ring portrait, one-line, overlapping companion `PortraitStack`, active story `Continue` / `Find a story`) + `"New character in {world}"` + `Templates` rail + `BottomNav`. |
| **`character-page`** | `/characters/:characterId` | **B** | Backend continuity exists (`P7` `scenarioResults`, `P8` `characterEvents`, `relationships`, `party_memberships`). | **M** — Build header (`Portrait` 88 + `ImagePicker` camera button, Duplicate `"Start fresh"` / Archive / Delete) + 4 tabs: `Profile` (`LivingEntryCard`s from stories + `StatusCard` + `What you wrote` editor), `Companions` (invite/leave), `Journey` (recaps + chips), `Notes`. |
| **`new-character`** | `/characters/new?world=:worldSlug` | **B** | Basic create endpoint exists (`POST /api/v2/characters`). | **S–M** — Build `Portrait` 128 + 3 `CostBadge` image buttons (`Upload · Free`, `Generate · [N] Stones`, `Gallery · Free`) + `Name` + `One line` + `Template` chips + collapsed `More detail` (`Personality`, `Appearance`, `Custom instructions`) + sticky `Create {name}`. |
| **`quick-create`** | `/create` | **C** | Backend `CreatorStudioService` (`draft_world`, `draft_scenario`, `draft_npc`, `run_playtest`, `suggest_revision`, `publish_revision`) already built in `P4`. | **M** — Build 1-screen `/create` (`Your idea`, `World` chips, `Style` `Segmented`, `Make it playable` → `Your draft` card with cover `ImagePicker`, element colour counts, `Play draft` / `Edit`). |
| *Not drawn:* **`browse`**, **`world-page`**, **`public-character-page`**, **`pricing`** | `/browse`, `/w/:worldSlug`, `/c/:npcSlug`, `/pricing` | **A / B / D** | `listWorlds` / `getWorldDetail` exist; no public SEO routes or pricing screen yet. | **M** — Compose purely from `COMPONENTS.md` (`AppHeader`, `ChipRail`, `StoryCard`, `Portrait`, `Tag`, `BottomNav`) + public crawlable meta tags; request design review before inventing new patterns. |
| *Not drawn:* **`home-signed-in`**, **`library`**, **`account-stones`**, **`stones-low-sheet`** | `/home`, `/library`, `/account`, overlay | **A / D** | Quota endpoint (`/api/v2/telemetry/quota`) exists; no Stones ledger UI or signed-in Home/Library yet. | **M** — Build signed-in `Home` (Continue + recap + daily Stones refill banner + "For you"), `Library` (in progress / finished / created), `Account & Stones`, and non-hostage `Stones-low` sheet. |
| *Not drawn:* **`guided-edit-sheet`**, **`publish-sheet`**, **`play-desktop-1100`**, **`play-desktop-1440`** | Sheets on `/play/:runId` & `/create`; responsive `Play` | **A / C** | Desktop `1100` (`SlimRail`) & `1440` (`288px` + `720px` + `328px`) **already built & tested** in `PlayShell`; Studio validation/publish ops built in `P4`. | **S–M** — Adapt desktop rails to the 3 display levels (`Story` = centered 720px no rails; `Story + Party` = right rail; `Full` = both rails w/ `StatusCard`) and wrap `suggest_revision` / `publish_revision` into `GuidedEditSheet` (≤5 tap questions) and 1-sheet `PublishSheet`. |

---

### 3.2 New Work Items Added by the UX Pack (Scope, Effort & Integration Plan)

1. **Guest Play via Supabase Anonymous Sign-In + Turn-5 Save Prompt + Account Merge (`Phase A` · Effort: `M` · Risk: `Medium`)**
   - **What's new:** Real Supabase JWT verification in `apps/api` supporting `is_anonymous = true` claims; Cloudflare Turnstile / invisible CAPTCHA on anonymous sign-in + per-IP guest turn rate limiting; separate small guest turn allowance on the most economical model profile; **never** minting starter Stones on anonymous user creation (granting starter Stones strictly on identity link via Google/Apple/Email); `guest-save` bottom sheet after Turn 5 (dismissable twice, mandatory before Turn 8); and an atomic `mergeGuestIntoExistingAccount(guestUserId, targetUserId)` RPC/service step reassigning `player_characters` + `timelines` + child rows when a guest signs into an already-registered account.
   - **RLS review:** Audit all policies in `001`–`006` so `is_anonymous` users can read public worlds/stories and own their guest character/timeline, but cannot publish public creator content or trigger paid image generation until linked or funded.

2. **First-Class Undo (Free) & Retry (Charged) (`Phase B` · Effort: `M` · Risk: `Medium`)**
   - **What's new:** Last committed turn in `Play` exposes **Undo** (free; rewinds 1 turn) and **Retry** (rewinds last turn + regenerates with a fresh Stones reservation/charge).
   - **Clean implementation on our schema:** Add `turn_state_snapshots` (capturing pre-turn `relationships`, `party_memberships`, `npc_instances`, `local_state`, and `statusValues` JSON) AND tag turn-created rows in `epistemic_records`, `character_event_timeline` (`P8`), and `knowledge_chunks` with `(scenario_run_id, turn_sequence)` (`character_event_timeline` **already** stores `scenario_run_id` and `turn_sequence`!). Undo atomically deletes that turn's `turn_commits` + turn-keyed events/epistemics/chunks and restores the pre-turn snapshot—unless the run was permanently locked by a `P7` closed-chapter ending (see Decision D6 below).

3. **Public Crawlable Pages & Social Link Unfurls (`Phase A` · Effort: `S–M` · Risk: `Low`)**
   - **What's new:** `/`, `/s/:storySlug`, `/browse`, `/w/:worldSlug`, and `/c/:npcSlug` must serve real `<title>`, `<meta name="description">`, and `og:title` / `og:description` / `og:image` HTML to search crawlers and Discord/iMessage/social link unfurls instead of an empty SPA shell.
   - **Clean implementation on our stack:** `apps/web` already deploys via Cloudflare Worker (`apps/web/wrangler.toml`)! Adding a lightweight Worker `HTMLRewriter` handler for `/`, `/s/:slug`, `/w/:slug`, and `/c/:slug` (backed by versioned-key KV/edge cache reading a public metadata endpoint on `apps/api`, plus build-time prerender of `/`) solves SEO + unfurls with **zero framework rewrite** (preserving our no-Next.js rule).

4. **Images Everywhere + Object Storage + `ImagePicker` & `CostBadge` (`Phase A–C` · Effort: `M–L` · Risk: `Medium`)**
   - **What's new:** Story covers (`16:9`), scene images (`2:1`), character/NPC portraits (`1:1` round with 2px role ring: teal player, violet NPC, dashed grey unknown), element images (`1:1` rounded-square), and world banners (`16:9`).
   - **Storage & billing rules:** Store object keys (Supabase Storage or Cloudflare R2) on DB rows, never base64/bytes; serve resized `srcset` (`128/256` portraits, `800/1600` covers); fall back to brand ring/disc motif (covers) or lettered tile (portraits/elements). **Uploads are Free** (enforcing MIME/byte-size limits + moderation/content check); **AI image generation costs `[N]` Stones** displayed upfront via `CostBadge`, using reserve-on-start → settle-on-success → refund-on-failure.

5. **Stones Reserve-and-Settle Ledger + Starter Grant + Daily Refill (`Phase A` · Effort: `M` · Risk: `Medium`)**
   - **What's new:** `003_creator_studio_and_quotas.sql` currently tracks simple daily turn/token counters (`usage_quotas`). The UX pack specifies configurable **Stones**: guest turn allowance → starter Stones on account link (displayed concretely as *"about N turns"*) → visible daily free refill on Home → atomic `reserveStones(idempotencyKey, amount)` before turn/image generation → `settleStones` on commit or `releaseStones` on failure (so failed turns/generations **never** charge Stones) → non-hostage `Stones-low` sheet.

6. **Tappable `<ElementLink>`s in Prose & `NameCardSheet` (`Phase A` · Effort: `M` · Risk: `Low`)**
   - **What's new:** Storyteller structured output includes `elementMentions` (or server entity-span matcher restricted strictly to encountered/unlocked elements in the world/timeline; unidentified NPCs link only by alias in `--sc-ent-unknown` grey dotted underline, never leaking true names).
   - **Accessibility & visual contract:** Real inline `<button>`s with both **colour token + underline shape** (`character`: `--sc-ent-npc` dotted; `place`: `--sc-ent-place` dashed; `item`: `--sc-ent-item` solid; `lore`: `--sc-ent-lore` double; `faction`: `--sc-ent-faction` wavy; offset `4px`, thickness `1.5px`). Tapping opens `NameCardSheet` (`What you know` with turn source, `N still unknown`, `Talk to them` → sets composer to `Say` + prefills `"{Name}, "`, and `More`).

7. **Product Analytics Event Stream (`Phase A` · Effort: `S` · Risk: `Low`)**
   - **What's new:** First-party `analytics_events` table + `/api/v2/analytics` ingestion + typed client emitter covering every funnel event specified in `SCREENS.md` & `PRODUCT_FLOW_PLAN.md`: `landing_view`, `play_click {source}`, `story_view`, `character_picked {kind}`, `turn_committed {n, mode}`, `turn_failed`, `undo`, `retry`, `namecard_open {kind}`, `companion_recruited`, `save_prompt_shown {turn}`, `save_prompt_dismissed`, `account_linked {provider}`, `recap_view`, `next_story_click {with_companion}`, `stones_depleted`, `purchase`, `draft_created {style, world_kind}`, `draft_played`, `story_published`, `day_1_return`. **Hard privacy gate:** Zod schema strips/forbids player story text and prompt prose.

8. **Global Hidden-Scrollbar Rule + Discoverability Compensations (`Phase A` · Effort: `S` · Risk: `Low`)**
   - **What's new:** Apply `* { scrollbar-width: none; -ms-overflow-style: none; } *::-webkit-scrollbar { display: none; width: 0; height: 0; }` in `packages/ui`, paired with `ChipRail` (`scroll-snap-type: x proximity`, negative-gutter edge bleed, `16px` left / `40px` right CSS `mask-image` fade, last chip partially visible), `overscroll-behavior: contain` on sheets/rails, conditional `tabindex="0"` for keyboard scroll, and a `"Jump to latest"` pill in `Play` when scrolled up.

9. **Three First-Party Flagship Onboarding Stories (`Phase A` · Effort: `M` · Risk: `Low`)**
   - **What's new:** Author and seed 3 onboarding stories (1 `Story` mystery with secret by ~turn 4 & companion by ~turn 8–12; 1 `Light RPG` adventure with plain-language check by ~turn 3; 1 `Full RPG` delve with template `StatusCard`) rather than relying solely on the engineering validation seed (`Mystika: Wolves at the Food Stores`).

---

## 4. Every Point Where the UX Pack and the Implementation Plan / Current Setup Disagree (Verbatim Quotes + Full-Context Recommendations)

Below is every point of disagreement between `ux/` and `STONECASTER_2_IMPLEMENTATION_PLAN.md` / `stonecaster2-design/` / our live `P0–P8` codebase, quoting both verbatim, along with **full-context recommendations** where our existing `P0–P8` architecture enables a stronger solution.

---

### Disagreement 1 — Mode 2 Deterministic TypeScript `CapabilityProvider`s (`D4` & `P5.2`) vs. Zero Engine Math

- **Implementation Plan (`STONECASTER_2_IMPLEMENTATION_PLAN.md` lines 16 & 178):**
  > "**D4 · Dual-Mode `SystemHost` Lifecycle from Day 1:** Implement `Intent → Validate → Gather Contributions → Reaction Window → Resolve → Reserve/Commit → Event` from Day 1 so **Mode 1 (Prompt-Adjudicated Rules)** and **Mode 2 (Deterministic TypeScript `CapabilityProvider`s)** execute side-by-side in the same turn. Ship MVP primarily with prompt-backed systems plus **1–2 TypeScript providers from `RPG Systems`** as proof."
  > "**End-to-End Hybrid System Proof:** Wire 1–2 real **Mode 2 TypeScript `CapabilityProvider` packages** from `RPG Systems` (e.g., `Resource/Inventory Reservation` and a `Skills` resolution slice) running side-by-side with Mode 1 Prompt Systems inside `Mystika`..."
- **UX Pack (`ux/README.md` line 57 & `PRODUCT_FLOW_PLAN.md` line 291):**
  > "**No deterministic engine of any kind.** Stats, dice, checks and systems live in story, element and character text (custom instructions and templates). The server parses the storyteller's structured output, validates it and commits it; it never computes an outcome. | Overrides: `STONECASTER_2_IMPLEMENTATION_PLAN.md` D4 'Mode 2 Deterministic TypeScript CapabilityProvider' and the P5 'Mode 2 TypeScript System Proof'; any coded RPG system providers."
- **Full-Context Recommendation:**
  - Follow the UX pack **100% inside StoneCaster 2.0**: remove all Mode 2 execution (`InMemoryEnergyProvider`, `InMemoryInventoryProvider`, `resourceRequirement`, `TurnEffortMode` UI) from `packages/application`, `packages/contracts`, `packages/ui`, and `apps/web`.
  - **Nuance to decide for `SparkBinder` (`D2`):** We built `packages/sparkbinder-systems` with zero StoneCaster dependencies specifically so it could lift into `C:\Dev\SparkBinder`. Do you want us to **(a)** leave the unused Mode 2 reference files inside `packages/sparkbinder-systems` until lifted to `SparkBinder` (while StoneCaster itself never imports or runs Mode 2), or **(b)** delete Mode 2 from `packages/sparkbinder-systems` too?

---

### Disagreement 2 — Creator-Facing Rule/System Packs (`D3`, `P3.4`, `P4.1`) vs. `Story / Light RPG / Full RPG` + Text Instructions

- **Implementation Plan (`05_RULE_PACKS_AND_MODELS.md` line 11 & `STONECASTER_2_IMPLEMENTATION_PLAN.md` line 171):**
  > "A Rule Pack is creator-facing reusable content with: `id`, `name`, `scope`, `revision`, `creator`, `worldCompatibility`, `visibility`... `instructions`: the validated prompt module..."
  > "Implement the 10 transport-neutral Creator Assistant operations in `packages/application` (`draft_world`, `draft_npc`, `draft_scenario`, `draft_system_pack`...)"
- **UX Pack (`ux/README.md` line 59 & `PRODUCT_FLOW_PLAN.md` line 200):**
  > "**Rules are text, not configurable platform systems.** A story's style is Story / Light RPG / Full RPG plus story instructions. | Overrides: Creator-facing 'rule pack' / 'system pack' builders as a separate content type in player or creator UI (P3.4, P4.1 `draft_system_pack`). Internal prompt modules that the platform itself maintains are fine."
- **Full-Context Recommendation (Better Hybrid Approach):**
  - Remove `draft_system_pack` from Creator Studio UI/API and remove all System Pack badges from player UI.
  - **Keep our battle-tested Mode 1 internal prompt modules** (`Agency`, `Two-Knower Information`, `Social`, `Light Check Guidance`, `Full RPG Status-Card Guidance`) as **invisible platform-maintained profiles** selected automatically by the story's `Style` (`Story` / `Light RPG` / `Full RPG`), layered above untrusted creator `storyInstructions` and character `customInstructions`. That preserves `RULE-01` (NPC refusal/agency) and `KNOW-01` (zero secret leakage) without exposing any "rule pack" concept to creators or players.

---

### Disagreement 3 — HUD Module Policies & Vitals Meters (`P0.6`, `P5.2`) vs. 3 Display Levels + `StatusCard` + `ChangeChip`s

- **Implementation Plan (`STONECASTER_2_PHASE_BREAKDOWN.md` lines 130 & 155):**
  > "`play-view.ts`: StoneCaster 2.0 UI projection contracts (`PlayView`, `SceneHeaderView`, `TranscriptEntry`, `AttributedDialogue`, `CompanionPresenceView`, `StoryThreadChip`, `CapabilityModuleView`, `PresentationControlsView`)."
  > "`src/stores/usePlayLayoutStore.ts` (responsive breakpoint defaults: `390px` hidden rails + mobile strip/sheets; `1100px` slim rails; `1440px` open rails + per-module `always | on_change | never` policy + Focus mode)."
- **UX Pack (`ux/README.md` line 60 & `PRODUCT_FLOW_PLAN.md` lines 158, 170):**
  > "**Status card instead of a HUD.** Values a template asks to track are returned by the storyteller each turn and saved with the committed turn. | Overrides: HUD manifests, vitals strips, `CapabilityModuleView` as gameplay state."
  > "Use one play screen with three display levels [`Story`, `Story + Party`, `Full`] instead of one dense screen that hides things behind rails. The story's game mode sets the default level; the player can change it at any time from the menu..."
- **Full-Context Recommendation:**
  - Adopt the UX pack's 3 display levels (`Story`, `Story + Party`, `Full`) + `StatusCard` + inline `ChangeChip`s, reusing our `ThreeColumnLayout`, `SlimRail`, `CharacterRail`, and `HereRail` shells (`SCREENS.md` line 120).
  - **Nuance on `PresentationControls` (`responseLength`, `pacing`, `dialogueDensity`, `perspectiveMode`):** `PRODUCT_FLOW_PLAN.md` line 176 cuts *"reader font controls beyond text size"*, while `01_PRODUCT_EXPERIENCE.md` line 52 & our `P2/P6` built `PresentationControls` in the menu. Recommend keeping `Text size` + collapsed *"Storyteller pacing / length"* inside the Play overflow menu (hidden by default so new players never see knobs), while leaving `perspectiveMode` (`perspective-bound` vs. `dramatic-irony`) as a story-level author setting rather than a confusing player toggle.

---

### Disagreement 4 — Character Living Memory: UX Pack's *"From your stories"* vs. `P8` Token-Frugal `character_event_timeline`

- **Current `P8` Setup (`docs/PROJECT_STATE.md` line 18 & `02_DOMAIN_AND_CONTENT.md` lines 48–51):**
  > "`PlayerCharacter = { id: ID; ownerId: ID; worldId: ID; name: string; persona: string; traits: string[]; abilities: string[]; }`"
  > "**P8:** Core Output-Parsed, Token-Frugal Character Event Timelines (`006_...sql`, resilient weak-model output parser, `<=320`-token memory digest & rollup compaction, zero engine math)"
- **UX Pack (`PRODUCT_FLOW_PLAN.md` lines 211–240):**
  > "**Fields (only the first three are required):** 1. Face. 2. Name. 3. One line. 4. Personality and background. 5. Appearance. 6. Custom instructions... **Templates instead of stat sheets.**"
  > "**Two layers on every character:** *What you wrote* (the authored fields, which only the player edits) and *From your stories* (the living layer, where each entry links to the story and turn it came from). Players can edit or remove any living entry; that changes what future turns know, not the story already told. Undoing a turn removes exactly what that turn added."
  > "**In context:** the authored fields and the current living layer go into every turn; older Journey entries are summarized and retrieved when relevant."
- **Full-Context Recommendation (Major Synergy — Combine Both!):**
  - Adopt the UX pack's Persona fields (`portrait`, `name`, `oneLine`, `personalityBackground`, `appearance`, `customInstructions`) + shareable `Templates` + editable `LivingEntryCard` UI (`Possession`, `Condition`, `Ability`, `Reputation`, `Relationship`, `Journey`).
  - **Crucial improvement over the UX pack's naive context rule:** Do **not** inject an unbounded list of *"current living layer"* entries verbatim once a character has played dozens of turns—that would recreate Rubii's token bloat and context degradation. Instead, **store *"From your stories"* entries directly in `P8`'s `character_event_timeline`**, add `living_category` + `player_override_text` + `is_hidden_by_player` columns, and run them through `P8`'s `<= 320`-token `packCharacterMemoryDigest` + lossless rollup compaction + `'character_event'` Hybrid RRF retrieval! Player edits/deletes immediately update the digest without mutating `turn_commits`, and Undo deletes rows matching `(scenario_run_id, turn_sequence)`.

---

### Disagreement 5 — Open-Ended `session-recap` vs. `P7` Closed Scenario Chapters & Permanent Session Locking

- **Current `P7` Setup (`docs/PROJECT_STATE.md` line 17 — built per your explicit request #1):**
  > "**P7:** Closed vs. open-ended scenarios, permanent session & SQL trigger locking, branching chapter progression, and Character & Party Scenario Chronicle (`005_...sql` + RAG + UI + E2E)"
- **UX Pack (`SCREENS.md` §6 line 149):**
  > "**Layout:** close → cover image → overline `{story} · Session {n}` → headline (one generated line) → three recap lines (prose) → 'What changed' chips → 'Still open' card (one thread, amber overline) → **Continue this story** → divider → 'Take `{companion}` into a new story'..."
- **Full-Context Recommendation (Preserve `P7` Inside `session-recap` & `Quick Create`!):**
  - The UX pack author did not know about your closed-chapter requirement. We **must keep `P7`**.
  - **Better combined UX:**
    1. When a run is **paused / open-ended**, `session-recap` shows **"Continue this story"** + *"Still open"* + *"Take {companion} into a new story"* exactly as drawn in `session-recap.png`.
    2. When a **closed scenario reaches an ending** (locking the session via `P7`), `Play` transitions to/links to `session-recap` in **Chapter Complete** state: *"Continue this story"* is replaced by the locked outcome pill + primary CTA **"Start next chapter: {Unlocked Story}"** (carrying your party + `character_scenario_results`), followed by *"Take {companion} into another {World} story"* and *"Make your own version"* (`Remix`).
    3. In Creator `Advanced` / `Guided` edit, keep a simple toggle: *"Story ending: Open-ended / Has a final ending (chapter)"* (defaulting `Quick Create` to `Open-ended` unless the creator's prompt asks for a chapter/mystery ending).

---

### Disagreement 6 — Multiple Timelines per Character (`01`/`02` Docs) vs. Invisible 1:1 Save Model (`Characters Hub`)

- **Implementation Plan (`02_DOMAIN_AND_CONTENT.md` line 86 & `STONECASTER_2_IMPLEMENTATION_PLAN.md` line 162):**
  > "A player may have several timelines in one world (alternate characters or fresh starts). Memories, companions and world changes never leak between those timelines."
  > "Build the `390px`-first Player screens in `apps/web`: `Discover → World (Mystika) → Character/Timeline → Party & Scenario Preflight...`"
- **UX Pack (`PRODUCT_FLOW_PLAN.md` lines 254 & 260, `DESIGN_RULES.md` line 60):**
  > "**Keep the save model invisible.** One character equals one continuous history in that world. 'Start fresh' duplicates the character with no companions or history, instead of exposing timelines as a separate concept the player must manage."
  > "Never 'ruleset', 'entity', 'timeline', 'scenario run', 'compiled', 'HUD' in player-facing text."
- **Full-Context Recommendation:**
  - **UI:** Follow the UX pack completely—remove `"Timeline"` everywhere on screen, replace `Timeline Hub` with `Characters Hub` + `Character Page`, and wire `Duplicate ("Start fresh")` to clone the character with clean history.
  - **Database:** Keep `public.timelines` as an automatic **1:1 backing row** created invisibly inside `createCharacter` (`PRODUCT_FLOW_PLAN.md` line 260 explicitly endorses *"one timeline per character holding companions, party membership and history"*). Zero schema rewrite needed.

---

### Disagreement 7 — Turn Delivery & Parse-Failure Handling: Commit Raw Prose vs. Reject Uncharged (`RT-02`)

- **Implementation Plan (`03_STORY_RUNTIME.md` lines 66 & 72, `STONECASTER_2_PHASE_BREAKDOWN.md` line 188):**
  > "Do not stream high-impact prose as committed fact before validating the resulting state, then discover the result is illegal. MVP default: model returns a structured proposal, validate/commit, then stream the *accepted* text to the client..."
  > "Schema failure: one targeted repair attempt, then error with diagnostics. Do not accept invented IDs... **never** commits or renders synthetic fallback fiction on provider failure."
- **UX Pack (Internal tension between `PRODUCT_FLOW_PLAN.md` lines 28 & 306 vs. `SCREENS.md` line 108):**
  > `PRODUCT_FLOW_PLAN.md` line 28: "**Stream prose live, apply state on commit.**"
  > `PRODUCT_FLOW_PLAN.md` line 306: "Narration streams first; change chips appear when the turn commits. If the block fails to parse, the server makes one repair attempt; if that fails too, the prose commits with no state changes and the player can retry."
  > `SCREENS.md` line 108: "`failed` (turn stays, 'The scene didn't finish. Nothing was charged and your words are kept.' + **Try again**)."
- **Full-Context Recommendation (Important Nuance to Lock):**
  1. **Streaming:** Stream `narrationText` live over HTTP POST SSE (`idle → sending → thinking → streaming`), then validate and apply state/chips/links on `committed`.
  2. **Failure handling:** Distinguish **benign update-block formatting hiccups** from **safety/epistemic/provider failures**:
     - If prose is valid and passes epistemic/consent checks, our `P8` tolerant normalizer (`normalizeRawSceneModelOutput`) **already** salvages malformed update JSON/fences and drops unknown IDs so the turn commits cleanly without bothering the player.
     - However, if the provider errors out **or** `OutcomeValidator` catches a hard violation after 1 repair (e.g., puppeting the player character, leaking a `creator_secret`, or illegally mutating a locked chapter), **do NOT commit unvalidated prose or charge Stones**—release the Stones reservation and show `SCREENS.md` §4's uncharged `Try again` state with the player's typed words preserved.

---

### Disagreement 8 — Build Sequence (`P0–P5` Engine-First vs. `Phase A–D` Front-Door-First) & Deferred Creator Features

- **Implementation Plan (`STONECASTER_2_IMPLEMENTATION_PLAN.md` lines 139–188):**
  > "`P0` (Repo + `sparkbinder-systems` + `PlayShell`) → `P1` (Schema + Epistemics) → `P2` (`ModelGateway` + Mystika Slice) → `P3` (Hybrid RAG + `MemoryWorker` + System Packs) → `P4` (Creator Studio + Seed Upload + World Permissions + Cloud Staging) → `P5` (50-Case Eval + Mode 2 Proof + Quotas)."
- **UX Pack (`PRODUCT_FLOW_PLAN.md` lines 314–318 & 206):**
  > "`A · Front door` (Home and story pages, 3 flagship stories, guest play and save, Story-level play, starter + daily Stones, product analytics) → `B · Party and return` (Timelines and companions, carry into story two, recap and return email, undo and retry, Story + Party view) → `C · Create` (Quick Create, play-to-edit drafts, one-sheet publish, remix public stories) → `D · Depth and plans` (Status card templates, paid plans, premium models, mature opt-in)."
  > "**Defer from launch:** world contribution permissions and approval queues, story export/import, uploaded lore documents, creator analytics."
- **Full-Context Recommendation:**
  - Since `P0–P8`'s backend engine room is **already built and green**, we get to execute **UX Phases `A → B → C → D` at high speed** on top of working persistence, RAG, companions, sandboxes, closed chapters, and `<=320`-token memory digests!
  - For already-built `P4` backend tables that the UX pack defers (`seed_document_ingestions`, `contribution_policy`), **leave the SQL tables & tests dormant in place** and simply omit those controls from the new `Quick Create` / `PublishSheet` UI.

---

## 5. Summary of Decisions Needed Before Refactoring or Updating the Plan

Please confirm your preferences on these **7 items** before any code, schema, or roadmap file is touched:

1. **Mode 2 Retirement Scope (`C1` / Disagreement 1):** Remove Mode 2 completely from StoneCaster's runtime/UI/contracts (**recommended**). Should we keep the standalone Mode 2 reference files isolated inside `packages/sparkbinder-systems` solely for future `SparkBinder` lift-and-move, or delete them from `packages/sparkbinder-systems` as well?
2. **Living Character Memory Architecture (Disagreement 4):** Approve backing the UX pack's *"From your stories"* (`LivingEntryCard` + `ChangeChip`s) with **P8's `character_event_timeline` + `<=320`-token `memoryDigest` compaction** (so living character state stays editable/undoable *and* token-bounded across long multi-story arcs)?
3. **Closed Scenario Chapters in Recap & Creation (Disagreement 5):** Approve keeping **P7's Closed Chapter session locking & sequel unlocking** alongside open-ended stories, adapting `session-recap` to show *"Start next chapter"* + *"Make your own version"* when a closed story locks?
4. **Parse vs. Safety Failure Policy (Disagreement 7):** Approve salvaging loose update formatting (`P8` parser), while **failing uncharged with preserved input (`SCREENS.md` §4)**—rather than committing raw unvalidated prose—if a hard consent/epistemic violation or stream failure occurs after 1 repair?
5. **Public Crawlable Pages Strategy (`PRODUCT_FLOW_PLAN.md` Decision 6):** Prefer **Cloudflare Worker edge meta/HTML injection** in `apps/web` (with build-time prerender for `/` Landing) so `/s/:storySlug`, `/w/:worldSlug`, and `/c/:npcSlug` unfurl cleanly without introducing Next.js/SSR server complexity?
6. **Three Flagship Onboarding Stories & Content Rating Policy (`PRODUCT_FLOW_PLAN.md` lines 285, 339–340):**
   - Should all 3 flagship onboarding stories (`Story`, `Light RPG`, `Full RPG`) **share one flagship world** so a companion recruited in Story 1 can walk directly into Story 2 and Story 3 in Session 1?
   - Confirm launch content policy (**Safe/Teen default** on public pages, with **Mature opt-in behind age confirmation**)?
7. **UX Pack Mirroring into `C:\Dev\StoneCaster-2`:** Once approved, should we copy `docs/Stonecaster_2_0/ux/` (including this `RECONCILIATION.md`) into `C:\Dev\StoneCaster-2\docs\ux\` as the single repo truth (`PRODUCT_FLOW_PLAN.md` Decision 10) and execute **Phase A → Phase B → Phase C → Phase D**?

---

## 6. Locked Owner Decisions (`2026-11-01` `/grill-me` Outcome — Recorded in `C:\Dev\StoneCaster-2` `ADR-0002`)

1. **`OD-1` (Mode 2 & `@sparkbinder/systems`):** Remove Mode 2 and `@sparkbinder/systems` from StoneCaster's active runtime; replace with a lean internal prompt-profile module behind `Story / Light RPG / Full RPG`, and archive `packages/sparkbinder-systems` cleanly in `archive/sparkbinder-systems` for `SparkBinder` later.
2. **`OD-2` (Living Character Memory):** Unify *"From your stories"* (`Possession`, `Condition`, `Ability`, `Reputation`, `Relationship`, `Journey`, `ChangeChip`s, and `StatusCard` values) onto `P8`'s `character_event_timeline` with storyteller superseding, non-destructive player edit/remove, hard token cap, and Hybrid RRF recall.
3. **`OD-3` (Closed Chapters + Recap + Final-Turn Undo/Retry):** Keep `P7` closed chapters in `Session Recap` (*"Start next chapter"* + *"Make your own version"*), and allow Undo/Retry on a concluding turn **only** before the player starts a follow-up story (`finalized_at IS NULL`), locking irrevocably afterward.
4. **`OD-4` (Two-Tier Streaming Failure Policy):** Stream prose live over HTTP POST SSE; salvage/drop messy update items and commit valid/safe prose via `P8` parser after 1 repair; fail uncharged with *"Try again"* and kept player text if stream crashes or violates consent/epistemic/safety rules.
5. **`OD-5` (World Elements & `<ElementLink>`s):** Keep `npc_definition_revisions` for characters, add `world_element_revisions` for `place/faction/item/lore` under one unified `Element` API, and link prose spans deterministically server-side strictly against encountered/unlocked elements (alias-only `--sc-ent-unknown` for unidentified NPCs).
6. **`OD-6` (Flagship Onboarding Stories):** Author all 3 flagship starter stories (`Story`, `Light RPG`, `Full RPG`) in **one shared world — `Mystika`** (zero lore-dump, instant 60-second hook, companions carry across all 3 in Session 1).
7. **`OD-7` (18+ Content & Billing Posture):** Strictly `18+` platform-wide; Standard (SFW) public pages & guest play; opt-in Mature/NSFW text for signed-in `18+` accounts; strictly SFW AI image generation and uploads; unconditional CSAM/SCIM & self-harm hard block; adult/AI-friendly payment processor before paid checkout.
8. **`OD-8` (18+ Guest Verification & Stones):** Explicit *"I am 18+ and agree to the Terms"* toggle right above *"Begin as {name}"* on `pick-character` (logged on anonymous user with Turnstile before Turn 1) + DOB/18+ record on Turn-5 signup; Starter Stones granted only on identity link (never on anon creation), with existing-account timeline merge and reserve/settle/release Stones billing.
9. **`OD-9` (Public Crawlable Pages):** Hybrid Cloudflare Worker (`apps/web`): build-time prerender static `/` & `/pricing` + Worker `HTMLRewriter` edge meta/OG/summary injection cached by revision key for `/s/:slug`, `/w/:slug`, `/c/:slug`.
10. **`OD-10` (Media Storage & Build Cadence):** `MediaStoragePort` targeting Cloudflare R2 + pre-sized `128/256` & `800/1600` variants + SFW check + local dev/CI mock + `ModelGateway.generateImage`; build **Phase A (Front Door)** through full `390/1100/1440` Playwright + `axe` gates, then pause for owner review.
