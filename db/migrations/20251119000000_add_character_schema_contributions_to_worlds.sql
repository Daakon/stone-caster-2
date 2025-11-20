-- Add character_schema_contributions column to chimera_worlds
-- Phase 3: Character Creation Gate - Make World modular
-- This column holds schema definitions that the World contributes to a character's starting form

BEGIN;

-- Add character_schema_contributions column
ALTER TABLE public.chimera_worlds
  ADD COLUMN IF NOT EXISTS character_schema_contributions jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.chimera_worlds.character_schema_contributions IS 
  'JSON schema definitions (e.g., { "essence_alignment": { ... } }) that the World contributes to character creation';

-- Create index for JSONB queries (optional, but useful for filtering/searching)
CREATE INDEX IF NOT EXISTS idx_chimera_worlds_character_schema_contributions 
  ON public.chimera_worlds USING gin (character_schema_contributions);

COMMIT;

