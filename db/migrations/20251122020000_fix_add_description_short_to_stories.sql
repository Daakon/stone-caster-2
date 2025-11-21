-- Fix: Add description_short column to chimera_stories
-- This migration ensures the column exists even if it was removed during rework
-- The column is referenced in the API but may be missing from the schema cache

BEGIN;

-- Add description_short column if it doesn't exist
-- Using IF NOT EXISTS to make this migration idempotent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'chimera_stories' 
    AND column_name = 'description_short'
  ) THEN
    ALTER TABLE public.chimera_stories
      ADD COLUMN description_short text NULL;
    
    -- Add comment for documentation
    COMMENT ON COLUMN public.chimera_stories.description_short IS 
      'Short description of the story';
    
    RAISE NOTICE 'Added description_short column to chimera_stories';
  ELSE
    RAISE NOTICE 'Column description_short already exists in chimera_stories';
  END IF;
END $$;

COMMIT;

