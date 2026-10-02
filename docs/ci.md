# CI gates and debt ratchets

The merge gate is **no new failures, strict zone clean**. Run `npm run ci:all`
before pushing. CI runs the same checks in parallel jobs and runs the mocked
play shell in Chromium without a backend or Supabase.

## Baselines

The TypeScript and Vitest ratchets are in `scripts/ci/`. They compare stable
keys against JSON in `scripts/ci/baselines/`: TypeScript uses path, TS code and
message without line number; tests use the path and full test name. Both
report how many failures disappeared. `--update-baseline` removes resolved
entries; it refuses additions unless `--allow-add` is passed. `--allow-add`
exists for initial baseline generation and must not be used in a PR. The
anti-gaming gate also rejects baseline growth.

ESLint 9 uses its native `eslint-suppressions.json` files at the repository
root and in `frontend/`. These record existing errors by file and rule. New
errors exceed the allowance and fail. After fixing old errors, regenerate with
`--prune-suppressions` and commit only the smaller file. Dependency Cruiser
uses its native known-violations file and `--baseline-mode shrink-only`. Knip
issues are keyed by file, issue type and symbol in its JSON baseline because
Knip does not provide a native shrink-only baseline.

## Strict zone

The following paths have no baseline allowance:

- `frontend/src/features/play/**`
- `frontend/src/stores/useActiveGameStore.ts`
- `shared/src/types/chimera-play-view.ts`
- `backend/src/services/play/**`
- Every file absent from main when this gate was introduced

The ratchet scripts accept `--strict-globs` with comma-separated patterns.
Strict TypeScript configs enable `strict`, `noUncheckedIndexedAccess`,
`noImplicitOverride` and `noFallthroughCasesInSwitch`. ESLint applies
typescript-eslint strict type checked, React Hooks and JSX accessibility
recommendations where relevant. Vitest requires 80% lines and branches for
the strict source paths.

Three legacy test files on main do not parse (`usePrefetch.test.ts`,
`useURLFilters.test.ts`, and `turn-engine-e2e.test.ts`). ESLint excludes those
exact paths until they are repaired. Vitest records each as a suite-load
failure, so a new suite-load failure elsewhere still fails CI.

## Shrinking debt

Fix the underlying issue, run `npm run ci:all`, then update the relevant
baseline with `--update-baseline` or a native prune command. Review the diff:
entries may disappear or counts may fall, never rise. Prettier is mechanical:
run `npm run format:fix` for changed files and commit the result.

The anti-gaming job rejects new undescribed ESLint disables and TypeScript
expect-error directives, a larger directive count, test `.only` or `.skip`,
assertion or test removal without a `TEST-REMOVAL:` reason in the PR body, and
baseline additions. Existing real-stack browser specs carry `@stack` and stay
runnable locally. CI uses `frontend/playwright.mocked.config.ts` for its
fixture-backed play shell.

The two existing local database integration suites previously used conditional
`describe.skip`. They now have a separate `backend/vitest.local-integration.config.ts`
and keep every assertion. They are excluded from the mocked unit configuration
because they were already opt-in, and fail clearly if the explicit local opt-in
is absent. With the isolated local stack ready, set `RUN_LOCAL_DB_INTEGRATION=1`
and run `npm run test --workspace=backend -- --config vitest.local-integration.config.ts`.

## Main branch protection

In Settings > General > Pull Requests, enable **Allow auto-merge** and squash
merging. In Settings > Branches, add a protection rule for `main` with:

- Require a pull request before merging.
- Require **0** general approvals and enable **Require review from Code Owners**.
  Ordinary paths need no human review; `.github/CODEOWNERS` paths require Daakon.
- Require status checks and require branches to be up to date before merging.
- Select these exact check names after the workflow has run: `install/build`,
  `ci:types`, `ci:lint`, `ci:tests`, `design:check`, `format:check`, `anti-gaming`,
  `architecture`, `knip`, and `e2e-mocked`.
- Leave `db-optional` outside the required checks. It runs the existing template
  linter only when Supabase URL and service credentials are present; it skips
  clearly when they are absent. Also supply `SUPABASE_ANON_KEY` when using it.
- Disallow force pushes and branch deletion. Apply the rule to administrators
  if administrator bypass is not intended.

GitHub authors cannot approve their own PRs. A PR touching owned paths and
authored by Daakon needs the repository's agreed review arrangement; do not
automatically bypass protection. Enable auto-merge on each eligible PR using
`gh pr merge <number> --auto --squash` after the required settings are active.
These settings are documented for an administrator to apply, not changed by
the CI tooling.

All jobs use Node 24, npm's lockfile cache and independent jobs. Browser jobs
cache Chromium by lockfile. Each required job has an eight-minute or shorter
timeout; measure the complete hosted run after opening a PR to verify the
under-ten-minute target rather than treating the timeout as a measurement.

## Regression proof and browser evidence

The optional **API Documentation Validation** workflow installs the root npm
workspace with Node 24, builds the backend, tests its documentation CLI, and
exports the existing `/swagger.json` document as the `api-specification` artifact.
Run `npm run docs:validate --workspace=backend` locally, or
`npm run docs:spec --workspace=backend -- <output.json>` to export it. These
commands need no backend, database, or provider credentials. Malformed Swagger
annotations and an empty or invalid document header fail validation. This is a
generation check of the declared documentation, not a completeness audit of all
Express routes or a full OpenAPI schema validator. The separate composed
`/api/openapi.json` document continues to have its existing endpoint tests.

The retired auto-generation job referenced scripts that no longer exist and
attempted to push generated route comments directly to protected `main`.
Documentation changes now follow the normal reviewed PR workflow. This job
has read-only repository permissions and publishes an artifact without making
commits or posting optimistic route-coverage claims.

Run `npm run ci:prove-gates` to temporarily introduce a type error, an explicit
`any`, and a failing assertion in the play strict zone. Each probe runs the
actual `ci:all` command, verifies rejection by the intended gate and is removed
in a `finally` block. Local proof logs are written to ignored `tmp/` files.
Run `npm run ci:all` again with every probe removed before committing.

Run `npm run build:client` and `npm run test:e2e:mocked` for the fixture route.
CI uploads the three viewport screenshots as `play-shell-screenshots`, even
when the browser job fails. Local reference captures are in
[`ci-evidence/`](ci-evidence/). They match the existing play shell on main;
the approved `play-redesign` screens belong to the separate Phase 0 task.
Existing speculative HP/default-100 rendering, legacy palette classes and
light-theme narration contrast conflict with the redesign spec and remain
follow-up design work. The fixture selects dark mode for readable captures.

Reference documentation: [GitHub branch protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule),
[ESLint native suppressions](https://eslint.org/docs/latest/use/suppressions),
and [Knip reporters](https://knip.dev/features/reporters).
