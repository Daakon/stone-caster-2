# World ID Schema Mismatch Issue

## Error

```
insert or update on table "entry_points" violates foreign key constraint "entry_points_world_id_fkey"
Key (world_id)=(a7ceea3f-378e-4214-b3e3-85f3b6ddd8b3) is not present in table "worlds".
```

## Root Cause

There's a schema conflict between two migration files:

### Core Schema (`db/migrations/20250130000000_core_schema.sql`)
```sql
CREATE TABLE IF NOT EXISTS worlds (
    id text PRIMARY KEY,  -- TEXT ID
    ...
);

CREATE TABLE IF NOT EXISTS entry_points (
    ...
    world_id text NOT NULL REFERENCES worlds(id),  -- TEXT FK
    ...
);
```

### Admin Schema (`create-admin-tables.sql`)
```sql
CREATE TABLE IF NOT EXISTS public.entry_points (
    ...
    world_id uuid REFERENCES public.worlds(id) ON DELETE CASCADE,  -- UUID FK
    ...
);
```

**Conflict**: Core schema uses TEXT, admin schema expects UUID!

## Immediate Fix

The error occurs because the specified world doesn't exist in the database. To fix:

### Option 1: Create a World First

Before creating entry points, create a world:

```sql
-- Check existing worlds
SELECT id, name, status FROM worlds;

-- If none exist, create one
INSERT INTO worlds (id, version, status, doc)
VALUES (
  'fantasy-realm',  -- TEXT ID
  '1.0.0',
  'active',
  '{"name": "Fantasy Realm", "description": "A magical world"}'::jsonb
);
```

### Option 2: Use Existing World ID

If worlds exist, use their actual IDs in the form. Check what worlds are available:

```sql
SELECT id, name, doc->>'name' as display_name FROM worlds WHERE status = 'active';
```

## Long-Term Fix: Schema Unification

The schemas need to be unified. Choose ONE approach:

### Approach A: Use TEXT IDs (Recommended)

Advantages:
- Human-readable IDs (`fantasy-realm`, `cyberpunk-2077`)
- Easier debugging
- Matches core schema

**Migration needed**:
```sql
-- Update admin tables to use TEXT
ALTER TABLE entry_points 
  ALTER COLUMN world_id TYPE text;

-- Ensure foreign key points to correct table
ALTER TABLE entry_points 
  DROP CONSTRAINT IF EXISTS entry_points_world_id_fkey;
  
ALTER TABLE entry_points 
  ADD CONSTRAINT entry_points_world_id_fkey 
  FOREIGN KEY (world_id) REFERENCES worlds(id) ON DELETE RESTRICT;
```

### Approach B: Use UUIDs

Advantages:
- Prevents collisions
- Standard format

**Migration needed**:
```sql
-- Update worlds table to use UUID
ALTER TABLE worlds 
  ALTER COLUMN id TYPE uuid USING id::uuid;

-- Update all referencing tables
ALTER TABLE entry_points 
  ALTER COLUMN world_id TYPE uuid USING world_id::uuid;
```

## Backend API Issue

The backend `/api/admin/worlds` endpoint (line 2648-2660 in `admin.ts`) generates UUIDs:

```typescript
const worldId = crypto.randomUUID();  // Generates UUID

const { data: result, error } = await supabase
  .from('worlds')
  .insert({
    id: worldId,  // Inserts UUID as TEXT
    ...
  });
```

This **works** because UUIDs can be stored as TEXT, but it's inconsistent with the schema expectations.

## Recommended Solution

1. **Decide on ID format**: TEXT or UUID (recommend TEXT for readability)

2. **Update migrations**: Ensure all schemas use the same type

3. **Update backend**: Ensure consistent ID generation:

```typescript
// For TEXT IDs
const worldId = slug || name
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

// For UUID IDs (if chosen)
const worldId = crypto.randomUUID();
```

4. **Update form**: Ensure dropdown shows correct ID format

5. **Test**: Create world → Create entry point using that world's ID

## Checking Your Database

To see what worlds exist and their ID format:

```sql
-- List all worlds
SELECT 
  id, 
  CASE 
    WHEN id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
    THEN 'UUID' 
    ELSE 'TEXT' 
  END as id_type,
  doc->>'name' as name,
  status
FROM worlds
ORDER BY created_at DESC;
```

## Quick Fix for Current Issue

The simplest fix right now:

1. **Check what worlds exist**:
   ```sql
   SELECT id, name FROM worlds WHERE status = 'active';
   ```

2. **Use an existing world ID** in the entry point form, OR

3. **Create a new world** via the admin interface first, then use its ID

The world UUID `a7ceea3f-378e-4214-b3e3-85f3b6ddd8b3` simply doesn't exist in your database.

## Related Files

- Core schema: `db/migrations/20250130000000_core_schema.sql`
- Admin schema: `create-admin-tables.sql`
- Backend worlds endpoint: `backend/src/routes/admin.ts` (lines 2636-2699)
- Frontend form: `frontend/src/admin/components/EntryPointForm.tsx`

## Status

🔴 **SCHEMA CONFLICT EXISTS**

This needs to be resolved at the database level by choosing one ID format and migrating all tables to use it consistently.

For now, you can work around it by creating worlds first and using their actual IDs.

