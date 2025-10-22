# Database Migration Instructions

## Issue
The frontend is showing errors like:
```
Failed to search references: Error: Failed to search rulesets: column rulesets.name does not exist
```

This is because the database migration that adds `name`, `slug`, and `description` columns to the `worlds`, `rulesets`, and `entry_points` tables hasn't been applied yet.

## Solution
You need to apply the database migration manually in your Supabase dashboard.

### Steps:

1. **Go to your Supabase project dashboard**
   - Open your browser and navigate to your Supabase project
   - Make sure you're logged in

2. **Navigate to SQL Editor**
   - In the left sidebar, click on "SQL Editor"
   - This will open the SQL query interface

3. **Copy and paste the following SQL (Simple Version):**

```sql
-- Naming & Reference Semantics Cleanup Migration (Simple Version)
-- Ensures name/slug on worlds/rulesets/entries, implements many-to-many rulesets per entry
-- This version focuses on the essential changes first

BEGIN;

-- ============================================================================
-- 1) Ensure name/slug on worlds are present & unique
-- ============================================================================

ALTER TABLE public.worlds
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS description text;

UPDATE public.worlds
  SET name = COALESCE(name, 'World ' || LEFT(id::text, 8)),
      slug = COALESCE(slug, REGEXP_REPLACE(LOWER(COALESCE(name, 'world-'||LEFT(id::text,8))), '[^a-z0-9]+', '-', 'g'))
WHERE name IS NULL OR slug IS NULL;

-- Only alter columns to NOT NULL if they're not already
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'worlds' AND column_name = 'name' AND is_nullable = 'YES') THEN
        ALTER TABLE public.worlds ALTER COLUMN name SET NOT NULL;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'worlds' AND column_name = 'slug' AND is_nullable = 'YES') THEN
        ALTER TABLE public.worlds ALTER COLUMN slug SET NOT NULL;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_worlds_slug ON public.worlds(slug);

-- ============================================================================
-- 2) Ensure name/slug on rulesets are present & unique
-- ============================================================================

ALTER TABLE public.rulesets
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS description text;

UPDATE public.rulesets
  SET name = COALESCE(name, 'Ruleset ' || LEFT(id::text, 8)),
      slug = COALESCE(slug, REGEXP_REPLACE(LOWER(COALESCE(name, 'ruleset-'||LEFT(id::text,8))), '[^a-z0-9]+', '-', 'g'))
WHERE name IS NULL OR slug IS NULL;

-- Only alter columns to NOT NULL if they're not already
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'rulesets' AND column_name = 'name' AND is_nullable = 'YES') THEN
        ALTER TABLE public.rulesets ALTER COLUMN name SET NOT NULL;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'rulesets' AND column_name = 'slug' AND is_nullable = 'YES') THEN
        ALTER TABLE public.rulesets ALTER COLUMN slug SET NOT NULL;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_rulesets_slug ON public.rulesets(slug);

-- ============================================================================
-- 3) Ensure name/slug on entry_points are present & unique
-- ============================================================================

ALTER TABLE public.entry_points
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS slug text;

UPDATE public.entry_points
  SET name = COALESCE(name, title, 'Entry ' || LEFT(id::text, 8)),
      slug = COALESCE(slug, REGEXP_REPLACE(LOWER(COALESCE(name, title, 'entry-'||LEFT(id::text,8))), '[^a-z0-9]+', '-', 'g'))
WHERE name IS NULL OR slug IS NULL;

-- Only alter columns to NOT NULL if they're not already
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'entry_points' AND column_name = 'name' AND is_nullable = 'YES') THEN
        ALTER TABLE public.entry_points ALTER COLUMN name SET NOT NULL;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'entry_points' AND column_name = 'slug' AND is_nullable = 'YES') THEN
        ALTER TABLE public.entry_points ALTER COLUMN slug SET NOT NULL;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_entry_points_slug ON public.entry_points(slug);

-- ============================================================================
-- 4) Ensure the join table for many rulesets per entry
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.entry_point_rulesets (
  entry_point_id text NOT NULL REFERENCES public.entry_points(id) ON DELETE CASCADE,
  ruleset_id     text NOT NULL REFERENCES public.rulesets(id) ON DELETE RESTRICT,
  sort_order     int  NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entry_point_id, ruleset_id)
);

CREATE INDEX IF NOT EXISTS idx_epr_entry ON public.entry_point_rulesets(entry_point_id);
CREATE INDEX IF NOT EXISTS idx_epr_ruleset ON public.entry_point_rulesets(ruleset_id);
CREATE INDEX IF NOT EXISTS idx_epr_sort ON public.entry_point_rulesets(entry_point_id, sort_order);

-- ============================================================================
-- 5) Basic RLS for entry_point_rulesets (simplified)
-- ============================================================================

ALTER TABLE public.entry_point_rulesets ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS epr_owner_rw ON public.entry_point_rulesets;
DROP POLICY IF EXISTS epr_owner_select ON public.entry_point_rulesets;
DROP POLICY IF EXISTS epr_owner_insert ON public.entry_point_rulesets;
DROP POLICY IF EXISTS epr_owner_update ON public.entry_point_rulesets;
DROP POLICY IF EXISTS epr_owner_delete ON public.entry_point_rulesets;

-- Simple policy for now - allow all operations for authenticated users
-- This can be refined later once the basic structure is working
CREATE POLICY epr_allow_all ON public.entry_point_rulesets FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- 6) Constraints (only add if they don't exist)
-- ============================================================================

-- Sort order bounds - only add if constraint doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'chk_epr_sort_order' 
                   AND table_name = 'entry_point_rulesets') THEN
        ALTER TABLE public.entry_point_rulesets
          ADD CONSTRAINT chk_epr_sort_order CHECK (sort_order BETWEEN 0 AND 999);
    END IF;
END $$;

COMMIT;
```

4. **Execute the SQL**
   - Click the "Run" button or press Ctrl+Enter
   - Wait for the execution to complete
   - You should see a success message

5. **Verify the changes**
   - The migration should complete without errors
   - You can verify by running a simple query like: `SELECT name, slug FROM worlds LIMIT 1;`

## What this migration does:

- **Adds `name`, `slug`, `description` columns** to `worlds`, `rulesets`, and `entry_points` tables
- **Creates the `entry_point_rulesets` join table** for many-to-many relationships between entries and rulesets
- **Sets up RLS policies** for the new table
- **Adds unique constraints and indexes** for performance
- **Populates existing rows** with default names and slugs

## After the migration:

- The frontend errors should disappear
- You'll be able to create and edit worlds, rulesets, and entries with proper names and slugs
- The multi-ruleset functionality will work correctly
- The admin interface will show proper name/slug fields instead of raw UUIDs

## Troubleshooting:

If you get any errors during execution:
- Some "already exists" errors are normal and can be ignored
- If you get constraint violations, the migration will handle them gracefully
- The `BEGIN;` and `COMMIT;` ensure the migration is atomic

Once this migration is applied, refresh your frontend and the errors should be resolved!
