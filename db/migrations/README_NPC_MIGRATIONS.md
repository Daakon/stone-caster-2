# NPC System Migrations - Execution Order

**Problem:** The `npcs` table is created by `create-admin-tables.sql` with one schema, but `20250101_npc_system.sql` expected a different schema.

## Schema Conflict Details

### Admin Tables Schema (`create-admin-tables.sql`)
```sql
CREATE TABLE npcs (
  id uuid PRIMARY KEY,          -- UUID type
  name text NOT NULL,
  slug text UNIQUE,
  status text DEFAULT 'active',
  description text,
  prompt jsonb DEFAULT '{}',
  created_at timestamptz,
  updated_at timestamptz
  -- NO world_id column!
);
```

### NPC System Migration (Original `20250101_npc_system.sql`)
```sql
CREATE TABLE npcs (
  id text PRIMARY KEY,          -- TEXT type
  world_id text NOT NULL,       -- Has world_id!
  name text NOT NULL,
  archetype text,
  role_tags text[],
  portrait_url text,
  doc jsonb,
  created_at timestamptz,
  updated_at timestamptz
);
```

## Solution: Run Migrations in This Order

### 1. Create Admin Tables (if not already done)
```bash
psql -f create-admin-tables.sql
```

This creates the base `npcs` table with UUID id.

### 2. Add Missing Columns to NPCs Table
```bash
psql -f db/migrations/20250101_npc_system_add_world_id.sql
```

This adds:
- `world_id text` (nullable)
- `archetype text`
- `role_tags text[]`
- `portrait_url text`
- `doc jsonb`

And creates:
- Foreign key constraint to `worlds(id)` (if worlds table exists)
- Index on `world_id`

### 3. Create NPC Binding Tables
```bash
psql -f db/migrations/20250101_npc_system.sql
```

This creates:
- `entry_point_npcs` table (with UUID npc_id to match npcs.id)
- `npc_relationships` table (with UUID npc_id to match npcs.id)
- Indexes and comments

## Key Changes Made

### 1. NPCs Table (Modified)
- **ID Type:** Uses `uuid` (from admin-tables)
- **World ID:** Added as nullable `text` column
- **Merged Columns:** Has both admin columns (slug, status, description, prompt) and system columns (archetype, role_tags, portrait_url, doc)

### 2. Entry Point NPCs Table (Updated)
```sql
CREATE TABLE entry_point_npcs (
    id uuid PRIMARY KEY,                  -- Added id column
    entry_point_id text NOT NULL,         -- TEXT (matches entry_points.id)
    npc_id uuid NOT NULL,                 -- UUID (matches npcs.id)
    role_hint text,
    weight int NOT NULL DEFAULT 1,
    created_at timestamptz,
    updated_at timestamptz,
    UNIQUE (entry_point_id, npc_id)       -- Unique constraint instead of composite PK
);
```

### 3. NPC Relationships Table (Updated)
```sql
CREATE TABLE npc_relationships (
    game_id uuid NOT NULL,                -- UUID (matches games.id)
    npc_id uuid NOT NULL,                 -- UUID (matches npcs.id)
    trust int, warmth int, respect int,
    romance int, awe int, fear int, desire int,
    flags jsonb,
    created_at timestamptz,
    updated_at timestamptz,
    PRIMARY KEY (game_id, npc_id)
);
```

## Backward Compatibility Notes

### World ID is Nullable
- **Why:** Existing NPCs don't have a world assigned
- **Impact:** Backend API doesn't filter by world (for now)
- **Future:** You can populate `world_id` for existing NPCs and make it NOT NULL later

### ID Type is UUID
- **Why:** Admin tables already created npcs with UUID
- **Impact:** NPC IDs are UUIDs, not human-readable like "npc.mystika.kiera"
- **Future:** Consider using `slug` field for human-readable identifiers

## Verification Queries

### Check NPCs Table Structure
```sql
\d npcs
```

### Check All NPC Columns Exist
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'npcs'
ORDER BY ordinal_position;
```

### Check Foreign Keys
```sql
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name IN ('npcs', 'entry_point_npcs', 'npc_relationships')
  AND tc.constraint_type = 'FOREIGN KEY';
```

## Rollback

If you need to rollback:

```sql
-- Drop in reverse order
DROP TABLE IF EXISTS npc_relationships CASCADE;
DROP TABLE IF EXISTS entry_point_npcs CASCADE;

-- Remove added columns from npcs table
ALTER TABLE npcs
  DROP COLUMN IF EXISTS world_id,
  DROP COLUMN IF EXISTS archetype,
  DROP COLUMN IF EXISTS role_tags,
  DROP COLUMN IF EXISTS portrait_url,
  DROP COLUMN IF EXISTS doc;
```

## Related Documentation

- `docs/fixes/NPC_BINDINGS_BACKEND_API_FIX.md` - Backend API implementation
- `docs/fixes/WORLD_ID_SCHEMA_MISMATCH.md` - World ID type conflicts
- `create-admin-tables.sql` - Original NPCs table definition

