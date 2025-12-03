# StoneCaster Ultra‑Complete Master Plan (Legacy‑Free)

> **Purpose**: A self‑contained, implementation‑ready blueprint that an AI agent can use to generate phased prompts for Cursor to build the StoneCaster MVP end‑to‑end. This document assumes **no legacy code or data** and establishes the canonical Chimera architecture, Casting Circle authoring UX, Compiler pipeline, and Runtime loop (MAS1 → Engine → MAS2). It includes schemas, contracts, file paths, API routes, acceptance criteria, test plans, and phase‑by‑phase “Cursor Prompt Packs.”

> **Target stack**: Frontend on **Cloudflare Workers/Pages** (React + Vite), **Supabase** for Auth + Postgres DB, Backend app on **Fly.io** (Node/Express). Asset storage via Cloudflare R2 (or Supabase Storage). Vector embeddings either in **Supabase pgvector** or **Qdrant** managed.

---

## 0. Canonical Glossary & Core Concepts

### 0.1 Story Dimension
A concrete composition that will be compiled into a playable artifact.
- **World**: setting metadata, schema extensions, images, lore hooks.
- **Forces**: modular rulesets organized as **Foundations**, **Expansions**, **Flavor**.
- **Elements**: concrete entities (NPCs, items, locations, factions, etc.).
- **Lore**: narrative fragments to enrich RAG context and MAS2 narration.
- **Player Template**: base character schema and defaults.

### 0.2 Casting Circle (Authoring UX)
The 4‑stone wizard to assemble a Story Dimension:
1) **World Stone** 2) **Forces Stone** 3) **Elements Stone** 4) **Lore Stone**.

### 0.3 Compiler (4 Steps)
1) **Base Load & Injection** (merge BaseCharacter with World extensions).  
2) **Dependency & Exclusion Resolution** for active Forces (rulesets).  
3) **Master Schema Build** (Tier allowlists + actions map + AI instructions).  
4) **Entity Filtering & Initial State** (split raw entity data into Tier1 mechanical and Tier0 narrative; construct initial GameState).

### 0.4 Runtime Loop (MAS1 → Engine → MAS2)
- **MAS1**: turns user text into `ActionDto` with sentiment; uses `master_schema.actions` hints.  
- **Engine**: deterministic resolution; emits mechanical `numeric_deltas` and `outcome_summary`.  
- **MAS2**: LLM narrator that consumes Engine result + RAG lore → `ripple_narrative` and Tier0 narrative mutations.

### 0.5 GameState Tiers
- **Tier1 Mechanical**: numeric/boolean/enum facts (HP, mana, position id, statuses).  
- **Tier0 Narrative**: narrative memory stream, soft facts, relationships, descriptors.

---

## 1. Canonical JSON Contracts (Authoring → Compile → Runtime)

> These contracts are **source of truth**. Keep Zod/TS in sync with DB JSONB.

### 1.1 `ChimeraAssetRef`
```json
{
  "id": "uuid",
  "url": "https://...",
  "role": "icon|banner|portrait|gallery|map|audio",
  "label": "optional string",
  "meta": {"copyright": "", "artist": "", "license": ""}
}
```

### 1.2 `BaseCharacter` (Layer 1)
```json
{
  "version": 1,
  "identity": {"name": "", "pronouns": "", "age": null, "role": "adventurer"},
  "appearance": {"summary": "", "traits": []},
  "persona": {"backstory": "", "drive": "", "flaw": "", "traits": []},
  "stats": {"hp": 10, "mp": 0, "speed": 5},
  "tags": ["player", "sentient"],
  "inventory": [],
  "abilities": [],
  "meta": {"created_by": "system"}
}
```

### 1.3 `WorldDefinition`
```json
{
  "id": "uuid",
  "key": "mystika",
  "version": 1,
  "title": "Mystika",
  "summary": "High magic world of planes and crystals.",
  "images": [{"id":"...","url":"...","role":"banner"}],
  "character_schema_extensions": {
    "stats": {"essence": {"life":0,"death":0,"order":0,"chaos":0}},
    "appearance": {"glyphs": []}
  },
  "lore_hooks": ["crystal planes", "dimensional rifts"],
  "meta": {"author":"", "rating":"T"}
}
```

