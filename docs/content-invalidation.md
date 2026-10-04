# Content invalidation (F0b foundation slice)

The current frozen compiler now caches authorized first-party source bodies
and checks the durable change stream before every mutable hit. A second check
after a body load prevents a fill racing a commit from entering the cache.
The existing database catalog/hash fence still protects the final compile.
Every request verifies its admin audience before using shared internal data;
other requests keep their RLS source lookup. A cache probe failure returns
typed HTTP 503 and clears mutable entries, rather than serving stale content.

## World reader integration

The mounted V2 world library (`selectable`), owned list (`my-creations`),
detail, and ruleset-access check now use `WorldContentReadService`. The public
catalog world list/detail use the same reader with an anonymous published
audience, even if the HTTP request carries an admin token. Other catalog and
authoring readers remain separate audit/migration work before launch.

First-party world bodies and release state come from the canonical
`chimera_content_source_items`, not the legacy world projection. Authenticated
requests verify `is_admin` before using internal values. Player bodies use the
request's RLS client with explicit owner/public filters. Shared first-party,
public player, and owner-private lists have distinct cache addresses. The
reader also checks release/ownership before returning a loaded value.

The service role resolves only legacy identity columns (UUID, key/slug,
namespace/owner, visibility), never world bodies. A legacy first-party UUID is
retained when present; otherwise the canonical key is the response ID. Detail
reads resolve either identifier to a stable source key before caching. Duplicate
owner-scoped key/slug aliases are refused rather than choosing an arbitrary
owner. Consumers requiring legacy UUID foreign keys still need their stable-key
adapter; this reader does not synthesize UUIDs or legacy source rows.

List responses remain arrays and accept `limit` (1–50, default 50), `offset`
(0–1000), optional `tag`, and optional `search`. Search matches name substrings
or exact tags; wildcard/filter punctuation is treated as literal input. Database
windows and alias lookups use batches of at most 200 rows. Library/catalog pages
group first-party, public player, then owned player rows, ordered by name and
stable namespace/key within each group, deduplicated before applying the page.
Owned lists retain newest-created order. This replaces the public catalog's
previous unbounded newest-created ordering and the library's single mixed name
ordering with explicit bounded groups. The existing empty ruleset-link response
is preserved after world authorization; no ruleset is invented.

Run `npm run test:f0b:world-readers:local`. It performs read-only actual SDK
filter/ordering checks, then exercises the reader/cache against real anon,
owner and admin RLS in a rollback transaction. Its transaction adapter is test
infrastructure, not an alternate production repository. Evidence covers current
source/release gating, same-key owner isolation, private replay on two instances,
public visibility/deletion invalidation, and body reuse on hits. No production
publishing/deletion action or schema change is added by this integration.

## Entity reader integration

The mounted V2 entity library (`selectable`), owned card list (`my-creations`),
owned raw list (`/`), and detail now use `EntityContentReadService` through a
request-RLS repository. First-party bodies come from the canonical source
table, with fresh admin verification and separate published/admin audiences.
Player source/detail and list entries use the same durable shared/owner stream
contract as worlds. Moderation (`pending`) and write endpoints remain separate
legacy migration work.

GET detail accepts stable keys and legacy UUIDs. First-party IDs retain a
legacy alias when one exists, otherwise use the canonical key. Foreign private
IDs return 404 before any body or tag lookup. Explicit projections replace
`select *`; no stats or entity type are fabricated. The old owned-root query
selected a nonexistent `kind` column in the inspected local schema. Its
compatibility field now derives from the declared entity type. Detail exposes
`base_state_json` only when authored in `raw_data`; legacy raw state remains
available without synthesizing a state schema.

Lists retain array responses with `limit` (1–50, default 50), `offset` (0–1000),
and optional `world_id` (UUID or stable canonical world key). First-party world
UUID aliases resolve to canonical world keys; player filtering uses real UUID
foreign keys. Cards omit raw bodies. Library pages group first-party, public
player, then owned player rows, newest-updated within each group, with stable
namespace/key tie-breaking and deduplication before paging. Owned cards retain
newest-updated order; the owned raw endpoint retains newest-created order.
Consumers requiring more than the first page must explicitly request further
pages; UUID-only authoring relation consumers still need their stable-key
adapter. No legacy UUID rows are synthesized here.

