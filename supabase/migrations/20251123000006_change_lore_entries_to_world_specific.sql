-- Change chimera_lore_entries from story-specific to world-specific
-- This migration:
-- 1. Adds world_id column (UUID, references chimera_worlds.id)
-- 2. Migrates existing data by looking up world_id from chimera_stories
-- 3. Drops story_id column and related constraints
-- 4. Updates indexes and comments

BEGIN;

-- ============================================================================
-- STEP 1: Check if table exists and current state
-- ============================================================================

DO $$
DECLARE
  table_exists BOOLEAN;
  has_story_id BOOLEAN;
  has_world_id BOOLEAN;
  row_count INTEGER;
BEGIN
  -- Check if table exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'chimera_lore_entries'
  ) INTO table_exists;

  IF NOT table_exists THEN
    RAISE NOTICE 'Table chimera_lore_entries does not exist, creating it with world_id';
    
    -- Create table with world_id from the start
    CREATE TABLE public.chimera_lore_entries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      world_id UUID REFERENCES public.chimera_worlds(id) ON DELETE CASCADE,
      display_name TEXT NOT NULL,
      entry_text TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_chimera_lore_entries_world_id 
      ON public.chimera_lore_entries(world_id);

    COMMENT ON TABLE public.chimera_lore_entries IS 
      'World-specific lore entries for Pure RAG system. These entries are vectorized by the compiler for semantic search during narrative generation. Stories reference lore from their world.';
    COMMENT ON COLUMN public.chimera_lore_entries.world_id IS 
      'Foreign key to chimera_worlds.id. Lore entries are world-specific.';
    
    RAISE NOTICE 'Created chimera_lore_entries table with world_id';
    RETURN;
  END IF;

  -- Check current columns
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'chimera_lore_entries' 
    AND column_name = 'story_id'
  ) INTO has_story_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'chimera_lore_entries' 
    AND column_name = 'world_id'
  ) INTO has_world_id;

  SELECT COUNT(*) INTO row_count FROM public.chimera_lore_entries;

  RAISE NOTICE 'Table exists. Has story_id: %, Has world_id: %, Row count: %', has_story_id, has_world_id, row_count;
END $$;

-- ============================================================================
-- STEP 2: Add world_id column if it doesn't exist
-- ============================================================================

ALTER TABLE public.chimera_lore_entries
ADD COLUMN IF NOT EXISTS world_id UUID REFERENCES public.chimera_worlds(id) ON DELETE CASCADE;

-- ============================================================================
-- STEP 3: Migrate existing data from story_id to world_id
-- ============================================================================

-- Migrate data: Get world_id from chimera_stories
-- Cast both sides to TEXT to avoid type mismatch issues
-- (chimera_stories.id is UUID, but story_id might be TEXT)
DO $$
DECLARE
  stories_id_type TEXT;
  has_story_id BOOLEAN;
  update_count INTEGER;
BEGIN
  -- Check if story_id column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'chimera_lore_entries' 
    AND column_name = 'story_id'
  ) INTO has_story_id;

  IF NOT has_story_id THEN
    RAISE NOTICE 'story_id column does not exist, skipping migration';
    RETURN;
  END IF;

  -- Check what type chimera_stories.id actually is (for logging)
  SELECT data_type INTO stories_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' 
  AND table_name = 'chimera_stories' 
  AND column_name = 'id';

  RAISE NOTICE 'chimera_stories.id type: %', stories_id_type;

  -- Migrate data: Always compare as TEXT to avoid type casting issues
  -- Use dynamic SQL to avoid compilation errors if column doesn't exist
  EXECUTE '
    UPDATE public.chimera_lore_entries le
    SET world_id = (
      SELECT s.world_id 
      FROM public.chimera_stories s 
      WHERE s.id::TEXT = le.story_id::TEXT
      LIMIT 1
    )
    WHERE le.world_id IS NULL 
    AND le.story_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.chimera_stories s 
      WHERE s.id::TEXT = le.story_id::TEXT 
      AND s.world_id IS NOT NULL
    )
  ';
  
  GET DIAGNOSTICS update_count = ROW_COUNT;
  RAISE NOTICE 'Migrated % lore entries (chimera_stories.id type: %)', update_count, stories_id_type;
END $$;

-- Log migration results
DO $$
DECLARE
  migrated_count INTEGER;
  failed_count INTEGER;
  null_world_count INTEGER;
  has_story_id BOOLEAN;
BEGIN
  -- Check if story_id column exists before trying to use it
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'chimera_lore_entries' 
    AND column_name = 'story_id'
  ) INTO has_story_id;

  SELECT COUNT(*) INTO migrated_count
  FROM public.chimera_lore_entries
  WHERE world_id IS NOT NULL;
  
  IF has_story_id THEN
    -- Use dynamic SQL to check failed migrations if story_id exists
    EXECUTE '
      SELECT COUNT(*) FROM public.chimera_lore_entries
      WHERE story_id IS NOT NULL AND world_id IS NULL
    ' INTO failed_count;
    
    -- Check for stories without world_id (compare as TEXT to avoid type issues)
    EXECUTE '
      SELECT COUNT(*) FROM public.chimera_lore_entries le
      WHERE le.story_id IS NOT NULL 
      AND le.world_id IS NULL
      AND EXISTS (
        SELECT 1 FROM public.chimera_stories s 
        WHERE s.id::TEXT = le.story_id::TEXT 
        AND s.world_id IS NULL
      )
    ' INTO null_world_count;
  ELSE
    failed_count := 0;
    null_world_count := 0;
  END IF;
  
  RAISE NOTICE 'Migrated % lore entries successfully', migrated_count;
  IF failed_count > 0 THEN
    RAISE WARNING 'Failed to migrate % lore entries (story not found or story has no world_id)', failed_count;
  END IF;
  IF null_world_count > 0 THEN
    RAISE WARNING '% lore entries reference stories without world_id (these will need manual cleanup)', null_world_count;
  END IF;
END $$;

-- ============================================================================
-- STEP 4: Drop old story_id column and constraints
-- ============================================================================

-- Drop FK constraint on story_id if it exists
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN 
    SELECT conname FROM pg_constraint 
    WHERE conrelid = 'public.chimera_lore_entries'::regclass
    AND conname LIKE '%story_id%'
  LOOP
    EXECUTE format('ALTER TABLE public.chimera_lore_entries DROP CONSTRAINT IF EXISTS %I', rec.conname);
    RAISE NOTICE 'Dropped constraint: %', rec.conname;
  END LOOP;
END $$;

-- Drop index on story_id if it exists
DROP INDEX IF EXISTS public.idx_chimera_lore_entries_story_id;

-- Drop story_id column
ALTER TABLE public.chimera_lore_entries
DROP COLUMN IF EXISTS story_id;

-- ============================================================================
-- STEP 5: Create index on world_id
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_chimera_lore_entries_world_id 
  ON public.chimera_lore_entries(world_id)
  WHERE world_id IS NOT NULL;

-- ============================================================================
-- STEP 6: Update comments
-- ============================================================================

COMMENT ON TABLE public.chimera_lore_entries IS 
  'World-specific lore entries for Pure RAG system. These entries are vectorized by the compiler for semantic search during narrative generation. Stories reference lore from their world.';
COMMENT ON COLUMN public.chimera_lore_entries.world_id IS 
  'Foreign key to chimera_worlds.id (UUID). Lore entries are world-specific. Stories can reference lore entries from their world during compilation.';

COMMIT;

