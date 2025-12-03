-- Fix Type Mismatch: compiled_stories.source_story_id
-- The error indicates chimera_stories.id is UUID, but source_story_id was defined as TEXT
-- This migration fixes the type mismatch and ensures all foreign keys are correct

BEGIN;

-- ============================================================================
-- FIX COMPILED_STORIES.SOURCE_STORY_ID: Change from TEXT to UUID
-- ============================================================================

-- Step 1: Drop the existing foreign key constraint if it exists (it may have failed to create)
DO $$
BEGIN
  -- Drop the constraint if it exists (it may have failed due to type mismatch)
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'compiled_stories_source_story_id_fkey'
  ) THEN
    ALTER TABLE compiled_stories DROP CONSTRAINT compiled_stories_source_story_id_fkey;
  END IF;
END $$;

-- Step 2: Drop the column if it exists (to recreate with correct type)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'compiled_stories' 
    AND column_name = 'source_story_id'
  ) THEN
    ALTER TABLE compiled_stories DROP COLUMN source_story_id;
  END IF;
END $$;

-- Step 3: Add source_story_id as UUID with proper foreign key
ALTER TABLE compiled_stories
ADD COLUMN source_story_id UUID REFERENCES chimera_stories(id) ON DELETE CASCADE;

-- Step 4: Recreate the index
CREATE INDEX IF NOT EXISTS idx_compiled_stories_source_story_id 
  ON compiled_stories(source_story_id);

COMMENT ON COLUMN compiled_stories.source_story_id IS 
  'Foreign key to chimera_stories.id (UUID). References the draft story that was compiled.';

-- ============================================================================
-- SAFETY CHECK: Verify chimera_stories and chimera_worlds field types
-- ============================================================================

-- Check chimera_stories.id type
DO $$
DECLARE
  stories_id_type TEXT;
  worlds_id_type TEXT;
  stories_world_id_type TEXT;
  stories_owner_id_type TEXT;
BEGIN
  -- Get actual column types from information_schema
  SELECT data_type INTO stories_id_type
  FROM information_schema.columns
  WHERE table_name = 'chimera_stories' AND column_name = 'id';
  
  SELECT data_type INTO worlds_id_type
  FROM information_schema.columns
  WHERE table_name = 'chimera_worlds' AND column_name = 'id';
  
  SELECT data_type INTO stories_world_id_type
  FROM information_schema.columns
  WHERE table_name = 'chimera_stories' AND column_name = 'world_id';
  
  SELECT data_type INTO stories_owner_id_type
  FROM information_schema.columns
  WHERE table_name = 'chimera_stories' AND column_name = 'owner_user_id';
  
  -- Log the types for debugging
  RAISE NOTICE 'chimera_stories.id type: %', stories_id_type;
  RAISE NOTICE 'chimera_worlds.id type: %', worlds_id_type;
  RAISE NOTICE 'chimera_stories.world_id type: %', stories_world_id_type;
  RAISE NOTICE 'chimera_stories.owner_user_id type: %', stories_owner_id_type;
  
  -- Verify chimera_stories.id is UUID (as per error message)
  IF stories_id_type != 'uuid' THEN
    RAISE WARNING 'chimera_stories.id is % (expected uuid). This may cause issues.', stories_id_type;
  END IF;
  
  -- Verify chimera_worlds.id is UUID
  IF worlds_id_type != 'uuid' THEN
    RAISE WARNING 'chimera_worlds.id is % (expected uuid). This may cause issues.', worlds_id_type;
  END IF;
  
  -- Verify chimera_stories.owner_user_id is UUID
  IF stories_owner_id_type != 'uuid' THEN
    RAISE WARNING 'chimera_stories.owner_user_id is % (expected uuid). This may cause issues.', stories_owner_id_type;
  END IF;
  
  -- Note: world_id may be TEXT if it references chimera_worlds.key instead of id
  -- This is acceptable if the schema design uses 'key' as the reference
END $$;

COMMIT;






