# Chimera Architecture Specification (Unified)

**Status:** Active | **Version:** 3.0 | **Last Updated:** 2025-12-03

**Purpose:** This document is the unified architecture specification for StoneCaster's Chimera system. It replaces the GPT and Gemini master plans and aligns with `PROJECT_CONTEXT_MAP.md`.

---

## Table of Contents

1. [Core Concepts & Glossary](#1-core-concepts--glossary)
2. [Data Architecture (Hybrid Schema)](#2-data-architecture-hybrid-schema)
3. [System Architecture (Route → Service → Repo)](#3-system-architecture-route--service--repo)
4. [The Compiler Strategy (4-Step Pipeline)](#4-the-compiler-strategy-4-step-pipeline)
5. [The Runtime Loop (MAS1 → Engine → MAS2)](#5-the-runtime-loop-mas1--engine--mas2)
6. [The Lore Strategy (RAG/Vector)](#6-the-lore-strategy-ragvector)
7. [Implementation Phases](#7-implementation-phases)
8. [Testing Strategy](#8-testing-strategy)
9. [Deployment & Operations](#9-deployment--operations)

---

## 1. Core Concepts & Glossary

### 1.1 Story Dimension (The "Casting Circle")

A concrete composition that will be compiled into a playable artifact, assembled via the 4-Stone Wizard:

- **World Stone:** Setting metadata, schema extensions, images, lore hooks
- **Forces Stone:** Modular rulesets organized as **Foundations**, **Expansions**, **Flavor**
- **Elements Stone:** Concrete entities (NPCs, items, locations, factions, etc.)
- **Lore Stone:** Narrative fragments to enrich RAG context and MAS2 narration

### 1.2 Casting Circle (Authoring UX)

The 4-stone wizard to assemble a Story Dimension:
1. **World Stone** - Select/create world
2. **Forces Stone** - Select rulesets (with dependency/exclusion validation)
3. **Elements Stone** - Select/create entities
4. **Lore Stone** - Select/create lore fragments

### 1.3 Compiler (4 Steps)

1. **Base Loader:** Load `BaseCharacter` + Merge `World` extensions
2. **Resolution:** Validate `Ruleset` dependencies and `Exclusion Groups`
3. **Schema Build:** Merge `actions`, `stats`, and `lore` into a Master Schema
4. **Artifact Gen:** Output `CompiledStory` (JSON) + `LoreIndex` (Vector)

### 1.4 Runtime Loop (MAS1 → Engine → MAS2)

- **MAS1:** Turns user text into `ActionDto` with sentiment; uses `master_schema.actions` hints
- **Engine:** Deterministic resolution; emits mechanical `numeric_deltas` and `outcome_summary`
- **MAS2:** LLM narrator that consumes Engine result + RAG lore → `ripple_narrative` and Tier0 narrative mutations

### 1.5 GameState Tiers

- **Tier1 Mechanical:** Numeric/boolean/enum facts (HP, mana, position id, statuses). Modified only by Engine.
- **Tier0 Narrative:** Narrative memory stream, soft facts, relationships, descriptors. Modified by MAS2.

---

## 2. Data Architecture (Hybrid Schema)

**Directive:** We use a **Hybrid Pattern** intentionally.

### 2.1 Hybrid Pattern Principles

- **SQL Columns:** Used for `name`, `slug`, `visibility`, `tags`, `owner_user_id`. These exist for **indexing and fast filtering**.
- **JSONB `definition`:** Used for the full canonical object (`WorldDefinition`, `RulesetDefinition`).
- **Migration Rule:** If a field is needed for a `WHERE` clause, it gets a column. If it is only needed for the Compiler/Client, it stays in JSONB.

### 2.2 Core Tables

#### `chimera_worlds` (Hybrid)
- **SQL Columns:** `id` (uuid), `key` (text, unique), `name` (text), `slug` (text), `visibility` (enum), `tags` (text[]), `owner_user_id` (uuid), `created_at`, `updated_at`
- **JSONB:** `definition` (full `WorldDefinition`), `character_schema_contributions` (separate JSONB for character extensions)
- **Indexes:** GIN on `definition`, GIN on `tags`, B-tree on `key`, `owner_user_id`, `visibility`

#### `chimera_ruleset_templates` (Hybrid)
- **SQL Columns:** `id` (uuid), `key` (text, unique), `ui_category` (enum), `exclusion_group` (text, nullable), `dependencies` (jsonb array), `created_at`, `updated_at`
- **JSONB:** `definition` (full `RulesetDefinition`)
- **Indexes:** GIN on `definition`, B-tree on `key`, `ui_category`, `exclusion_group`

#### `chimera_entities` (Hybrid)
- **SQL Columns:** `id` (uuid), `kind` (enum: npc|item|location|faction), `key` (text, unique), `created_at`, `updated_at`
- **JSONB:** `raw_data` (full entity data)
- **Indexes:** GIN on `raw_data`, B-tree on `kind`, `key`

#### `chimera_lore` (Vector Enabled)
- **SQL Columns:** `id` (uuid), `created_at`, `updated_at`
- **JSONB:** `fragment` (full `LoreFragment`)
- **Vector:** `embedding` (vector(1536)) for semantic search
- **Indexes:** IVFFlat on `embedding` (vector_cosine_ops), GIN on `fragment`

#### `compiled_stories` (Artifact Storage)
- **SQL Columns:** `id` (uuid), `story_key` (text, unique), `created_at`, `updated_at`
- **JSONB:** `compiled` (full `CompiledStory`)
- **Indexes:** GIN on `compiled`, B-tree on `story_key`

#### `chimera_game_states` (Runtime Persistence)
- **SQL Columns:** `id` (uuid), `story_id` (uuid), `created_at`, `updated_at`
- **JSONB:** `state` (full `GameState` with tier1_mechanical + tier0_narrative)
- **Indexes:** GIN on `state`, B-tree on `story_id`

### 2.3 Legacy Tables (DROPPED)

The following tables are **deprecated** and should be dropped:
- `awf_*` (All analytics, rollups, dashboards)
- `stone_*` (Wallets, ledgers, packs)
- `mod_*` (Packs, registry, hooks)
- `world_templates`, `worlds` (Old schemas)
- `adventures`, `games`, `sessions`, `turns` (Legacy runtime)

See `PROJECT_CONTEXT_MAP.md` Section 1 for the complete kill list.

---

## 3. System Architecture (Route → Service → Repo)

**Directive:** Business logic must live in Services, not Routes.

### 3.1 Backend Structure (`backend/src/`)

#### `routes/`
- **Purpose:** Zod validation of HTTP inputs. Calls Service. Returns DTO.
- **Pattern:** Thin controllers that validate, call service, return response
- **Example:** `routes/chimera-worlds.ts` validates input, calls `services/authoring/worlds.service.ts`, returns DTO

#### `services/` (Pure Business Logic)
- **`compile/`:** The 4-Step Compiler (New Implementation)
  - `base-loader.service.ts` - Step 1: Base Load & Injection
  - `resolution.service.ts` - Step 2: Dependency & Exclusion Resolution
  - `schema-builder.service.ts` - Step 3: Master Schema Build
  - `artifact-writer.service.ts` - Step 4: Artifact Generation
- **`runtime/`:** The Game Loop (`mas1`, `engine`, `mas2`)
  - `mas1.service.ts` - Action interpreter
  - `engine.service.ts` - Deterministic resolver
  - `mas2.service.ts` - Narrative generator with RAG
  - `state-reducer.service.ts` - State mutation logic
- **`authoring/`:** CRUD logic for Worlds, Lore, Rulesets, Entities
  - `worlds.service.ts` - World CRUD
  - `rulesets.service.ts` - Ruleset CRUD
  - `entities.service.ts` - Entity CRUD
  - `lore.service.ts` - Lore CRUD + vectorization
- **`assets/`:** R2/S3 integrations
  - `asset.service.ts` - Upload, signed URLs, lifecycle

#### `db/repos/`
- **Purpose:** Supabase/SQL interactions. No business logic.
- **Pattern:** Typed repository methods for CRUD operations
- **Example:** `db/repos/chimera-worlds.repo.ts` - `findById()`, `create()`, `update()`, `delete()`

#### `types/`
- **Purpose:** Shared Zod schemas (Synced with `chimera-full-schemas.json`)
- **Location:** `shared/src/types/chimera-*.ts`

### 3.2 Frontend Structure (`frontend/src/`)

#### `pages/casting-circle/`
- **Purpose:** The 4-Stone Wizard (World, Forces, Elements, **Lore**)
- **Components:** `CastingCircleWizard.tsx`, `WorldStone.tsx`, `ForcesStone.tsx`, `ElementsStone.tsx`, `LoreStone.tsx`

#### `pages/play/`
- **Purpose:** The Runtime Interface
- **Components:** `GameLog.tsx`, `StatsPanel.tsx`, `InputBar.tsx`, `CharacterView.tsx`

#### `services/`
- **Purpose:** API Client wrappers
- **Pattern:** React Query hooks for data fetching
- **Example:** `services/chimera-api.ts` - `useWorlds()`, `useCompileStory()`, `useCastStone()`

---

## 4. The Compiler Strategy (4-Step Pipeline)

**Directive:** Delete existing `services/compiler` and `services/compile`. Build fresh.

### 4.1 Step 1: Base Loader

**Input:** `BaseCharacter` (from system), `WorldDefinition` (from DB)

**Process:**
- Load `BaseCharacter` template
- Apply `World.character_schema_extensions` via shallow/deep merge rules:
  - Numeric keys override defaults
  - Arrays concatenate
  - Unknown keys rejected unless whitelisted in `schema_extensions.allow`

**Output:** `LayeredCharacter(L1+L2)` - BaseCharacter + World extensions

### 4.2 Step 2: Resolution

**Input:** Selected `RulesetDefinition[]`

**Process:**
- Validate dependencies: All `dependencies` must be present in selection
- Validate exclusions: Only one ruleset per `exclusion_group`
- Aggregate `provides_tags` for later addressing

**Output:** `ActiveForces` list (validated rulesets)

**Errors:**
- `EXCLUSION_CONFLICT` - Multiple rulesets in same exclusion group
- `MISSING_DEPENDENCY` - Required dependency not found

### 4.3 Step 3: Schema Build

**Input:** `ActiveForces`, `LayeredCharacter`

**Process:**
- Merge all `state_contributions` → `tier1_allowlist` / `tier0_allowlist`
- Merge all `actions` → `actions_map` (last-in wins with warnings)
- Aggregate `ai_instructions` → `prompt_instructions` (mas1_hints, mas2_style arrays)

**Output:** `master_schema` with allowlists, actions_map, prompt_instructions

**Errors:**
- `ACTION_CONFLICT` - Conflicting action definitions (warn, last-in wins)

### 4.4 Step 4: Artifact Gen

**Input:** `master_schema`, `EntityTemplate[]`, `LoreFragment[]`

**Process:**
- Filter entities: Route each `EntityTemplate.raw_data` key to Tier1 or Tier0 based on allowlists
- Discard non-allowlisted keys
- Construct `initial_state` with `global` and `entities` maps
- Build `narrative_context_index` using embeddings over Lore content (vectorize and store in `chimera_lore`)

**Output:** `CompiledStory` with:
- `meta` (story_id, world, version)
- `master_schema` (allowlists, actions_map, prompt_instructions)
- `narrative_context_index` (lore fragment references with embeddings)
- `initial_state` (tier1_mechanical + tier0_narrative)

**Errors:**
- `ILLEGAL_KEY` - Entity key not in allowlist
- `INVALID_EXTENSION` - World extension violates schema

---

## 5. The Runtime Loop (MAS1 → Engine → MAS2)

### 5.1 MAS1 (Interpreter)

**Input:**
- `text_input` (user text)
- `game_state_snapshot` (current state)
- `master_schema.actions_map` (available actions)

**Process:**
- Coreference resolution (resolve pronouns using game state)
- Intent parsing (map text to action type)
- Action selection (prefer actions in `actions_map` when confidence < 0.8)
- Sentiment extraction (tone, intensity)

**Output:** `Mas1ResponseDto`
```json
{
  "resolved_query": "attack the bandit",
  "sentiment": {"tone": "determined", "intensity": 7},
  "action_dto": {"type": "attack", "target": "entity-123", "args": {}}
}
```

### 5.2 Engine (Resolver)

**Input:** `Mas1ResponseDto`, `GameState`, `master_schema`

**Process:**
- Deterministic evaluation for mechanical actions
- Execute dice, thresholds, resource costs
- Validate costs (e.g., stamina, mana)
- Calculate numeric deltas
- Generate outcome summary

**Output:** `EngineResultDto`
```json
{
  "success": true,
  "numeric_deltas": [{"path": "entities.bandit.stats.hp", "op": "-", "value": 7}],
  "outcome_summary": "Hit for 7 damage"
}
```

### 5.3 MAS2 (Narrator)

**Input:**
- `EngineResultDto` (mechanical outcome)
- RAG hits from `chimera_lore` (vector similarity search)
- `prompt_instructions.mas2_style` (style guidelines)
- `sentiment` (from MAS1)

**Process:**
- Query `chimera_lore` by vector similarity to current context
- Generate narrative using Engine result + RAG lore
- Apply style rules (tense, mood, show don't tell)
- Never write player dialogue
- Weave in up to 2 lore facts from RAG

**Output:** `Mas2ResponseDto`
```json
{
  "ripple_narrative": "Your blade finds its mark...",
  "mutations": [{"path": "memory_stream", "op": "push", "value": {"event": "attack_success", "detail": "bandit"}}]
}
```

### 5.4 State Reducer

**Process:**
- Apply Tier1 deltas first (from Engine)
- Then apply Tier0 mutations (from MAS2)
- Persist new `GameState` version to `chimera_game_states`

**Output:** Updated `GameState`

### 5.5 Client View

**Compose:**
- `last_narrative` (from MAS2)
- `tier1_snapshot` (mechanical state)
- `key_relationships` (from Tier0)
- `active_effects` (from Tier1)

---

## 6. The Lore Strategy (RAG/Vector)

**Directive:** Lore is a cross-cutting concern powered by `pgvector`.

### 6.1 Ingestion

**When:** World/Element/Force is saved

**Process:**
1. Extract text fragments from `WorldDefinition`, `EntityTemplate`, `RulesetDefinition`
2. Chunk text into semantic units (200-500 tokens)
3. Embed chunks using OpenAI/local embedding model (1536 dimensions)
4. Save to `chimera_lore` table:
   - `fragment` (JSONB): Full `LoreFragment` object
   - `embedding` (vector(1536)): Embedding vector

### 6.2 Retrieval

**When:** At runtime, MAS2 queries for narrative context

**Process:**
1. Generate query embedding from current context (player action, location, entities)
2. Query `chimera_lore` using vector similarity (cosine distance)
3. Retrieve top 2-3 most relevant fragments
4. Inject into MAS2 prompt as context

**Query Example:**
```sql
SELECT fragment, embedding <-> $1::vector AS distance
FROM chimera_lore
ORDER BY embedding <-> $1::vector
LIMIT 3;
```

### 6.3 LoreFragment Schema

```json
{
  "id": "uuid",
  "title": "Whispercross Chronicle I",
  "content": "Text...",
  "tags": ["whispercross", "history"],
  "triggers": {"when_action": "travel", "where": "whispercross"},
  "weight": 0.9
}
```

**Note:** The `embedding` vector is stored separately in the `chimera_lore` table column, not in the JSONB fragment.

---

## 7. Implementation Phases

### Phase 0: Terminology + Contracts

**Goal:** Establish glossary and freeze contracts.

**Output:**
- `docs/PROJECT_CONTEXT_MAP.md` ✅ (Done)
- `docs/CHIMERA_ARCHITECTURE_SPEC.md` ✅ (This document)
- `shared/src/types/chimera-*.ts` (Zod schemas)
- `docs/chimera-full-schemas.json` (JSON contract)

**Status:** ✅ Complete

---

### Phase 1: Database Migration & Legacy Purge

**Goal:** Drop legacy tables and ensure Hybrid Schema compliance.

**Tasks:**
1. **Run Migration:** `supabase/migrations/20251203_consolidate_chimera.sql`
   - Enable `pgvector` extension
   - Drop all `awf_*`, `stone_*`, `mod_*`, legacy tables
   - Fix `chimera_worlds` Hybrid structure
   - Fix `chimera_lore` vector support
2. **Run Purge Script:** `scripts/purge_legacy.sh --confirm`
   - Delete all AWF legacy code
   - Remove `mods/`, `marketplace/` directories
   - Clean up legacy service files

**Output:**
- Clean database schema (Hybrid Pattern)
- No legacy code in codebase
- Service directories scaffolded (`compile/`, `authoring/`, `runtime/`, `assets/`)

**Status:** ✅ Complete (Phase 1 deliverables created)

---

### Phase 2: Authoring CRUD + Repos

**Goal:** Backend CRUD routes + repositories for Worlds, Rulesets, Entities, Lore.

**Tasks:**
1. **Repositories:** `db/repos/chimera-*.repo.ts`
   - Typed CRUD methods
   - Supabase client integration
   - No business logic
2. **Services:** `services/authoring/*.service.ts`
   - World CRUD logic
   - Ruleset CRUD logic
   - Entity CRUD logic
   - Lore CRUD + vectorization logic
3. **Routes:** `routes/chimera-*.ts`
   - Zod validation
   - Call services
   - Return DTOs
4. **Asset Service:** `services/assets/asset.service.ts`
   - Cloudflare R2 signed URLs
   - Upload handling

**Output:**
- Full CRUD API for authoring
- Asset upload endpoints
- Lore vectorization on save

**Status:** 🔄 Ready to start

---

### Phase 3: Casting Circle Wizard (Frontend)

**Goal:** Build 4-stone wizard with validation panel.

**Tasks:**
1. **Components:** `pages/casting-circle/`
   - `CastingCircleWizard.tsx` (stepper)
   - `WorldStone.tsx`, `ForcesStone.tsx`, `ElementsStone.tsx`, `LoreStone.tsx`
   - Validation panel (dependency/exclusion checks)
2. **API Integration:** `services/chimera-api.ts`
   - React Query hooks
   - Optimistic updates
3. **Validation:** Real-time dependency/exclusion checking

**Output:**
- Functional 4-stone wizard
- Dependency/exclusion validation
- Modern Tailwind UI

**Status:** 🔄 Ready to start

---

### Phase 4: Compiler Pipeline

**Goal:** Implement 4-step compiler and artifact persistence.

**Tasks:**
1. **Services:** `services/compile/`
   - `base-loader.service.ts` (Step 1)
   - `resolution.service.ts` (Step 2)
   - `schema-builder.service.ts` (Step 3)
   - `artifact-writer.service.ts` (Step 4)
2. **Route:** `routes/chimera-compile.ts`
   - `POST /chimera/compile` endpoint
   - Input: `{ worldId, rulesetIds[], entityIds[], loreIds[] }`
   - Output: `CompiledStory`
3. **Tests:** Unit tests for each step, integration tests for full pipeline

**Output:**
- Functional compiler service
- `/chimera/compile` endpoint
- Test coverage

**Status:** 🔄 Ready to start

---

### Phase 5: Character Creator (Dynamic)

**Goal:** Dynamic UI from BaseCharacter + world extensions + forces.

**Tasks:**
1. **Service:** `services/authoring/character-layers.service.ts`
   - Merge BaseCharacter + World extensions
   - Apply ruleset contributions
2. **Frontend:** `pages/play/character-creator.tsx`
   - Dynamic form generation
   - Schema-driven UI

**Output:**
- Dynamic character creator
- Schema-driven form generation

**Status:** 🔄 Ready to start

---

### Phase 6: Runtime Loop

**Goal:** MAS1 → Engine → MAS2 end-to-end.

**Tasks:**
1. **Services:** `services/runtime/`
   - `mas1.service.ts` (LLM adapter + schema guard)
   - `engine.service.ts` (deterministic logic with dice)
   - `mas2.service.ts` (LLM + RAG)
   - `state-reducer.service.ts` (state mutations)
2. **Routes:** `routes/chimera-play.ts`
   - `POST /chimera/play/start` (initialize game)
   - `POST /chimera/play/:gameStateId/cast-stone` (user action)
3. **RAG Integration:** Vector similarity search in MAS2

**Output:**
- Functional runtime loop
- RAG-powered narrative
- State persistence

**Status:** 🔄 Ready to start

---

### Phase 7: Game View (Frontend)

**Goal:** Minimal but polished play UI.

**Tasks:**
1. **Components:** `pages/play/`
   - `GameLog.tsx` (narrative log)
   - `StatsPanel.tsx` (mechanical state)
   - `InputBar.tsx` (user input)
   - `CharacterView.tsx` (character sheet)
2. **Integration:** Connect to runtime endpoints
3. **UX:** Optimistic UI, loading states, error handling

**Output:**
- Functional play interface
- Real-time state updates
- Polished UX

**Status:** 🔄 Ready to start

---

### Phase 8: Seeds + QA + Observability

**Goal:** Seed content and verify instruments.

**Tasks:**
1. **Standard Library:** Seed scripts for:
   - Foundational rulesets (`rs_d20_core`, `rs_time_simple`, `rs_health_simple`)
   - Minimal world (`mystika`)
   - Sample entities (1 companion NPC, 2 enemies, 3 items, 2 locations)
   - 5 lore fragments
2. **Observability:** Metrics logging for:
   - Compile time
   - Cast latency (MAS1 + Engine + MAS2)
   - Error rates
3. **Documentation:** `docs/TEST_PLAN.md`, `docs/OPERATIONS.md`

**Output:**
- Standard library seeded
- Metrics dashboard
- Operations docs

**Status:** 🔄 Ready to start

---

## 8. Testing Strategy

### 8.1 Unit Tests

**Targets:**
- Allowlist builder merges
- Dependency/exclusion validation
- Entity router (Tier1/Tier0)
- Dice utils
- State reducer logic

**Framework:** Vitest

### 8.2 Integration Tests

**Targets:**
- Compile pipeline (happy path + error cases)
- MAS1 → Engine → MAS2 loop
- RAG retrieval
- State persistence

**Framework:** Vitest + test database

### 8.3 E2E Tests

**Targets:**
- Casting Circle assembly → Compile → Start Play → First cast → State update visible

**Framework:** Playwright

### 8.4 Accessibility Tests

**Targets:**
- All UI components
- Zero serious/critical axe violations

**Framework:** @axe-core/playwright

---

## 9. Deployment & Operations

### 9.1 Infrastructure

- **Frontend:** Cloudflare Workers/Pages (React + Vite)
- **Backend:** Fly.io (Node/Express)
- **Database:** Supabase (Postgres + Auth + RLS)
- **Storage:** Cloudflare R2 (or Supabase Storage)
- **Vector:** Supabase pgvector (1536 dimensions)

### 9.2 Environment Variables

**Frontend:**
- `VITE_API_BASE_URL` - Backend API URL
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key

**Backend:**
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_KEY` - Supabase service key
- `OPENAI_API_KEY` - For embeddings and LLM
- `R2_ACCOUNT_ID` - Cloudflare R2 account
- `R2_ACCESS_KEY_ID` - R2 access key
- `R2_SECRET_ACCESS_KEY` - R2 secret

### 9.3 Observability

**Metrics:**
- Compile time (p50, p95, p99)
- Cast latency (MAS1 + Engine + MAS2)
- Error rates by endpoint
- Vector search latency

**Logging:**
- Compiler errors with error codes
- Runtime tracing (MAS timings, token usage)
- RAG retrieval hits/misses

### 9.4 Security

- **Auth:** Supabase JWT validation
- **RLS:** Row-level security policies (authors vs players)
- **Validation:** Zod schemas on all inputs
- **Secrets:** Never log secrets/PII

---

## 10. Acceptance Criteria (MVP)

- ✅ Author can assemble a Story Dimension in Casting Circle without JSON editing
- ✅ Compiler produces a single `CompiledStory` deterministically
- ✅ Player can start a game, cast actions, see state change and narrative
- ✅ Tests cover compiler steps and a basic runtime loop
- ✅ Observability shows compile and loop metrics
- ✅ Zero serious/critical accessibility violations
- ✅ Mobile-first (375×812) design

---

## 11. Roadmap After MVP

- Multi-actor scenes
- Spatial map UI
- Inventory management UI
- Factions reputation system
- Save slots
- Replays
- Analytics for author tuning
- Marketplace for Worlds/Forces/Elements packs

---

**End of Specification**

