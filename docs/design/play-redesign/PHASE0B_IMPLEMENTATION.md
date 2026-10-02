# Phase 0B implementation and Phase 0C handoff

The responsive shell is `frontend/src/features/play/components/PlayShell.tsx`.
`ActiveGameInterface` loads the existing authenticated play endpoint, hydrates
the existing turn store, and projects it through `model/play-view.ts`.

## Frontend boundary

`PlayViewSchema` is the temporary frontend-owned, version-1 contract:

- Optional pinned story title and committed turn; optional known scene/time.
- Optional player identity and disclosure-safe presence (observed alias, learned
  role/disposition, known count). Empty presence explicitly says no one is here.
- Declared ruleset keys and a list of available modules. Each module has a unique
  ID, kind, label and source ruleset. Each field carries its runtime path and
  actual value. Numeric bounds and deltas are optional; an unbounded number has
  no bar. Conditions are words. Unknown fields use label/value rows.
- Absent/unsupported modules are omitted. This slice does not create dossier
  slots, authored locked hints, HUD manifests, combat mode or new game state.

Every module source must occur in the session's declared rulesets. Validation
rejects malformed projections and duplicate module IDs. No resource value is
defaulted. The schema strips unrelated fields, including raw NPC properties.
It does not replace the server's obligation to verify pinned declarations and
disclosure before building the projection.

The current backend has no safe declaration/disclosure projection. The interim
live adapter therefore exposes verified scene metadata and the existing
transcript, with no inferred HUD or cast. It never installs sample content in
a live session. Legacy store vitals and old presentation components remain for
existing callers/tests; the active shell does not render them.

Phase 0C should move the contract into `shared/src/types/chimera-play-view.ts`,
project the frozen session's declared state into `play_view` on the existing
GET response, and import that shared contract here. The shell's props and HUD
components remain unchanged. Successful turns currently refresh that GET after
the existing optimistic delta handling so the projected view is authoritative.
An invalid projection fails visibly and offers Try again.

## Layout and fixtures

The active-game store owns panel open/slim/hidden states, focus and per-module
Always/On change/Never policies. Focus restores the previous asymmetric panel
states. Explicitly chosen Always modules appear as pinned focus chips. Policies
survive story switches within the visit; account persistence remains Phase 7.
On-change cards appear only after a value changes and expire after eight seconds;
reduced motion disables their fade.

The shell uses the existing button, progress and Radix sheet primitives. Mobile
has Character and Here entry points, a scrolling feed, and a composer above the
safe-area inset. Sheets trap focus and restore the originating control. Desktop
uses token-sized rails and a flexible story column capped at `--sc-measure`.

`/_test_gallery` includes all modules and three deterministic mixes. Fullscreen
links are `/_test_gallery?play=core`, `?play=social`, and `?play=combat`; each has
its own transcript/suggestions. Only this explicit preview bypasses the gallery's
marketing wrapper. The live route never imports fixtures.

## Design reconciliation and scope

- Matched references: `Play-Mobile.png`, `Play-Mobile-Character.png`,
  `Play-Mobile-Here.png`, `Play--slim-rails.png`, `Play.png`, and `Play-Focus.png`.
- At 1100, the full rails plus a 720px story cannot fit. Both rails start slim;
  players can expand them and the story shrinks. At 1440 both start open.
- Touch targets are at least 44px even where reference icons/chips are smaller.
  Source labels and independently hideable modules add vertical spacing; rails
  scroll rather than shrinking text. UI text stays at least 12px.
- `docs/UX_Game_Play_Screen_Design.md` is the older raw-state/default-vitals
  specification. SPEC §11 supersedes those bindings for the active play route.
- Phase 0A's dark-only decision remains. Older pnpm-only guidance conflicts with
  the npm lockfile, package scripts and current AGENTS/CI instructions; use npm.
- Plain committed transcript rendering is retained. Typed blocks/entity links,
  mechanics receipts/learned-fact cards, Do/Say/Look transport hints, macros,
  phase-aware streaming, dossiers and the full HUD settings screen stay in their
  scheduled phases. The small chooser handles only panels and module policies.
- Journal is an interim transcript sheet, not the later Journal/Codex system.

## Validation and visual evidence

Run `npm run ci:all`, `npm run build:client`, and `npm run test:e2e:mocked`.
The mocked config includes the original Phase 0A regression checks and
`play-redesign-phase0.spec.ts`; it needs no backend, Supabase or AI provider.
Screenshots are produced at 390x844, 1100x800 and 1440x900, plus mobile sheets
and focus/on-change states. The PR links the captured evidence in
`output/playwright/phase0b/`.
