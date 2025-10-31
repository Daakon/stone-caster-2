-- Simplify world references: Just use TEXT slugs everywhere
-- Drop the unnecessary UUID columns and mapping complexity

BEGIN;

-- 1. Drop world_id UUID columns (they're not populated and add complexity)
ALTER TABLE public.characters 
DROP COLUMN IF EXISTS world_id;

ALTER TABLE public.premade_characters
DROP COLUMN IF EXISTS world_id;

-- 2. Ensure world_slug is properly indexed
CREATE INDEX IF NOT EXISTS idx_characters_world_slug 
ON public.characters(world_slug);

CREATE INDEX IF NOT EXISTS idx_premade_characters_world_slug
ON public.premade_characters(world_slug);

-- 3. entry_points.world_id should just be TEXT (it already is in practice)
-- Verify it matches worlds.id (text)
DO $$
BEGIN
  -- Check if any entry_points reference non-existent worlds
  IF EXISTS (
    SELECT 1 
    FROM public.entry_points ep
    WHERE ep.world_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.worlds w WHERE w.id = ep.world_id)
  ) THEN
    RAISE WARNING 'Some entry_points reference non-existent worlds in entry_points.world_id';
  END IF;
END $$;

COMMIT;

-- Summary: Now everything uses TEXT slugs consistently:
-- - worlds.id = TEXT ("mystika")
-- - characters.world_slug = TEXT ("mystika")
-- - premade_characters.world_slug = TEXT ("mystika")
-- - entry_points.world_id = TEXT ("mystika")

