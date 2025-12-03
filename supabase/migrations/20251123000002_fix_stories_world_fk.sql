-- Fix chimera_stories.world_id Foreign Key Relationship
-- This migration:
-- 1. Converts world_id from TEXT (referencing key) to UUID (referencing id)
-- 2. Adds proper FK constraint to chimera_worlds(id)
-- 3. Handles data migration for existing records

BEGIN;

-- ============================================================================
-- STEP 1: Check current state and prepare for migration
-- ============================================================================

DO $$
DECLARE
  current_type TEXT;
  has_fk BOOLEAN;
  row_count INTEGER;
BEGIN
  -- Check current column type
  SELECT data_type INTO current_type
  FROM information_schema.columns
  WHERE table_name = 'chimera_stories' AND column_name = 'world_id';
  
  -- Check if FK constraint exists
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chimera_stories_world_id_fkey'
  ) INTO has_fk;
  
  -- Count rows with non-null world_id
  SELECT COUNT(*) INTO row_count
  FROM chimera_stories
  WHERE world_id IS NOT NULL;
  
  RAISE NOTICE 'Current world_id type: %', current_type;
  RAISE NOTICE 'FK constraint exists: %', has_fk;
  RAISE NOTICE 'Rows with world_id: %', row_count;
END $$;

-- ============================================================================
-- STEP 2: Drop existing FK constraint if it exists (may reference wrong column)
-- ============================================================================

DO $$
DECLARE
  rec RECORD;
BEGIN
  -- Drop constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chimera_stories_world_id_fkey'
  ) THEN
    ALTER TABLE chimera_stories DROP CONSTRAINT chimera_stories_world_id_fkey;
    RAISE NOTICE 'Dropped existing FK constraint';
  END IF;
  
  -- Also check for any other world-related constraints
  -- Drop any constraints that reference world columns
  FOR rec IN 
    SELECT conname FROM pg_constraint 
    WHERE conrelid = 'chimera_stories'::regclass
    AND conname LIKE '%world%'
  LOOP
    EXECUTE format('ALTER TABLE chimera_stories DROP CONSTRAINT IF EXISTS %I', rec.conname);
    RAISE NOTICE 'Dropped constraint: %', rec.conname;
  END LOOP;
END $$;

-- ============================================================================
-- STEP 3: Migrate existing data (if world_id is TEXT referencing key)
-- ============================================================================

-- Create temporary column to store UUID values
ALTER TABLE chimera_stories
ADD COLUMN IF NOT EXISTS world_id_uuid UUID;

-- Migrate data: Convert TEXT keys to UUID ids
-- Only update rows where world_id is not null and can be matched
UPDATE chimera_stories cs
SET world_id_uuid = (
  SELECT w.id 
  FROM chimera_worlds w 
  WHERE w.key = cs.world_id::TEXT
  LIMIT 1
)
WHERE cs.world_id IS NOT NULL
AND EXISTS (
  SELECT 1 FROM chimera_worlds w WHERE w.key = cs.world_id::TEXT
);

-- Log migration results
DO $$
DECLARE
  migrated_count INTEGER;
  failed_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO migrated_count
  FROM chimera_stories
  WHERE world_id_uuid IS NOT NULL;
  
  SELECT COUNT(*) INTO failed_count
  FROM chimera_stories
  WHERE world_id IS NOT NULL AND world_id_uuid IS NULL;
  
  RAISE NOTICE 'Migrated % rows successfully', migrated_count;
  IF failed_count > 0 THEN
    RAISE WARNING 'Failed to migrate % rows (world key not found)', failed_count;
  END IF;
END $$;

-- ============================================================================
-- STEP 4: Drop old column and rename new column
-- ============================================================================

-- Drop the old world_id column
ALTER TABLE chimera_stories
DROP COLUMN IF EXISTS world_id;

-- Rename the new column to world_id
ALTER TABLE chimera_stories
RENAME COLUMN world_id_uuid TO world_id;

-- ============================================================================
-- STEP 5: Add proper Foreign Key constraint
-- ============================================================================

-- Add FK constraint to chimera_worlds(id)
ALTER TABLE chimera_stories
ADD CONSTRAINT chimera_stories_world_id_fkey
FOREIGN KEY (world_id)
REFERENCES chimera_worlds(id)
ON DELETE SET NULL;

-- ============================================================================
-- STEP 6: Recreate index (if it was dropped)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_chimera_stories_world_id 
  ON chimera_stories(world_id) 
  WHERE world_id IS NOT NULL;

-- ============================================================================
-- STEP 7: Add comment
-- ============================================================================

COMMENT ON COLUMN chimera_stories.world_id IS 
  'Foreign key to chimera_worlds.id (UUID). References the world this story belongs to.';

COMMIT;

