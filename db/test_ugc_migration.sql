-- Test script for UGC ownership and moderation migration
-- This script can be run to test the UGC migration on a clean database

-- ============================================================================
-- STEP 1: Apply the core schema migration (if not already applied)
-- ============================================================================

-- Read and execute the core schema migration
\i db/migrations/20250130000000_core_schema.sql

-- ============================================================================
-- STEP 2: Apply the UGC migration
-- ============================================================================

-- Read and execute the UGC migration
\i db/migrations/20250130000001_ugc_ownership_moderation.sql

-- ============================================================================
-- STEP 3: Run UGC verification
-- ============================================================================

-- Read and execute the UGC verification script
\i db/verification/verify_ugc.sql

-- ============================================================================
-- STEP 4: Test UGC functionality with sample data
-- ============================================================================

-- Test UGC workflow with sample data
DO $$
DECLARE
    test_world_id text := 'test.ugc.world';
    test_ruleset_id text := 'test.ugc.ruleset';
    test_user_id uuid := gen_random_uuid();
    test_moderator_id uuid := gen_random_uuid();
    test_entry_id text := 'test.ugc.entry';
    review_id bigint;
BEGIN
    RAISE NOTICE 'Testing UGC workflow with sample data...';
    
    -- Create test world and ruleset
    INSERT INTO worlds (id, version, status, doc) 
    VALUES (test_world_id, '1.0.0', 'active', '{"name": "Test UGC World", "description": "A test world for UGC validation"}');
    
    INSERT INTO rulesets (id, version, status, doc) 
    VALUES (test_ruleset_id, '1.0.0', 'active', '{"name": "Test UGC Ruleset", "description": "A test ruleset for UGC validation"}');
    
    -- Test 1: Create a draft entry by a user
    INSERT INTO entry_points (id, slug, type, world_id, ruleset_id, title, description, owner_user_id, lifecycle, visibility) 
    VALUES (test_entry_id, 'test-ugc-adventure', 'adventure', test_world_id, test_ruleset_id, 'Test UGC Adventure', 'A test adventure created by a user', test_user_id, 'draft', 'public');
    
    RAISE NOTICE 'Created draft entry with owner: %', test_user_id;
    
    -- Test 2: Submit for review
    UPDATE entry_points 
    SET lifecycle = 'pending_review' 
    WHERE id = test_entry_id;
    
    -- Create a review request
    INSERT INTO content_reviews (target_type, target_id, submitted_by, state, notes) 
    VALUES ('entry_point', test_entry_id, test_user_id, 'open', 'Please review this adventure for publication')
    RETURNING id INTO review_id;
    
    RAISE NOTICE 'Submitted entry for review (review ID: %)', review_id;
    
    -- Test 3: Moderator reviews and requests changes
    UPDATE content_reviews 
    SET state = 'changes_requested', reviewer_id = test_moderator_id, notes = 'Please add more detail to the description'
    WHERE id = review_id;
    
    UPDATE entry_points 
    SET lifecycle = 'changes_requested' 
    WHERE id = test_entry_id;
    
    RAISE NOTICE 'Moderator requested changes';
    
    -- Test 4: Creator makes changes and resubmits
    UPDATE entry_points 
    SET description = 'A detailed test adventure created by a user with comprehensive gameplay', lifecycle = 'pending_review'
    WHERE id = test_entry_id;
    
    UPDATE content_reviews 
    SET state = 'open', notes = 'Updated description, please review again'
    WHERE id = review_id;
    
    RAISE NOTICE 'Creator updated and resubmitted';
    
    -- Test 5: Moderator approves
    UPDATE content_reviews 
    SET state = 'approved', reviewer_id = test_moderator_id, notes = 'Approved for publication'
    WHERE id = review_id;
    
    UPDATE entry_points 
    SET lifecycle = 'active' 
    WHERE id = test_entry_id;
    
    RAISE NOTICE 'Moderator approved entry for publication';
    
    -- Test 6: Test content reporting
    INSERT INTO content_reports (target_type, target_id, reporter_id, reason) 
    VALUES ('entry_point', test_entry_id, test_user_id, 'Test report for validation');
    
    RAISE NOTICE 'Content report created';
    
    -- Test 7: Test search functionality with UGC content
    SELECT 'Testing search with UGC content...' as status;
    
    -- This should find the UGC content
    SELECT id, title, lifecycle, visibility, owner_user_id 
    FROM entry_points 
    WHERE search_text @@ to_tsquery('english', 'adventure:*')
    AND lifecycle = 'active'
    AND visibility = 'public';
    
    RAISE NOTICE 'Search functionality working with UGC content';
    
    -- Clean up test data
    DELETE FROM content_reports WHERE target_id = test_entry_id;
    DELETE FROM content_reviews WHERE id = review_id;
    DELETE FROM entry_points WHERE id = test_entry_id;
    DELETE FROM rulesets WHERE id = test_ruleset_id;
    DELETE FROM worlds WHERE id = test_world_id;
    
    RAISE NOTICE 'UGC workflow test completed successfully';
    
