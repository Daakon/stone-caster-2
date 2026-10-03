# F0b entitlement slices

This slice establishes the database and HTTP entitlement boundary described in
[PLAN.md](PLAN.md#f0b--required-before-admitting-real-players). F0b is **not complete**:
release operations, real deletion, GC, deployment format checks, and cache/outbox work
still precede real-player admission. The launch
guard remains closed. Phase 1 still owns durable turn claims and settlement.

## Configuration and deployment

Apply `20261002000000_f0b_entitlements.sql` with the normal migration workflow.
It adds nonnegative story/game caps, the singleton default-tier reference, account
assignments, ordered active choices, and activity timestamps. It deliberately
seeds no tier, default, or numeric product limits. An authenticated administrator
sets these operational values before creation is enabled:

- `GET /api/admin/tier-limits`: configured policies and the nullable default key.
- `PATCH /api/admin/tier-limits`: `{tier_key, max_owned_stories, max_saved_games,
make_default}`. Caps are integers at least zero; `make_default` is explicit.
- `POST /api/admin/users/:userId/tier`: `{tier_key}` referencing an existing tier.

These routes run the existing administrator middleware and use the caller's JWT
for database administration. Service-role credentials cannot call these functions
or substitute for a signed-in administrator. Direct policy/choice writes and bare
story/game inserts are revoked from application roles.

Signup attempts assignment without blocking account creation on configuration or
repair failure. Entitlement reads and content activity repair a missing assignment
idempotently. Without a configured default, reads return only
`{state:"configuration_pending"}` and creation fails with
`details.entitlement_code: "ENTITLEMENT_NOT_CONFIGURED"` (503).

## Owner boundary

`GET /api/me/entitlements/active` returns the account's actual configured caps,
usage, owned item labels, ordered manual selections, and computed writable IDs.
`PUT` at the same path accepts the complete `{story_ids, game_ids}` selection.
UUIDs must be unique, owned, and within each configured cap. Foreign and missing
IDs have the same rejection. Empty lists restore recent-activity defaults.

Manual priority precedes activity; absent activity falls back to creation time
and ID. A smaller cap retains the highest-priority choices that fit. Excess items
remain readable and deletable. Deletion/upgrade fills available slots without
deleting content or discarding surviving manual priorities. Story edits include
linked rules/cast/packs/lore; game activity advances only on a committed turn.

Creation locks the account entitlement and tier policy and inserts in one database
transaction. Pinned game creation additionally locks its compiled row and checks
the owned character. Read-only game turns fail before Director/Narrator providers.
The current runtime has no durable claim; Phase 1 must integrate the writability
check into its game-row/entitlement-row claim transaction and preserve already
claimed turns across a choice change. This slice does not implement that contract.

## Frontend controls

`/admin/tier-limits` exposes configured policies, an explicit default-tier choice,
and assignment of a configured tier to an account UUID through the existing admin
guards. New forms start empty; zero is a valid explicit cap. Saving a policy or
assignment invalidates cached owner entitlement views. The shared Zod contract
validates API responses and choices; the existing authenticated API client sends
all requests. No billing, checkout, pricing, or new default policy is introduced.

`/my-creations` displays actual story/game usage and read-only story rows using
the approved My Creations row/usage pattern. Unknown, unavailable, or pending
limits disable creation and editing. Known read-only stories can still be opened
and deleted. Deletion refreshes usage and writable IDs. The owner picker submits
both complete ordered lists, supports priority moves and recent-activity defaults,
and preserves an unsaved draft on failure. A downgrade retains the old selection
and requires correction before saving; it never silently drops priorities.

Account queries use owner-specific keys and refresh on remount. The picker resets
when the account changes. Mobile owner content stacks the usage panel beneath the
rows, then adds a right rail at 1100 pixels. Changed controls use design tokens,
44px targets, visible keyboard focus, and a focus-restoring dialog. The surrounding
marketing header/footer and the worlds/entities tabs retain their existing flows;
full dashboard navigation, All/import actions, and billing belong to later work.
There is no approved tier-editor screen, so its fields use the admin form pattern.

The shared admin shell now collapses its navigation on mobile, gives the form
available width, and preserves the desktop sidebar. This supporting adjustment
was explicitly approved; local verification was waived for the final shell patch.
Owner screens and the admin editor at 1100/1440 have browser evidence from before
that patch. The 390px admin overflow screenshot records the prior state, not the
patched result. This frontend slice does not open the real-player launch guard.

## Validation and deviations

`npm run test:f0b:entitlements:local` requires the isolated local Supabase stack
and synced first-party content. It tests signup/default repair, role grants,
ownership, full-set choices, downgrade/read-only enforcement, deletion recovery,
and independent-connection creation races. Transactional fixtures roll back;
committed race fixtures are removed by their exact generated IDs. Immutable test
blobs remain subject to the forthcoming GC workflow.

Run `npm run ci:all`, the mocked browser suite, and the Phase 0C live browser suite.
The latter temporarily assigns explicit local fixture caps, then restores the
original account assignment; it does not set a default policy.

The additive migration uses a current timestamp rather than the earlier proposed
F0b filename so it follows merged pin/play migrations. A supporting grant restores
execution of the pure `content_canonical_json(jsonb)` function for application
roles: the existing F0a invoker ownership trigger calls it during player edits.
No source-read or first-party write privilege is added. Release/internal-content
rules retain F0a behavior until the separate F0b release slice is implemented.

The frontend suite includes entitlement boundary, owner picker, and admin form
checks. `npm run test:e2e:mocked` covers the production bundle; live controls use
`npm run local:smoke:browser -- --grep "live admin configuration|real hash-pinned"`.
The live entitlement test creates an isolated account/tier, sets no default,
and deletes only its generated fixtures. Evidence lives in
`output/playwright/f0b-entitlements/` and matches My-Creations/Mobile and the
Admin-Content form style, with the inherited shell deviations described above.
