# StoneCaster Prompt System Discovery
## Product Manager + Architect View

**Document Purpose**: Comprehensive architectural analysis of the prompt creation, assembly, and delivery system in StoneCaster, designed for product planning and feature development roadmapping.

**Last Updated**: January 2025  
**Target Audience**: Product Managers, Architects, Feature Developers

---

## Executive Summary

StoneCaster employs a **database-first, layered prompt assembly system** that has evolved from filesystem-based loading to a fully database-backed pipeline. The system supports:

- **Multi-layer composition** (Core → Ruleset → World → Entry → NPC → Dynamic Runtime)
- **Token budget management** with intelligent truncation policies
- **Role-based admin interfaces** for prompt authoring and management
- **Variable interpolation** for dynamic context injection
- **Deterministic assembly** with full audit trails

**Current State**: Production-ready for core, world, entry point, and NPC prompts using the active `prompt_segments` system.

---

## ⚠️ IMPORTANT: Active vs Legacy Systems

**This document describes both active and legacy prompt systems.** Always verify which system you're working with.

### ✅ Active System (USE THIS)

**Admin Content Tables**:
- `worlds` → `worlds.prompt` (text field)
- `rulesets` → `rulesets.prompt` (text field)
- `entry_points` → `entry_points.prompt` / `entry_points.content` (jsonb)
- `npcs` → `npcs.prompt` (jsonb)

**Assembly Table**:
- `prompt_segments` (scopes: core, ruleset, world, entry, entry_start, npc)

**Assembler**:
- `src/prompt/assembler/` (TypeScript, deterministic assembly with audit)

**Key Points**:
- Scenarios are `entry_points` with `type='scenario'` - they use `entry` and `entry_start` scopes
- **No separate scenario scope exists**
- Multi-ruleset support via `entry_point_rulesets` junction table

📖 **Full Documentation**: [docs/prompt-system/ACTIVE_SYSTEM.md](./prompt-system/ACTIVE_SYSTEM.md)

### ❌ Legacy Systems (DO NOT USE)

**Deprecated Tables**:
- `prompting.prompts` (layer-based, unused)
- Early `prompts` table from `005_prompts_table.sql`

**Deprecated Code**:
- `backend/src/prompts/database-prompt-assembler.ts` (uses `prompting.prompts`)
- `backend/src/prompts/wrapper.ts` (old PromptWrapper)

**Why Deprecated**:
- Used `layer` instead of `scope` terminology
- Had `adventure_slug` instead of `entry_point_id`
- Never integrated with current `entry_points` architecture
- No multi-ruleset support

📖 **Full Documentation**: [docs/prompt-system/LEGACY_SYSTEMS.md](./prompt-system/LEGACY_SYSTEMS.md)

---

## 1. System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         ADMIN UI (Frontend)                      │
│  /admin/prompts → PromptAdmin.tsx                               │
│  • CRUD operations on prompts                                    │
│  • Token count estimation                                        │
│  • Category/subcategory tagging                                  │
│  • Dependency validation                                         │
└─────────────────┬───────────────────────────────────────────────┘
                  │ HTTP (REST API)
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND API (Node/Express)                    │
│  Routes: /api/admin/prompts                                     │
│  Services: PromptsService, DatabasePromptService                │
│  Assemblers: DatabasePromptAssembler, PromptWrapper            │
└─────────────────┬───────────────────────────────────────────────┘
                  │ Supabase Client
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                   SUPABASE POSTGRES DATABASE                     │
│  Schema: prompting.prompts (admin authoring)                    │
│  Schema: public.prompt_segments (runtime assembly)              │
│  RPC: prompting.prompt_segments_for_context()                  │
└─────────────────┬───────────────────────────────────────────────┘
                  │ Query & Fetch
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PROMPT ASSEMBLY ENGINE                        │
│  src/prompt/assembler/assembler.ts                              │
│  • Fetches segments by scope (core/ruleset/world/entry/npc)    │
│  • Injects dynamic layers (game_state/player/rng/input)        │
│  • Applies token budgets and truncation policies               │
│  • Returns final prompt string + metadata                       │
└─────────────────┬───────────────────────────────────────────────┘
                  │ Assembled Prompt
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                       GAME SESSION START                         │
│  POST /api/games/:id/turn                                       │
│  • First turn: includes entry_start segments                    │
│  • Ongoing turns: dynamic context updates                       │
│  • Sends prompt to AI provider (OpenAI, Anthropic, etc.)       │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow: Admin → Player

```
1. Admin creates/edits prompt
   ↓
2. Stored in prompting.prompts table (with metadata, sort_order, layer)
   ↓
3. Ingestion script converts to prompt_segments (if using dual schema)
   ↓
4. Player starts game → PromptsService.createInitialPrompt()
   ↓
5. DatabasePromptAssembler.assemblePrompt() fetches segments
   ↓
6. Assembler combines layers in order: CORE → WORLD → ADVENTURE → PLAYER → INPUT
   ↓
7. Token budget enforced, truncation applied if needed
   ↓
8. Final prompt sent to AI model
   ↓
9. AI response returned to player as narrative
```

---

## 2. Backend Architecture

### 2.1 API Endpoints

