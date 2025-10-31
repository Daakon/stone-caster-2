-- Fix world_id_mapping to have uuid_id as the primary key
-- This is needed because all foreign keys should reference the UUID, not the TEXT

BEGIN;

-- Check current structure
DO $$
DECLARE
  current_pk TEXT;
BEGIN
  SELECT constraint_name INTO current_pk
  FROM information_schema.table_constraints
  WHERE table_name = 'world_id_mapping'
  AND constraint_type = 'PRIMARY KEY';
  
  RAISE NOTICE 'Current PK on world_id_mapping: %', current_pk;
END $$;

-- Drop all foreign keys that reference this table
ALTER TABLE IF EXISTS public.entry_points
DROP CONSTRAINT IF EXISTS entry_points_world_id_fkey;

ALTER TABLE IF EXISTS public.characters
DROP CONSTRAINT IF EXISTS characters_world_id_fkey;

ALTER TABLE IF EXISTS public.premade_characters
DROP CONSTRAINT IF EXISTS premade_characters_world_id_fkey;

-- Drop the existing table and recreate with correct structure
DROP TABLE IF EXISTS public.world_id_mapping CASCADE;

-- Recreate with uuid_id as primary key
CREATE TABLE public.world_id_mapping (
  uuid_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text_id TEXT NOT NULL UNIQUE,  -- References worlds.id (TEXT, versioned)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Populate with all existing worlds
INSERT INTO public.world_id_mapping (text_id, uuid_id)
SELECT DISTINCT id, gen_random_uuid()
FROM public.worlds
ON CONFLICT (text_id) DO NOTHING;

-- Add RLS
ALTER TABLE public.world_id_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "world_id_mapping_select_all" ON public.world_id_mapping
  FOR SELECT USING (true);

CREATE POLICY "world_id_mapping_manage_auth" ON public.world_id_mapping
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Verify
DO $$
DECLARE
  mapping_count INTEGER;
  worlds_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO mapping_count FROM public.world_id_mapping;
  SELECT COUNT(DISTINCT id) INTO worlds_count FROM public.worlds;
  
  RAISE NOTICE 'Mappings created: %, Distinct worlds: %', mapping_count, worlds_count;
  
  IF mapping_count < worlds_count THEN
    RAISE WARNING 'Not all worlds have mappings! Check for duplicates or conflicts.';
  END IF;
END $$;

COMMIT;

