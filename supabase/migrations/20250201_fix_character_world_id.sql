-- Fix characters.world_id that are NULL
-- Populate from world_id_mapping using world_slug

BEGIN;

-- Check current state
DO $$
DECLARE
  char_null_count INTEGER;
  char_total INTEGER;
  mapping_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO char_total FROM public.characters;
  SELECT COUNT(*) INTO char_null_count FROM public.characters WHERE world_id IS NULL;
  SELECT COUNT(*) INTO mapping_count FROM public.world_id_mapping;
  
  RAISE NOTICE '=== Character World ID Status ===';
  RAISE NOTICE 'Total characters: %', char_total;
  RAISE NOTICE 'Characters with NULL world_id: %', char_null_count;
  RAISE NOTICE 'World mappings available: %', mapping_count;
  
  -- Show what world_slugs exist on characters
  RAISE NOTICE 'Character world_slugs: %', (
    SELECT array_agg(DISTINCT world_slug) FROM public.characters
  );
  
  -- Show what text_ids exist in mapping
  RAISE NOTICE 'Mapping text_ids: %', (
    SELECT array_agg(text_id) FROM public.world_id_mapping
  );
END $$;

-- Update characters with NULL world_id
UPDATE public.characters c
SET world_id = wm.uuid_id
FROM public.world_id_mapping wm
WHERE c.world_slug = wm.text_id
AND c.world_id IS NULL;

-- Verify
DO $$
DECLARE
  char_null_after INTEGER;
  char_updated INTEGER;
BEGIN
  SELECT COUNT(*) INTO char_null_after FROM public.characters WHERE world_id IS NULL;
  SELECT COUNT(*) INTO char_updated FROM public.characters WHERE world_id IS NOT NULL;
  
  RAISE NOTICE '=== After Update ===';
  RAISE NOTICE 'Characters with NULL world_id: %', char_null_after;
  RAISE NOTICE 'Characters with world_id: %', char_updated;
  
  IF char_null_after > 0 THEN
    RAISE WARNING 'Some characters still have NULL world_id - their world_slug may not match any mapping.text_id';
    
    -- Show mismatches
    RAISE WARNING 'Unmatched world_slugs: %', (
      SELECT array_agg(DISTINCT c.world_slug)
      FROM public.characters c
      WHERE c.world_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.world_id_mapping wm WHERE wm.text_id = c.world_slug
      )
    );
  END IF;
END $$;

COMMIT;