#### Admin Prompt Management (`/api/admin/prompts`)

| Endpoint | Method | Purpose | Auth Required |
|----------|--------|---------|---------------|
| `/api/admin/prompts` | GET | List prompts with filters (layer, active, search) | Admin role |
| `/api/admin/prompts/:id` | GET | Fetch single prompt by ID | Admin role |
| `/api/admin/prompts` | POST | Create new prompt | Admin role |
| `/api/admin/prompts/:id` | PUT | Update prompt content/metadata | Admin role |
| `/api/admin/prompts/:id` | DELETE | Delete prompt | Admin role |
| `/api/admin/prompts/:id/toggle-active` | PATCH | Toggle active status | Admin role |
| `/api/admin/prompts/:id/toggle-locked` | PATCH | Toggle locked status | Admin role |
| `/api/admin/prompts/stats` | GET | Get prompt statistics by layer | Admin role |
| `/api/admin/prompts/validate-dependencies` | POST | Validate prompt dependencies | Admin role |

**Authentication**: All admin endpoints require:
- Valid Supabase session token
- User role metadata includes `prompt_admin` OR service-role token

**Validation**: All write operations use Zod schemas to validate:
- `layer` ∈ {core, world, adventure, adventure_start, optional}
- `turn_stage` ∈ {any, start, ongoing, end}
- `content` (text, required)
- `metadata` (JSONB, includes category, subcategory, dependencies)

### 2.2 Core Services

#### `PromptsService` (`backend/src/services/prompts.service.ts`)

**Responsibilities**:
- Orchestrates prompt assembly for game initialization and turn processing
- Delegates to `DatabasePromptAssembler` for segment fetching
- Logs assembled prompts to debug service for audit trails

**Key Methods**:
- `createInitialPrompt(game: GameContext): Promise<string>`  
  Creates the first prompt when a game session begins
- `buildPrompt(game: GameContext, optionId: string): Promise<string>`  
  Builds subsequent turn prompts with player input

**Dependencies**:
- `DatabasePromptService` (for segment queries)
- `PromptWrapper` (legacy fallback, being phased out)
- `DebugService` (for prompt logging)

#### `DatabasePromptAssembler` (`backend/src/prompts/database-prompt-assembler.ts`)

**Responsibilities**:
- Fetches prompt segments from Supabase based on context (world, adventure, scene)
- Performs variable interpolation (e.g., `{world_slug}`, `{character.name}`)
- Combines segments in prescribed load order
- Enforces token budgets and applies truncation policies

**Key Methods**:
- `assemblePrompt(params: DatabasePromptParams): Promise<DatabasePromptResult>`
  - Inputs: `worldSlug`, `adventureSlug`, `startingSceneId`, `includeEnhancements`
  - Outputs: `promptText`, `audit` (segment IDs used), `metadata` (token counts)

**Load Order** (Authority Hierarchy):
1. **Foundation Layer**: World lore & logic
2. **Core Systems**: Universal mechanics, UI standards
3. **Engine Layer**: RPG storyteller core, AWF contract, JSON schema
4. **AI Behavior**: Presence & guardrails
5. **Data Management**: Save/load protocols, validation rules
6. **Performance Layer**: Benchmarks & optimization guidance
7. **Content Layer**: Adventure-specific content
8. **Enhancement Layer**: Optional expansions

### 2.3 Database Schema

#### `prompting.prompts` (Admin Authoring Table)

```sql
CREATE TABLE prompting.prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layer VARCHAR(50) NOT NULL,           -- core, world, adventure, adventure_start, optional
  world_slug VARCHAR(100),              -- NULL for core/system prompts
  adventure_slug VARCHAR(100),          -- NULL for non-adventure prompts
  scene_id VARCHAR(100),                -- NULL for non-scene prompts
  turn_stage VARCHAR(50) DEFAULT 'any', -- start, ongoing, end, any
  sort_order INTEGER NOT NULL DEFAULT 0,-- Load order within layer
  version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  hash VARCHAR(64) NOT NULL,            -- SHA256 hash for change detection
  content TEXT NOT NULL,                -- The actual prompt content
  metadata JSONB DEFAULT '{}',          -- category, subcategory, dependencies, etc.
  active BOOLEAN NOT NULL DEFAULT true,
  locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);
```

**Indexes**:
- `idx_prompts_world_adventure` on `(world_slug, adventure_slug) WHERE active = true`
- `idx_prompts_layer_sort` on `(layer, sort_order) WHERE active = true`
- `idx_prompts_scene` on `(scene_id) WHERE active = true AND scene_id IS NOT NULL`
- `idx_prompts_turn_stage` on `(turn_stage) WHERE active = true`
- `idx_prompts_hash` on `(hash)` for change detection

#### `public.prompt_segments` (Runtime Assembly Table)

