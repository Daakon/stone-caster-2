-- Phase A1: NPC Indexes + RLS Policies
-- Makes /api/catalog/npcs fast and RLS-correct
-- Adds search_vector column, indexes, and proper RLS policies

BEGIN;

-- Generated column for search
ALTER TABLE public.npcs
ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector(
      'simple',
      coalesce(name,'') || ' ' || coalesce(doc->>'short_desc','')
    )
  ) STORED;

-- Indexes
CREATE INDEX IF NOT EXISTS npcs_status_idx ON public.npcs (status);
CREATE INDEX IF NOT EXISTS npcs_world_idx ON public.npcs (world_id);
CREATE INDEX IF NOT EXISTS npcs_visibility_idx ON public.npcs ((doc->>'visibility'));
CREATE INDEX IF NOT EXISTS npcs_created_idx ON public.npcs (created_at);
CREATE INDEX IF NOT EXISTS npcs_search_idx ON public.npcs USING GIN (search_vector);

-- Safety: Enable RLS
ALTER TABLE public.npcs ENABLE ROW LEVEL SECURITY;

-- Admin helper (idempotent check)
-- Note: is_admin() should already exist from Phase 0 migration (20250211_phase0_profiles_roles.sql)
-- Only create it if profiles table exists and function doesn't exist
DO $func$
BEGIN
  -- Check if profiles table exists (Phase 0 must be run first)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    -- Profiles table exists, check if function exists
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc
      WHERE proname = 'is_admin' 
        AND pg_function_is_visible(oid)
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) THEN
      -- Create the function
      CREATE OR REPLACE FUNCTION public.is_admin()
      RETURNS boolean
      LANGUAGE sql
      SECURITY DEFINER
      STABLE
      AS $admin_func$
        SELECT EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role = 'admin'
        );
      $admin_func$;
    END IF;
  END IF;
  -- If profiles table doesn't exist, skip function creation (Phase 0 must be run first)
END $func$;

-- Policies (read path only for this phase)
-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "npcs_public_read_visible" ON public.npcs;
DROP POLICY IF EXISTS "npcs_admin_read_all" ON public.npcs;

-- Public (anon + authed) can read active, public NPCs
CREATE POLICY "npcs_public_read_visible"
ON public.npcs
FOR SELECT
USING (
  status = 'active'
  AND (doc->>'visibility') = 'public'
);

-- Admins can read everything
CREATE POLICY "npcs_admin_read_all"
ON public.npcs
FOR SELECT
USING (public.is_admin());

COMMIT;

