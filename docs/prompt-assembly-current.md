# Prompt Assembly and AI Response Processing (Current)

Last updated: 2025-11-06

This document explains exactly how prompts are assembled and how AI responses are processed in the current codebase. There are two active pathways:

- AWF Orchestrator path (JSON bundle → strict model output → validators → acts applied)
- V3 Entry-Point Assembler path (sectioned text prompt → OpenAI → JSON parse/repair → normalization)

Use `PROMPT_BUILDER` env var to select at turn time: `AWF` or `V3`. See `backend/src/services/turns.service.ts:254`.

## Overview

- Turn execution entry: `backend/src/services/turns.service.ts`
  - AWF path: `runAwfTurn()` → returns `{ txt, choices, meta: { scn } }` (AWF v2)
  - V3 path: `EntryPointAssemblerV3` builds sectioned prompt (AWF v1), `OpenAIService` calls, then JSON parsing/repair
- Initial prompt (game spawn): also V3-based (AWF v1) with similar wrapping/parsing logic


## AWF Orchestrator Path

Files of record:
- `backend/src/orchestrators/awf-turn-orchestrator.ts`
- `backend/src/assemblers/awf-bundle-assembler.ts`
- `backend/src/assemblers/awf-bundle-assembler-cached.ts`
- `backend/src/model/awf-model-provider.ts`
- `backend/src/model/system-prompts.ts`
- `backend/src/validators/awf-output-validator.ts`
- `backend/src/interpreters/apply-acts.ts`
- `backend/src/assemblers/injection-map-executor.ts`
- `backend/src/config/awf-budgets.ts`

### 1) Bundle Assembly

- Entry: `assembleBundle({ sessionId, inputText })` builds `awf_bundle` object with:
  - `meta`: engine version, world/adventure refs, turn id, locale, timestamps, and LiveOps levers (`token_budget`, `tool_quota`).
  - `contract`: active core contract (`core_contracts`).
  - `core.ruleset`: resolved by ruleset ref from game state (`rulesets`).
  - `world`: compacted world doc (locale-aware) + token discipline.
  - `adventure`: compacted adventure doc + token discipline.
  - `scenario`: optional, loaded if `scenario_ref` is set.
  - `npcs.active`: compact NPCs collected from game/adventure/ruleset via `collectNpcRefs()` and `compactNpcDoc()`.
  - `player`: loaded from characters.
  - `game_state`: hot/warm/cold snapshot from game state.
  - `rng`: deterministic seed from `sessionId` + `turn_count`.
  - `input`: `{ text, timestamp }`.

- Injection map: If present, rules (JSON pointers) are executed against the bundle to inject/transform fields. See `backend/src/assemblers/injection-map-executor.ts`.

- Validation and metrics:
  - Structural validation: `validateBundleStructure()`.
  - Metrics: byte size, estimated tokens, npc count, slice count via `calculateBundleMetrics()`.
  - Optional cached variant `assembleBundleCached()` adds slice caching, inline summaries, and input token budget enforcement via `awfBudgetEnforcer`.

### 2) Model Call

- Provider: `OpenAIModelProvider` in `backend/src/model/awf-model-provider.ts`.
- System prompt: `SYSTEM_AWF_RUNTIME` or `SYSTEM_AWF_RUNTIME_WITH_TOOLS` in `backend/src/model/system-prompts.ts`.
- Request shape:
  - `messages`: `[ { role: 'system', content }, { role: 'user', content: minified awf_bundle JSON } ]`
  - `response_format: { type: 'json_object' }` to bias JSON responses.
  - Tool-enabled variant supports a single function tool `GetLoreSlice` with a second pass including tool results.

### 3) Output Validation and Retry

- Parse JSON: provider returns `raw` and parsed `json`.
- Extract AWF object: `extractAwfFromOutput()` ensures top-level `AWF` object or a direct AWF-like object with `scn` and `txt`.
- Validate: `validateAwfOutput()` checks structure and constraints (required fields, max choices 5, max acts 8, etc.).
- On failure: Retry with a “repair hint” injected into the system prompt via `createSystemPromptWithRepairHint()`.

### 4) Apply Acts and Return Result

- Apply `awf.acts` to session/game state in a DB transaction: `backend/src/interpreters/awf-act-interpreter.ts` (uses injection map `acts` rules, updates session turn, trims/advances time, flags, resources, objectives, relations, etc.).
- Return legacy-compatible result:
  - `{ txt: awf.txt, choices: [{ id, label }], meta: { scn: awf.scn } }`.
