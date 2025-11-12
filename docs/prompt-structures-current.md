# Prompt Structures (Current)

This document catalogs every model-facing prompt structure that exists in the Stone Caster runtime as of 2025-11-06. Each section references the authoritative validation source so you can trace the contract that is enforced in code. Use it together with `docs/prompt-assembly-current.md` (pipeline/flow) and `docs/prompt-assembly-improvements.md` (roadmap) when auditing or extending prompts.

## 1. Execution Paths

- **Turn-time selection** - `PROMPT_BUILDER` env chooses between the AWF Orchestrator (`runAwfTurn`) and the V3 Entry-Point Assembler (`EntryPointAssemblerV3`). See `backend/src/services/turns.service.ts` and `docs/prompt-assembly-current.md`.
- **Initial prompt** - game spawn currently reuses the V3 assembler wrap (AWF v1 contract) with the same parsing/normalization pipeline.

## 2. Model Input Structures (Validated)

### 2.1 AWF Bundle (JSON fed to the strict AWF system prompt)
Source: `backend/src/validators/awf-bundle-validators.ts`

| Section | Key fields and constraints |
| --- | --- |
| `awf_bundle.meta` | `engine_version`, `world`, `adventure`, `turn_id` (positive int), `is_first_turn` (boolean), optional `locale`, `timestamp`. Optional LiveOps levers: `token_budget.input_max`, `token_budget.output_max`, `tool_quota.max_calls`. |
| `awf_bundle.contract` | `id`, `version`, `hash`, `doc` (arbitrary record). Captures the active core contract reference. |
| `awf_bundle.core` | Embeds `ruleset: CoreRulesetV1Schema` and `contract.acts_catalog` (array of `{ type, mode, target }`). |
| `awf_bundle.world` | `ref`, `hash`, `slice` (>=1 string) with optional `doc`. |
| `awf_bundle.adventure` | `ref`, `hash`, `slice` (>=1 string). Optional `start_hint.scene`/`description`/`initial_state`. |
| `awf_bundle.npcs` | `active`: up to 5 compact NPCs (`id`, `name`, `description`, `role`, optional `location`/`metadata`); `count` must match `active.length`. |
| `awf_bundle.player` | `id`, `name`, plus `traits`, `skills`, `inventory`, optional `metadata`. |
| `awf_bundle.game_state` | `hot` (record), `warm.episodic`, `warm.pins`, `cold` (record). |
| `awf_bundle.rng` | `seed` and `policy` strings. |
| `awf_bundle.input` | `{ text, timestamp }` both strings. |

Supporting schemas in the same file:
- `AwfBundleParamsSchema`: `{ sessionId, inputText }` - requirements on assembler inputs.
- `SceneSlicePolicySchema` and `DefaultSliceConfigSchema`: define required slice arrays per namespace.
- `AwfBundleMetricsSchema`: `byteSize`, `estimatedTokens`, `npcCount`, `sliceCount`, `buildTime`.
- `AwfBundleValidationErrorSchema`: `{ field, message, expected?, actual? }` used for diagnostics.

### 2.2 Core Contract (what the system prompt promises)
Source: `backend/src/validators/awf-core-contract.schema.ts`

- `contract`: requires `name`, `awf_return`, and `keys.required` (non-empty). Optional `keys.optional`, `language.one_language_only`, `acts.policy`, `time` (first-turn policy, `ticks_min_step`), `menus` (min/max/label length), `validation.policy`.
- `core`: `acts_catalog` (non-empty), `scales` for `skill` and `relationship` (min/baseline/max), optional `budgets.input_max_tokens` and `budgets.output_max_tokens`.

### 2.3 Core Ruleset (narrative discipline)
Source: `backend/src/validators/awf-ruleset.schema.ts`

