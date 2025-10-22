-- Naming & Reference Semantics Cleanup Migration (Final Version)
-- Ensures name/slug on worlds/rulesets/entries, implements many-to-many rulesets per entry
-- This version handles all existing constraints and policies gracefully

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
-- 5) RLS for entry_point_rulesets (handle existing policies gracefully)
-- ============================================================================

ALTER TABLE public.entry_point_rulesets ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies (ignore errors if they don't exist)
DO $$
BEGIN
    -- Drop all possible policy names
    DROP POLICY IF EXISTS epr_owner_rw ON public.entry_point_rulesets;
    DROP POLICY IF EXISTS epr_owner_select ON public.entry_point_rulesets;
    DROP POLICY IF EXISTS epr_owner_insert ON public.entry_point_rulesets;
    DROP POLICY IF EXISTS epr_owner_update ON public.entry_point_rulesets;
    DROP POLICY IF EXISTS epr_owner_delete ON public.entry_point_rulesets;
    DROP POLICY IF EXISTS epr_allow_all ON public.entry_point_rulesets;
EXCEPTION
    WHEN OTHERS THEN
        -- Ignore errors if policies don't exist
        NULL;
END $$;

-- Create a simple policy for now - allow all operations for authenticated users
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




