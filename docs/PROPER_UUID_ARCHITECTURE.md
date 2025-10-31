# Proper UUID Architecture for World References

## The Problem

You have a **versioned worlds table** with composite primary key:
```sql
CREATE TABLE worlds (
  id TEXT NOT NULL,        -- e.g., "mystika"
  version TEXT NOT NULL,   -- e.g., "1.0", "1.1"
  doc JSONB NOT NULL,
  PRIMARY KEY (id, version)
);
```

You can't change `worlds.id` to UUID without breaking the versioning system.

## The Proper Solution: UUID Everywhere with Mapping

**Use UUIDs as the primary identifier everywhere, with a stable mapping to the versioned content:**

```
┌─────────────────────┐
│  world_id_mapping   │  <-- Stable UUID identity
├─────────────────────┤
│ uuid_id  (UUID PK)  │  <-- This is the "real" world ID
│ text_id  (TEXT)     │  <-- Points to worlds.id
└─────────────────────┘
         │
         │ references
         ▼
┌─────────────────────┐
│      worlds         │  <-- Versioned content
├─────────────────────┤
│ id      (TEXT)      │  <-- Content identifier
│ version (TEXT)      │
│ doc     (JSONB)     │
│ PRIMARY KEY (id, version)
└─────────────────────┘
```

### All References Use UUID

```sql
-- Characters reference the UUID
characters.world_id UUID → world_id_mapping.uuid_id

-- Entry points reference the UUID  
entry_points.world_id UUID → world_id_mapping.uuid_id

-- Premade characters reference the UUID
premade_characters.world_id UUID → world_id_mapping.uuid_id
```

### When You Need the Content

```sql
-- Join through the mapping to get versioned content
SELECT c.*, w.*
FROM characters c
JOIN world_id_mapping wm ON c.world_id = wm.uuid_id
JOIN worlds w ON wm.text_id = w.id
WHERE w.version = (
  SELECT MAX(version) FROM worlds w2 WHERE w2.id = w.id
);
```

## Why This Is Better

1. **Stable IDs**: UUID never changes even if world slug/version changes
2. **Referential Integrity**: Foreign keys enforce valid world references
3. **Versioning**: Can update world content without breaking character references
4. **Standard Practice**: UUIDs for database relations, TEXT for human-readable content IDs

## Current State vs. Target State

### Current (Broken)
- `entry_points.world_id` = TEXT with FK to `worlds.id`
- `characters.world_slug` = TEXT (no FK)
- Missing data in `world_id_mapping`

### Target (Correct)
- `entry_points.world_id` = UUID with FK to `world_id_mapping.uuid_id`
- `characters.world_id` = UUID with FK to `world_id_mapping.uuid_id`
- `world_id_mapping` populated for all worlds
- Keep `world_slug` for display only (no FK)

## Migration Path

1. **Populate world_id_mapping** for all existing worlds
2. **Change FK constraints** to point to UUID instead of TEXT
3. **Add UUID columns** to all tables that reference worlds
4. **Populate UUID values** from mapping
5. **Drop TEXT foreign keys**, keep TEXT columns for display only