```sql
CREATE TABLE prompt_segments (
  id BIGSERIAL PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN (
    'core', 'ruleset', 'world', 'entry', 'entry_start', 'npc',
    'game_state', 'player', 'rng', 'input'
  )),
  ref_id TEXT,                      -- Target identifier (e.g., world ID, NPC ID)
  version TEXT NOT NULL DEFAULT '1.0.0',
  active BOOLEAN NOT NULL DEFAULT true,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Scope Definitions**:
- **Static Scopes** (stored in database):
  - `core`: System-wide prompts (always included)
  - `ruleset`: Ruleset-specific mechanics
  - `world`: World lore and rules
  - `entry`: Entry point main prompts
  - `entry_start`: Entry start prompts (first turn only)
  - `npc`: NPC-specific prompts
- **Dynamic Scopes** (generated at runtime, NOT stored):
  - `game_state`: Current game state snapshot
  - `player`: Character data and stats
  - `rng`: Random seed for determinism
  - `input`: Player's current action/input

### 2.4 Prompt Assembly Logic

The assembly engine (`src/prompt/assembler/assembler.ts`) follows a strict deterministic process:

#### Assembly Order

```javascript
const STATIC_ORDER = [
  'core',       // Step 1: System-wide rules
  'ruleset',    // Step 2: Ruleset-specific mechanics
  'world',      // Step 3: World context
  'entry',      // Step 4: Entry point content
  'entry_start',// Step 5: Entry start (first turn only)
  'npc'         // Step 6: NPC context
];

const DYNAMIC_ORDER = [
  'game_state', // Step 7: Game snapshot
  'player',     // Step 8: Character data
  'rng',        // Step 9: Random seed
  'input'       // Step 10: Player action
];
```

#### Token Budget Management

**Default Budgets**:
- Total prompt budget: 8000 tokens (configurable)
- NPC section budget: 600 tokens (configurable)
- Token estimation: ~4 characters per token

**Truncation Policy** (applied in order):
1. Trim `INPUT` text (max 2000 chars, preserve first/last context)
2. Compress `GAME_STATE` (summarize if over budget)
3. Drop `RNG` section (least critical)
4. Drop `PLAYER` section (AI can infer from context)
5. **Never drop** `CORE`, `RULESET`, or `WORLD` (critical layers)

**Markdown Delimiters**:
```
=== CORE_BEGIN ===
[Core content]
=== CORE_END ===

