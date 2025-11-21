# Chimera System Alignment Plan

This plan updates the Stone Caster system to fully align with the Chimera System Design specifications in `/docs/planning`. The system currently has partial Chimera infrastructure but needs updates to match the definitive architecture.

## Current State Analysis

**Existing Infrastructure:**

- `chimera_ruleset_templates` table exists but uses `RulesetDefinitionV1` structure (different from planning docs)
- `chimera_worlds` table exists with `character_schema_contributions` but missing `images` and `lore_fragments`
- `chimera_game_states` table exists but uses different tier structure
- Compiler service exists (`rebuild-service.ts`) but may not follow exact 4-step process
- Play engine exists with MAS 1/2 but DTOs may not match planning docs
- Character creation uses legacy race/class system, not 3-layer architecture

**Key Gaps:**

1. Ruleset structure doesn't match planning docs (missing `ui_category`, `state_contributions`, `actions`, etc.)
2. World table missing `images` (ChimeraAssetRef[]) and `lore_fragments`
3. Game state structure doesn't match `tier1_mechanical`/`tier0_narrative` from planning docs
4. No `base_character.json` system asset
5. Character creation doesn't use 3-layer architecture
6. Missing `ChimeraAssetRef` type and visual asset support
7. Compiler may not follow exact 4-step process
8. Runtime DTOs may not match planning docs exactly

## Phase 1: Foundation - Data Contracts & Types

**Goal:** Establish the correct TypeScript interfaces and database schemas matching the planning documents.

### 1.1 Update Shared Types

- **File:** `shared/src/types/chimera-rulesets.ts`
- Replace `RulesetDefinitionV1` with `RulesetDefinition` matching planning docs
- Add: `ui_category`, `exclusion_group`, `dependencies`, `provides_tags`, `state_contributions`, `actions`, `ai_instructions`
- Keep backward compatibility layer if needed

- **File:** `shared/src/types/chimera-worlds.ts` (create if missing)
- Add `WorldDefinition` interface matching planning docs
- Include `images: ChimeraAssetRef[]`, `lore_fragments` array
- Ensure `character_schema_extensions` matches planning docs structure

- **File:** `shared/src/types/chimera-assets.ts` (create)
- Add `ChimeraAssetRef` interface: `{ id, url, role, label? }`
- Add to shared exports

- **File:** `shared/src/types/chimera-compiled.ts` (create)
- Add `CompiledStory` interface matching planning docs
- Add `GameState` interface with `tier1_mechanical` and `tier0_narrative` structure
- Add runtime DTOs: `Mas1ResponseDto`, `EngineResultDto`, `Mas2ResponseDto`

### 1.2 Database Schema Updates

- **Migration:** `db/migrations/YYYYMMDDHHMMSS_update_chimera_worlds_for_planning_docs.sql`
- Add `images jsonb` column to `chimera_worlds` (array of ChimeraAssetRef)
- Add `lore_fragments jsonb` column to `chimera_worlds` (array structure from planning docs)
- Add GIN index on `images` for queries

- **Migration:** `db/migrations/YYYYMMDDHHMMSS_update_ruleset_templates_for_planning_docs.sql`
- Add `ui_category text` column (foundation/expansion/flavor)
- Add `icon_url text` column
- Update `definition` jsonb structure to match new `RulesetDefinition` (migration script to transform existing data)
- Ensure `exclusion_group` and `dependencies` are properly indexed

- **Migration:** `db/migrations/YYYYMMDDHHMMSS_update_game_states_tier_structure.sql`
- Update `current_game_state` structure documentation/comments
- Add validation function to ensure tier structure matches planning docs
- Consider adding check constraint or trigger for structure validation

### 1.3 Base Character System Asset

- **File:** `content/system/base_character.json` (create)
- Copy structure from `docs/planning/base_character.json`
- Add to content/modules or system assets location
- Create API endpoint or service to load this asset

- **File:** `backend/src/services/base-character.service.ts` (create)
- Service to load and validate `base_character.json`
- Method to merge base character with world extensions and ruleset mechanics

## Phase 2: Ruleset System Alignment

**Goal:** Update ruleset structure and validation to match planning docs Hub & Spoke model.

### 2.1 Ruleset Definition Migration

- **File:** `backend/src/services/chimera/ruleset-migration.service.ts` (create)
- Service to migrate existing `RulesetDefinitionV1` to new `RulesetDefinition`
- Transform `ui_schema`, `action_prompt_rules`, `narrative_prompt_rules` into new structure
- Map old `rule_type` to new `ui_category` (MAIN_SYSTEM → foundation, SUBSYSTEM → expansion, MODIFIER → flavor)

- **File:** `backend/src/services/chimera/ruleset-validation.service.ts` (create or update)
- Validate exclusion groups (only one per group allowed)
- Validate dependencies (all dependencies must exist)
- Validate `state_contributions` structure
- Validate `actions` structure

### 2.2 Ruleset CRUD Updates

