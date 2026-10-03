# F0a content and reset operations

## Reconciliation audit

The read-only hosted inventory and premade resolution are recorded in [content-reconciliation-f0a.md](content-reconciliation-f0a.md). To repeat the inventory, configure `HOSTED_SUPABASE_URL` and a read credential in `backend/.env`, then run:

```powershell
npm.cmd run content:audit:hosted
```

The command issues only `GET` requests. It does not export SQL or write content. Review the full inventory and resolve held owner/reference questions before adding those rows to `content/first-party/`.

## Local reset, validation and sync

Use the local wrapper to rebuild the isolated Supabase database, sync repo content using the dedicated deploy login, and run the F0a local database checks:

```powershell
npm.cmd run local:reset
npm.cmd run content:validate -- --hashes
npm.cmd run content:sync -- --target=local
```

The native `supabase db reset` command still handles migrations and SQL seed files. The `local:reset` wrapper runs it first and then loads authored content from `content/first-party/` through the content-only sync function. Do not run `content:sync` against production in this milestone.

## Backup check and wipe dry run

Backups used for the guarded cutover must be PostgreSQL custom-format archives. Check the archive, compare its digest with the independently recorded value, and restore it to a temporary local database:

```powershell
npm.cmd run backup:check -- --file="C:\backups\stonecaster-pre-f0a.dump" --sha256=<recorded-sha256> --restore-test
```

The isolated restore check is local-only and drops only the randomly named temporary database it creates. The local wipe dry run reports foreign-key order, row counts, the launch/reset guards, and retained users, profiles, config and rulesets:

```powershell
npm.cmd run wipe-prelaunch-data -- --dry-run --target=local --reset-key=f0a-pre-setup-v1 --tester-allowlist=supabase/ops/testers.local.json
```

The wipe command above is a local dry run. No wipe execution or hosted/shared dry run was performed. An actual cutover remains a separate operator action after product approval, write freeze, hosted-schema/FK confirmation and a verified restorable backup.

## First content sync

For local verification, the first sync command is:

```powershell
npm.cmd run content:sync -- --target=local
```

It requires `CONTENT_DEPLOY_DATABASE_URL` for the local `stonecaster_content_deployer` role and refuses non-loopback hosts for `--target=local`. The F0b [protected content deployment workflow](content-deployment.md) adds staging/production targets for reviewed pre-launch upserts. Hosted configuration and execution require the independent environment gate; no hosted sync was run during these implementation slices.