=== WORLD_BEGIN ===
[World content]
=== WORLD_END ===
```

These delimiters enable:
- Deterministic parsing by AI models
- Section-level truncation
- Audit trail reconstruction

---

## 3. Frontend Architecture

### 3.1 Admin UI Components

#### `PromptAdmin.tsx` (`frontend/src/pages/admin/PromptAdmin.tsx`)

**Purpose**: Full CRUD interface for prompt management

**Features**:
- **Table View**: Lists all prompts with filters (layer, active status, search)
- **Token Count Column**: Server-side estimation displayed per prompt
- **Create/Edit Modal**: Multi-tab interface:
  - **Basic Info**: Layer, world/adventure slugs, sort order
  - **Content**: Large textarea with Markdown support
  - **Dependencies**: Tag-based dependency tracking
  - **Metadata**: JSON editor for custom fields
- **Category/Subcategory Pickers**: Logical groupings within layers
- **Active/Locked Toggles**: Quick status changes
- **Stats Dashboard**: Layer-wise counts (total, active, locked)

**State Management**:
- Uses custom `useAdminService` hook
- Local state for filters and editing
- No React Query (direct API calls)

#### `WorldEditPage.tsx` (`frontend/src/pages/admin/worlds/edit.tsx`)

**Legacy Feature**: Worlds have a `prompt` JSONB field (filesystem era)

**Current Usage**: Mostly deprecated; world prompts now live in `prompting.prompts` table with `layer = 'world'`

**Migration Path**: Existing world prompts should be ingested into the new system

### 3.2 Player-Facing Components

#### `GamePage.tsx` / `UnifiedGamePage.tsx`

**Purpose**: Main game interface where players see AI-generated narrative

**Prompt Visibility**: Players **never see** the assembled prompt. They only see:
- AI-generated narrative text
- Choice options
- Character state updates

**Data Flow**:
1. Player loads game → React Query fetches game state
2. Player submits action → POST `/api/games/:id/turn`
3. Backend assembles prompt (invisible to player)
4. AI generates response
5. Response returned to frontend as narrative

**State Management**:
- React Query hooks:
  - `useQuery(['game', gameId])` - Game state
  - `useQuery(['adventure', adventureId])` - Adventure metadata
  - `useMutation` - Turn submission
- Session storage for initialization tracking

### 3.3 State Management Patterns

#### Admin UI
- **No React Query** for prompts admin
- Direct `AdminService` calls with local state caching
- Toast notifications for success/error feedback

#### Player UI
- **React Query** for all game data
- 30-second stale time for game state
- Optimistic updates on turn submission
- Automatic refetch after mutations

---

## 4. Prompt Assembly Logic Deep Dive

### 4.1 Variable Interpolation

The system supports template variables in prompt content:

**Character Variables**:
```
{character.name}
{character.race}
{character.class}
{character.essence}
{character.backstory}
{character.skills}
```

**Game Variables**:
```
{game.id}
{game.turn_index}
{game.current_scene}
{game.summary}
```

**World Variables**:
```
{world.name}
{world.setting}
{world.genre}
{world.lore}
```

**Adventure Variables**:
```
{adventure.name}
{adventure.objectives}
{adventure.scenes}
```

**Implementation**: Variables are replaced in `DatabasePromptAssembler.processSegment()` using a context object built from game state.

### 4.2 NPC Integration

NPCs are dynamically included based on:
1. **Scenario fixed party/cast** (from `ScenarioDocV1`)
2. **Adventure cast** (if present)
3. **Game hot/warm state** (relationships, pins, active encounters)

**NPC Selection Logic** (`backend/src/assemblers/npc-collector.ts`):
- Collects NPC refs from all sources
- De-duplicates by NPC ID
- Applies cap from ruleset (default: 5 active NPCs)

**NPC Tier System**:
- Each NPC segment has a `tier` (0-3)
- Higher tiers = more detail
- Token budget determines max tier included:
  - Tier 0: Basic presence (name, role)
  - Tier 1: Personality traits
  - Tier 2: Backstory and relationships
  - Tier 3: Full context (motivations, secrets)

**NPC Budget Enforcement** (`src/prompt/assembler/npc.ts`):
- Default NPC budget: 600 tokens
- If over budget, progressively drop higher tiers
- Indicator added to prompt: `[NPC tier dropped from 3 to 1 due to budget]`

### 4.3 First Turn vs. Ongoing Turns

#### First Turn (`isFirstTurn = true`)
- Includes `entry_start` segments
- No `GAME_STATE` section (fresh start)
- Full world lore and adventure setup
- NPC introductions

#### Ongoing Turns (`isFirstTurn = false`)
- Excludes `entry_start` segments
- Includes `GAME_STATE` with recent history
- Compressed world lore (only if budget allows)
- NPC context based on active relationships

### 4.4 Token Estimation

**Heuristic**: ~4 characters per token (simple approximation)

**Implementation**:
```typescript
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}
```

**Production Consideration**: For higher accuracy, integrate `tiktoken` (OpenAI's tokenizer) or model-specific tokenizers.

---

## 5. Data Contracts

### 5.1 Key Interfaces

#### `DatabasePromptParams`
```typescript
interface DatabasePromptParams {
  worldSlug: string;
  adventureSlug: string;
  startingSceneId: string | null;
  includeEnhancements: boolean;
}
```

#### `DatabasePromptResult`
```typescript
interface DatabasePromptResult {
  promptText: string;
  audit: {
    segmentIds: string[];
    loadOrder: string[];
    assembledAt: string;
  };
  metadata: {
    totalSegments: number;
    tokenCount: number;
    layers: string[];
  };
}
```

#### `AssembleArgs`
```typescript
interface AssembleArgs {
  entryPointId: string;
  worldId: string;
  rulesetId: string;
  gameId: string;
  isFirstTurn: boolean;
  npcs?: Array<{ npcId: string; tier: number }>;
  locale?: string;
  tokenBudget?: number;
  npcTokenBudget?: number;
}
```

#### `AssembleResult`
```typescript
interface AssembleResult {
  prompt: string;
  meta: {
    order: Scope[];
    segmentIdsByScope: Record<Scope, number[]>;
    tokensEstimated: number;
    truncated?: TruncationMeta;
  };
}
```

### 5.2 Prompt Metadata Structure

**Admin UI Metadata** (stored in `prompting.prompts.metadata`):
```json
{
  "category": "logic",
  "subcategory": "npc_agency",
  "dependencies": ["core.rpg_base", "world.mystika.lore"],
  "format": "markdown",
  "variables": ["character.name", "world.setting"],
  "version": "1.0.0"
}
```

**Segment Metadata** (stored in `prompt_segments.metadata`):
```json
{
  "tier": 2,
  "priority": 10,
  "tags": ["mystery", "forest"],
  "content_rating": "safe"
}
```

### 5.3 Scenario Structure (AWF)

**ScenarioDocV1** (`backend/src/types/awf-scenario.ts`):
```typescript
interface ScenarioDocV1 {
  id: string;
  slug: string;
  title: string;
  synopsis: string;
  world_id: string;
  ruleset_id: string;
  fixed_npcs?: Array<{ npc_ref: string; tier: number }>;
  opening: {
    scene_id: string;
    narrative: string;
  };
  acts?: Array<{
    id: string;
    title: string;
    scenes: string[];
  }>;
}
```

**Current Gap**: Scenarios do NOT have dedicated prompt fields. They rely on:
- World prompts (inherited)
- Adventure prompts (if scenario is treated as mini-adventure)
- Entry point prompts (generic)

**Opportunity**: Add `scenario_prompts` table or extend `prompting.prompts` with `scenario_slug` field.

---

## 6. Data Flow Diagrams

### 6.1 Admin Creates Prompt

```
Admin User (Browser)
    ↓ [Opens /admin/prompts]
PromptAdmin.tsx
    ↓ [Fills form: layer, content, metadata]
    ↓ [Clicks "Save"]
AdminService.createPrompt()
    ↓ [POST /api/admin/prompts]
Express Router (/api/admin/prompts)
    ↓ [authenticateToken + requireAdminRole middleware]
PromptController.create()
    ↓ [Validates with Zod]
    ↓ [Calculates token estimate]
Supabase Client
    ↓ [INSERT INTO prompting.prompts]
