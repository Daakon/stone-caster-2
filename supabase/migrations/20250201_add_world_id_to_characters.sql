-- Add world_id UUID column to characters table for consistency
-- This allows using UUID (like entry_points) instead of only text slug

BEGIN;

-- Add world_id column
ALTER TABLE public.characters 
ADD COLUMN IF NOT EXISTS world_id UUID;

-- Populate world_id from world_id_mapping using world_slug
UPDATE public.characters c
SET world_id = wm.uuid_id
FROM public.world_id_mapping wm
WHERE c.world_slug = wm.text_id
AND c.world_id IS NULL;

-- Create index for world_id lookups
CREATE INDEX IF NOT EXISTS idx_characters_world_id 
ON public.characters(world_id);

-- Add comment
COMMENT ON COLUMN public.characters.world_id IS 'World UUID (maps to entry_points.world_id, preferred over world_slug)';

COMMIT;

