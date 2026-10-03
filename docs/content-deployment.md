# Protected content deployment (F0b, pre-launch slice)

The manual **Deploy content (pre-launch)** workflow deploys reviewed first-party
upserts from current `main` without building or deploying either app. This is a
bounded step toward the F0b gate in [PLAN](design/play-redesign/PLAN.md).
It does **not** complete F0b or authorize real-player admission. The launch
guard remains closed. The [invalidation foundation](content-invalidation.md)
adds durable shared/private streams and a first-party compiler cache; broader
reader migration, retention/scale qualification, release controls, real source
deletes, and hosted deployment/rollback rehearsal remain outstanding.

## Configure before the first hosted dispatch

Create separate `content-staging` and `content-production` GitHub environments.
Each must have required reviewers, **Prevent self-review** enabled, administrator
bypass disabled, and deployment branches restricted to protected branches.
Protect `main` with the normal PR/CI gates described in [CI](ci.md). The workflow
checks these settings before referencing an environment, so it cannot silently
create an unprotected environment. It checks again after approval and rejects
the run if `main` has advanced. Dispatch a fresh run for the new commit.

On inspection during this slice, neither environment existed. Configuration,
credentials, hosted schema installation, and execution are operator work;
this change does not create environments, install secrets, or run a deployment.
The public repository's read-only workflow token must be able to inspect its
environment and branch metadata. An unavailable API or missing read permission
fails closed, before content credentials are used.

Set these **environment-scoped** values separately for each target:

| Kind     | Name                               | Value                                                                                                                                                                    |
| -------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Secret   | `CONTENT_DEPLOY_DATABASE_URL`      | PostgreSQL DSN for `stonecaster_content_deployer`, with a password, explicit port `5432`, and no query/hash overrides. A session pooler login may include `.projectref`. |
| Secret   | `CONTENT_DEPLOY_TLS_CA`            | PEM CA certificate obtained for that database endpoint through the provider's trusted configuration.                                                                     |
| Variable | `CONTENT_DEPLOY_EXPECTED_HOST`     | Exact lowercase database or session pooler hostname from the approved DSN.                                                                                               |
| Variable | `CONTENT_DEPLOY_EXPECTED_DATABASE` | Exact database name, normally `postgres`.                                                                                                                                |
| Variable | `CONTENT_DEPLOY_EXPECTED_APP`      | Actual Fly app identity recorded in that database's verified runtime inventory.                                                                                          |

Do not supply an app/service-role credential, Fly token, general database login,
or PR-provided connection string. No deploy credential is stored in Fly or
checked into the repository. The connection verifies the CA and server name
with TLS 1.2 or newer; transaction-pooler port `6543` and TLS URL overrides are
rejected. The database session must actually be `stonecaster_content_deployer`;
the database name and verified fleet app must match the approved environment.
The narrow validation view must report the target contract and a closed launch
guard. Missing metadata is a refusal, not an inferred default.

Apply migrations through `20261007000000_f0b_content_deploy_targets.sql` using
the separate migration procedure before deploying content. Inventory the
actual running Fly machines, bootstrap the durable registry, and have each
build report its compiled format support as described in
[content operations](content-f0a-operations.md). An empty, unreported, or
incompatible unretired build blocks the sync transaction. Registry entries
never expire automatically; retiring a build requires verifying that it no
longer runs. Keep the pre-launch write/admission freeze throughout this slice.

## Deploy and inspect the receipt

1. Merge the content change through the normal reviewed PR into `main`.
2. Manually dispatch **Deploy content (pre-launch)** on `main`, choosing staging
   first. No arbitrary ref or content SHA input is accepted.
3. Review the exact commit and target through the GitHub environment gate.
4. Inspect the JSON success receipt: target, commit SHA, generation, deploy ID,
   manifest hash, item count, format, outcome, changed keys, and old/new hashes.
   The receipt's SHA/hash/count must match the committed validated bundle.
5. Inspect the staging runtime and repeat with a separate production approval
   only after the remaining hosted operational gates are satisfied.

Dispatches are serialized per target, with no cancellation of a running sync.
Only the final sync step receives the dedicated DSN and CA. GitHub-token
preflight, dependency install, and graph validation receive no content
credential. Database failures produce a safe error and no accepted success
receipt. Fixed-function graph/hash validation, generation fencing, runtime
format compatibility, source writes, and deploy receipt remain transactional.

## Pre-launch rollback and limits

For a payload rollback, submit a reviewed **revert of the content change** to
`main`, merge it, then dispatch the same workflow and review the new commit.
This reruns content sync only; neither app is redeployed. It writes a new
generation/receipt and preserves existing frozen compiled stories and games.

The current RPC **upserts** the supplied set and emits metadata changes for
changed source keys in that transaction. Removing a key from repo files
does not delete an existing source row, and a revert that omits a newly added
key does not remove that key. Existing release state is preserved; new keys
are internal. Full delete/release rollback, broader cache reader migration,
and operational cache qualification require their remaining F0b slices. Do not treat a successful upsert receipt
as proof of production lifecycle or cache readiness.

Credential rotation/revocation is an operator action: change the dedicated
database login and corresponding protected environment secret together,
revoke the old credential, and repeat staging validation. Never rotate a
shared app credential or put the DSN in command arguments or logs.

## Evidence for this slice

Unit tests exercise protected-main/environment refusals, missing environments,
safe API/database failure messages, explicit local/hosted targets, TLS policy,
wrong database/role/app identities, and launched-target rejection. The local
runtime-fence harness reads the additive view as the real dedicated session
role, verifies it cannot read the underlying launch guard, and checks the
launched flag inside rollback-only fixtures. The migration is rerunnable.

Hosted TLS connectivity, actual workflow token permissions, independent
review, credential isolation, staging deployment, and rollback rehearsal
remain unverified until the operator configuration above is installed.