### 1.4 `RulesetDefinition` (Force)
```json
{
  "id": "uuid",
  "key": "rs_d20_core",
  "ui_category": "foundation|expansion|flavor",
  "exclusion_group": "dice_core",
  "dependencies": ["rs_time_simple"],
  "provides_tags": ["d20"],
  "icon_url": "https://...",
  "state_contributions": {
    "tier1_entity": ["stats.hp", "stats.ac", "stats.proficiency"],
    "tier1_global": ["time.ticks"],
    "tier0_narrative": ["memory.events", "relationships"]
  },
  "actions": {
    "attack": {
      "kind": "mechanical",
      "inputs": {"target":"entityId"},
      "logic": {"dice":"1d20+mod", "vs":"target.ac"},
      "effects": {"on_success":{"target.stats.hp":"-1d8"}}
    },
    "travel": {"kind":"narrative", "inputs":{"to":"locationId"}}
  },
  "ai_instructions": {
    "mas1_hints": ["Prefer actions listed in actions map when confidence < 0.8"],
    "mas2_style": ["tense mood", "show don't tell", "never write player dialogue"]
  }
}
```

### 1.5 `EntityTemplate` (Element)
```json
{
  "id":"uuid",
  "kind":"npc|item|location|faction|creature",
  "key":"kiera_panther_shifter",
  "raw_data": {
    "identity": {"name":"Kiera", "species":"Shifter"},
    "stats": {"hp": 24, "mp": 6},
    "tags": ["companion","romanceable"],
    "abilities": ["claws","stealth"],
    "appearance": {"summary":"panther grace"},
    "relationships": {"player":"curious"}
  }
}
```

### 1.6 `LoreFragment`
```json
{
  "id":"uuid",
  "title":"Whispercross Chronicle I",
  "content":"Text...",
  "tags":["whispercross","history"],
  "triggers": {"when_action":"travel", "where":"whispercross"},
  "weight": 0.9
}
```

### 1.7 `CompiledStory` (Compiler Output)
```json
{
  "meta": {"story_id":"uuid", "world":"mystika", "version":1},
  "master_schema": {
    "tier1_allowlist": ["stats.*", "time.*", "effects.*"],
    "tier0_allowlist": ["memory.*", "relationships.*"],
    "actions_map": {"attack": {"kind":"mechanical"}, "travel": {"kind":"narrative"}},
    "prompt_instructions": {"mas1_hints":["..."], "mas2_style":["..."]}
  },
  "narrative_context_index": [{"fragment_id":"uuid","embedding":[0.1,0.2]}],
  "initial_state": {
    "tier1_mechanical": {"global": {"time":{"ticks":0}}, "entities": {}},
    "tier0_narrative": {"memory_stream": [], "entities": {}}
  }
}
```

### 1.8 Runtime DTOs
```json
{
  "Mas1ResponseDto": {
    "resolved_query": "attack the bandit",
    "sentiment": {"tone":"determined","intensity":7},
    "action_dto": {"type":"attack","target":"entity-123"}
  },
  "EngineResultDto": {
    "success": true,
    "numeric_deltas": [{"path":"entities.bandit.stats.hp","op":"-","value":"1d8+2"}],
    "outcome_summary": "Hit for 7 damage"
  },
  "Mas2ResponseDto": {
    "ripple_narrative": "Your blade finds its mark...",
    "mutations": [{"path":"memory_stream","op":"push","value":{"event":"attack_success","detail":"bandit"}}]
  }
}
```

### 1.9 `GameState` (Runtime Persistence)
```json
{
  "tier1_mechanical": {
    "global": {"time":{"ticks":2}},
    "entities": {
      "player": {"stats":{"hp":9,"ac":12}},
      "bandit": {"stats":{"hp":3}}
    }
  },
  "tier0_narrative": {
    "memory_stream": [
      {"ts": 1, "event":"arrival","where":"whispercross"}
    ],
    "entities": {
      "player": {"relationships":{"kiera":"warming"}}
    }
  }
}
```

---

## 2. Data Storage (Postgres + JSONB) and Migrations

> Supabase Postgres with RLS; JSONB for authoring blobs; normalized references for IDs; pgvector for embeddings.

### 2.1 Tables
- `chimera_worlds (id uuid pk, key text unique, definition jsonb, created_at, updated_at)`
- `chimera_ruleset_templates (id uuid pk, key text unique, definition jsonb, ui_category text, exclusion_group text, dependencies jsonb, created_at, updated_at)`
- `chimera_entities (id uuid pk, kind text, key text unique, raw_data jsonb, created_at, updated_at)`
- `chimera_lore (id uuid pk, fragment jsonb, embedding vector, created_at, updated_at)`
- `compiled_stories (id uuid pk, story_key text unique, compiled jsonb, created_at, updated_at)`
- `chimera_game_states (id uuid pk, story_id uuid, state jsonb, created_at, updated_at)`

### 2.2 Indexes
- GIN on `definition`, `raw_data`, `compiled` JSONB fields.  
- pgvector index on `chimera_lore.embedding`.

