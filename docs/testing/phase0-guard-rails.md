# Phase 0 Guard Rails

## Objective
- Freeze feature work and focus only on restoring automated test coverage.
- Keep production/runtime code untouched until a failing test requires it and write/adjust tests first.

## Workflow Requirements
1. Before editing anything, run the smallest relevant Vitest target (e.g. `npm run test -- profile.service`) to confirm the current failure signature.
2. Make test/mocks/config changes only; if a production file must be touched, open a discussion first and capture the failing test proving the need.
3. Re-run the same targeted test immediately after each change and record the command/output in your commit notes.
4. At the end of every work session, run `npm run test --workspaces --runInBand` and attach the summary to your PR description.

## Config Fingerprints
- File hashes live in `docs/testing/phase0-config-snapshot.json` (generated 2025-11-09). Recompute with:
  ```powershell
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/tools/check-phase0-config.ps1
  ```
  Add `-Update` to refresh the snapshot after intentional config edits. Any change to tsconfig or Vitest config must update the snapshot intentionally.

## Shared Mock Baseline
- Global mocks now live under `backend/src/test-utils` and are wired in via `backend/src/test-setup.ts`.
- `createSupabaseAdminMock` / `createConfigServiceMock` expose `mockSupabaseAdmin` and `mockConfigService` on `globalThis` for test-specific overrides—reuse them instead of redefining local stubs.

## Communication
- Note the failing suite(s) in the PR title (e.g. `Test Fix: profile service (Phase 0)`).
- When pairing with an LLM, feed it this guard rail doc first to keep it from editing runtime code.
