-- Fix: Add character_schema_contributions column to chimera_worlds
-- This migration ensures the column exists even if it was removed during rework
-- Phase 3: Character Creation Gate - Make World modular
-- This column holds schema definitions that the World contributes to a character's starting form

BEGIN;

-- Add character_schema_contributions column if it doesn't exist
-- Using IF NOT EXISTS to make this migration idempotent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'chimera_worlds' 
    AND column_name = 'character_schema_contributions'
  ) THEN
    ALTER TABLE public.chimera_worlds
      ADD COLUMN character_schema_contributions jsonb NOT NULL DEFAULT '{}'::jsonb;
    
    -- Add comment for documentation
    COMMENT ON COLUMN public.chimera_worlds.character_schema_contributions IS 
      'JSON schema definitions (e.g., { "essence_alignment": { ... } }) that the World contributes to character creation';
    
    -- Create index for JSONB queries (optional, but useful for filtering/searching)
    CREATE INDEX IF NOT EXISTS idx_chimera_worlds_character_schema_contributions 
      ON public.chimera_worlds USING gin (character_schema_contributions);
    
    RAISE NOTICE 'Added character_schema_contributions column to chimera_worlds';
  ELSE
    RAISE NOTICE 'Column character_schema_contributions already exists in chimera_worlds';
  END IF;
END $$;

COMMIT;