- Required keys: `ruleset.name`, `ruleset['scn.phases']` (>=1 string), `ruleset['txt.policy']`, `ruleset['choices.policy']`, and `ruleset.defaults` with `txt_sentences_min`/`txt_sentences_max`.
- Optional: `language.one_language_only`, `language.use_meta_locale`, `token_discipline` (various caps), `time` bands/ticks per band, `menus` (min/max choices, label cap), `mechanics_visibility.no_mechanics_in_txt`, `safety` toggles, `defaults.time_ticks_min_step`, `defaults.cooldowns`.

### 2.4 Domain Documents Feeding the Bundle

| Schema | Source | Highlights |
| --- | --- | --- |
| `WorldDocV1Schema` | `backend/src/validators/awf-world.schema.ts` | `id`, `name`, `version`, optional `timeworld` (`timezone`, `calendar`, optional `seasons`), optional `slices`, per-locale `i18n`. `.passthrough()` allows additional world-specific keys. |
| `AdventureDocV1Schema` | `backend/src/validators/awf-adventure.schema.ts` | `id`, `name`, `version`, `world_ref`, optional `synopsis`, `cast` (NPC refs), `slices`, localized `i18n`. `.passthrough()` for authoring extras. |
| `ScenarioDocV1Schema` | `backend/src/validators/awf-scenario.schema.ts` | `world_ref`, optional `adventure_ref`, `scenario.start_scene`, optional fixed NPCs, party, inventory/resources/flags/objectives, tags, slices, `i18n`. |
| `NPCDocV1Schema` | `backend/src/validators/awf-npc.schema.ts` | `npc.display_name`, `summary`, optional `archetype`, `tags`, bounded trait/skill scales (0-100), stylistic hints, world/adventure links, slices, localized overrides. |
| `AdventureDocSchema` / `AdventureStartDocSchema` | `backend/src/validators/awf-validators.ts` | Flexible versions of adventure data plus `start.scene`, `rules.no_time_advance`, allowing arbitrary extra fields for experimentation. |

### 2.5 Injection Maps
Sources: `backend/src/validators/awf-injection-map.schema.ts` and `backend/src/validators/awf-validators.ts`

- `InjectionRuleV1Schema`: `{ from, to (absolute JSON Pointer), optional skipIfEmpty, fallback.ifMissing, limit { units: 'tokens'|'count', max } }`.
- `InjectionMapDocV1Schema`: requires `rules` array; optional `notes`.
- `InjectionMapDocSchema` (legacy) keeps `{ build: record<JSON pointer>, acts: record<JSON pointer> }` for DB persistence.
- Dry-run/diff request shapes ensure both left/right handles map refs or raw docs consistently.

### 2.6 Prompt Template Metadata (DB-only assembler)
Source: `backend/src/prompts/schemas.ts`

- `PromptTemplateMetaSchema`: template `id`, `scope` enum (`core|world|adventure|scenario|quest|enhancement`), `version`, `hash`, `variables`, `segments`, `loadOrder`, optional dependencies/world specificity and `required` flag.
- `PromptContextSchema`: canonical context passed into template interpolation (character/game/world/adventure/runtime/system objects with typed subfields). Serves both the legacy DatabasePromptAssembler and the `PromptWrapper`.
- `PromptAuditEntrySchema`: records template ids, version, hash, context summary, optional token count, timestamp.
- `PromptAssemblyResultSchema`: wraps the final string plus audit + metadata summary.
- `WorldPromptConfigSchema`: describes per-world load orders (`requiredSegments`, `optionalSegments`, `worldSpecificSegments`, etc.).

### 2.7 Prompt Variable Allowlist
Source: `backend/src/prompts/variables.ts`

- `PROMPT_VARIABLES` enumerates every path exposed to templating (character/game/world/adventure/runtime/system).  
- `ALLOWLISTED_VARIABLES` enforces those paths; `validateTemplateVariables` and helper utilities ensure no stray `{{ }}` references leak into model prompts.

## 3. Prompt Composition Surfaces

### 3.1 AWF Prompt Wrapper
Source: `backend/src/prompts/wrapper.ts`