EXCEPTION
    WHEN OTHERS THEN
        -- Clean up on error
        DELETE FROM content_reports WHERE target_id = test_entry_id;
        DELETE FROM content_reviews WHERE id = review_id;
        DELETE FROM entry_points WHERE id = test_entry_id;
        DELETE FROM rulesets WHERE id = test_ruleset_id;
        DELETE FROM worlds WHERE id = test_world_id;
        RAISE;
END $$;

-- ============================================================================
-- STEP 5: Test constraint violations
-- ============================================================================

-- Test invalid lifecycle values
DO $$
DECLARE
    test_world_id text := 'test.constraint.world';
    test_ruleset_id text := 'test.constraint.ruleset';
    test_user_id uuid := gen_random_uuid();
BEGIN
    -- Create temporary test data
    INSERT INTO worlds (id, version, status, doc) 
    VALUES (test_world_id, '1.0.0', 'active', '{"name": "Test Constraint World"}');
    
    INSERT INTO rulesets (id, version, status, doc) 
    VALUES (test_ruleset_id, '1.0.0', 'active', '{"name": "Test Constraint Ruleset"}');
    
    -- Test invalid lifecycle
    BEGIN
        INSERT INTO entry_points (id, slug, type, world_id, ruleset_id, title, description, owner_user_id, lifecycle) 
        VALUES ('test.constraint.entry', 'test-constraint', 'adventure', test_world_id, test_ruleset_id, 'Test Constraint', 'A test for constraints', test_user_id, 'invalid_lifecycle');
        RAISE EXCEPTION 'Invalid lifecycle was accepted (this should not happen)';
    EXCEPTION
        WHEN check_violation THEN
            RAISE NOTICE 'Invalid lifecycle correctly rejected (PASS)';
    END;
    
    -- Test invalid review state
    BEGIN
        INSERT INTO content_reviews (target_type, target_id, submitted_by, state) 
        VALUES ('entry_point', 'test.constraint.entry', test_user_id, 'invalid_state');
        RAISE EXCEPTION 'Invalid review state was accepted (this should not happen)';
    EXCEPTION
        WHEN check_violation THEN
            RAISE NOTICE 'Invalid review state correctly rejected (PASS)';
    END;
    
    -- Clean up
    DELETE FROM rulesets WHERE id = test_ruleset_id;
    DELETE FROM worlds WHERE id = test_world_id;
    
    RAISE NOTICE 'Constraint violation tests completed successfully';
    
EXCEPTION
    WHEN OTHERS THEN
        -- Clean up on error
        DELETE FROM rulesets WHERE id = test_ruleset_id;
        DELETE FROM worlds WHERE id = test_world_id;
        RAISE;
END $$;

-- Final verification
SELECT 'UGC migration test completed successfully!' as result;
