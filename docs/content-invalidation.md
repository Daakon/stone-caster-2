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

## Lore reader integration

The authenticated V2 lore `my-creations`, context list and detail GETs use
`LoreContentReadService`. Canonical first-party bodies come from current source
items, with a fresh request-role admin check for internal previews. Player bodies
and tag relations use request RLS with explicit owner/public filters. Service-role
queries resolve only fixed identity metadata; they never read fragments or vectors.
The approved-tag selector and atomic lore writer are audited below.

The old routes inferred lore access, visibility and even ownership from its
world, despite the foundation schema giving lore its own visibility/owner. That
could expose private lore on a public world or include another owner's private
entry in a world owner's list. The reader follows actual row ownership/RLS:
owned lore remains readable even with a missing/private parent, foreign private
lore returns a non-disclosing 404, and explicitly public lore detail follows its
own visibility. World publication never publishes attached lore implicitly.
The old invented `version: 1` and `is_system_asset: false` are omitted. DTOs extract
authored name/text/type from `fragment`; `content_chunk` aliases the actual text,
and missing values are null. Vectors are withheld (`embedding: null`).

Context lists authorize the parent through existing world/entity/story readers
on every request, including before a cached page is returned. Entity context
takes priority over story, then world. World context excludes entity/story-specific
entries; entity/story context applies only its selected parent filter. A private
entity in a public world gets no world-based access fallback. Canonical world/entity
keys and available UUID aliases are supported; stories retain UUID identifiers.
First-party lore detail reuses existing UUID aliases or returns its stable key,
and ambiguous owner-scoped keys are refused. No UUID projection rows are invented.

Owned/context responses stay arrays with bounded `limit` (1–50, default 50) and
`offset` (0–1000). Context pages group canonical, public player, then owned player
rows; each lane orders by creation time descending and namespace/key, deduplicates
before paging, and fetches bounded prefix windows in batches of at most 200.
The previously ignored `display_name` query is not promoted to a new search API.
Clients needing more than one page must request subsequent pages explicitly.

Source bodies and list lanes have distinct admin/published/owner cache addresses.
Context filters conservatively invalidate on relevant lore changes, covering
world moves and entity/story scopes absent from the facet allowlist. Parent access
is rechecked separately, so parent privatization does not require caching parent
facts inside lore entries. Detail has no inherited-parent permission. Player tag
relations are fetched fresh on every response, since tag/asset-tag changes emit
their own kinds. Publishing lore does not publish owner-private tag links; hidden
relations are omitted and failures return 503. Canonical inline fragment tags are
authored source data; canonical asset-tag relation adapters remain later work.

Run `npm run test:f0b:lore-readers:local`. Read-only SDK checks exercise actual
projections, JSON null context filters, identity and poller transport. Serialized
rollback fixtures then use actual authenticated RLS for lore bodies and parent
identity checks with two independent caches. Evidence covers direct ownership,
world/public privacy isolation, strict context priority, private-entity denial,
canonical release/admin revocation, fresh tags without body reload, private edits
without shared events, public visibility/world-move/delete refresh and parent
context privatization. Parent adapters return only fields consumed by this boundary;
existing parent-reader harnesses separately cover their body-cache behavior.
Catalog/source/relations/entitlements/outbox fingerprints are restored by rollback.

## Approved-tag selector

The authenticated `GET /api/v2/chimera/lore/tags` now uses
`TagContentReadService` and the request-RLS, read-only
`chimera_approved_tag_page` RPC. The old service-role query treated approval as
global access and could expose another player's private tag names. The inspected
tag table has no visibility column: player tags remain owner-only, including for
admins. First-party choices come from current canonical `tag` sources, never the
legacy projection. Ordinary callers see published sources; internal preview
requires the database's fresh `is_admin()` result. An authored boolean
`is_approved: true` and a nonempty authored string name are required. Approval
does not publish a tag, and missing approval/name does not receive a default.

