-- Test Admin Tables (Fixed for content_rating constraint)
-- Simple test to verify tables work with existing schema

BEGIN;

-- Test creating a ruleset
INSERT INTO public.rulesets (id, name, slug, description, status)
VALUES ('test-ruleset-1', 'Test Ruleset', 'test-ruleset', 'A test ruleset', 'active')
ON CONFLICT (id) DO NOTHING;

-- Test creating an NPC
INSERT INTO public.npcs (name, slug, description, status)
VALUES ('Test NPC', 'test-npc', 'A test NPC', 'active')
ON CONFLICT (slug) DO NOTHING;

-- Test creating an NPC pack
INSERT INTO public.npc_packs (name, slug, description, status)
VALUES ('Test NPC Pack', 'test-npc-pack', 'A test NPC pack', 'active')
ON CONFLICT (slug) DO NOTHING;

-- Test creating an entry and entry point with proper constraints
DO $$
DECLARE
  world_count integer;
  test_world_id text;
  test_entry_id uuid;
BEGIN
  SELECT COUNT(*) INTO world_count FROM public.worlds;
  
  IF world_count = 0 THEN
    -- Create a test world if none exist
    INSERT INTO public.worlds (id, name, slug, description, status)
    VALUES ('test-world-1', 'Test World', 'test-world', 'A test world', 'active')
    RETURNING id INTO test_world_id;
  ELSE
    -- Use the first available world
    SELECT id INTO test_world_id FROM public.worlds LIMIT 1;
  END IF;

  -- Create test entry
  INSERT INTO public.entries (name, slug, world_id, description, status, tags, difficulty, visibility)
  VALUES ('Test Entry', 'test-entry', test_world_id, 'A test entry', 'active', ARRAY['test', 'demo'], 'medium', 'public')
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO test_entry_id;

  -- If entry already exists, get its ID
  IF test_entry_id IS NULL THEN
    SELECT id INTO test_entry_id FROM public.entries WHERE slug = 'test-entry';
  END IF;

  -- Create test entry point with valid content_rating
  -- Try common rating values: G, PG-13, R, or just use a simple text value
  INSERT INTO public.entry_points (id, name, slug, type, world_id, title, description, content_rating, lifecycle, prompt, entry_id)
  VALUES (
    'test-entry-point-1', 
    'Test Entry Point', 
    'test-entry-point', 
    'adventure', 
    test_world_id,  -- Provide the world_id
    'Test Adventure', 
    'A test adventure entry point', 
    'G',  -- Use G instead of PG
    'active', 
    '{"scenario": "You find yourself in a test location..."}',
    test_entry_id   -- Link to the entry
  )
  ON CONFLICT (id) DO NOTHING;
END $$;

COMMIT;

-- Verify the test data
SELECT 'Test data created successfully!' as status;

SELECT 'Rulesets:' as table_name, COUNT(*) as count FROM public.rulesets
UNION ALL
SELECT 'NPCs:', COUNT(*) FROM public.npcs
UNION ALL
SELECT 'NPC Packs:', COUNT(*) FROM public.npc_packs
UNION ALL
SELECT 'Entries:', COUNT(*) FROM public.entries
UNION ALL
SELECT 'Entry Points:', COUNT(*) FROM public.entry_points;









