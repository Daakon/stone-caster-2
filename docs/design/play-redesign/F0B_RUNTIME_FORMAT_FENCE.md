# F0b runtime registry and transactional format fence

This slice extends per-build readiness with a durable fleet registry and a
database-enforced content-sync fence. It does not deploy the backend, inventory
the hosted fleet, enable hosted content sync, or open the player launch guard.
Release/deletion, cache/outbox propagation and production deploy/rollback remain
separate F0b gates.

## Registry and readiness

Apply `20261006000000_f0b_runtime_format_fence.sql` after readiness. The tables
start empty; the migration invents no machine inventory or parser support. A
trusted maintenance operator must bootstrap the expected Fly app and every
potentially serving machine/configuration version from an actual inventory.
Unreported entries have null format bounds, image reference and report time.
An absent fleet, empty active fleet or unreported entry blocks content sync.

On Fly, every readiness call validates `FLY_APP_NAME`, `FLY_MACHINE_ID`,
`FLY_MACHINE_VERSION` and `FLY_IMAGE_REF`, then calls the fixed registration RPC
with this build's compiled `SUPPORTED_CONTENT_FORMAT` (currently 1 through 1).
Partial/malformed identity, the wrong app, missing inventory or an unavailable
RPC fails closed. Registration and the metadata read share one bounded RPC;
no second probe or read-only fallback is used. Non-Fly readiness keeps its
read-only inventory RPC. The public HTTP envelope, uncached behavior and safe
trace-correlated errors remain unchanged; runtime identities are not public.

The key is `(app_name, machine_id, machine_version)`. A version's image and range
are immutable once reported. Upgrading records a new version; stale reports
cannot overwrite it. All unretired versions participate, even with an old report
timestamp. There is no heartbeat TTL, age-based deletion or automatic retirement.
A waking retired version restores its entry before checking stored source/blob
formats; even an incompatible wake remains recorded and returns 503.
Registration uses the same catalog row lock as sync, so it cannot race a format
decision.

The NOLOGIN, NOINHERIT, non-BYPASSRLS registration owner can write only reports
and lock the catalog without changing it. It cannot read source bodies, edit
fleet scope, delete records or create schema objects. Only `service_role` can
execute registration; application and deploy identities have no direct registry
access. Temporary maintenance memberships are removed after owner/grant work.

## Sync fence

The existing dedicated sync function, graph validation, provenance, hashes,
upsert/release behavior and generation fence remain intact. A receipt trigger
runs inside that locked transaction, requiring every unretired build to report
support for the receipt's actual format. Refusal rolls back the entire source
batch, generation and receipt, including direct calls to the fixed DB function.
Historical receipts without commit provenance remain unknown; current sync
always requires provenance, so callers cannot use the historical representation
to bypass the fence.

The validation view exposes a contract version, not fleet identities. The CLI
refuses an unmigrated schema before writing. Fleet refusals become safe,
actionable validation errors (`P0F01` unknown/unreported, `P0F02` unsupported).
Connection strings and raw database exceptions remain hidden. Sync and parsers
still implement format 1 only; a wider report never substitutes for parser code
or updated sync schemas. Ordinary format-1 edits and no-op syncs require no app
redeployment once the fleet has reported compatibility.

## Operator bootstrap and retirement

Heartbeats cannot discover a machine that never reported, and expiring a report
could hide a sleeping build. The conservative resolution is verified inventory
plus durable reports. Use Fly's [list Machines endpoint](https://docs.fly.io/machines/api/machines-resource),
including stopped/suspended machines and configuration versions. Identity fields
follow the [Fly runtime reference](https://docs.fly.io/machines/runtime-environment).

Before hosted rollout, freeze fleet/config changes and content writes. Verify
every eligible image includes PR #50's per-build readiness gate. With a reviewed
maintenance connection, begin a transaction and lock
`chimera_content_catalog_state WHERE singleton FOR UPDATE`. Insert the verified
app and actual verification time into `chimera_content_runtime_fleet`; insert
every expected app/machine/version into `chimera_content_runtime_builds` with
null report fields. Preserve all previously reported versions. Commit, deploy
or wake eligible machines, and require each to report its own compiled range
before syncing. Never seed guessed/default ranges. New registry-capable machines
enroll on readiness before becoming healthy.

Keep old versions until verified drained, replaced or destroyed and unable to
serve. Retirement is a reviewed maintenance transaction using the same catalog
lock and exact verified app/machine/version tuple. Set only that tuple's
`retired_at`, preserve its report, and update `inventory_verified_at` after review.
A missing heartbeat or stopped/sleeping state alone never authorizes retirement.
Do not remove records automatically from an inventory snapshot: an old process
may still be draining. Creating machines from pre-registry images remains an
operational prohibition; self-reporting cannot discover them. Protected hosted
bootstrap/deployment workflow and real-fleet verification remain required.

For the isolated local stack, fresh seeding precedes app startup. The local
seeder calls `bootstrapLocalContentFleet` inside its maintenance transaction.
This registers the actual local validation process ID, source Git SHA and parser
range imported from the checked-out code, using explicit `stonecaster-local`
scope. It does not pretend these are Fly identities. It refuses a non-local
fleet and unsupported existing content. `tsx` loads the shared declaration.
The seeder's existing local password provisioning is unchanged; the new harness
tests bootstrap inside rollback without executing that rotation or a reset.
The older F0a/deploy acceptance harnesses now require this bootstrapped local
contract before sync. The local-only content CLI remains local-only.

## Validation and rollback

Run `npm run ci:all`, backend build, API documentation validation and
`npm run test:f0b:runtime-fence:local`. The harness uses the isolated stack's
existing maintenance credential and switches session identity to the real deploy
role inside rollback-only transactions; it changes no passwords. It verifies
actual grants/RLS, local bootstrap, absent/unreported/stale/incompatible fleet
refusal, immutable identities, compatible/no-op sync, sleeping-build readiness
refusal and cross-connection lock contention. Counterfactual range-2 reports
exercise refusal; they do not declare application parser support. Fleet, build,
source, blob, generation and receipt fingerprints must remain unchanged.

Keep additive registry schema and the DB fence when rolling back app code.
Retain the old version until it cannot serve. A pre-registry rollback does not
complete reporting and blocks further content sync. Never drop the trigger or
retire a live build to conceal incompatibility. The launch guard remains closed.
No UI changes or screenshots are required.
