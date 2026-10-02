# Phase 0C implementation: pinned starting state and play view

The existing mobile-first shell now renders the server's shared version-1
`play_view` on authenticated `GET /api/chimera/play/:gameStateId`. Its props,
components, fixture previews and layout behavior retain the Phase 0B contract.
The frontend imports the schema from `shared/src/types/chimera-play-view.ts`.

## Starting state

The active frozen compiler is `services/compile/frozen-content-compile.service.ts`,
not the older `services/compiler/compiler.service.ts`. It now stores the typed
state-default map alongside the immutable definitions and manifest. The shared
contribution reader verifies ruleset hashes against that manifest, validates
scope/key/target declarations and rejects conflicting starting values. The older
`RulesetSchema` also retains definition extensions and outer hash metadata.

`applyFrozenStateDefaults` verifies the compiled default map, applies declared
player/NPC/world/system fields to their runtime tiers, and fills absent leaves.
Explicit values, including zero and false, retain precedence; incompatible types
and declared numeric bounds fail validation. The character template is cloned before factory projection; neither it nor
the frozen payload is mutated. Initialization checks the selected character's
ownership through the request-scoped repository before the first save or opening
provider call. No invented resource or stat is installed.

The committed-turn marker is saved with the authoritative narrative snapshot,
after the opening narrative or successful turn. Play reads that marker rather
than counting turn rows, so an orphaned turn row is not reported as committed.
This does not change turn transaction/retry semantics scheduled for later work.

## Read boundary

`PlayViewRepository` scopes session reads by both game ID and owner, excludes
the compiled prompt, and loads the exact compiled ID pinned by the session.
`PlayViewService` derives modules from those frozen declarations and actual
persisted player values. Missing fields stay absent. Bounds appear only when
declared. Private system fields and NPC-only contributions have no player HUD.

The response also retains the snapshot keys needed by the existing turn store,
with only visible player properties and plain player/narrator transcript entries.
It strips raw NPC state, private global/director context, internal receipts and
prompt fields from this GET. Active cast members expose an observed visual alias
or an explicitly identified name; selecting an NPC is not evidence that the
player learned its identity. Undisclosed cast data is omitted without asserting
an empty scene. Declared world time takes precedence over legacy scene time.

The existing turn transport still returns deltas. The shell refreshes this GET
after success and uses the resulting projection as its authoritative view.
Mock-only scenario suggestions remain available through the existing local
harness; production reads do not create them.

## Plan reconciliation and follow-up

- F0a already added the required NOT NULL session pins, foreign keys and
  initialization-version check. Direct read-only inspection of local PostgreSQL
  confirmed them. No duplicate integrity migration or legacy-save repair was
  added. The planned factory/harvester rewrite is unnecessary on the active
  frozen path, which already calls the initializer after constructing its cast.
- PLAN's claim that the active compiler already emitted state defaults predates
  the frozen compiler. This slice adds them to that active path and validates
  them in the existing initializer rather than building a second genesis path.
- Removing the genesis service's direct admin-client dependency unmasked nine
  old genesis tests that previously stopped at suite loading. They are migrated
  to frozen declarations and owned-character snapshots, retaining coverage of
  cloning, identity, appearance, profiles, stats, scene configuration, extensions
  and missing compiles. Custom HP exists only in an explicitly declared test
  ruleset. No pre-F0a raw-state path is restored to satisfy those tests.
- Frozen compiles created before this default-map addition can still be read by
  pinned existing sessions. Starting another session from such a compile fails
  validation; recompile explicitly to obtain the new map. Published payloads
  and existing sessions are not rewritten or remapped.
- The legacy live authoring/browser smoke assumes UUID compilation and a
  physical first-party world row. Frozen compilation uses catalog keys, while
  characters still reference the legacy world table. The focused 0C browser
  test creates isolated local world/character fixtures, then uses real current
  compile/init/play/turn APIs. Broader authoring/entitlement integration remains
  F0b work; no database grants were widened to make fixtures work.
- There is no complete player knowledge log in the current runtime. Learned
  roles, disposition, dossiers and mechanics receipts remain omitted until
  their planned phases. This GET projection is not the later comprehensive
  disclosure/RLS audit: the existing POST turn response, direct database access
  and other endpoints still need that audit before real-player admission.
- Hosted foundation cutover, F0b entitlements/caps, phase-aware streaming,
  typed narration/entity links and full HUD manifests are outside this slice.
  Validation used the isolated local stack and mock providers only.

## Validation and evidence

Run `npm run ci:all`, `npm run build`, and `npm run test:e2e:mocked`.
The normal CI baselines are unchanged. Tests cover schema extension round trips,
all 16 reconciled first-party rulesets, tier/target placement, explicit overrides,
source immutability, invalid declarations and ownership, save-before-provider,
and safe pinned projection with absent/zero values.

With `npm run local:dev` running, execute:

```powershell
$env:RUN_LOCAL_DB_INTEGRATION='1'
npm exec --workspace backend -- vitest run --config vitest.local-integration.config.ts
npm run local:smoke:browser -- phase0c-live.spec.ts
```

The local integration changes a source default, recompiles and proves the old
session retains its pinned payload and real HUD values while a new session gets
the new defaults. It restores the source and removes its fixture rows. The live
browser authenticates, compiles, initializes, checks actual overrides and absent
Health, submits a turn and hard-reloads the committed snapshot. It also removes
its fixture rows; content blobs use the existing garbage-collection lifecycle.

Visual evidence in `output/playwright/phase0c/` matches the approved layouts:
390x844 (`Play-Mobile.png`), 1100x800 (`Play--slim-rails.png`), 1440x900
(`Play.png`), plus the mobile Character sheet (`Play-Mobile-Character.png`).
Screenshots show actual server state from a mock-provider local session; sample
reference prose/names are not substituted into live data.