Entity tag links and tag edits emit separate `asset_tag`/`tag` events, not
parent entity invalidations. Player detail therefore fetches tag relations
fresh through request RLS on every hit; these relations are never included in
the entity cache. Canonical first-party tags remain authored source-body data.
The inspected legacy tag/link tables have no visibility column: publishing
an entity does not grant access to its owner's tags. Player tag/link rows
remain owner-only; admin preview applies to internal first-party rows. Their
RLS policy remains authoritative, and hidden tags are omitted. A failed tag lookup returns 503,
instead of presenting a failed lookup as an empty tag set.

Run `npm run test:f0b:entity-readers:local`. Read-only checks exercise actual
SDK projections, world predicates, tag joins and the poller RPC. Rollback-only
fixtures then exercise the services and two independent caches through a
serialized real-role SQL adapter. Evidence covers release gates, duplicate-key
owner isolation, private refresh without shared changes, old/new world-filter
invalidation, public visibility/deletion refresh, fresh tag rename/removal
without a body reload, hidden-tag denial, and unchanged source/log fingerprints.
This does not claim a transaction fixture was served through PostgREST; focused
repository and HTTP tests separately cover those production boundaries.

## Story reader integration

V2 story `my-creations` and detail, plus public catalog story list/detail,
now use `StoryContentReadService` through a request-RLS repository. The
inspected schema stores player stories in `chimera_stories`; the canonical
source-kind contract does not include stories. Reads therefore retain UUID
identifiers and use the actual owner namespace/content key for cache addresses.
No canonical story format, UUID projection, or first-party story is invented.
First-party legacy story identities are refused by this player reader.

Owned lists and sources are owner-scoped; public playable lists and public
sources use shared addresses. The service role resolves fixed identity columns
only. Body projections exclude joins and `select *`. Foreign private IDs
return 404 before body or world access. Reads do not depend on writable-tier
selection, and entitlement state is not cached in these bodies: downgraded
owned stories stay readable while existing mutation gates remain authoritative.

The old public catalog bypassed visibility, including for detail. Its reader
now always uses an anonymous RLS client, even with an admin bearer token, and
requires public visibility, compiled/bound status and an actual committed
compile pointer. A status label alone is insufficient. This is compilation
readiness, not a grant to start a game; the existing launch/runtime gates still
apply. `has_prompt` reflects nonempty authored opening text instead of the old
unconditional `true`. Description/media/ruleset values come from existing fields.

World summaries are not stored inside story cache entries. V2 detail/list and
public detail resolve them through the existing world reader on each request,
which separately authorizes access and catches up its world cache. Shared
world IDs within one owned-list response load once. Missing or inaccessible
worlds produce `world: null` (public summaries use null name/slug); unavailable
world reads fail with 503. This closes the old service-role join's private-world
disclosure and refreshes world edits/visibility independently of story bodies.
World deletion also refreshes the actual story FK changed by `ON DELETE SET NULL`.
No fallback world name or cached relation is synthesized.

List responses stay arrays, ordered newest-created with UUID tie-breaking.
They accept `limit` 1–50 (default 50), `offset` 0–1000, and optional literal
`search` over existing title/display-name/description fields. They use the
standard success/error trace envelopes instead of the catalog's previous fixed
paging/sort metadata, which did not match its unbounded query. The current
story-list consumer reads the data array. Consumers beyond the first page still
need the separate paging adapter. Public list world summaries remain null as
before; public detail resolves only authorized world data.

Run `npm run test:f0b:story-readers:local`. Read-only actual SDK checks cover
projections, literal filter punctuation and the poller RPC. Rollback fixtures
then run both story/world services against serialized real-role SQL adapters
and two caches. They prove same-key owner isolation, private replay without
shared events, compile-pointer/visibility/deletion refresh, independently
authorized world edits/hiding/deletion, and read-only draft access with writes
denied after a fixture downgrade. Immutable compile and tier rows are fixture
setup only. Fingerprints prove rollback restores sources, compiles, blobs,
tier/choice records and outboxes. This does not claim fixture HTTP/PostgREST
traffic; focused repository/service/HTTP tests cover those production boundaries.

## Durable streams and privacy

Migration `20261008000000_f0b_content_changes.sql` adds
`chimera_content_changes` and `chimera_owner_content_changes`, with separate
shared and per-owner generation/cursor rows. The source transaction emits
identity and bounded old/new listing facets only, never content bodies.
Triggers cover the current source table and the existing ownership-guarded
authoring tables. Ownership guards and first-party write restrictions remain.
Visibility-less dependency links use a narrow metadata lookup of their world,
story, or pack parent. They inherit its visibility for stream classification
and invalidate that parent's keys too, including private parent entries.