### 2.3 RLS (illustrative)
- Authors can CRUD their assets; players can read compiled stories and their own game states.

---

## 3. Backend Services (Node/Express on Fly.io)

### 3.1 Folder Layout
```
backend/
  src/
    routes/
      chimera-worlds.ts
      chimera-rulesets.ts
      chimera-entities.ts
      chimera-lore.ts
      chimera-compile.ts
      chimera-play.ts
    services/
      worlds.service.ts
      rulesets.service.ts
      entities.service.ts
      lore.service.ts
      compile/
        compiler.service.ts
        allowlist-builder.ts
        dependency-checker.ts
        entity-filter.ts
        artifact-writer.ts
      runtime/
        mas1.service.ts
        engine.service.ts
        mas2.service.ts
        state-reducer.ts
      assets/asset.service.ts
    db/
      pool.ts
      repo.ts
    types/
      chimera/*.ts
    utils/
      zod.ts
      dice.ts
  tests/
```

### 3.2 REST API (MVP)
- **Authoring**
  - `POST /chimera/worlds` | `GET /chimera/worlds/:id`
  - `POST /chimera/rulesets` | `GET /chimera/rulesets/:id`
  - `POST /chimera/entities` | `GET /chimera/entities/:id`
  - `POST /chimera/lore` | `GET /chimera/lore/:id`
- **Compile**
  - `POST /chimera/compile` → body: `{ worldId, rulesetIds[], entityIds[], loreIds[] }` → returns `CompiledStory`
- **Runtime**
  - `POST /chimera/play/:gameStateId/cast-stone` → `{ text_input }` → returns `{ Mas1, EngineResult, Mas2, client_view }`
  - `POST /chimera/play/start` → `{ compiledStoryId, playerOptions }` → returns `{ gameStateId }`

### 3.3 Security
- Supabase JWT validation middleware.  
- Author vs Player roles.

---

## 4. Frontend (Cloudflare Workers/Pages, React + Vite)

### 4.1 Pages
- `/dashboard/worlds` (CRUD)  
- `/dashboard/forces` (CRUD rulesets)  
- `/dashboard/elements` (CRUD entities)  
- `/dashboard/lore` (CRUD fragments)  
- `/casting-circle` (4‑stone wizard)  
- `/play/:id` (Game View)

### 4.2 Components (Selected)
- `CastingCircleWizard` with stones and validation panel.  
- `CharacterCreator` (dynamic based on BaseCharacter + World extensions).  
- `GameLog`, `StatsPanel`, `InputBar`.

---

## 5. Compiler Detailed Spec

### 5.1 Step 1: Base Load & Injection
- Load `BaseCharacter`.  
- Apply `World.character_schema_extensions` via shallow/deep merge rules: numeric keys override defaults; arrays concatenate; unknown keys rejected unless whitelisted in `schema_extensions.allow`.

**Output**: `LayeredCharacter(L1+L2)`.

### 5.2 Step 2: Dependency & Exclusion
- Confirm only one ruleset per `exclusion_group`.
- Validate all `dependencies` present.
- Aggregate `provides_tags` to make later rules addressable.

**Output**: `ActiveForces` list.

### 5.3 Step 3: Master Schema Builder
- Combine all `state_contributions` to produce:
  - `tier1_allowlist`
  - `tier0_allowlist`
  - `actions_map` (merged by action key; last‑in wins with warnings)
  - `prompt_instructions` (mas1_hints, mas2_style arrays)

**Output**: `master_schema`.

### 5.4 Step 4: Entity Filter & Initial State
- For each `EntityTemplate.raw_data` key, route to Tier1 or Tier0 based on allowlists.  
- Discard non‑allowlisted keys.  
- Construct `initial_state` with `global` and `entities` maps.  
- Build `narrative_context_index` using embeddings over Lore content.

**Output**: `CompiledStory`.

### 5.5 Compiler Errors
- `EXCLUSION_CONFLICT`, `MISSING_DEPENDENCY`, `ILLEGAL_KEY`, `ACTION_CONFLICT`, `INVALID_EXTENSION`.

---

## 6. Runtime Loop Detailed Spec

### 6.1 MAS1 (Interpreter)
- Input: `{ text_input, game_state_snapshot, master_schema.actions_map }`.  
- Tasks: coreference resolution, intent parsing, action selection, sentiment.  
- Output: `Mas1ResponseDto`.

### 6.2 Engine (Resolver)
- Deterministic evaluation for mechanical actions.  
- Executes dice, thresholds, resource costs; writes `numeric_deltas`, `outcome_summary`.

