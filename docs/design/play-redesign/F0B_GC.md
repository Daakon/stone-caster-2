# F0b bounded snapshot cleanup

This implements the manual snapshot GC slice in PLAN F0b. It does not complete
F0b or open the real-player launch guard. Source deletion, release propagation,
cache/outbox invalidation, format compatibility and deployment gates remain
separate work.

The separate [deployment provenance slice](F0B_DEPLOY_PROVENANCE.md) records
committed source identity and hash changes; it does not implement runtime format
compatibility or a hosted deployment gate.

## Operator workflow

Apply `20261003000000_f0b_snapshot_gc.sql` through the normal migration workflow.
Provide `CONTENT_GC_DATABASE_URL` through the operator environment; the CLI does
not load application credentials or fall back to content-deployer credentials.
This slice accepts only the isolated local PostgreSQL endpoint on loopback port 54422. Hosted execution needs its own deployment/operations gate.

Run a preview with an explicit target and batch size:

```sh
npm run content:gc -- --target=local --batch-size=100
```

Add `--apply` to commit one bounded cleanup transaction:

```sh
npm run content:gc -- --target=local --batch-size=100 --apply
```

There is no startup hook, timer or application HTTP endpoint. Each invocation
opens a fresh connection and enters `stonecaster_content_gc_operator`, whose
only content privilege is EXECUTE on `chimera_content_gc(integer,boolean)`.
The migration grants operator membership to the existing `postgres` maintenance
login. Additional maintenance logins must be provisioned explicitly; application
roles and `stonecaster_content_deployer` receive no access. Neither the operator
nor the function-owner role can log in. The owner is not granted to application
or operator roles, has no schema CREATE privilege after migration, and uses RLS.

The SQL and shared Zod contract require a batch size from 1 to 1000 and an explicit
dry-run flag. A batch can delete at most that many compiled rows **and** that many
blobs, so a limit of 100 permits at most 200 row deletions. The CLI defaults to
preview and requires `--apply` to change data. Connections, statements and lock
waits have time limits; a database error rolls back the transaction and returns
a sanitized failure rather than a success receipt.

The JSON receipt contains the requested mode/limit, candidate and deletion counts,
and eligible/reclaimed byte counts as decimal strings to retain bigint precision.
Preview counts currently eligible blobs; it does not project blobs that would
become eligible after deleting compiled rows. Concurrent activity and skipped
locks can make an apply receipt differ from its earlier preview. Repeat explicit
batches until no rows are deleted, while allowing locked work to finish.

## Retention and concurrency

Compiled snapshots qualify only when no game pins them and no story points to
them as current. Their compiled-content refs cascade with the compiled row. Blobs
qualify only when neither a compiled-content ref nor a compiled payload points
to them. Cleanup never modifies source content, entitlements, games, characters,
notes or ledgers. No synthetic replacement snapshot or game repair is created.

GC selects candidates in stable creation/key order with `FOR UPDATE SKIP LOCKED`,
locks an originating story when present, and rechecks both retention predicates
before deletion. A busy originating story is skipped to avoid reversing the
compiler's story/blob lock order. Games already lock the compiled row in their
pinned-creation transaction. The compiler now locks its story before publication
and takes `FOR KEY SHARE` on every upserted source/payload blob until refs are
inserted and committed. Serialization/deadlock errors retry the entire compiler
resolution at most three times, even if catalog generation stays unchanged.

Foreign keys remain the final guard. The current-pointer FK changes from the
existing `ON DELETE SET NULL` to `RESTRICT`, as required by the plan: cleanup must
not silently clear a published pointer. Blob immutability previously prohibited
all DELETEs; its trigger now permits DELETE only while executing as the restricted
NOLOGIN GC function owner. UPDATE remains forbidden. PostgreSQL row locking
requires UPDATE privilege, so that owner receives only key-column grants with an
RLS `WITH CHECK (false)` policy that forbids changing rows. These are the two
supporting adjustments to the existing F0a schema; earlier migrations are unchanged.

## Validation

`npm run test:f0b:gc:local` requires an idle isolated local stack with synced
first-party content and the migration applied. It holds locks on every pre-existing
compiled snapshot and blob before committing its disposable fixtures. The real GC
can collect only the harness's new data. It checks role denial, immutability,
invalid limits, preview behavior, bounded/idempotent deletion, shared references,
current/game retention, and concurrent story/compiler/pinned-session operations
in both winning orders. Generated accounts, tiers, stories, games, compiled rows
and blobs are removed while the protection locks remain held.

Unit tests check CLI/service validation, receipt consistency and bigint precision,
credential-safe failures, connection cleanup, and bounded compiler retry behavior.
Run `npm run ci:all` and the local lifecycle harness before publishing changes.
This slice changes no UI, so it requires no new visual evidence.
