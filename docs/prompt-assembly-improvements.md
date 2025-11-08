# Prompt Assembly: Low-Change Improvements

Last updated: 2025-11-06

This document proposes incremental improvements to the current prompt assembly and AI response processing without large architectural shifts.

## Goals

- Increase correctness and robustness of outputs
- Reduce regressions and maintenance overhead
- Improve cost control and observability
- Keep the current dual-path (AWF and V3) working while harmonizing behavior

## Quick Wins (High Impact, Low Risk)

1) Unify Validation Across Paths
- Apply `validateAwfOutput()` (backend/src/validators/awf-output-validator.ts) to V3 responses after parse/repair.
- On failure, retry once with a repair hint using a system preamble (mirroring AWF path) before persisting/normalizing.
- Benefit: consistent guardrails, fewer malformed turns, shared error taxonomy.

2) Standardize System Instructions
- Reuse `SYSTEM_AWF_RUNTIME` text for V3 assembler prompts (prepend to the assembled prompt) to match output contract expectations.
- Benefit: reduces drift between AWF and V3 output shapes; improves parser reliability.

3) JSON Output Biasing on V3
- Use `response_format: { type: 'json_object' }` on V3 `OpenAIService` calls, matching AWF provider.
- Benefit: fewer code-fenced markdown and mixed content cases → less reparsing.

4) Better Token Estimation
- Replace “chars/4” with a real tokenizer for both paths (e.g., `@dqbd/tiktoken` or OpenAI token utilities when available).
- Benefit: tighter budgeting; fewer surprise overruns and last-minute trims.

5) Normalization Consistency
- Ensure all code paths use `aiToTurnDTO()` before returning to routes. V3 already does post-persist; confirm initial prompt and any side paths do the same.
- Benefit: single source of truth for user-facing schema.

6) Structured Logs Harmonization
- Mirror AWF structured logs (bundle tokens, validator retries, reductions) on the V3 side with analogous fields (piece counts, drop policy, repair attempts).
- Benefit: unified dashboards and easier comparisons.

## Short Iterations (Contained Changes)

7) V3 Validation + Repair Hint Loop
- Where V3 currently does `parseAIResponse()` and `repairJSONResponse()`, insert validator step and feed a concise repair hint, similar to AWF `createSystemPromptWithRepairHint()`.
- Implementation: small extension in `backend/src/services/turns.service.ts` after parse and before persist.

8) Tool Usage Parity (Optional)
- Add a thin tool-call capability to V3 path for lore slices (same `GetLoreSlice` function schema).
- Start with disabled-by-default flag; enable for large worlds/adventures to reduce prompt size.

9) Prompt Wrapper Alignment
- If `backend/src/prompts/wrapper.ts` is used in any flows, ensure its SYSTEM preamble and sectioning are consistent with EntryPointAssemblerV3’s `CORE_PROMPT` (format, delimiters, AWF key names).
- Optionally refactor wrapper preamble to import from `system-prompts.ts`.

10) Budget Policy Transparency
- Return an explicit `policy` array on AWF path similar to V3 (list reductions applied); V3 already lists drops; AWF records reductions internally—surface them uniformly in debug payloads.

11) Turn ID and Metrics Accuracy (AWF)
- Replace the placeholder `turnId: 0` in AWF result logs with actual DB turn id after `applyActs()` or when response is persisted by the caller.
- Add explicit `awf_version` field into `meta` for easier change management.

## Medium-Scope Cleanups (Still Small Changes)

12) Single JSON Schema for AWF
- Define and reuse a JSON schema (e.g., Zod or JSON Schema) for `AWF` output in both paths and pipe it into model prompts via structured outputs when feasible.
- For OpenAI, prefer the Responses API or function/tool JSON schema once available in the environment.

13) Injection Map: Soft Limits
- Expand injection map to support additional `limit` strategies (e.g., per-field token caps before the final trim), especially for verbose world/adventure sections.
- Log applied limits and expose them in debug payloads for visibility.

14) Replayable Prompt Traces
- Ensure both paths write trace records with the exact system + user content sent to the model (already present for V3); for AWF, include the minified bundle string used.
- Redact sensitive data consistently.

15) Unit Tests for Normalization
- Add focused tests for `aiToTurnDTO()` covering:
  - Empty narrative fallback
  - Various choice encodings (objects, strings, missing ids)
  - AWF v1 vs v2 shapes
  - Schema validation error propagation

## Longer-Term (Still No Big Swings)

16) Converge on AWF Path as Default
- Once validated, make `PROMPT_BUILDER=AWF` the default for turns; keep V3 as fallback behind a feature flag.
- Benefit: single mental model (bundle + contract + validator + acts) and easier evolution of the runtime.

17) Gradual Deletion of Legacy/Redundant Paths
- Retire unused or duplicate prompt builders/wrappers as coverage and confidence increase.
- Keep the entry-point authoring flow; ensure it feeds into bundle creation where possible.

## Optional Config Flags

- `V3_RESPONSE_JSON_ONLY=true` → enable `response_format: json_object` for V3.
- `V3_VALIDATION_REPAIR=true` → enable validator + repair hint loop.
- `V3_TOOLS_GET_LORE=false` → gated tool availability for V3.
- `USE_TIKTOKEN=true` → switch token counting to real tokenizer when installed.

## Acceptance Criteria to Track

- Reduction in malformed response incidents (parse/repair failures)
- Stable or reduced average and p95 input tokens post-budget changes
- Consistent TurnDTO schema validation pass rate across both paths
- Improved observability: same core fields present in both AWF and V3 logs

## Rollout Plan

1. Land validation + repair hint for V3 behind a flag, ship to staging.
2. Swap token estimation to tokenizer in staging; monitor budgets and trims.
3. Enable `json_object` response formatting for V3; verify lower parse repairs.
4. Introduce AWF tool parity flag; test on a large world.
5. If stable for a week, set `PROMPT_BUILDER=AWF` as the default for turns.

