-- Add tags column to chimera_worlds table
-- Phase 9: UX Repair, World Filtering & Asset Restoration

BEGIN;

-- Add tags column as text array with default empty array
ALTER TABLE public.chimera_worlds
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- Create GIN index for efficient tag filtering
CREATE INDEX IF NOT EXISTS idx_chimera_worlds_tags 
  ON public.chimera_worlds USING GIN (tags);

-- Add comment for documentation
COMMENT ON COLUMN public.chimera_worlds.tags IS 
  'Array of tags for categorizing and filtering worlds (e.g., ["fantasy", "horror", "sci-fi"])';

COMMIT;

