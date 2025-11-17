# 🚀 Chimera Technical Spec

This document is the "ground truth" for the Chimera V2 architecture, used to provide technical context for all development.

## Phase 1 & 3: Admin & Rulesets

### `chimera_ruleset_templates` (Table Schema / DTO)

**Database Schema:**
```sql
CREATE TABLE public.chimera_ruleset_templates (
    id text PRIMARY KEY,
    display_name text NOT NULL,
    description_short text,
    description_long text,
    version integer NOT NULL DEFAULT 1,
    rule_type public.chimera_rule_type NOT NULL, -- ENUM: 'MAIN_SYSTEM', 'SUBSYSTEM', 'MODIFIER'
    main_system_dependency text NULL,
    exclusion_group text NULL,
    rule_category text NOT NULL,
    definition jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
```

**TypeScript DTO:**
```typescript
export interface ChimeraRulesetTemplate {
  id: string;
  display_name: string;
  description_short: string | null;
  description_long: string | null;
  version: number;
  rule_type: 'MAIN_SYSTEM' | 'SUBSYSTEM' | 'MODIFIER';
  main_system_dependency: string | null;
  exclusion_group: string | null;
  rule_category: string;
  definition: RulesetDefinitionV1;
  created_at: string;
  updated_at: string;
}

export interface RulesetDefinitionV1 {
  /**
   * UI Schema
   * Defines the structure and presentation of UI elements for this ruleset
   */
  ui_schema: Record<string, unknown>;

  /**
   * Action Prompt Rules
   * Rules governing how action prompts are constructed and processed
   */
  action_prompt_rules: Record<string, unknown>;

  /**
   * Narrative Prompt Rules
   * Rules governing how narrative prompts are constructed and processed
   */
  narrative_prompt_rules: Record<string, unknown>;
}
```

**Source:** `shared/src/types/chimera-rulesets.ts`, `db/migrations/20251115093722_create_chimera_ruleset_templates.sql`

---

## Phase 3: Story Creation & Compiler

### `chimera_stories` (Table Schema / DTO)

**Database Schema:**
```sql
CREATE TABLE public.chimera_stories (
    id text PRIMARY KEY,
    owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    visibility public.chimera_world_visibility NOT NULL DEFAULT 'private', -- ENUM: 'private', 'pending_approval', 'public'
    display_name text NOT NULL,
    description_short text NULL,
    content_rating text NOT NULL DEFAULT 'safe' CHECK (content_rating IN ('safe', 'mature', 'explicit')),
    world_id text NULL REFERENCES public.chimera_worlds(id) ON DELETE SET NULL,
    story_definition jsonb NULL DEFAULT '{}',
    is_system_asset boolean NOT NULL DEFAULT false,
    version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uk_chimera_stories_owner_user_id_display_name UNIQUE (owner_user_id, display_name)
);
```

**TypeScript DTO:**
```typescript
export interface ChimeraStory {
  id: string;
  owner_user_id: string;
  visibility: 'private' | 'pending_approval' | 'public';
  display_name: string;
  description_short: string | null;
  content_rating: 'safe' | 'mature' | 'explicit';
  world_id: string | null; // Foreign key to chimera_worlds.id
  story_definition?: Record<string, unknown> | null;
  is_system_asset: boolean;
  version: number;
  created_at: string;
  updated_at: string;
  // Optional relations (populated via joins)
  world?: {
    id: string;
    display_name: string;
    description_short?: string | null;
  } | null;
  ruleset_links?: Array<{ ruleset_template_id: string }>;
  pack_links?: Array<{ pack_id: string }>;
  entity_links?: Array<{ entity_template_id: string }>;
}
```

**Related Junction Tables:**
- `chimera_story_links` - Links stories to ruleset templates (story_id, ruleset_template_id)
- `chimera_story_entity_links` - Links stories to entity templates (story_id, entity_template_id)
- `chimera_story_content_pack_links` - Links stories to content packs (story_id, pack_id)

**Source:** `frontend/src/services/chimera.stories.ts`, `db/migrations/20251115120000_create_chimera_stories.sql`, `db/migrations/20251115150000_update_chimera_stories_phase3.sql`, `db/migrations/20251115151000_add_story_definition_to_stories.sql`, `db/migrations/20251115152000_add_content_rating_to_stories.sql`

---

### `chimera_story_compiled_ruleset` (Table Schema / DTO)

**Database Schema:**
```sql
CREATE TABLE public.chimera_story_compiled_ruleset (
    story_id text PRIMARY KEY REFERENCES public.chimera_stories(id) ON DELETE CASCADE,
    compiled_json jsonb NOT NULL DEFAULT '{}',
    source_manifest jsonb NOT NULL DEFAULT '[]',
    last_compiled_at timestamptz NOT NULL DEFAULT now()
);
```