The response remains an array of `{id, tag_name, is_approved}`. Canonical IDs are
stable source keys; player IDs are existing UUIDs. Consumers must treat selector
IDs as opaque; the current lore editors submit tag names. Equal canonical and
owned names retain their distinct IDs. `limit` is 1–50 (default 50), `offset` is
0–1000 (default 0). The RPC merges accessible lanes before sorting by name and
stable identity and paginating, rather than applying an SDK first-page cap before
merging. Invalid HTTP bounds return 422; failures return a safe 503, never an
empty-success fallback. Caller-supplied owner/admin parameters cannot change access.

Pages are deliberately uncached: each request reads a bounded page under fresh
RLS and release/admin checks. A mixed canonical/private result must not enter a
shared cache. This also observes tag rename, unapproval, deletion, release changes
and admin revocation immediately without relying on parent-asset invalidations.
The additive invoker RPC grants only authenticated execution; it grants no new
table access and changes no RLS policy. Apply migration
`20261010000000_approved_tag_selector.sql` before deploying the reader.

Run `npm run test:f0b:tag-selector:local`. Actual SDK calls prove anonymous and
service-role execution denial. Rollback fixtures exercise the production
repository/service over the actual authenticated SQL RPC, including owner/admin
isolation, approved/internal/published gates, same-name identities, malformed
authored-field omission, merged pagination beyond 1000 rows, two fresh readers,
private-write shared-stream non-interference, migration reapplication, unchanged
table grants/RLS, and restored source/catalog/relations/outbox/runtime fingerprints.
Fixture reads are not claimed as HTTP/PostgREST fixture tests.

The lore writer below now resolves its ownership/transaction conflict. The existing
frontend selector requests the default page; full paginated/search UI remains a
later consumer adapter. No release was persisted and the launch gate remains closed.

## Atomic lore authoring

The authenticated V2 lore POST, PUT and DELETE use `LoreContentWriteService` and
the transactional, caller-RLS `chimera_write_owned_lore` invoker RPC. The route
contains no repository/client calls or business logic. The inspected legacy PUT
and DELETE checked world ownership instead of lore ownership; this could modify
another creator's lore on an owned world and reject legitimate null-world lore.
The clone-only restriction on a public world also conflicted with editable current
sources. Edits/deletes now require the actual player lore owner, regardless of
world privacy/ownership; admins gain no foreign or first-party authoring access.
Existing owned public lore can be edited in place. Visibility transitions and
reparenting are not supported by these write DTOs.

Creation verifies and locks the selected owned player context in existing
Entity → Story → World priority. Entity/story creation infers the nullable world
from that parent and persists only the selected specific parent. Lower-priority
unchecked fields never become references. Context IDs are UUIDs, as current editor
requests require; canonical stable-key selection needs a later consumer adapter.
The existing story-child entitlement trigger remains authoritative: read-only
story lore cannot be created, edited or explicitly deleted. Parent-story locks
precede lore locks, and a parent race returns 409 rather than taking a mixed view.

Direct authenticated table writes previously could attach owned lore to a foreign
story and make the privileged entitlement trigger touch that story. A narrow
before-trigger now denies foreign/first-party story parents before that side effect.
Its dedicated `NOLOGIN NOINHERIT NOBYPASSRLS` owner can read only story ID/ownership
columns, with no body read, table DML, schema CREATE or role membership. Only the
trigger invokes it. Global identity visibility is necessary to distinguish a
deleted parent in a legitimate FK cascade from an RLS-hidden foreign story.
Owned-story deletion cascades still work after a tier downgrade. Malformed legacy
foreign-story lore is rejected without touching the foreign parent; repairing
those old references remains a maintenance audit.

Body patches merge under a lore row lock, preserving unknown authored fragment
fields. Body/keywords, owner-private tag creation and tag-link replacement commit
together or roll back together, including entitlement activity and change events.
Omitted tags preserve links; `[]` clears owned links. Explicit lore deletion removes
its owned tag links in the same transaction, never foreign links. New tags retain
the existing unapproved workflow and use stable UUID keys independent of editable
names. Tag names are normalized/deduplicated, then processed in stable order.
The old global name constraint is replaced by `(owner_namespace, tag_name)`
uniqueness, so equal private names never reuse another owner's tag or reserve a
global name. Remaining legacy entity/world/pack writers with global tag lookups
need their own audits; this slice does not broaden their scope.