- Metrics/logging: model latency, tool calls, validator retries, assembly build time, etc.

### 5) Integration in Turn Flow

- In `backend/src/services/turns.service.ts:264` when `PROMPT_BUILDER === 'AWF'`: calls `runAwfTurn()` and maps the result to the unified flow (including structured logs and prompt preview placeholders).


## V3 Entry-Point Assembler Path

Files of record:
- `backend/src/prompts/entry-point-assembler-v3.ts`
- `backend/src/services/openai.service.ts`
- `backend/src/services/turns.service.ts`
- `backend/src/prompts/wrapper.ts` (used by other services, not by EntryPointAssemblerV3)

### 1) Prompt Assembly

- Entry: `EntryPointAssemblerV3.assemble({ entryPointId, entryStartSlug?, stateSnapshot?, conversationWindow?, userIntentText? })`.
- Fetches:
  - `entry_points`, `worlds`, `rulesets`, optional NPCs via `entry_point_npcs` bindings and `npcs`.
- Builds ordered pieces with token estimates:
  - Core preamble (`CORE_PROMPT`) describing AWF v1 output contract (scn/txt/choices/acts/val).
  - Ruleset prompt (extracted from ruleset doc fields).
  - World prompt (extracted from world doc fields).
  - Entry prompt (from entry point doc and `entryStartSlug`).
  - NPC prompts (ordered by binding `sort_order`, then `npc_slug`).
- Budget policy: calculates rough token counts and drops lower-priority pieces (typically NPCs) if above budget. Returns `pieces`, `prompt`, and `meta` with selection context and policy list.

- The final prompt is a single text block composed by concatenating the segments in order.

### 2) Model Call and Parse/Repair

- `OpenAIService.generateBufferedResponse(prompt)` calls Chat Completions on `gpt-4o-mini`.
- Response parsing: `OpenAIService.parseAIResponse()` attempts JSON parse, strips ```json code fences, or extracts the first JSON object if mixed content.
- If parsing fails: `OpenAIService.repairJSONResponse()` asks the model to emit valid JSON only (adds a system preamble), then re-parses.

### 3) Post-processing and Normalization

- The parsed object is expected to be AWF v1-like: `{ scn, txt, choices?, acts?, val? }`.
- For persistence: `gamesService.applyTurn()` is called with a `TurnResponse`-like structure.
- Normalization: `aiToTurnDTO()` in `backend/src/ai/ai-adapter.ts` converts raw AI JSON into `TurnDTO`:
  - Narrative: prefers `txt` → `narrative` → `scene.txt`; falls back to a safe default if empty.
  - Choices: accepts arrays of objects or strings; normalizes to `{ id, label }[]` and requires at least one.
  - Emotion: default `neutral`.
  - Actions: maps `acts` if provided.
  - Validates with `@shared/types/dto.ts` Zod schema; throws `AiNormalizationError` on failure (caught and reported at `backend/src/services/turns.service.ts:619`).

- Structured logs: prompt/response previews, timing, and metrics are emitted.

### 4) Initial Prompt (Game Spawn)

- Game creation uses V3 assembler semantics as well. See `backend/src/services/games.service.ts` and `backend/src/services/turns.service.ts:1004-1149` for initial prompt creation and storage of metadata.


## Selection and Feature Flags

- Turn-time pathway is selected by env var `PROMPT_BUILDER` in `runBufferedTurn()`:
  - `AWF` → `runAwfTurn()` orchestrator path.
  - `V3` (default) → Entry-Point Assembler + OpenAIService path.
- AWF feature flagging used elsewhere (e.g., initial prompt logging path) through `isAwfBundleEnabled()`.


## Token Budgeting

- AWF path: precise bundle-level token estimation via JSON minification and helper heuristics; enforced reductions include trimming NPCs, removing inline slice summaries, trimming episodic memory, and final content trimming. See `backend/src/config/awf-budgets.ts`.
- V3 path: rough “chars/4” estimation per piece, with simple drop policy (mostly NPCs) when over budget.


## Summary of Responsibilities

- Orchestrator (AWF): assembly, strict system prompt, tool calls, validation with repair, act application, return minimal `{ txt, choices, meta }`.
- Assembler (V3): sectioned text prompt, model call with best-effort JSON parsing/repair, then persistence and TurnDTO normalization.
- Shared normalization: `aiToTurnDTO()` ensures the final DTO is consistent across both paths.