**TypeScript DTO:**
```typescript
export interface ChimeraStoryCompiledRuleset {
  story_id: string; // Foreign key to chimera_stories.id (PRIMARY KEY)
  compiled_json: Record<string, unknown>; // Merged ruleset definitions
  source_manifest: Array<{ id: string; version: number }>; // Receipt of templates used
  last_compiled_at: string;
}
```

**Note on `compiled_json` structure:**
The current implementation merges all ruleset `definition` objects in load order (Main System → Subsystems → World Modifiers → Pack Modifiers → Story Definition). The resulting `compiled_json` is a flat merge where later definitions override earlier ones for conflicting keys.

**Planned structure (from planning docs):**
```typescript
// This is the target structure we're compiling *to* (not yet implemented)
export interface CompiledStoryJson {
  action_context_json: object;      // For MAS Step 1 (Action)
  narrative_context_json: object;    // For MAS Step 2 (Narrative)
  ui_schema_merged: object;          // For the studio
  version_manifest: object;          // For dependency tracking
}
```

**Source:** `db/migrations/20251115124836_create_chimera_story_compiled_ruleset.sql`, `backend/src/routes/chimera-stories.ts` (rebuild endpoint)

---

## Phase 3 API Endpoints

**Base Path:** `/api/v2/chimera/stories`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/my-creations` | Get all stories owned by current user | Required |
| POST | `/` | Create a new story | Required |
| GET | `/:id` | Get a single story by ID | Required |
| PUT | `/:id` | Update story metadata | Required (owner only) |
| PUT | `/:id/definition` | Update only the story_definition JSON | Required (owner only) |
| POST | `/:id/rebuild` | Compile/rebuild story ruleset | Required (owner only) |
| DELETE | `/:id` | Delete a story | Required (owner only) |

**Source:** `backend/src/routes/chimera-stories.ts`

---

## Phase 4: Core AI Play Engine

### `chimera_game_states` (Table Schema / DTO)

**Status:** ⚠️ **NOT YET IMPLEMENTED** - Planned for Phase 4

**Planned Database Schema:**
```sql
-- This table does not exist yet - placeholder for Phase 4
CREATE TABLE public.chimera_game_states (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id text NOT NULL REFERENCES public.chimera_stories(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    current_game_state jsonb NOT NULL DEFAULT '{}',
    turn_count integer NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended', 'abandoned')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
```

**Planned TypeScript DTO:**
```typescript
export interface ChimeraGameState {
  id: string;
  story_id: string; // Foreign key to chimera_stories.id
  user_id: string;  // Foreign key to auth.users.id
  current_game_state: Record<string, unknown>; // Game state snapshot (location, inventory, quest progress, etc.)
  turn_count: number;
  status: 'active' | 'ended' | 'abandoned';
  created_at: string;
  updated_at: string;
}
```

**Source:** `docs/planning/planning.md` (Phase 4.1)

---

## Phase 4 API Endpoints

**Status:** ⚠️ **NOT YET IMPLEMENTED** - Planned for Phase 4

**Planned Endpoints:**

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v2/play/:gameStateId/action` | MAS Step 1: Process player action | Required |
| POST | `/api/v2/play/:gameStateId/narrative` | MAS Step 2: Generate narrative response | Required |

**Note:** The exact structure of these endpoints is TBD. The MAS (Multi-Agent System) flow may combine both steps into a single endpoint or use separate endpoints as shown above.

**Source:** `docs/planning/planning.md` (Phase 4)

---

## Additional Context

### Admin Ruleset Endpoints

**Base Path:** `/api/v2/chimera/admin/rulesets`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | List all ruleset templates | Publisher role |
| GET | `/exclusion-groups` | List exclusion groups | Publisher role |
| GET | `/:id` | Get single ruleset template | Publisher role |
| POST | `/` | Create ruleset template | Publisher role |
| PUT | `/:id` | Update ruleset template | Publisher role |
| DELETE | `/:id` | Delete ruleset template | Publisher role |

**Source:** `backend/src/routes/chimera-admin-rulesets.ts`

---

### Compiler Load Order

The compiler merges rulesets in the following order (last one wins for conflicts):

1. **Main System** (rule_type = 'MAIN_SYSTEM')
2. **Subsystems** (rule_type = 'SUBSYSTEM', main_system_dependency matches Main System ID)
3. **World Modifiers** (rule_type = 'MODIFIER', linked via world)
4. **Content Pack Modifiers** (rule_type = 'MODIFIER', linked via content packs)
5. **Story Definition** (from `chimera_stories.story_definition` - highest priority)

**Source:** `backend/src/routes/chimera-stories.ts` (rebuild endpoint, lines 1012-1082)

---

## Notes

- All story IDs are `text` (not UUIDs) - using timestamp-based generation: `chimera_story_${Date.now()}_${random}`
- The `compiled_json` structure is currently a flat merge. The planned structure with `action_context_json`, `narrative_context_json`, etc. is not yet implemented.
- Phase 4 (Play Engine) is not yet implemented - this spec includes planned structures based on planning documents.