- **File:** `backend/src/routes/chimera-admin-rulesets.ts`
- Update POST/PUT handlers to accept new `RulesetDefinition` structure
- Add validation for `ui_category`, `exclusion_group`, `dependencies`
- Update Zod schemas in `shared/src/types`

- **File:** `frontend/src/pages/admin/chimera/rulesets/Editor.tsx`
- Update form to include `ui_category` dropdown
- Add `icon_url` field
- Update form sections for `state_contributions`, `actions`, `ai_instructions`
- Add dependency selector UI

### 2.3 Standard Library Rulesets

- **File:** `backend/scripts/seed-standard-rulesets.ts` (create)
- Seed rulesets from `docs/planning/chimera-full-schemas.json`
- Implement: `rs_d100_core`, `rs_d20_core`, `rs_time_simple`, `rs_health_simple`, `rs_survival_basic`, etc.
- Ensure all match planning docs structure exactly

## Phase 3: World System Alignment

**Goal:** Update world structure to match planning docs with images and lore_fragments.

### 3.1 World Schema Updates

- **File:** `backend/src/routes/chimera-worlds.ts`
- Update POST/PUT handlers to accept `images` array and `lore_fragments` array
- Add validation for `ChimeraAssetRef[]` structure
- Update Zod schemas

- **File:** `frontend/src/pages/dashboard/worlds/Editor.tsx`
- Add image upload/selector UI component
- Add lore fragments editor (array of { id, triggers, content, metadata })
- Update form to match new structure

### 3.2 Visual Asset Support

- **File:** `backend/src/services/chimera/asset.service.ts` (create)
- Service to handle Cloudflare asset uploads
- Generate `ChimeraAssetRef` objects
- Validate asset types and roles

- **File:** `frontend/src/components/chimera/AssetSelector.tsx` (create or update)
- Component for selecting/uploading visual assets
- Support for icon, banner, portrait, gallery roles
- Preview and management UI

## Phase 4: Character Architecture - 3-Layer System

**Goal:** Implement the layered character architecture from planning docs.

### 4.1 Character Creation Service

- **File:** `backend/src/services/chimera/character-layers.service.ts` (create)
- `loadBaseCharacter()`: Load from `base_character.json`
- `injectWorldExtensions(worldId, baseChar)`: Merge Layer 2
- `aggregateRulesetMechanics(activeRulesets, char)`: Merge Layer 3
- `buildLayeredCharacter(worldId, activeRulesets, userInput)`: Orchestrate all 3 layers

### 4.2 Character Creation API

- **File:** `backend/src/routes/chimera-characters.ts` (create or update)
- POST endpoint that uses layered architecture
- Accept: worldId, activeRulesetIds, user input (name, pronouns, role, etc.)
- Return: Complete character with all 3 layers merged

### 4.3 Character Creation UI

- **File:** `frontend/src/pages/play/CharacterCreationPage.tsx` (major update)
- Replace race/class system with base character form (name, pronouns, role, age)
- Add narrative profile section (appearance, backstory, personality_traits, drive, flaw)
- Dynamically render world-specific fields from `character_schema_extensions`
- Show ruleset-derived mechanical fields (read-only, calculated)
- Use stepper component for multi-step flow
- Mobile-first design (375×812)

### 4.4 Character Schema Types

- **File:** `shared/src/types/chimera-characters.ts` (create)
- `BaseCharacter` type (Layer 1)
- `WorldExtendedCharacter` type (Layer 1 + 2)
- `LayeredCharacter` type (Layer 1 + 2 + 3)
- Zod schemas for validation

## Phase 5: Compiler Alignment

**Goal:** Ensure compiler follows exact 4-step process from planning docs.

### 5.1 Compiler Service Update

- **File:** `backend/src/services/chimera/rebuild-service.ts`
- **Step 1:** Base Load & Injection
- Load `base_character.json`
- Inject world `character_schema_extensions` into character template
- **Step 2:** Dependency Resolution
- Exclusion check (only one per exclusion_group)
- Dependency check (all dependencies must exist)
- Tag aggregation (collect `provides_tags`)
- **Step 3:** Master Allowlist Generation
- Merge `state_contributions.tier1_entity` → `tier1_allowlist`
- Merge `state_contributions.tier1_global` → `tier1_allowlist`
- Merge narrative keys → `tier0_allowlist`
- Merge actions → `actions_map`
- **Step 4:** Entity Processing
- Filter entity `raw_data` keys through allowlists
- Move to `tier1_mechanical_state` or `tier0_narrative_context`
- Discard keys not in either allowlist

### 5.2 Compiled Story Structure

- **File:** `backend/src/services/chimera/compiled-story-builder.ts` (create or update)
- Build `CompiledStory` matching planning docs exactly
- Structure: `meta`, `master_schema`, `narrative_context_index`, `initial_state`
- Ensure `master_schema` has `tier1_allowlist`, `tier0_allowlist`, `actions_map`, `prompt_instructions`

### 5.3 Compiler Tests