- **System preamble**: strict instruction string forcing JSON AWF output with `scn`, `txt`, optional `choices/acts/val`, RNG handling, tick policy, skill/relationship scale, ambient/NPC beat caps, time bands.
- **Section order**: `SYSTEM`, `CORE`, `WORLD`, `ADVENTURE`, optional `GAME_STATE` (only first turn when not starting a new adventure), `PLAYER`, `RNG`, `INPUT`. Each section is produced via `=== NAME_BEGIN ===` delimiters and JSON-minified payloads.
- **Runtime inputs**: `GameStateData` bundle (time band+ticks, RNG policy/d20/d100, player input, first-turn flags). Includes validators for RNG presence, band naming, and player input formatting.

### 3.2 Entry-Point Assembler V3
Source: `backend/src/prompts/entry-point-assembler-v3.ts`

- **Scopes/pieces**: ordered `core` (fixed `CORE_PROMPT` describing AWF v1 JSON), `ruleset`, `world`, `entry`, and zero or more `npc` segments loaded from Supabase tables. Scope priority and policies defined in `backend/src/prompts/assembler-types.ts`.
- **Budget policy**: target token budget (env overrides) with warn threshold (`PROMPT_BUDGET_WARN_PCT`). If over budget, only NPC pieces are dropped from the end; policy array captures `NPC_DROPPED` etc.
- **Ongoing-turn context**: optional `stateSnapshot` (flags, ledgers, metadata, compacted character/adventure), recent `conversationWindow` (player choice + AI story per turn), and latest `userIntentText` appended under `# Current Game State`.
- **Structured output**: returns `{ prompt, pieces, meta { included, dropped, policy, tokenEst, npcTrimmedCount, selectionContext } }` for observability.

### 3.3 Database Prompt Inventory (legacy templates still enforced)
Source: `backend/src/prompts/README.md` and `backend/src/prompts/inventory.md`

- Defines a strict load order spanning Foundation -> Core Systems -> Engine -> AI Behavior -> Data Management -> Performance -> Content -> Enhancements.
- Each world has a manifest enumerating required segments (e.g., `world-codex.{world}-lore.md`, `systems.unified.json`, `engine.system.json`, `adventure.{world}.json`, etc.) with load-order validation and audit trails.
- Guards in `backend/src/prompts/runtime-guards.ts` ensure DB-only mode and prevent reintroducing file-based loaders.

## 4. Model Output Structures (Validated)

### 4.1 AWF Runtime Output
Source: `backend/src/validators/awf-output-validator.ts`

- **Required**: `scn` (string) and `txt` (string).
- **Optional arrays**:
  - `choices`: array length <= 5, each element must be an object with string `id` and `label`.
  - `acts`: array length <= 8, each element must be an object with string `type` and object `data`.
- **Optional scalar**: `val` if present must be a string (used for validator annotations).
- **No extra keys**: only `scn`, `txt`, `choices`, `acts`, `val` are allowed.
- **Locale guardrails**: optional `LocaleValidationOptions` enforce max choice label length per locale and single-language text (simple heuristic) when not `en-US`.
- **Helpers**: `hasCorrectTopLevelStructure` expects a top-level `{ AWF: { ... } }` shape; `extractAwfFromOutput` unwraps nested or direct AWF objects; `generateRepairHint` summarizes missing/invalid fields for retry prompts.

## 5. Auditing and Observability Structures

- `PromptAuditEntrySchema` / `PromptAssemblyResultSchema` (Section 2.6) - track template composition per prompt.
- `AwfBundleMetricsSchema` (Section 2.1) - captures byte size, estimated tokens, NPC counts, build times.
- `EntryPointAssemblerV3Output.meta` (Section 3.2) - unified telemetry for V3 prompts.
- `AwfValidationError` / `AwfValidationResult` interfaces (Section 4.1) - standardize validator output with `repairHint`.

---

**How to use this document**
1. Identify the prompt pathway (AWF vs V3) for the turn you care about.
2. Locate the relevant structure(s) above (bundle inputs, template context, or output).
3. Follow the "Source" link to the schema/validator before making contract changes.
4. Update both this document and the associated schema if you add or remove fields so downstream teams stay aligned.