The shared schemas reject privileged/unknown fields and bound work: name 200
characters, entry text 100,000, optional type 200, at most 100 keywords (200
characters each) and tags (160 each). The RPC independently validates the same
fields, types and bounds. It returns the explicit source/tag DTO from the mutation
transaction, with vectors redacted and no invented lore type, version or stats.
A changed entry clears its old embedding. Read failures cannot silently become
successes, and expected ownership/tier/validation/conflict errors use safe
404/403/422/409 envelopes; unexpected failures use safe trace-only 503 logging.
There is no automatic write retry. Apply `20261011000000_atomic_lore_authoring.sql`
before deploying the writer.

Run `npm run test:f0b:lore-authoring:local`. Actual SDK calls prove anonymous and
service-role invocation denial. Rollback-only fixtures exercise the production
repository/service over the real-role SQL RPC: ownership independent of world,
first-party/admin refusal, null contexts and priority, direct-table foreign-story
denial/cascade compatibility, guard-owner privilege limits, same-name private tags,
strict fields/bounds, disjoint fragment patches, injected create/update tag failure
rollback, tier rejection, explicit delete cleanup, and private/public/delete refresh
through two actual reader caches and the durable outbox RPC. This is not a
multi-connection concurrent-write or HTTP/PostgREST fixture test. A first-party
legacy UUID fixture uses temporary setup-only sync-role INSERT rights, removed
before application assertions. Final fingerprints restore source/catalog/relations,
entitlements, compiles/blobs/games and outboxes; application grants/RLS are retained.

Follow-up: direct parent-delete cascades still need a polymorphic tag-link cleanup
audit (the inspected asset relation has no asset FK). Draft pack/story source links
may remain unresolved after source deletion; missing-reference UI and the other
content-writer/dependency audits remain prelaunch gates. Pinned snapshots are not
rewritten. No hosted deployment or launch opening occurs, and F0b remains incomplete.

## Owner-scoped world/entity tags

The mounted player V2 world POST/PUT (`tag_names`) and entity POST/PUT (`tags`)
now replace tag relations through `AssetTagWriteService`, its request-RLS
repository, and `chimera_replace_owned_asset_tags`. They no longer perform
service-role global-name lookups or silently continue after tag failures. HTTP
validation normalizes/deduplicates names before saving the parent and rejects
empty normalized names, names over 160 characters, and arrays over 100 entries.
Omitting update tags preserves links; an explicit empty array clears owned links.
The world's separate inline `tags` field retains its existing behavior.

The inspected schema makes tag names unique within `owner_namespace`, keeps
tags/links owner-private regardless of approval or parent publication, and has
no polymorphic asset FK. The old inserts omitted the required owner; the old
global lookups could adopt another owner's same-name tag or fail ambiguously.
The invoker RPC derives its actor from `auth.uid()`, locks and verifies the
owned player world/entity before any tag mutation, and returns 404 for foreign,
missing or first-party assets, including admin calls. Replacement deletes only
that actor's links for the exact asset UUID/type. Tags resolve only in that
actor's namespace. New tags are unapproved and receive UUID stable keys, avoiding
collisions with renamed legacy tags; existing identity/approval remains intact.
An insertion failure rolls back tag creation, deletion, replacement and durable
events together. Responses/logs mask database diagnostics, and writes never retry
automatically. Private tag edits do not advance the shared content stream.

Apply `20261012000000_owned_asset_tags.sql` before deploying these callers. This
additive, rerunnable function grants execution only to authenticated callers;
it changes no table grants, RLS policies, ownership guards or source data. A
backend rollback can retain the function. Removing it requires first rolling
back its callers; no data backfill or tag deletion is part of the migration.

