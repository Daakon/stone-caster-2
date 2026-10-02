# F0b entitlement backend slice

This slice establishes the database and HTTP entitlement boundary described in
[PLAN.md](PLAN.md#f0b--required-before-admitting-real-players). F0b is **not complete**:
release operations, real deletion, GC, deployment format checks, cache/outbox work,
and the admin/player selection UI still precede real-player admission. The launch
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
