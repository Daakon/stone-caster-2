# F0b per-build content readiness

This bounded slice makes each running or waking build reject readiness when it
cannot read stored content. It does not complete the all-machine deployment
registry or open the real-player launch guard. Release/source deletion, the
deployer's live-build compatibility fence, cache/outbox propagation, and hosted
deployment/rollback operations remain separate F0b work.

## Database and application contract

Apply `20261005000000_f0b_content_readiness.sql` before deploying this backend.
The additive migration is rerunnable and changes no content. It adds format-only
indexes and a fixed `chimera_content_format_inventory()` function. Its NOLOGIN,
NOINHERIT, non-BYPASSRLS owner can read only format columns and singleton catalog
metadata. It cannot read bodies or mutate content, and has no schema CREATE
permission after migration. PostgreSQL's maintenance creator retains only its
automatic ADMIN option, without inheritance or SET ROLE; application roles get
no owner membership. Only the backend service role can execute the function.

The function reads current-source and retained frozen-blob version extrema in
one statement snapshot. Indexed minima/maxima avoid scanning every blob or
fetching content bodies per health check. The catalog generation is an internal
decimal string so bigint precision is retained. Missing catalog state is an
invalid contract, not an empty catalog. A real empty catalog has null version
extrema and remains ready; player admission still depends on separate launch
gates. Sources can be deleted while pinned blobs remain, so readiness checks both.

`SUPPORTED_CONTENT_FORMAT` is compiled into this build and currently declares
the implemented format-1 parsers. It is not an environment knob. A future range
change requires actual parser support, including retained session formats.
Metadata is strictly validated. Unsupported formats, malformed metadata, a
missing RPC, an outage, or a probe exceeding its one-second deadline returns 503.
Every readiness call reads fresh metadata; an earlier success is never cached.
All retained blobs are checked conservatively, including unreferenced blobs
awaiting the separate GC workflow.

## HTTP and Fly probes

`GET /api/health/ready` is public and sets `Cache-Control: no-store`. A 200 response
uses the normal success envelope, with `data: {status:"ready", checks:{db:true,
contentFormats:true}, timestamp}`. A 503 uses the normal error envelope and
includes safe readiness checks in `error.details` when available. Error logs,
response metadata and the response trace header share one request trace. Public
responses expose no content bodies, keys, hashes, generations or credentials.

Both `fly.toml` and `backend/fly.toml` now probe this endpoint. Their existing
ports and timing remain unchanged. `/health` and `/api/health/live` retain their
process-liveness contracts for local tooling and diagnosis.

The previous readiness route queried legacy `worlds`, assumed `v3Only=true`, and
required a warmed legacy cache; both Fly configurations instead probed an
always-successful root `/health`. No repo consumer depends on those obsolete
readiness fields. This slice replaces them with actual Chimera metadata and the
standard API envelope, updating API/OpenAPI documentation accordingly. Health
checks are routing signals; request-level compatibility fencing and the deploy
registry remain necessary before format upgrades or player admission. No hosted
deployment is performed by this PR.

## Validation and rollback

Run `npm run ci:all`, the backend build/API documentation checks, and
`npm run test:f0b:readiness:local` on the migrated isolated stack. The local
harness verifies real grants, RLS owner restrictions, v1 readiness, unsupported
source and frozen-blob rejection, missing-catalog failure, and recovery. Every
fixture rolls back; catalog, receipt, source and blob fingerprints must remain
unchanged. The harness changes no credentials and stops its imported config
poller before exiting. Unit/HTTP tests cover malformed metadata, changing
inventory, outages, sanitized responses and trace correlation. Live HTTP checks
exercise the deployed local route through PostgREST.

Two supporting shared-utility import fixes reference the existing API type module
directly so the standalone harness can load its service code. Unit-test aliases
had masked the response utility's startup failure. Resolving the actual enum also
exposed an incomplete legacy status map; its type now expresses that partial map
and explicitly preserves the existing 500 fallback. A regression test covers it.
No common response or error behavior changes.

The schema can remain when rolling back the backend. Restore the previous Fly
probe path only with that backend rollback; the former path provides process
liveness rather than format readiness. Do not remove the migration or widen
format support to conceal a compatibility failure. This slice changes no UI and
requires no new screenshots.