Run `npm run test:f0b:asset-tags:local`. Actual SDK requests verify anonymous and
service-role denial. Rollback-only real-role fixtures exercise the production
repository/service, same-name owner isolation, admin/first-party refusal,
approval/key preservation, renamed legacy-key collision avoidance, same UUIDs
across asset types, strict SQL bounds, private outbox events, empty replacement,
foreign-link preservation and injected failure rollback. Reapplying the migration
twice preserves grants/RLS, and final fingerprints restore accounts, catalog,
sources, relations, entitlements, snapshots and outboxes. Fixture mutation calls
use a sequential SQL adapter, not fixture HTTP or a multi-connection concurrency
test. Focused HTTP tests separately verify actual player route/service wiring,
validation before parent mutation, omission/clear semantics and safe failures.

This is a tag transaction, **not a transaction for the whole parent save**: legacy
world/entity source mutations occur separately before tag replacement. A tag
failure now returns an error with the previous tags retained, but earlier parent
changes can already be committed. Full atomic world/entity authoring, their
legacy published-edit restrictions, direct-table polymorphic parent validation,
parent-delete cleanup and the mounted admin world/entity/tag paths remain
separate prelaunch audits. The admin routes still query legacy projections,
perform global tag lookups and use old official/system flags without canonical
ownership. Those flags cannot authorize first-party writes under the foundation
guards; first-party authoring stays in the repository/sync workflow. No first-party
UI writer, source release or hosted deployment is added.
F0b remains incomplete and launch remains closed.

## Public NPC catalog integration

`GET /api/catalog/npcs` and `/npcs/:id` use an anonymous published audience,
including when the caller supplies an admin bearer token. Lists combine canonical
published first-party NPCs with public player NPCs; stale first-party legacy
bodies are excluded. Detail reuses the entity reader's identity, RLS, release,
source-cache and non-disclosing 404 boundaries. This remains the public authoring
catalog, not a session dossier or learned-NPC knowledge view.

The old list filtered world/search after pagination and reported an unfiltered
total. The new read-only `chimera_public_npc_page` invoker function applies NPC,
world, literal case-insensitive name/description/role-tag search and authored
activity filters before one globally ordered page and exact count in the same
database snapshot. It uses caller RLS with explicit published/public gates even
for direct authenticated admin calls. No definer privilege or new table grant
is introduced. The new migration is idempotent and must precede the API release.

The existing `{ items, total, limit, offset }` shape, default limit 20, maximum
limit 100 and `q`/`search` aliases are retained (`q` takes precedence). Invalid
pagination is now rejected; offset is bounded to 1000 and search to 100 characters.
World filters accept canonical keys as well as UUIDs. Ordering is creation time
descending with namespace/key tie breakers. Existing first-party UUID aliases
are reused when present; keys otherwise identify canonical entries, and ambiguous
player slugs are refused. Missing name/description/status is null. The old
invented `status: "active"` is removed; `activeOnly=1/true`, previously ignored,
requires an authored `raw_data.status === "active"`. No stats are synthesized.
Catalog cards that still prefer owner-scoped slugs need stable-ID links before
launch; this backend slice retains the existing DTO field names and does not
rewrite the legacy NPC detail page's separate frontend field assumptions.

Lists cache the complete page and its filtered total under a distinct public
entity audience. Entity-type facets target NPC changes; search, activity and
the mixed UUID/key world filters conservatively invalidate on relevant shared
NPC changes. Old/new facets handle NPC type transitions. Private-only edits
never enter this shared stream. Both instances catch up before hits and after
fills; visibility/release changes, world moves and deletion refresh pages and
totals together. Failures return safe 503 envelopes.

Run `npm run test:f0b:npc-catalog:local`. It checks actual anonymous SDK/RPC
transport, then uses the actual invoker function under anon/authenticated roles
inside a serialized rollback transaction. Fixtures cover literal punctuation and
role-tag fallback, matches beyond the old first page, exact counts on empty pages,
world/activity filters, internal/private/type/ambiguous-slug denial, admin
isolation, two cache instances, release/visibility/deletion changes and private
event non-interference. Migration reapplication and catalog/source/outbox
fingerprints are checked. HTTP/unit tests separately cover request validation,
anonymous client construction, DTOs and safe error envelopes. No hosted deploy,
launch opening or persistent fixture publishing is performed.

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

These slices do **not** complete F0b. World, player entity, lore, public NPC catalog and story reads now use this cache; other
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