PostgreSQL Database
    ↓ [Returns created record]
Response to Admin UI
    ↓ [Toast: "Prompt created successfully"]
```

### 6.2 Player Starts Game

```
Player (Browser)
    ↓ [Clicks "Start Adventure"]
    ↓ [POST /api/games]
GamesController.create()
    ↓ [Creates game record]
    ↓ [Calls PromptsService.createInitialPrompt()]
PromptsService
    ↓ [Builds DatabasePromptParams]
    ↓ [Calls DatabasePromptAssembler.assemblePrompt()]
DatabasePromptAssembler
    ↓ [SELECT FROM prompt_segments WHERE scope IN (...)]
    ↓ [Fetches: core, ruleset, world, entry, entry_start, npc]
    ↓ [Performs variable interpolation]
    ↓ [Combines segments in order]
    ↓ [Applies token budget and truncation]
    ↓ [Returns final prompt string]
PromptsService
    ↓ [Logs to DebugService]
    ↓ [Sends prompt to OpenAI API]
OpenAI API
    ↓ [Returns AI-generated narrative]
GamesController
    ↓ [Saves first turn to database]
    ↓ [Returns narrative to player]
Player UI
    ↓ [Displays narrative in GamePage]
```

### 6.3 Player Submits Turn

```
Player (Browser)
    ↓ [Types action, clicks "Submit"]
    ↓ [POST /api/games/:id/turn]
GamesController.createTurn()
    ↓ [Increments turn_count]
    ↓ [Calls PromptsService.buildPrompt(game, optionId)]
PromptsService
    ↓ [Builds DatabasePromptParams (same world/adventure)]
