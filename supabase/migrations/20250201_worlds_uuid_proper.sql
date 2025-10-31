-- Proper UUID Architecture: All world references use UUID
-- The world_id_mapping table provides stable UUID identity for versioned worlds content

BEGIN;

-- ============================================================================
-- STEP 1: Ensure world_id_mapping is properly set up
-- ============================================================================

-- Ensure the mapping table exists (should already exist from earlier migration)
CREATE TABLE IF NOT EXISTS public.world_id_mapping (
  uuid_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text_id TEXT NOT NULL UNIQUE,  -- References worlds.id
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Populate mapping for all existing worlds (insert new UUIDs for any missing)
INSERT INTO public.world_id_mapping (text_id, uuid_id)
SELECT DISTINCT id, gen_random_uuid()
FROM public.worlds
WHERE id NOT IN (SELECT text_id FROM public.world_id_mapping)
ON CONFLICT (text_id) DO NOTHING;

-- ============================================================================
-- STEP 2: Update entry_points to use UUID
-- ============================================================================

-- Add UUID column if it doesn't exist
ALTER TABLE public.entry_points
ADD COLUMN IF NOT EXISTS world_uuid UUID;

-- Populate UUID from mapping (for entry_points that currently have TEXT world_id)
UPDATE public.entry_points ep
SET world_uuid = wm.uuid_id
FROM public.world_id_mapping wm
WHERE ep.world_id = wm.text_id
AND ep.world_uuid IS NULL;

-- Drop old TEXT foreign key if it exists
ALTER TABLE public.entry_points
DROP CONSTRAINT IF EXISTS entry_points_world_id_fkey;

-- Rename columns: world_id_old (TEXT) → world_id (UUID)
DO $$
BEGIN
  -- If world_id is currently TEXT, rename it
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entry_points'
    AND column_name = 'world_id'
    AND data_type = 'text'
  ) THEN
    ALTER TABLE public.entry_points RENAME COLUMN world_id TO world_id_old;
    ALTER TABLE public.entry_points RENAME COLUMN world_uuid TO world_id;
  END IF;
END $$;

-- Add foreign key to mapping table
ALTER TABLE public.entry_points
DROP CONSTRAINT IF EXISTS entry_points_world_id_fkey,
ADD CONSTRAINT entry_points_world_id_fkey 
  FOREIGN KEY (world_id) REFERENCES public.world_id_mapping(uuid_id) ON DELETE RESTRICT;

-- Create index
CREATE INDEX IF NOT EXISTS idx_entry_points_world_id ON public.entry_points(world_id);

-- ============================================================================
-- STEP 3: Update characters to use UUID
-- ============================================================================

-- Add world_id UUID column
ALTER TABLE public.characters
ADD COLUMN IF NOT EXISTS world_id UUID;

-- Populate from mapping using world_slug
UPDATE public.characters c
SET world_id = wm.uuid_id
FROM public.world_id_mapping wm
WHERE c.world_slug = wm.text_id
AND c.world_id IS NULL;

-- Add foreign key
ALTER TABLE public.characters
DROP CONSTRAINT IF EXISTS characters_world_id_fkey,
ADD CONSTRAINT characters_world_id_fkey
  FOREIGN KEY (world_id) REFERENCES public.world_id_mapping(uuid_id) ON DELETE RESTRICT;

-- Create index
CREATE INDEX IF NOT EXISTS idx_characters_world_id ON public.characters(world_id);

-- Keep world_slug for display, but it's no longer the source of truth
COMMENT ON COLUMN public.characters.world_id IS 'World UUID (FK to world_id_mapping.uuid_id) - source of truth';
COMMENT ON COLUMN public.characters.world_slug IS 'World slug for display only (deprecated for FK)';

-- ============================================================================
-- STEP 4: Update premade_characters to use UUID
-- ============================================================================

-- Add world_id UUID column
ALTER TABLE public.premade_characters
ADD COLUMN IF NOT EXISTS world_id UUID;

-- Populate from mapping using world_slug
UPDATE public.premade_characters pc
SET world_id = wm.uuid_id
FROM public.world_id_mapping wm
WHERE pc.world_slug = wm.text_id
AND pc.world_id IS NULL;

-- Add foreign key
ALTER TABLE public.premade_characters
DROP CONSTRAINT IF EXISTS premade_characters_world_id_fkey,
ADD CONSTRAINT premade_characters_world_id_fkey
  FOREIGN KEY (world_id) REFERENCES public.world_id_mapping(uuid_id) ON DELETE RESTRICT;

-- Create index
CREATE INDEX IF NOT EXISTS idx_premade_characters_world_id ON public.premade_characters(world_id);

-- Update unique constraint to use UUID
ALTER TABLE public.premade_characters
DROP CONSTRAINT IF EXISTS premade_characters_world_slug_archetype_key_key,
DROP CONSTRAINT IF EXISTS premade_characters_world_id_archetype_key_key;

ALTER TABLE public.premade_characters
ADD CONSTRAINT premade_characters_world_id_archetype_key_key UNIQUE (world_id, archetype_key);

COMMENT ON COLUMN public.premade_characters.world_id IS 'World UUID (FK to world_id_mapping.uuid_id) - source of truth';
COMMENT ON COLUMN public.premade_characters.world_slug IS 'World slug for display only (deprecated for FK)';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  mapping_count INTEGER;
  worlds_count INTEGER;
  entry_points_null INTEGER;
  characters_null INTEGER;
  premade_null INTEGER;
BEGIN
  SELECT COUNT(*) INTO mapping_count FROM public.world_id_mapping;
  SELECT COUNT(DISTINCT id) INTO worlds_count FROM public.worlds;
  SELECT COUNT(*) INTO entry_points_null FROM public.entry_points WHERE world_id IS NULL;
  SELECT COUNT(*) INTO characters_null FROM public.characters WHERE world_id IS NULL;
  SELECT COUNT(*) INTO premade_null FROM public.premade_characters WHERE world_id IS NULL AND is_active = true;
  
  RAISE NOTICE 'World ID Mapping entries: %', mapping_count;
  RAISE NOTICE 'Distinct worlds: %', worlds_count;
  RAISE NOTICE 'Entry points with NULL world_id: %', entry_points_null;
  RAISE NOTICE 'Characters with NULL world_id: %', characters_null;
  RAISE NOTICE 'Active premade characters with NULL world_id: %', premade_null;
  
  IF entry_points_null > 0 OR characters_null > 0 OR premade_null > 0 THEN
    RAISE WARNING 'Some records still have NULL world_id - they reference worlds not in world_id_mapping';
  END IF;
END $$;

COMMIT;

