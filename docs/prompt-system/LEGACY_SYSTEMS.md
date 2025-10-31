# Legacy Prompt Systems

**Status**: Deprecated - Do Not Use  
**Last Updated**: 2025-02-01

---

## Overview

This document catalogs deprecated prompt system implementations that should not be used for new development. These systems may still exist in the codebase but are superseded by the active system documented in [ACTIVE_SYSTEM.md](./ACTIVE_SYSTEM.md).

---

## Deprecated Systems

### 1. `prompting.prompts` Table (Layer-Based System)

**Location**: `prompting` schema

**Created By**: `supabase/migrations/20250103000000_create_prompting_schema.sql`

**Status**: ❌ **Not Used** - can be dropped in future cleanup

**Description**:
An alternative prompt storage system using a "layer" approach instead of "scope". This table was created as part of an experimental migration but was never fully integrated into the active system.

**Schema**:
```sql
CREATE TABLE prompting.prompts (
    id UUID PRIMARY KEY,
    layer VARCHAR(50) NOT NULL,  -- 'foundation', 'core', 'engine', etc.
    world_slug VARCHAR(100),
    adventure_slug VARCHAR(100),
    scene_id VARCHAR(100),
    turn_stage VARCHAR(50),
    sort_order INTEGER,
    version VARCHAR(20),
    hash VARCHAR(64),
    content TEXT,
    metadata JSONB,
    active BOOLEAN,
    locked BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    created_by UUID,
    updated_by UUID
);
```

**Why Not Used**:
- Uses "layer" terminology instead of "scope" (inconsistent with active system)
- Separate schema from main admin tables
- Has `adventure_slug` instead of `entry_point_id` (outdated)
- Never integrated with current `entry_points` architecture

**Migration Path**:
No migration needed - this table was never populated in production. Can be dropped safely.

---

### 2. `DatabasePromptAssembler` (Backend)

**Location**: `backend/src/prompts/database-prompt-assembler.ts`

**Status**: ❌ **Deprecated** - uses `prompting.prompts`

**Description**:
A prompt assembly implementation that fetches from the `prompting.prompts` table instead of `prompt_segments`.

**Why Not Used**:
- Depends on the deprecated `prompting.prompts` table
- Uses outdated `worldSlug`, `adventureSlug` instead of `entry_point_id`
- Doesn't support multi-ruleset assembly
- Incompatible with current `entry_points` architecture

**Active Replacement**:
Use `src/prompt/assembler/assembler.ts` which works with `prompt_segments`.

---

### 3. `PromptWrapper` (Backend)

**Location**: `backend/src/prompts/wrapper.ts`

**Status**: ❌ **Deprecated** - old assembly logic

**Description**:
An older prompt assembly class that directly combined JSON data structures (core, world, adventure, player) without using database segments.

**Key Issues**:
- Hardcoded assembly order
- No support for `entry_points`, rulesets, or NPCs as first-class entities
- No token budgeting or truncation
- No assembly audit trail
- Uses `adventureData` instead of `entryData`

**Active Replacement**:
Use `src/prompt/assembler/assembler.ts`.

---

### 4. Early Migration: `005_prompts_table.sql`

**Location**: `supabase/migrations/005_prompts_table.sql`

**Status**: ❌ **Superseded** by current schema

**Description**:
An early attempt at a prompts table with scope-based storage, but using a different schema than the current `prompt_segments`.

**Schema**:
```sql
CREATE TABLE IF NOT EXISTS prompts (
  id UUID PRIMARY KEY,
  slug TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('world', 'scenario', 'adventure', 'quest')),
  version INTEGER,
  hash TEXT,
  content TEXT,
  active BOOLEAN,
  metadata JSONB,
  ...
);
```

**Why Superseded**:
- Used `slug` instead of `ref_id`
- Scope values were content types, not assembly layers
- No support for `core`, `ruleset`, `npc`, `entry_start` scopes
- Predates `entry_points` architecture

**Active Replacement**:
Current `prompt_segments` table in `db/migrations/20250130000000_core_schema.sql`.

---

## How to Identify Legacy Code

### Red Flags

If you see any of these in code, it's likely using a deprecated system:

#### In TypeScript/JavaScript:
- `import from 'backend/src/prompts/database-prompt-assembler'`
- `import from 'backend/src/prompts/wrapper'`
- `.from('prompting.prompts')`
- `worldSlug` and `adventureSlug` (instead of `worldId` and `entryPointId`)
- `layer` field in prompt context (should be `scope`)

#### In SQL:
- `SELECT * FROM prompting.prompts`
- `SELECT * FROM prompts WHERE slug = ...`
- References to `adventure_slug` field

#### In Migrations:
- Files referencing `prompting` schema
- Files creating tables with `layer` column
- `005_prompts_table.sql` or earlier

---

## Migration Checklist (Future Cleanup)

When time permits, the following cleanup can be performed:

### Phase 1: Verify No Usage
- [ ] Search codebase for `prompting.prompts`
- [ ] Search for `DatabasePromptAssembler` imports
- [ ] Search for `PromptWrapper` imports
- [ ] Confirm no active queries to `prompting` schema

### Phase 2: Remove Code
- [ ] Delete `backend/src/prompts/database-prompt-assembler.ts`
- [ ] Delete `backend/src/prompts/wrapper.ts`
- [ ] Remove any tests for these modules
- [ ] Update any stale imports

### Phase 3: Drop Database Objects
- [ ] Drop `prompting.prompts` table
- [ ] Drop `prompting` schema
- [ ] Drop early `prompts` table (if exists)
- [ ] Remove old migration files (or mark as obsolete)

### Phase 4: Documentation
- [ ] Update all docs referencing old systems
- [ ] Remove references from API specs
- [ ] Archive this LEGACY_SYSTEMS.md (move to `docs/archive/`)

---

## Related Migrations to Archive

These migration files can be marked as obsolete (or moved to `db/migrations/archive/`):

- `supabase/migrations/20250103000000_create_prompting_schema.sql`
- `supabase/migrations/005_prompts_table.sql`
- Any migrations adding columns to `prompting.prompts`

---

## FAQ

### Q: Can I still use `prompting.prompts` for new features?

**No.** Always use the active system (`prompt_segments` table and `src/prompt/assembler/`).

### Q: What if I find code using `DatabasePromptAssembler`?

Refactor it to use `src/prompt/assembler/assembler.ts`. If you're unsure how, consult [ACTIVE_SYSTEM.md](./ACTIVE_SYSTEM.md) or ask for help.

### Q: Is there data in `prompting.prompts` that needs migration?

No. This table was never populated in production. It's safe to drop.

### Q: Why were these systems created if they're not used?

They were experimental implementations during architecture exploration. The current system emerged as the production-ready solution.

### Q: When will these be removed from the codebase?

No immediate timeline. They're documented here to prevent accidental use. Removal will occur during a dedicated cleanup sprint.

---

## See Also

- [ACTIVE_SYSTEM.md](./ACTIVE_SYSTEM.md) - Current production architecture
- [ENTRY_POINT_ASSEMBLY.md](./ENTRY_POINT_ASSEMBLY.md) - How to use the active system
- [SCENARIOS.md](./SCENARIOS.md) - Scenario-specific guidance
- `docs/prompt-system-discovery.md` - Full system analysis