DatabasePromptAssembler
    ↓ [Fetches: core, ruleset, world, entry, npc (NO entry_start)]
    ↓ [Adds dynamic layers: game_state, player, rng, input]
    ↓ [INPUT = player's typed action]
    ↓ [Applies token budget]
    ↓ [Returns prompt]
PromptsService
    ↓ [Sends to OpenAI]
OpenAI API
    ↓ [Returns response]
GamesController
    ↓ [Saves turn to database]
    ↓ [Invalidates React Query cache]
Player UI
    ↓ [React Query refetches game]
    ↓ [New turn appears in history]
```

---

## 7. Gaps & TODOs

### 7.1 Scenario Prompt Infrastructure (Current Gap)

**Problem**: Scenarios currently lack dedicated prompt fields. They inherit from:
- World prompts (too generic)
- Adventure prompts (if treated as mini-adventure)
- Entry point prompts (not scenario-specific)

**Impact**: Scenario authors cannot specify:
- Opening flavor text / tone
- Scenario-specific NPC instructions
- Scene transition guidance
- Act-specific directives

**Recommendation**: See Section 8 (Suggested Next Phases)

### 7.2 Preview/Lint in Admin UI (Partially Implemented)

**Status**: `PromptAdmin.tsx` has preview tabs, but no live assembly preview.

**Gap**: Admins cannot see:
- How their prompt will be interpolated with real game data
- Token count impact in full assembled context
- Validation errors until save attempt

**Recommendation**: Add "Preview Assembly" button that:
1. Accepts mock context (world, character, game state)
2. Calls `/api/admin/prompts/preview` (new endpoint)
3. Returns assembled prompt + token breakdown
4. Highlights truncation warnings

### 7.3 Version Control & Rollback

**Current State**: `prompts.version` field exists but is manually managed.

**Gap**: No automatic versioning, no rollback UI, no diff viewer.

**Recommendation**:
- Implement `prompts_history` table (append-only log)
- Trigger on `UPDATE prompting.prompts` to snapshot old version
- Add "History" tab in `PromptAdmin.tsx` with diff viewer
- Add "Restore Version" button

### 7.4 Dependency Validation (Stub Implemented)

**Status**: `validateDependencies()` RPC exists but is a stub.

**Gap**: Admins can enter invalid dependencies in `metadata.dependencies` array.

**Recommendation**:
- Implement RPC to validate dependency refs against active prompts
- Return warnings for missing dependencies
- Show dependency graph in admin UI

### 7.5 Token Estimation Accuracy

**Current State**: Simple heuristic (~4 chars per token)

**Gap**: Inaccurate for:
- Non-English text
- Code blocks
- Special tokens

**Recommendation**:
- Integrate `tiktoken` (OpenAI) or `transformers` (Anthropic) tokenizers
- Store model-specific counts in `prompts.metadata.token_counts`
- Support multi-model targeting (GPT-4, Claude, etc.)

### 7.6 Real-Time Collaboration (Not Implemented)

**Gap**: No conflict resolution if multiple admins edit same prompt.

**Recommendation**:
- Add optimistic locking (version number check on save)
- Show "Prompt locked by [user]" if another admin is editing
- Supabase Realtime channels for live presence

### 7.7 Prompt Testing & A/B Testing (Not Implemented)

**Gap**: No way to test prompts against historical game states.

**Recommendation**:
- Add "Test Prompt" feature:
  - Select past game state as test case
  - Assemble prompt with new version
  - Compare AI output (side-by-side)
- Add A/B testing framework:
  - Duplicate prompt with `metadata.experiment = "variant_a"`
  - Route 50% of sessions to each variant
  - Collect feedback metrics

### 7.8 Localization Support (Stub Implemented)

**Status**: `locale` parameter exists in assembly logic but no i18n prompts.

**Gap**: All prompts are English-only.

**Recommendation**:
- Add `prompts.locale` column (default: 'en')
- Duplicate prompts per locale
- Assembly logic fetches locale-specific segments
- Admin UI: "Translate" button to create locale variants

---

## 8. Suggested Next Phases

### Phase 1: Scenario Prompt Infrastructure (Priority: HIGH)

**Goal**: Enable scenario authors to create scenario-specific prompts.

**Tasks**:
1. **Schema Extension**:
   - Add `scenario_slug` column to `prompting.prompts` table
   - Add `scenario` layer type (or reuse `adventure` with `scenario_slug` set)
   - Migration: `ALTER TABLE prompting.prompts ADD COLUMN scenario_slug VARCHAR(100)`

2. **Backend Updates**:
   - Update `DatabasePromptAssembler` to fetch scenario prompts
   - Insert scenario layer after `world` but before `entry` in load order
   - Update Zod schemas to allow `scenario_slug`

3. **Admin UI**:
   - Add "Scenario" to layer dropdown in `PromptAdmin.tsx`
   - Add scenario slug picker (autocomplete from `entry_points` where `type = 'scenario'`)
   - Add category suggestions: `opening`, `act_transitions`, `npc_context`, `tone`

4. **Testing**:
   - Create 3 test scenarios with unique prompts
   - Verify assembly order: `core → world → scenario → entry → ...`
   - Validate token budgets with scenario prompts included

**Deliverables**:
- Migration script: `migrations/20250201_add_scenario_prompts.sql`
- Updated API docs: `docs/API_CONTRACT.md`
- Admin guide: `docs/authoring/SCENARIO_PROMPTS.md`

---

### Phase 2: Preview & Live Assembly (Priority: MEDIUM)

**Goal**: Let admins preview assembled prompts with mock data.

**Tasks**:
1. **New API Endpoint**: `POST /api/admin/prompts/preview`
   - Accepts: `prompt_id`, `mock_context` (world, character, game state)
   - Returns: Assembled prompt, token breakdown, truncation warnings

2. **Frontend**:
   - Add "Preview" button in `PromptAdmin.tsx` edit modal
   - Modal dialog showing:
     - Full assembled prompt (read-only)
     - Token count per layer
     - Truncation warnings (if any)
     - Variable interpolation results

3. **Mock Context Builder**:
   - Pre-populate with sample character ("Test Hero")
   - Pre-populate with sample game state (turn 1, mystika world)
   - Allow admin to customize mock data

**Deliverables**:
- Endpoint: `/api/admin/prompts/preview`
- Component: `PromptPreviewModal.tsx`
- User story: "As a prompt admin, I can preview how my prompt will look in a real game"

---

### Phase 3: Versioning & History (Priority: MEDIUM)

**Goal**: Track prompt changes and enable rollback.

**Tasks**:
1. **Schema**:
   - Create `prompting.prompts_history` table (append-only)
   - Trigger: `AFTER UPDATE ON prompting.prompts` → insert old version into history

2. **API**:
   - `GET /api/admin/prompts/:id/history` - list versions
   - `POST /api/admin/prompts/:id/restore/:version` - restore old version

3. **UI**:
   - Add "History" tab in prompt editor
   - Show version list with timestamps, author, change summary
   - Add "Diff" view (side-by-side content comparison)
   - Add "Restore" button per version

**Deliverables**:
- Migration: `migrations/20250215_prompt_versioning.sql`
- Component: `PromptHistoryTab.tsx`

---

### Phase 4: Dependency Management (Priority: LOW)

**Goal**: Validate and visualize prompt dependencies.

**Tasks**:
1. **RPC Implementation**:
   - Implement `prompting.validate_prompt_dependencies()`
   - Check `metadata.dependencies` array against active prompts
   - Return missing dependency warnings

2. **UI**:
   - Show dependency graph (D3.js or Mermaid)
   - Highlight broken dependencies in red
   - Auto-complete dependency refs when typing

**Deliverables**:
- RPC: `validate_prompt_dependencies.sql`
- Component: `DependencyGraph.tsx`

---

### Phase 5: Token Budget Dashboard (Priority: LOW)

**Goal**: Give admins visibility into token usage across all prompts.

**Tasks**:
1. **Analytics**:
   - Calculate total token count per layer
   - Calculate average prompt size per world/adventure
   - Identify prompts over 1000 tokens (flag for review)

2. **UI**:
   - Dashboard widget: "Token Usage by Layer" (bar chart)
   - Dashboard widget: "Top 10 Largest Prompts" (table)
   - Alert if core prompts exceed 2000 tokens

**Deliverables**:
- Endpoint: `/api/admin/prompts/token-stats`
- Component: `TokenUsageDashboard.tsx`

---

## 9. Architecture Decision Records (ADRs)

### ADR-001: Database-Only Prompts (Adopted)

**Context**: Original system loaded prompts from filesystem (`AI API Prompts/*.json`).

**Decision**: Migrate to database-backed storage using `prompting.prompts` table.

**Rationale**:
- Enables role-based access control (RLS)
- Supports versioning and audit trails
- Allows hot-reloading without server restart
- Provides admin UI for non-technical authors

**Trade-offs**:
- Increased database load (mitigated by caching)
- Migration complexity (solved by ingestion script)

**Status**: Implemented (see `docs/adr/001-db-only-prompts.md`)

---

### ADR-002: Markdown Delimiters (Adopted)

**Context**: Need deterministic section parsing.

**Decision**: Use strict delimiters: `=== SECTION_BEGIN ===` / `=== SECTION_END ===`

**Rationale**:
- AI models can parse deterministically
- Enables section-level truncation
- Simplifies audit trail reconstruction

**Trade-offs**:
- Adds boilerplate to prompt content
- Requires consistent formatting discipline

**Status**: Implemented (see `src/prompt/assembler/markdown.ts`)

---

### ADR-003: Token Budget Hierarchy (Adopted)

**Context**: Need fair truncation policy when over budget.

**Decision**: Never drop `CORE`, `RULESET`, or `WORLD`. Drop dynamic layers first.

**Rationale**:
- Core layers define game rules (critical)
- Dynamic layers can be inferred from context (less critical)

**Trade-offs**:
- May result in truncated player input (mitigated by summarization)

**Status**: Implemented (see `src/prompt/assembler/budget.ts`)

---

## 10. Technology Stack Summary

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Frontend** | React 18 + Vite | Admin UI and player UI |
| **State Management** | React Query + Local State | Data fetching and caching |
| **Backend** | Node.js + Express | REST API server |
| **Database** | Supabase (PostgreSQL) | Prompt storage and RLS |
| **Authentication** | Supabase Auth | Admin role verification |
| **Validation** | Zod | Schema validation |
| **Token Estimation** | Custom heuristic (~4 char/token) | Budget management |
| **AI Providers** | OpenAI, Anthropic (via API) | Narrative generation |

---

## 11. Security & Compliance

### Role-Based Access Control (RBAC)

**Admin Role Required**: All `/api/admin/prompts/*` endpoints check:
1. Valid Supabase JWT token
2. User metadata includes `role: 'prompt_admin'` OR service-role key

**Row-Level Security (RLS)**:
- `prompting.prompts` table has RLS policies:
  - `SELECT`: Public (for assembly), Admin (for management)
  - `INSERT/UPDATE/DELETE`: Admin only

### Audit Trails

**Prompt Changes**:
- `created_by` and `updated_by` fields track authorship
- `created_at` and `updated_at` timestamps
- Hash field (`hash`) for change detection

**Assembly Logs**:
- `DebugService.logPrompt()` stores assembled prompts per game/turn
- Includes segment IDs, load order, token counts

### Data Privacy

**No PII in Prompts**: Prompts should never contain:
- Real player names (use `{character.name}` variable)
- Real email addresses
- Real payment info

**Sanitization**: All user-generated content is sanitized before interpolation.

---

## 12. Performance Considerations

### Caching Strategy

**Database Queries**:
- `prompt_segments` queries are cached in-memory for 5 minutes
- Cache key: `world_slug:adventure_slug:scene_id`

**Frontend**:
- React Query: 30-second stale time for game data
- Admin UI: No caching (always fetch latest)

### Database Indexes

All high-traffic queries use indexes:
- `(world_slug, adventure_slug)` for prompt fetching
- `(layer, sort_order)` for assembly order
- `(scene_id)` for scene-specific prompts

### Token Estimation Speed

- Simple character count (~4 char/token) is O(n) where n = prompt length
- Average prompt: 8000 chars → 2ms estimation time
- No external API calls required

---

## 13. Testing Strategy

### Unit Tests

**Backend**:
- `DatabasePromptAssembler.test.ts`:
  - Test segment fetching
  - Test variable interpolation
  - Test token budget enforcement
  - Test truncation policies

**Frontend**:
- `PromptAdmin.test.tsx`:
  - Test CRUD operations
  - Test filter logic
  - Test metadata validation

### Integration Tests

**Prompt Assembly Flow**:
- Seed database with test prompts
- Start mock game
- Assert correct segments fetched
- Assert correct order
- Assert token count within budget

### E2E Tests (Playwright)

**Admin Flow**:
1. Login as admin
2. Navigate to `/admin/prompts`
3. Create new prompt
4. Verify prompt appears in list
5. Edit prompt
6. Verify changes saved

**Player Flow**:
1. Login as player
2. Start new game
3. Verify first turn narrative (backend assembled prompt correctly)
4. Submit action
5. Verify response (backend assembled ongoing turn correctly)

---

## 14. Monitoring & Observability

### Metrics to Track

1. **Prompt Assembly Time**:
   - Measure: Time from `assemblePrompt()` call to return
   - Target: < 100ms (p95)

2. **Token Budget Violations**:
   - Count: How often truncation is triggered
   - Alert: If > 10% of turns require truncation

3. **Admin API Latency**:
   - Measure: Time for prompt CRUD operations
   - Target: < 200ms (p95)

4. **Prompt Sizes**:
   - Histogram: Token counts per layer
   - Alert: If any layer exceeds 3000 tokens

### Logging

**Backend Logs** (structured JSON):
```json
{
  "level": "info",
  "message": "Prompt assembled",
  "gameId": "uuid",
  "worldSlug": "mystika",
  "totalTokens": 7850,
  "segmentCount": 12,
  "truncated": false,
  "assemblyTimeMs": 45
}
```

**Error Logging**:
- All prompt assembly errors logged with full context
- TraceId included for support escalation

---

## 15. Glossary

| Term | Definition |
|------|------------|
| **AWF** | Adventure World Format - JSON schema for worlds and scenarios |
| **Bundle** | Complete assembled prompt sent to AI provider |
| **Core Contract** | Base ruleset defining game mechanics |
| **Entry Point** | Starting location for a game (adventure, scenario, sandbox, quest) |
| **Layer** | Hierarchical grouping of prompts (core, world, adventure, etc.) |
| **NPC Tier** | Detail level for NPCs (0 = minimal, 3 = full backstory) |
| **Prompt Segment** | Atomic unit of prompt content stored in database |
| **RLS** | Row-Level Security (Supabase access control) |
| **Scope** | Runtime category for prompt segments (core, world, npc, etc.) |
| **Token Budget** | Maximum tokens allowed in assembled prompt |
| **Truncation Policy** | Rules for dropping content when over budget |

---

## 16. References & Related Docs

### Internal Documentation
- `docs/prompt/ASSEMBLER.md` - Assembler technical spec
- `docs/PROMPT_MIGRATION_PLAN.md` - DB migration guide
- `docs/API_CONTRACT.md` - API endpoint reference
- `docs/adr/001-db-only-prompts.md` - ADR for DB-first approach
- `backend/src/prompts/README.md` - Backend implementation guide

### Code Locations
- **Backend Assembler**: `backend/src/prompts/database-prompt-assembler.ts`
- **Frontend Admin**: `frontend/src/pages/admin/PromptAdmin.tsx`
- **Shared Types**: `shared/src/types/awf-scenario.ts`
- **Database Schema**: `supabase/migrations/20250103000000_create_prompting_schema.sql`

### External Resources
- Supabase RLS Docs: https://supabase.com/docs/guides/auth/row-level-security
- OpenAI Tokenizer: https://github.com/openai/tiktoken
- React Query Docs: https://tanstack.com/query

---

## Appendix A: Sample Prompt Assembly

### Input Context
```json
{
  "worldSlug": "mystika",
  "adventureSlug": "crystal-quest",
  "startingSceneId": "scene.mystika.forest_entrance",
  "characterName": "Aria",
  "characterRace": "Elf",
  "playerInput": "I examine the glowing crystal"
}
```

### Assembled Prompt (Simplified)

```
=== CORE_BEGIN ===
You are a fantasy RPG narrator. Follow these rules:
- Generate narrative in second person
- Provide 3-4 choice options per turn
- Maintain world consistency
=== CORE_END ===

=== WORLD_BEGIN ===
World: Mystika
Setting: High-magic fantasy realm where crystals power civilization
Key NPCs: Crystal Keepers, Corrupted Mages
=== WORLD_END ===

=== ADVENTURE_BEGIN ===
Adventure: The Crystal Quest
Synopsis: Investigate mysterious crystal corruption
Objectives:
- Find the corrupted crystal source
- Restore balance to the forest
=== ADVENTURE_END ===

=== PLAYER_BEGIN ===
Character: Aria (Elf)
Skills: { lore: 65, stealth: 55, social: 50 }
Inventory: [Elven Cloak, Crystal Detector]
=== PLAYER_END ===

=== RNG_BEGIN ===
Seed: 1704124800
=== RNG_END ===

=== INPUT_BEGIN ===
I examine the glowing crystal
=== INPUT_END ===
```

### Metadata
```json
{
  "totalTokens": 1850,
  "segmentCount": 6,
  "loadOrder": ["core", "world", "adventure", "player", "rng", "input"],
  "truncated": false,
  "assemblyTimeMs": 42
}
```

---

## Appendix B: Prompt Categories by Layer

### Core Layer Categories
- `logic` - Game mechanics and rules
- `output_rules` - Response formatting
- `npc_agency` - NPC behavior guidelines
- `failsafes` - Safety and content policies

### World Layer Categories
- `world_rules` - World-specific mechanics
- `world_npcs` - World-wide NPCs
- `world_events` - Global events and phenomena

### Adventure Layer Categories
- `story_beats` - Plot progression
- `encounters` - Combat and challenge setups
- `adventure_npcs` - Adventure-specific NPCs

### Scenario Layer Categories (Proposed)
- `opening` - Scenario start narrative
- `act_transitions` - Scene transition guidance
- `tone` - Mood and atmosphere
- `npc_context` - Scenario-specific NPC behavior

---

## Document Change Log

| Date | Author | Changes |
|------|--------|---------|
| 2025-01-30 | GPT-5 (Ed's request) | Initial discovery document created |

---

**End of Discovery Document**

**Next Steps**: Review this document with product team, prioritize Phase 1 (Scenario Prompts), and schedule implementation sprint.

