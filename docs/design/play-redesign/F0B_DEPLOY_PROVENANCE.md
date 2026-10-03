# F0b content deployment provenance

This bounded slice implements PLAN F0b's deployment audit metadata and admin
history boundary. F0b remains incomplete: release operations, source deletion,
runtime format compatibility, hosted deployment gates, and cache/outbox propagation
still precede real-player admission. The launch guard remains closed.

Per-build compatibility probing is documented in
[F0B_CONTENT_READINESS.md](F0B_CONTENT_READINESS.md); the all-machine deployment
registry and sync fence are implemented in the later
[runtime format fence slice](F0B_RUNTIME_FORMAT_FENCE.md), with hosted inventory
and deployment gates still required.

## Operator contract

Apply `20261004000000_f0b_deploy_provenance.sql` through the normal migration
workflow. Earlier migrations remain unchanged. The migration extends the existing
restricted sync function and validation view, preserving the dedicated login and
generation fence. The CLI checks the provenance schema version before writing.

Set `CONTENT_DEPLOY_DATABASE_URL` in the operator environment to an existing
`stonecaster_content_deployer` login on loopback port 54422, then run:

```sh
npm run content:validate
npm run content:sync -- --target=local
```

Validation reads working files. Sync requires a clean `content/first-party/` tree
and reads every authored file from the captured full Git SHA. Concurrent worktree
or HEAD changes cannot change those committed bytes. Unrelated working changes
do not block sync. There is no app/service-role credential fallback, credential
rotation, hosted target, startup hook, or new operator HTTP endpoint.

The database computes canonical hashes and old/new changes while holding the
existing catalog lock. Catalog writes, generation advancement, and the receipt
commit in the same transaction. The receipt records deployment ID, Git SHA,
format version, manifest hash, item count, trusted database actor, timestamp,
changed owner-scoped keys, old/new hashes, and outcome. A new key has a null old
hash; unchanged content produces empty change arrays. Successful no-op syncs
still advance generation under the existing contract. Failures roll back and do
not create an applied receipt. Operational errors are sanitized rather than
copying connection URLs or raw database exceptions into logs.

Sync retains existing upsert behavior: omitted keys are not deleted and release
state is preserved. Change arrays describe actual upserts, not Git file diffs or
deletions. Failed-attempt auditing would require a separate transaction and is
outside this slice; `outcome` currently records only `applied`.

## Administrator history

`GET /api/admin/content/deploy-log` uses the existing administrator middleware
and caller-scoped JWT repository. The database independently requires an
authenticated administrator. Anonymous, player, service-role, and deployer callers
cannot read history through this endpoint/RPC. Application roles cannot write
the audit table, and its append-only trigger rejects updates and deletes.

Pages accept `limit` (1–100, default 25) and optional `before_generation` (positive
decimal bigint string), ordered by descending unique generation. The response is
`{items, next_before_generation}` inside the normal API envelope and uses
`Cache-Control: no-store`. Generations and cursors remain strings to preserve
bigint precision. No content bodies are returned.

Historical F0a receipts have no reliable Git SHA or change list. They are returned
as `provenance: "legacy"` with null provenance fields; no historical facts are
invented. New receipts use `provenance: "recorded"`. The API exposes commit SHAs
for a future admin interface; no new UI is included here.

## Validation

Run `npm run ci:all`, the backend build, and
`npm run test:f0b:deploy:local` against the migrated, synced isolated local stack.
The latter requires an existing dedicated deploy login and never changes its
password. It checks new/changed/no-op hashes, required commit metadata, generation
fencing, duplicate-receipt and dependency rollback, cross-connection atomicity,
role denial, admin pagination, legacy unknowns, and append-only history. All
fixtures roll back; catalog/generation/receipt fingerprints must remain unchanged.

The existing F0a acceptance harness also supplies required metadata for its
temporary source edits. Those local-only committed fixture receipts use an
explicitly synthetic all-zero SHA, rather than claiming the edits came from Git.

`npm run test:f0b:deploy:local -- --history-only` runs only the administrator and
append-only checks without a deploy login. Report this as partial validation;
it cannot establish the dedicated-login transaction boundary. Unit tests exercise
Git-pinned reads, schema preflight, receipt validation, credential-safe failures,
caller-JWT repositories, and the real administrator middleware. This slice has
no UI changes and requires no new screenshots.

A supporting cleanup uses relative shared-content imports in the source reader,
catalog repository, compiled repository, and frozen compiler. The existing root
alias points outside this checkout; resolving the real module exposed an unused
format-version export. That type remains internal, and the catalog uses the
existing release-state type. No compiler or release behavior changes.