### 6.3 MAS2 (Narrator)
- Uses Engine result + RAG retrieval from `narrative_context_index`, plus `prompt_instructions.mas2_style`.  
- Output: `Mas2ResponseDto` with `ripple_narrative` and Tier0 mutations.

### 6.4 State Reducer
- Apply Tier1 deltas first; then Tier0 mutations.  
- Persist new `GameState` version.

### 6.5 Client View
- Compose `{ last_narrative, tier1_snapshot, key_relationships, active_effects }`.

---

## 7. Prompt Specifications (LLM‑Facing)

> These are **templates** for MAS1 and MAS2. Cursor prompts will inject variables.

### 7.1 MAS1 System Prompt (Template)
```
You are MAS1, an action interpreter for a structured RPG engine.
Strict rules:
- Output JSON only in the ActionDto format defined below.
- Prefer actions that exist in actions_map.
- Resolve pronouns using provided game state.
- Never invent entities outside state or elements.

Inputs:
- User text: {{text_input}}
- Actions map: {{actions_map_json}}
- Snapshot (for references): {{state_snapshot_min}}

ActionDto schema:
{ "type": "string", "target": "string|null", "args": {"...": "..."} }

Return structure:
{
  "resolved_query": "",
  "sentiment": {"tone":"","intensity":0},
  "action_dto": {"type":"","target":"","args":{}}
}
```

### 7.2 MAS2 System Prompt (Template)
```
You are MAS2, the narrative narrator.
Style guardrails:
- Keep tense consistent.
- Show action consequences briefly before flourishes.
- Never write player dialogue.
- Weave in up to 2 lore facts from RAG; avoid contradictions.

Inputs:
- Engine summary: {{engine_outcome}}
- RAG hits: {{lore_snippets}}
- Style rules: {{style_rules}}
- Detected sentiment: {{sentiment}}

Output:
{
  "ripple_narrative": "",
  "mutations": [ {"path":"tier0...","op":"set|push|merge","value":{}} ]
}
```

---

## 8. Testing Strategy

### 8.1 Unit
- Allowlist builder merges.  
- Dependency/exclusion validation.  
- Entity router (Tier1/Tier0) with fixtures.  
- Dice utils.

### 8.2 Integration
- Compile pipeline happy path and each error class.  
- MAS1 → Engine → MAS2 loop with seeded stories.

### 8.3 E2E
- Casting Circle assembly → Compile → Start Play → First cast → State update visible.

---

## 9. Observability
- Compiler logs with error codes.  
- Runtime tracing: MAS timings and token usage.  
- Metrics dashboard: compile time, loop latency, error rates.

---

## 10. Deployment

- **Frontend**: Cloudflare Pages, environment secrets via CF dashboard.  
- **Backend**: Fly.io, scale to zero optional, rolling deploy.  
- **Supabase**: prod project; apply SQL migrations via CI.  
- **Embeddings**: Supabase pgvector.  
- **Assets**: Cloudflare R2; signed URLs.

---

## 11. Standard Library (MVP Seed)

- **Foundations**: `rs_d20_core`, `rs_time_simple`, `rs_health_simple`.
- **Expansions**: `rs_social_simple`, `rs_status_effects`.
- **Flavor**: `rs_gothic_tone`.
- **Worlds**: `mystika` minimal.  
- **Elements**: 1 companion NPC, 2 enemies, 3 items, 2 locations.  
- **Lore**: 5 short fragments.

---

## 12. Acceptance Criteria (MVP)

- Author can assemble a Story Dimension in Casting Circle without JSON editing.  
- Compiler produces a single `CompiledStory` deterministically.  
- Player can start a game, cast actions, see state change and narrative.  
- Tests cover compiler steps and a basic runtime loop.  
- Observability shows compile and loop metrics.

---

## 13. Phase Plan with Cursor Prompt Packs

Each phase below includes a ready‑to‑paste prompt block for Cursor. Replace bracketed variables as needed.

### Phase 0: Terminology + Contracts
**Goal**: Establish glossary and freeze contracts.
**Output**: `docs/ARCHITECTURE.md`, `shared/types/` interfaces, checklists.

**Cursor Prompt Pack**
```
You are an engineering pair.
Create the following files:
- docs/ARCHITECTURE.md with glossary (World, Forces, Elements, Lore, Story Dimension, Casting Circle, Compiler, MAS1/Engine/MAS2) and diagrams in text.
- shared/src/types/chimera-assets.ts exporting ChimeraAssetRef (TS + Zod).
- shared/src/types/chimera-authoring.ts exporting BaseCharacter, WorldDefinition, RulesetDefinition, EntityTemplate, LoreFragment (TS + Zod).
- shared/src/types/chimera-compiled.ts exporting CompiledStory (TS + Zod).
- shared/src/types/chimera-runtime.ts exporting GameState, Mas1ResponseDto, EngineResultDto, Mas2ResponseDto (TS + Zod).
Include minimal Jest tests for Zod parse examples.
```

