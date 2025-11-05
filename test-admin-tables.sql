-- Test Admin Tables
-- Simple test to verify tables are working

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

-- Test creating an entry (requires a world_id, so we'll use a placeholder)
-- First check if worlds table exists and has data
DO $$
DECLARE
  world_count integer;
  test_world_id uuid;
BEGIN
  SELECT COUNT(*) INTO world_count FROM public.worlds;
  
  IF world_count = 0 THEN
    -- Create a test world if none exist
    INSERT INTO public.worlds (id, name, slug, description, status)
    VALUES (gen_random_uuid(), 'Test World', 'test-world', 'A test world', 'active')
    RETURNING id INTO test_world_id;
  ELSE
    -- Use the first available world
    SELECT id INTO test_world_id FROM public.worlds LIMIT 1;
  END IF;

  -- Create test entry
  INSERT INTO public.entries (name, slug, world_id, description, status, tags, difficulty, visibility)
  VALUES ('Test Entry', 'test-entry', test_world_id, 'A test entry', 'active', ARRAY['test', 'demo'], 'medium', 'public')
  ON CONFLICT (slug) DO NOTHING;
END $$;

-- Test creating an entry point
INSERT INTO public.entry_points (id, name, slug, type, title, description, content_rating, lifecycle, prompt)
VALUES ('test-entry-point-1', 'Test Entry Point', 'test-entry-point', 'adventure', 'Test Adventure', 'A test adventure entry point', 'PG', 'active', '{"scenario": "You find yourself in a test location..."}')
ON CONFLICT (id) DO NOTHING;

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











