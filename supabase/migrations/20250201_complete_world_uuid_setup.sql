-- Complete World UUID Setup - All in one migration
-- Run this single migration to set up proper UUID architecture

BEGIN;

-- ============================================================================
-- STEP 1: Create world_id_mapping with correct structure
-- ============================================================================

DROP TABLE IF EXISTS public.world_id_mapping CASCADE;

CREATE TABLE public.world_id_mapping (
  uuid_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text_id TEXT NOT NULL UNIQUE,
  name TEXT,
  doc JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Populate from worlds (get name and doc from latest version)
-- For the first world, use existing UUID from entry_points if available
DO $$
DECLARE
  existing_uuid UUID;
  world_count INT;
BEGIN
  -- Check if entry_points has any UUIDs we should preserve
  SELECT ep.world_id INTO existing_uuid
  FROM public.entry_points ep
  WHERE ep.world_id IS NOT NULL
  LIMIT 1;
  
  -- Count how many distinct worlds we have
  SELECT COUNT(DISTINCT id) INTO world_count FROM public.worlds;
  
  RAISE NOTICE 'Found existing entry_points UUID: %', existing_uuid;
  RAISE NOTICE 'Number of distinct worlds: %', world_count;
  
  -- Insert worlds with their UUIDs
  IF existing_uuid IS NOT NULL AND world_count = 1 THEN
    -- Single world case: use the existing UUID
    INSERT INTO public.world_id_mapping (text_id, uuid_id, name, doc)
    SELECT DISTINCT ON (w.id)
      w.id as text_id,
      existing_uuid as uuid_id,
      w.doc->>'name' as name,
      w.doc
    FROM public.worlds w
    ORDER BY w.id, w.version DESC
    ON CONFLICT (text_id) DO UPDATE
    SET name = EXCLUDED.name, doc = EXCLUDED.doc;
  ELSE
    -- Multiple worlds or no existing UUID: generate new UUIDs
    INSERT INTO public.world_id_mapping (text_id, uuid_id, name, doc)
    SELECT DISTINCT ON (w.id)
      w.id as text_id,
      gen_random_uuid() as uuid_id,
      w.doc->>'name' as name,
      w.doc
    FROM public.worlds w
    ORDER BY w.id, w.version DESC
    ON CONFLICT (text_id) DO UPDATE
    SET name = EXCLUDED.name, doc = EXCLUDED.doc;
  END IF;
END $$;

-- RLS
ALTER TABLE public.world_id_mapping ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "world_id_mapping_select_all" ON public.world_id_mapping;
CREATE POLICY "world_id_mapping_select_all" ON public.world_id_mapping
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "world_id_mapping_manage_auth" ON public.world_id_mapping;
CREATE POLICY "world_id_mapping_manage_auth" ON public.world_id_mapping
  FOR ALL USING (auth.uid() IS NOT NULL);

-- ============================================================================
-- STEP 2: Create worlds_admin view
-- ============================================================================

DROP VIEW IF EXISTS public.worlds_admin;

CREATE VIEW public.worlds_admin AS
SELECT 
  wm.uuid_id as id,
  wm.name,
  w.id as text_id,
  w.version,
  w.doc,
  w.created_at,
  w.updated_at
FROM public.worlds w
JOIN public.world_id_mapping wm ON w.id = wm.text_id
WHERE w.version = (
  SELECT MAX(version) 
  FROM public.worlds w2 
  WHERE w2.id = w.id
);

COMMENT ON VIEW public.worlds_admin IS 'Admin view of worlds with UUID identity from world_id_mapping';

-- ============================================================================
-- STEP 3: Update entry_points to use UUID
-- ============================================================================

-- Drop old FK first
ALTER TABLE public.entry_points
DROP CONSTRAINT IF EXISTS entry_points_world_id_fkey;

-- Check current data type of world_id and handle accordingly
DO $$
DECLARE
  world_id_type TEXT;
BEGIN
  SELECT data_type INTO world_id_type
  FROM information_schema.columns
  WHERE table_name = 'entry_points'
  AND column_name = 'world_id';
  
  RAISE NOTICE 'entry_points.world_id current type: %', world_id_type;
  
  IF world_id_type = 'uuid' THEN
    -- world_id is already UUID
    -- The UUIDs should now match the mapping table since we preserved them
    -- If any don't match, log them but don't change (they'll fail FK constraint)
    RAISE NOTICE 'Entry points with orphaned world_id UUIDs: %', (
      SELECT COUNT(*) 
      FROM public.entry_points ep
      WHERE NOT EXISTS (
        SELECT 1 FROM public.world_id_mapping wm 
        WHERE wm.uuid_id = ep.world_id
      )
    );
    
  ELSIF world_id_type = 'text' THEN
    -- world_id is TEXT, need to convert to UUID
    -- Add temporary UUID column
    ALTER TABLE public.entry_points ADD COLUMN IF NOT EXISTS world_id_new UUID;
    
    -- Populate from mapping using TEXT world_id
    UPDATE public.entry_points ep
    SET world_id_new = wm.uuid_id
    FROM public.world_id_mapping wm
    WHERE ep.world_id = wm.text_id;
    
    -- Drop old TEXT column and rename new UUID column
    ALTER TABLE public.entry_points DROP COLUMN world_id;
    ALTER TABLE public.entry_points RENAME COLUMN world_id_new TO world_id;
  END IF;
END $$;

-- Add FK
ALTER TABLE public.entry_points
ADD CONSTRAINT entry_points_world_id_fkey 
  FOREIGN KEY (world_id) REFERENCES public.world_id_mapping(uuid_id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_entry_points_world_id ON public.entry_points(world_id);

-- ============================================================================
-- STEP 4: Update characters to use UUID
-- ============================================================================

ALTER TABLE public.characters
ADD COLUMN IF NOT EXISTS world_id UUID;

-- Populate from world_slug
UPDATE public.characters c
SET world_id = wm.uuid_id
FROM public.world_id_mapping wm
WHERE c.world_slug = wm.text_id
AND c.world_id IS NULL;

-- Add FK
ALTER TABLE public.characters
DROP CONSTRAINT IF EXISTS characters_world_id_fkey;

ALTER TABLE public.characters
ADD CONSTRAINT characters_world_id_fkey
  FOREIGN KEY (world_id) REFERENCES public.world_id_mapping(uuid_id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_characters_world_id ON public.characters(world_id);

-- ============================================================================
-- STEP 5: Update premade_characters to use UUID
-- ============================================================================

-- Check if world_id column exists and what it contains
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'premade_characters'
    AND column_name = 'world_id'
  ) THEN
    -- Drop the old world_id if it has wrong UUIDs
    ALTER TABLE public.premade_characters DROP COLUMN world_id;
  END IF;
END $$;

-- Add fresh world_id column
ALTER TABLE public.premade_characters
ADD COLUMN world_id UUID;

-- Populate from world_slug (the source of truth)
UPDATE public.premade_characters pc
SET world_id = wm.uuid_id
FROM public.world_id_mapping wm
WHERE pc.world_slug = wm.text_id;

-- Add FK
ALTER TABLE public.premade_characters
DROP CONSTRAINT IF EXISTS premade_characters_world_id_fkey;

ALTER TABLE public.premade_characters
ADD CONSTRAINT premade_characters_world_id_fkey
  FOREIGN KEY (world_id) REFERENCES public.world_id_mapping(uuid_id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_premade_characters_world_id ON public.premade_characters(world_id);

-- Update unique constraint
ALTER TABLE public.premade_characters
DROP CONSTRAINT IF EXISTS premade_characters_world_slug_archetype_key_key;

ALTER TABLE public.premade_characters
DROP CONSTRAINT IF EXISTS premade_characters_world_id_archetype_key_key;

ALTER TABLE public.premade_characters
ADD CONSTRAINT premade_characters_world_id_archetype_key_key UNIQUE (world_id, archetype_key);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  mapping_count INTEGER;
  entry_null INTEGER;
  char_null INTEGER;
  premade_null INTEGER;
BEGIN
  SELECT COUNT(*) INTO mapping_count FROM public.world_id_mapping;
  SELECT COUNT(*) INTO entry_null FROM public.entry_points WHERE world_id IS NULL;
  SELECT COUNT(*) INTO char_null FROM public.characters WHERE world_id IS NULL;
  SELECT COUNT(*) INTO premade_null FROM public.premade_characters WHERE world_id IS NULL AND is_active = true;
  
  RAISE NOTICE '=== World UUID Migration Complete ===';
  RAISE NOTICE 'World mappings: %', mapping_count;
  RAISE NOTICE 'Entry points with NULL world_id: %', entry_null;
  RAISE NOTICE 'Characters with NULL world_id: %', char_null;
  RAISE NOTICE 'Premade characters with NULL world_id: %', premade_null;
  
  IF entry_null > 0 OR char_null > 0 OR premade_null > 0 THEN
    RAISE WARNING 'Some records have NULL world_id - they may need manual fixing';
  ELSE
    RAISE NOTICE 'All records properly migrated!';
  END IF;
END $$;

COMMIT;

