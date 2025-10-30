-- Comprehensive Entries & Entry Points Migration
-- Adds missing columns and establishes proper relationships

BEGIN;

-- ============================================================================
-- ADD MISSING COLUMNS TO ENTRIES TABLE
-- ============================================================================

-- Add slug column to entries table (if it doesn't exist)
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS slug text;
CREATE UNIQUE INDEX IF NOT EXISTS entries_slug_uq ON public.entries(slug);

-- Add prompt column to entries table (handle existing text columns)
DO $$
BEGIN
  -- Check if prompt column already exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'entries' 
    AND table_schema = 'public' 
    AND column_name = 'prompt'
  ) THEN
    -- Column exists, check if it's jsonb type
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'entries' 
      AND table_schema = 'public' 
      AND column_name = 'prompt'
      AND data_type = 'jsonb'
    ) THEN
      -- It's already jsonb, just create the index
      CREATE INDEX IF NOT EXISTS entries_prompt_gin_idx ON public.entries USING gin (prompt);
    ELSE
      -- It's text type, convert to jsonb safely
      BEGIN
        ALTER TABLE public.entries ALTER COLUMN prompt TYPE jsonb USING prompt::jsonb;
        CREATE INDEX IF NOT EXISTS entries_prompt_gin_idx ON public.entries USING gin (prompt);
      EXCEPTION WHEN OTHERS THEN
        -- If conversion fails, drop the column and recreate as jsonb
        ALTER TABLE public.entries DROP COLUMN IF EXISTS prompt;
        ALTER TABLE public.entries ADD COLUMN prompt jsonb DEFAULT '{}';
        CREATE INDEX IF NOT EXISTS entries_prompt_gin_idx ON public.entries USING gin (prompt);
      END;
    END IF;
  ELSE
    -- Column doesn't exist, create as jsonb
    ALTER TABLE public.entries ADD COLUMN prompt jsonb DEFAULT '{}';
    CREATE INDEX IF NOT EXISTS entries_prompt_gin_idx ON public.entries USING gin (prompt);
  END IF;
END $$;

-- Add additional columns for player-facing features
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS difficulty text DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard'));
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'public' CHECK (visibility IN ('public', 'unlisted', 'private'));
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS entry_point_id text;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS entries_tags_gin_idx ON public.entries USING gin (tags);
CREATE INDEX IF NOT EXISTS entries_difficulty_idx ON public.entries(difficulty);
CREATE INDEX IF NOT EXISTS entries_visibility_idx ON public.entries(visibility);
CREATE INDEX IF NOT EXISTS entries_entry_point_idx ON public.entries(entry_point_id);

-- ============================================================================
-- ADD MISSING COLUMNS TO ENTRY_POINTS TABLE
-- ============================================================================

-- Add slug column to entry_points table (if it doesn't exist)
ALTER TABLE public.entry_points ADD COLUMN IF NOT EXISTS slug text;
CREATE UNIQUE INDEX IF NOT EXISTS entry_points_slug_uq ON public.entry_points(slug);

-- Add prompt column to entry_points table (handle existing text columns)
DO $$
BEGIN
  -- Check if prompt column already exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'entry_points' 
    AND table_schema = 'public' 
    AND column_name = 'prompt'
  ) THEN
    -- Column exists, check if it's jsonb type
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'entry_points' 
      AND table_schema = 'public' 
      AND column_name = 'prompt'
      AND data_type = 'jsonb'
    ) THEN
      -- It's already jsonb, just create the index
      CREATE INDEX IF NOT EXISTS entry_points_prompt_gin_idx ON public.entry_points USING gin (prompt);
    ELSE
      -- It's text type, convert to jsonb safely
      BEGIN
        ALTER TABLE public.entry_points ALTER COLUMN prompt TYPE jsonb USING prompt::jsonb;
        CREATE INDEX IF NOT EXISTS entry_points_prompt_gin_idx ON public.entry_points USING gin (prompt);
      EXCEPTION WHEN OTHERS THEN
        -- If conversion fails, drop the column and recreate as jsonb
        ALTER TABLE public.entry_points DROP COLUMN IF EXISTS prompt;
        ALTER TABLE public.entry_points ADD COLUMN prompt jsonb DEFAULT '{}';
        CREATE INDEX IF NOT EXISTS entry_points_prompt_gin_idx ON public.entry_points USING gin (prompt);
      END;
    END IF;
  ELSE
    -- Column doesn't exist, create as jsonb
    ALTER TABLE public.entry_points ADD COLUMN prompt jsonb DEFAULT '{}';
    CREATE INDEX IF NOT EXISTS entry_points_prompt_gin_idx ON public.entry_points USING gin (prompt);
  END IF;
END $$;

-- Add entry_id column to link entry_points to entries
ALTER TABLE public.entry_points ADD COLUMN IF NOT EXISTS entry_id uuid REFERENCES public.entries(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS entry_points_entry_id_idx ON public.entry_points(entry_id);

-- ============================================================================
-- ADD COMMENTS TO DOCUMENT THE NEW COLUMNS
-- ============================================================================

COMMENT ON COLUMN public.entries.slug IS 'URL-friendly identifier for entries';
COMMENT ON COLUMN public.entries.prompt IS 'JSONB field for storing entry prompt data and AI instructions';
COMMENT ON COLUMN public.entries.tags IS 'Array of tags for filtering and discovery';
COMMENT ON COLUMN public.entries.difficulty IS 'Difficulty level for player matching';
COMMENT ON COLUMN public.entries.visibility IS 'Visibility setting for player discovery';
COMMENT ON COLUMN public.entries.entry_point_id IS 'Reference to the entry point JSON for initialization';

COMMENT ON COLUMN public.entry_points.slug IS 'URL-friendly identifier for entry points';
COMMENT ON COLUMN public.entry_points.prompt IS 'JSONB field for storing turn-1 injection JSON';
COMMENT ON COLUMN public.entry_points.entry_id IS 'Reference to the entry this point initializes';

COMMIT;

-- ============================================================================
-- VERIFY THE CHANGES
-- ============================================================================

-- Check entries table schema
SELECT 
  'entries' as table_name,
  column_name, 
  data_type, 
  is_nullable, 
  column_default 
FROM information_schema.columns 
WHERE table_name = 'entries' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check entry_points table schema
SELECT 
  'entry_points' as table_name,
  column_name, 
  data_type, 
  is_nullable, 
  column_default 
FROM information_schema.columns 
WHERE table_name = 'entry_points' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- ============================================================================
-- SUMMARY
-- ============================================================================

SELECT 
  'Migration completed successfully!' as status,
  'Entries and Entry Points tables updated with missing columns' as message;








