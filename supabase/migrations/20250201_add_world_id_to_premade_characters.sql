-- Add world_id UUID column to premade_characters table for consistency
-- This allows querying by UUID (used by entry_points) instead of only by slug

BEGIN;

-- Add world_id column
ALTER TABLE public.premade_characters 
ADD COLUMN IF NOT EXISTS world_id UUID;

-- Populate world_id from world_id_mapping using world_slug
UPDATE public.premade_characters pc
SET world_id = wm.uuid_id
FROM public.world_id_mapping wm
WHERE pc.world_slug = wm.text_id
AND pc.world_id IS NULL;

-- Create index for world_id lookups
CREATE INDEX IF NOT EXISTS idx_premade_characters_world_id 
ON public.premade_characters(world_id) 
WHERE is_active = true;

-- Add comment
COMMENT ON COLUMN public.premade_characters.world_id IS 'World UUID (maps to entry_points.world_id)';

COMMIT;

