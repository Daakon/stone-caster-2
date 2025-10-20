-- Test script for core schema migration
-- This script can be run to test the migration on a clean database

-- ============================================================================
-- STEP 1: Apply the migration
-- ============================================================================

-- Read and execute the core schema migration
\i db/migrations/20250130000000_core_schema.sql

-- ============================================================================
-- STEP 2: Run verification
-- ============================================================================

-- Read and execute the verification script
\i db/verification/verify_core_schema.sql

-- ============================================================================
-- STEP 3: Additional tests
-- ============================================================================

-- Test that we can insert sample data
DO $$
BEGIN
    -- Insert a test world
    INSERT INTO worlds (id, version, status, doc) 
    VALUES ('test.world', '1.0.0', 'active', '{"name": "Test World", "description": "A test world for validation"}');
    
    -- Insert a test ruleset
    INSERT INTO rulesets (id, version, status, doc) 
    VALUES ('test.ruleset', '1.0.0', 'active', '{"name": "Test Ruleset", "description": "A test ruleset for validation"}');
    
    -- Insert a test entry point
    INSERT INTO entry_points (id, slug, type, world_id, ruleset_id, title, description, tags) 
    VALUES ('test.entry', 'test-adventure', 'adventure', 'test.world', 'test.ruleset', 'Test Adventure', 'A test adventure for validation', ARRAY['test', 'demo']);
    
    -- Insert a test prompt segment
    INSERT INTO prompt_segments (scope, ref_id, content, metadata) 
    VALUES ('core', NULL, 'You are a helpful AI assistant.', '{"type": "system"}');
    
    -- Insert a test game
    INSERT INTO games (entry_point_id, entry_point_type, world_id, ruleset_id, owner_user_id, state) 
    VALUES ('test.entry', 'adventure', 'test.world', 'test.ruleset', gen_random_uuid(), '{"hot": {"player": "test"}, "warm": {}, "cold": {}}');
    
    -- Get the game ID for the turn
    DECLARE
        game_uuid uuid;
    BEGIN
        SELECT id INTO game_uuid FROM games WHERE entry_point_id = 'test.entry' LIMIT 1;
        
        -- Insert a test turn
        INSERT INTO turns (game_id, idx, role, content, prompt_meta) 
        VALUES (game_uuid, 1, 'system', '{"message": "Welcome to the test adventure!"}', '{"prompt_id": "test"}');
    END;
    
    RAISE NOTICE 'Sample data inserted successfully';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error inserting sample data: %', SQLERRM;
        RAISE;
END $$;

-- Test search functionality
SELECT 'Testing search functionality...' as status;

-- This should use the GIN index
EXPLAIN (ANALYZE, BUFFERS) 
SELECT id, title, search_text 
FROM entry_points 
WHERE search_text @@ to_tsquery('english', 'test:*')
ORDER BY sort_weight DESC;

-- Test foreign key constraints
SELECT 'Testing foreign key constraints...' as status;

-- This should fail due to foreign key constraint
DO $$
BEGIN
    BEGIN
        INSERT INTO entry_points (id, slug, type, world_id, ruleset_id, title, description) 
        VALUES ('test.invalid', 'invalid-adventure', 'adventure', 'nonexistent.world', 'nonexistent.ruleset', 'Invalid Adventure', 'This should fail');
        RAISE EXCEPTION 'Foreign key constraint not working!';
    EXCEPTION
        WHEN foreign_key_violation THEN
            RAISE NOTICE 'Foreign key constraint working correctly';
    END;
END $$;

-- Test check constraints
SELECT 'Testing check constraints...' as status;

-- This should fail due to check constraint
DO $$
BEGIN
    BEGIN
        INSERT INTO entry_points (id, slug, type, world_id, ruleset_id, title, description, status) 
        VALUES ('test.invalid2', 'invalid-adventure-2', 'adventure', 'test.world', 'test.ruleset', 'Invalid Adventure 2', 'This should fail', 'invalid_status');
        RAISE EXCEPTION 'Check constraint not working!';
    EXCEPTION
        WHEN check_violation THEN
            RAISE NOTICE 'Check constraint working correctly';
    END;
END $$;

-- Clean up test data
DELETE FROM turns WHERE game_id IN (SELECT id FROM games WHERE entry_point_id = 'test.entry');
DELETE FROM games WHERE entry_point_id = 'test.entry';
DELETE FROM entry_points WHERE id = 'test.entry';
DELETE FROM prompt_segments WHERE scope = 'core' AND ref_id IS NULL;
DELETE FROM rulesets WHERE id = 'test.ruleset';
DELETE FROM worlds WHERE id = 'test.world';

SELECT 'Test data cleaned up' as status;

-- Final verification
SELECT 'Core schema migration test completed successfully!' as result;