### Phase 1: DB + Repos + RLS
**Goal**: Create tables and repos.
**Output**: SQL migrations, repo layer.

**Cursor Prompt Pack**
```
Add SQL migrations for tables listed in section 2.1 with indexes in 2.2. Use Supabase style. Generate Node pg repositories with typed methods for CRUD. Add basic RLS templates (authors vs players). Write integration tests using a test DB.
```

### Phase 2: Authoring CRUD + Uploads
**Goal**: Backend CRUD routes + Cloudflare R2 uploads.
**Output**: routes/services for worlds, rulesets, entities, lore; asset service.

**Cursor Prompt Pack**
```
Implement Express routes under /chimera/* for CRUD. Validate with Zod. Add asset.service.ts for signed upload URLs (R2). Write supertest specs for happy/error paths.
```

### Phase 3: Casting Circle Wizard (FE)
**Goal**: Build 4‑stone wizard with validation panel.
**Output**: React components; dependency/exclusion checks via API.

**Cursor Prompt Pack**
```
Create /casting-circle page with steps: World, Forces, Elements, Lore. Add validation side panel that calls backend to compute conflicts and preview schema contributions. Build minimal, modern Tailwind UI.
```

### Phase 4: Compiler Pipeline
**Goal**: Implement 4 steps and artifact persistence.
**Output**: compiler.service.ts and helpers; CLI command; tests.

**Cursor Prompt Pack**
```
Implement compiler.service.ts per section 5. Create helpers: dependency-checker.ts, allowlist-builder.ts, entity-filter.ts, artifact-writer.ts. Add /chimera/compile endpoint. Create a CLI script to compile locally. Write snapshot tests for sample mixes.
```

### Phase 5: Character Creator (3 Layers)
**Goal**: Dynamic UI from BaseCharacter + world extensions + forces.
**Output**: CharacterCreator, backend builder service.

**Cursor Prompt Pack**
```
Create character-layers.service.ts to produce a LayeredCharacter. Build /play/character-creator using dynamic form generation. Write unit tests for merging and invalid extensions.
```

### Phase 6: Runtime Loop
**Goal**: MAS1 → Engine → MAS2 end‑to‑end.
**Output**: services, reducer, /play endpoints, tests.

**Cursor Prompt Pack**
```
Implement mas1.service.ts (LLM adapter + schema guard), engine.service.ts (deterministic logic with dice and costs), mas2.service.ts (LLM + RAG). Implement state-reducer.ts. Add POST /chimera/play/start and /chimera/play/:gameStateId/cast-stone. Write integration tests with seeded CompiledStory.
```

### Phase 7: Game View (FE)
**Goal**: Minimal but polished play UI.
**Output**: GameLog, StatsPanel, InputBar; session management.

**Cursor Prompt Pack**
```
Implement /play/:id with narrative log, stats panel, input bar. Connect to runtime endpoints. Add optimistic UI with loading states and error toasts. Write Playwright E2E for a single simple path.
```

### Phase 8: Seeds + QA + Observability
**Goal**: Seed content and verify instruments.
**Output**: standard library data; dashboards.

**Cursor Prompt Pack**
```
Add seed scripts for foundational rulesets, minimal world, sample entities, and 5 lore fragments. Add metrics logging for compile time and cast latency. Create docs/TEST_PLAN.md and docs/OPERATIONS.md.
```

---

## 14. Risk Matrix and Mitigations
- **Prompt brittleness** → Provide strict JSON output schemas and validators.  
- **Rule merging conflicts** → Last‑in wins with warnings; add lints.  
- **Token usage spikes** → Cache compiled artifacts, reduce RAG hits to top 2.  
- **Data drift** → Snapshot tests and schema checks in CI.

---

## 15. Roadmap After MVP
- Multi‑actor scenes; spatial map; inventory UI; factions reputation.  
- Save slots; replays; analytics for author tuning.  
- Marketplace for Worlds/Forces/Elements packs.

---

## 16. Done Checklist (MVP)
- Casting Circle creates a valid Story Dimension.  
- Compiler outputs a deterministic `CompiledStory`.  
- Character creator emits layered character and posts to start a game.  
- MAS1 → Engine → MAS2 loop updates state and produces narrative.  
- E2E test passes on CI for a seed scenario.  
- Deployed FE on Cloudflare, BE on Fly, DB on Supabase.