- **File:** `backend/tests/chimera/compiler-4-step.test.ts` (create)
- Test Step 1: Base load and injection
- Test Step 2: Dependency resolution (exclusion conflicts, missing dependencies)
- Test Step 3: Allowlist generation
- Test Step 4: Entity filtering

## Phase 6: Runtime Loop Alignment

**Goal:** Ensure runtime loop DTOs and flow match planning docs exactly.

### 6.1 Runtime DTOs

- **File:** `shared/src/types/chimera-runtime.ts` (create)
- `Mas1ResponseDto`: `resolved_query`, `sentiment`, `action_dto`
- `EngineResultDto`: `success`, `numeric_deltas`, `outcome_summary`
- `Mas2ResponseDto`: `ripple_narrative`, `mutations`
- Zod schemas for all DTOs

### 6.2 Game State Structure

- **File:** `backend/src/services/play/state-factory.ts` (update)
- Update `GameState` to use `tier1_mechanical` and `tier0_narrative` structure
- `tier1_mechanical`: `{ global: {}, entities: {} }`
- `tier0_narrative`: `{ memory_stream: [], entities: {} }`
- Ensure structure matches planning docs exactly

### 6.3 Play Engine Updates

- **File:** `backend/src/routes/chimera-play.ts`
- Ensure MAS 1 returns `Mas1ResponseDto` matching planning docs
- Ensure Engine returns `EngineResultDto` matching planning docs
- Ensure MAS 2 returns `Mas2ResponseDto` matching planning docs
- Update mutation application to respect tier structure

### 6.4 Action Resolver Updates

- **File:** `backend/src/services/play/action-resolver.ts` (create or update)
- Use `actions` from compiled story `master_schema.actions_map`
- Execute deterministic logic from ruleset `actions` definitions
- Return `EngineResultDto` with `numeric_deltas` and `outcome_summary`

## Phase 7: Testing & Documentation

**Goal:** Ensure all changes are tested and documented.

### 7.1 Unit Tests

- Update existing tests to use new types
- Add tests for character layer merging
- Add tests for compiler 4-step process
- Add tests for runtime DTOs

### 7.2 E2E Tests

- **File:** `frontend/e2e/character-creation-layered.spec.ts` (create)
- Test character creation with 3-layer architecture
- Test world-specific field injection
- Test ruleset mechanics aggregation

- **File:** `frontend/e2e/compiler-workflow.spec.ts` (create)
- Test story compilation with dependency resolution
- Test exclusion group conflicts
- Test entity filtering

### 7.3 Documentation Updates

- **File:** `docs/FEATURES.md`
- Document 3-layer character architecture
- Document ruleset Hub & Spoke model
- Document compiler 4-step process

- **File:** `docs/API_CONTRACT.md`
- Update character creation endpoint
- Update ruleset CRUD endpoints
- Update world CRUD endpoints
- Document runtime loop DTOs

- **File:** `docs/UX_FLOW.md`
- Update character creation flow
- Document Casting Circle metaphor (World Stone, Forces Stone, Elements Stone, Lore Stone)

- **File:** `docs/TEST_PLAN.md`
- Add test cases for layered character creation
- Add test cases for compiler validation
- Add test cases for runtime loop

## Phase 8: Migration & Backward Compatibility

**Goal:** Migrate existing data and ensure backward compatibility where possible.

### 8.1 Data Migration Scripts

- **File:** `backend/scripts/migrate-rulesets-to-new-structure.ts`
- Migrate existing rulesets to new `RulesetDefinition` structure
- Preserve data where possible
- Log migration results

- **File:** `backend/scripts/migrate-game-states-to-tier-structure.ts`
- Migrate existing game states to new tier structure
- Map old state keys to new tier structure
- Validate migrated data

### 8.2 Backward Compatibility

- Add compatibility layer for old character creation API (if needed)
- Add migration path for existing characters
- Document breaking changes

## Implementation Order

1. **Phase 1** (Foundation) - Must be done first, establishes contracts
2. **Phase 2** (Rulesets) - Can be done in parallel with Phase 3
3. **Phase 3** (Worlds) - Can be done in parallel with Phase 2
4. **Phase 4** (Characters) - Depends on Phases 1-3
5. **Phase 5** (Compiler) - Depends on Phases 1-4
6. **Phase 6** (Runtime) - Depends on Phase 5
7. **Phase 7** (Testing) - Ongoing throughout all phases
8. **Phase 8** (Migration) - After all phases complete

## Key Files to Modify

**Backend:**

- `shared/src/types/chimera-*.ts` (multiple new/updated files)
- `backend/src/services/chimera/rebuild-service.ts`
- `backend/src/routes/chimera-*.ts` (multiple routes)
- `backend/src/services/play/*.ts` (runtime services)

**Frontend:**

- `frontend/src/pages/play/CharacterCreationPage.tsx`
- `frontend/src/pages/dashboard/worlds/Editor.tsx`
- `frontend/src/pages/admin/chimera/rulesets/Editor.tsx`
- `frontend/src/components/chimera/*.tsx` (new components)

**Database:**

- Multiple migration files for schema updates

**Content:**

- `content/system/base_character.json` (new file)