First-party mutations and player changes affecting an old or new public view
enter the shared stream. Private-only changes enter only the relevant owner's
stream and do not increment shared or first-party catalog generation. This
removes the existing global fence/lock from private-only edits. The current
frozen compile accepts only first-party refs; expanding it to private player
sources must also add an owner-generation fence before that path is enabled.

A multi-key transaction advances one shared generation and emits its keys
atomically. A no-op source upsert does not emit an event. Cursor allocation
uses a transactional state-row lock, so a lower cursor cannot commit after a
consumer has advanced beyond it. Private writers lock only their owner row.
Public/shared legacy authoring retains the catalog-before-shared lock order.

The NOLOGIN stream function owner has metadata-table and catalog-fence
privileges and selected parent identity/visibility columns, no source-body or
auth-account read permission, no schema creation,
and no RLS bypass. Client roles and the deploy login cannot read or write
stream tables. The backend service role has only the fixed bounded page RPC;
it cannot call the emission helpers or read the underlying stream tables.
No stream RPC is exposed through an HTTP endpoint.

## Cache addresses and catch-up

Shared addresses distinguish source, preview, and listing entries, including
audience, kind, namespace/key or sorted filters/page. Owner addresses also
include the authenticated owner's UUID and reject a differing namespace.
Readers must derive that owner from their authenticated request, never from
an untrusted request body. Immutable `blob:{sha256}` entries survive mutable
invalidation; a cache entry does not itself authorize access to a blob.

Changes invalidate the matching source/preview and all listing pages whose
filters match old or new facets. Unknown filter facets conservatively
invalidate that kind's lists. Shared visibility changes also invalidate local
owner entries for that namespace. Private events affect that owner only.

The consumer batches its active-owner set into one probe, with indexed
`(user_id,seq)` owner pages. It polls only owners with cached entries or an
in-flight fill, drops idle cursors, and evicts old owner values when its active
set is full. It does not poll the entire population. The current technical
bounds are 512 entries, 32 active owners, 100 events per stream/page, 16 pages
per catch-up, and a 2.5-second health window with a 1-second RPC timeout.
These are cache bounds, not account or product limits.

Disconnected instances replay before returning mutable hits. A new process
has no mutable values and adopts the actual stream head. A pruned prefix
clears the affected mutable scope and adopts the head; it does not clear
immutable blobs or other owners for an owner-only gap. Malformed or missing
pages fail closed. The RPC returns cursors as decimal strings to preserve
PostgreSQL bigint values. It reads head, retained-prefix floor and pages in
one statement snapshot.

Polling is demand-driven at the cache boundary. Idle instances need no
background timer; their next mutable access catches up. Cache statistics
record probes, processed rows, hits/misses, invalidations, clears, entries,
active-owner count and the shared cursor. They are internal process metrics.

## Evidence and remaining gates

Run `npm run test:f0b:cache:local` with the isolated local stack ready. It uses
existing maintenance credentials and rollback-only fixtures; it does not
reset data or rotate passwords. It proves real-role grants, private/public
classification, no shared lock or generation for private edits, selected-owner
pages, old/new visibility facets, multi-key deploy/no-op/rollback behavior,
and two independent cache consumers. Existing runtime-fence and compile tests
continue to cover format refusal and frozen compile retries.

Unit tests exercise source/preview/list targeting, owner isolation, shared
visibility transitions, disconnected replay, pruned gaps, immutable values,
concurrent fill fencing, safe authorization/probe failure, and bounded
memory/catch-up. The compile HTTP boundary preserves the normal error envelope
and maps unavailable caches to 503.

These slices do **not** complete F0b. World, player entity and story reads now use this cache; other
player readers and legacy TTL readers are not moved into it. Broader shared/private reader
migration, owner-aware compile support if added, retention/partitioning and
consumer lag instrumentation, million-owner/100-instance/10x-peak measurement,
admin release/deletion controls, and hosted multi-machine deployment/rollback
rehearsal remain separate gates. Logs are currently retained without an
automatic prune job; the tested prefix-gap behavior is the consumer contract
for the later retention operator. The launch guard remains closed.

Before caching public dependency-link views, their reader integration must
also invalidate on parent visibility changes and deletion cascades. The
current link trigger resolves existing parent metadata; it cannot recover
that metadata after a cascading parent deletion. Those readers remain
uncached in this slice.
