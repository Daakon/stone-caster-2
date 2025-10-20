-- UGC Ownership & Moderation Verification
-- Asserts that all UGC-related tables, columns, constraints, and indexes exist
-- Tests lifecycle functionality and review flow

-- ============================================================================
-- STRUCTURE CHECKS
-- ============================================================================

-- Check that entry_points has the new UGC columns
DO $$
BEGIN
    -- Check owner_user_id column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'entry_points' 
        AND column_name = 'owner_user_id'
        AND data_type = 'uuid'
    ) THEN
        RAISE EXCEPTION 'entry_points.owner_user_id column missing or wrong type';
    END IF;
    
    -- Check lifecycle column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'entry_points' 
        AND column_name = 'lifecycle'
        AND data_type = 'text'
    ) THEN
        RAISE EXCEPTION 'entry_points.lifecycle column missing or wrong type';
    END IF;
    
    RAISE NOTICE 'entry_points UGC columns validated';
END $$;

-- Check lifecycle constraint exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'chk_entry_points_lifecycle'
        AND check_clause LIKE '%draft%pending_review%changes_requested%active%archived%rejected%'
    ) THEN
        RAISE EXCEPTION 'entry_points lifecycle constraint missing or incorrect';
    END IF;
    
    RAISE NOTICE 'entry_points lifecycle constraint validated';
END $$;

-- Check owner index exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND indexname = 'idx_entry_points_owner'
    ) THEN
        RAISE EXCEPTION 'idx_entry_points_owner index missing';
    END IF;
    
    RAISE NOTICE 'entry_points owner index validated';
END $$;

-- Check content_reviews table exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'content_reviews'
    ) THEN
        RAISE EXCEPTION 'content_reviews table missing';
    END IF;
    
    RAISE NOTICE 'content_reviews table validated';
END $$;

-- Check content_reviews columns and constraints
DO $$
BEGIN
    -- Check required columns exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'content_reviews' 
        AND column_name IN ('id', 'target_type', 'target_id', 'submitted_by', 'state', 'notes', 'reviewer_id', 'created_at', 'updated_at')
    ) THEN
        RAISE EXCEPTION 'content_reviews table missing required columns';
    END IF;
    
    -- Check target_type constraint
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name LIKE '%content_reviews_target_type%' 
        AND check_clause LIKE '%entry_point%prompt_segment%npc%'
    ) THEN
        RAISE EXCEPTION 'content_reviews target_type constraint missing';
    END IF;
    
    -- Check state constraint
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name LIKE '%content_reviews_state%' 
        AND check_clause LIKE '%open%approved%rejected%changes_requested%'
    ) THEN
        RAISE EXCEPTION 'content_reviews state constraint missing';
    END IF;
    
    RAISE NOTICE 'content_reviews structure validated';
END $$;

-- Check content_reviews indexes exist
DO $$
DECLARE
    missing_indexes text[] := ARRAY[]::text[];
    index_name text;
    expected_indexes text[] := ARRAY['idx_cr_target', 'idx_cr_state', 'idx_cr_submitted_by'];
BEGIN
    FOREACH index_name IN ARRAY expected_indexes
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE schemaname = 'public' AND indexname = index_name
        ) THEN
            missing_indexes := array_append(missing_indexes, index_name);
        END IF;
    END LOOP;
    
    IF array_length(missing_indexes, 1) > 0 THEN
        RAISE EXCEPTION 'Missing content_reviews indexes: %', array_to_string(missing_indexes, ', ');
    END IF;
    
    RAISE NOTICE 'content_reviews indexes validated';
END $$;

-- Check content_reports table exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'content_reports'
    ) THEN
        RAISE EXCEPTION 'content_reports table missing';
    END IF;
    
    RAISE NOTICE 'content_reports table validated';
END $$;

-- Check content_reports columns and constraints
DO $$
BEGIN
    -- Check required columns exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'content_reports' 
        AND column_name IN ('id', 'target_type', 'target_id', 'reporter_id', 'reason', 'created_at')
    ) THEN
        RAISE EXCEPTION 'content_reports table missing required columns';
    END IF;
    
    -- Check target_type constraint
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name LIKE '%content_reports_target_type%' 
        AND check_clause LIKE '%entry_point%prompt_segment%npc%turn%'
    ) THEN
        RAISE EXCEPTION 'content_reports target_type constraint missing';
    END IF;
    
    RAISE NOTICE 'content_reports structure validated';
END $$;

-- Check content_reports indexes exist
DO $$
DECLARE
    missing_indexes text[] := ARRAY[]::text[];
    index_name text;
    expected_indexes text[] := ARRAY['idx_crep_target', 'idx_crep_reporter'];
BEGIN
    FOREACH index_name IN ARRAY expected_indexes
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE schemaname = 'public' AND indexname = index_name
        ) THEN
            missing_indexes := array_append(missing_indexes, index_name);
        END IF;
    END LOOP;
    
    IF array_length(missing_indexes, 1) > 0 THEN
        RAISE EXCEPTION 'Missing content_reports indexes: %', array_to_string(missing_indexes, ', ');
    END IF;
    
    RAISE NOTICE 'content_reports indexes validated';
END $$;

-- ============================================================================
-- LIFECYCLE SANITY TESTS
-- ============================================================================

-- Test lifecycle constraints with temporary data
DO $$
DECLARE
    test_world_id text := 'test.ugc.world';
    test_ruleset_id text := 'test.ugc.ruleset';
    test_entry_id text := 'test.ugc.entry';
    test_user_id uuid := gen_random_uuid();
BEGIN
    -- Create temporary test data
    INSERT INTO worlds (id, version, status, doc) 
    VALUES (test_world_id, '1.0.0', 'active', '{"name": "Test UGC World"}');
    
    INSERT INTO rulesets (id, version, status, doc) 
    VALUES (test_ruleset_id, '1.0.0', 'active', '{"name": "Test UGC Ruleset"}');
    
    -- Test valid lifecycle values
    RAISE NOTICE 'Testing valid lifecycle values...';
    
    -- Test draft
    INSERT INTO entry_points (id, slug, type, world_id, ruleset_id, title, description, owner_user_id, lifecycle) 
    VALUES (test_entry_id || '.draft', 'test-draft', 'adventure', test_world_id, test_ruleset_id, 'Test Draft', 'A test draft entry', test_user_id, 'draft');
    
    -- Test pending_review
    INSERT INTO entry_points (id, slug, type, world_id, ruleset_id, title, description, owner_user_id, lifecycle) 
    VALUES (test_entry_id || '.pending', 'test-pending', 'adventure', test_world_id, test_ruleset_id, 'Test Pending', 'A test pending entry', test_user_id, 'pending_review');
    
    -- Test changes_requested
    INSERT INTO entry_points (id, slug, type, world_id, ruleset_id, title, description, owner_user_id, lifecycle) 
    VALUES (test_entry_id || '.changes', 'test-changes', 'adventure', test_world_id, test_ruleset_id, 'Test Changes', 'A test changes entry', test_user_id, 'changes_requested');
    
    -- Test active
    INSERT INTO entry_points (id, slug, type, world_id, ruleset_id, title, description, owner_user_id, lifecycle) 
    VALUES (test_entry_id || '.active', 'test-active', 'adventure', test_world_id, test_ruleset_id, 'Test Active', 'A test active entry', test_user_id, 'active');
    
    -- Test archived
    INSERT INTO entry_points (id, slug, type, world_id, ruleset_id, title, description, owner_user_id, lifecycle) 
    VALUES (test_entry_id || '.archived', 'test-archived', 'adventure', test_world_id, test_ruleset_id, 'Test Archived', 'A test archived entry', test_user_id, 'archived');
    
    -- Test rejected
    INSERT INTO entry_points (id, slug, type, world_id, ruleset_id, title, description, owner_user_id, lifecycle) 
    VALUES (test_entry_id || '.rejected', 'test-rejected', 'adventure', test_world_id, test_ruleset_id, 'Test Rejected', 'A test rejected entry', test_user_id, 'rejected');
    
    RAISE NOTICE 'All valid lifecycle values accepted';
    
    -- Test invalid lifecycle value
    BEGIN
        INSERT INTO entry_points (id, slug, type, world_id, ruleset_id, title, description, owner_user_id, lifecycle) 
        VALUES (test_entry_id || '.invalid', 'test-invalid', 'adventure', test_world_id, test_ruleset_id, 'Test Invalid', 'A test invalid entry', test_user_id, 'foobar');
        RAISE EXCEPTION 'Invalid lifecycle value was accepted (this should not happen)';
    EXCEPTION
        WHEN check_violation THEN
            RAISE NOTICE 'Invalid lifecycle value correctly rejected (PASS)';
    END;
    
    -- Clean up test data
    DELETE FROM entry_points WHERE id LIKE test_entry_id || '%';
    DELETE FROM rulesets WHERE id = test_ruleset_id;
    DELETE FROM worlds WHERE id = test_world_id;
    
    RAISE NOTICE 'Lifecycle sanity tests completed successfully';
    
EXCEPTION
    WHEN OTHERS THEN
        -- Clean up on error
        DELETE FROM entry_points WHERE id LIKE test_entry_id || '%';
        DELETE FROM rulesets WHERE id = test_ruleset_id;
        DELETE FROM worlds WHERE id = test_world_id;
        RAISE;
END $$;

-- ============================================================================
-- REVIEW FLOW SMOKE TEST
-- ============================================================================

-- Test content_reviews functionality
DO $$
DECLARE
    test_world_id text := 'test.review.world';
    test_ruleset_id text := 'test.review.ruleset';
    test_entry_id text := 'test.review.entry';
    test_user_id uuid := gen_random_uuid();
    test_reviewer_id uuid := gen_random_uuid();
    review_id bigint;
BEGIN
    -- Create temporary test data
    INSERT INTO worlds (id, version, status, doc) 
    VALUES (test_world_id, '1.0.0', 'active', '{"name": "Test Review World"}');
    
    INSERT INTO rulesets (id, version, status, doc) 
    VALUES (test_ruleset_id, '1.0.0', 'active', '{"name": "Test Review Ruleset"}');
    
    INSERT INTO entry_points (id, slug, type, world_id, ruleset_id, title, description, owner_user_id, lifecycle) 
    VALUES (test_entry_id, 'test-review', 'adventure', test_world_id, test_ruleset_id, 'Test Review Entry', 'A test entry for review', test_user_id, 'pending_review');
    
    RAISE NOTICE 'Testing content_reviews functionality...';
    
    -- Test valid review states
    INSERT INTO content_reviews (target_type, target_id, submitted_by, state, notes) 
    VALUES ('entry_point', test_entry_id, test_user_id, 'open', 'Initial review request')
    RETURNING id INTO review_id;
    
    -- Test updating to approved
    UPDATE content_reviews 
    SET state = 'approved', reviewer_id = test_reviewer_id, notes = 'Approved by moderator'
    WHERE id = review_id;
    
    -- Test updating to rejected
    UPDATE content_reviews 
    SET state = 'rejected', reviewer_id = test_reviewer_id, notes = 'Rejected for content issues'
    WHERE id = review_id;
    
    -- Test updating to changes_requested
    UPDATE content_reviews 
    SET state = 'changes_requested', reviewer_id = test_reviewer_id, notes = 'Please revise the content'
    WHERE id = review_id;
    
    RAISE NOTICE 'All valid review states accepted';
    
    -- Test invalid review state
    BEGIN
        UPDATE content_reviews 
        SET state = 'invalid_state'
        WHERE id = review_id;
        RAISE EXCEPTION 'Invalid review state was accepted (this should not happen)';
    EXCEPTION
        WHEN check_violation THEN
            RAISE NOTICE 'Invalid review state correctly rejected (PASS)';
    END;
    
    -- Test content_reports functionality
    INSERT INTO content_reports (target_type, target_id, reporter_id, reason) 
    VALUES ('entry_point', test_entry_id, test_user_id, 'Inappropriate content');
    
    RAISE NOTICE 'Content reports functionality working';
    
    -- Clean up test data
    DELETE FROM content_reports WHERE target_id = test_entry_id;
    DELETE FROM content_reviews WHERE id = review_id;
    DELETE FROM entry_points WHERE id = test_entry_id;
    DELETE FROM rulesets WHERE id = test_ruleset_id;
    DELETE FROM worlds WHERE id = test_world_id;
    
    RAISE NOTICE 'Review flow smoke test completed successfully';
    
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
-- TRIGGER VERIFICATION
-- ============================================================================

-- Test that the updated_at trigger works
DO $$
DECLARE
    test_world_id text := 'test.trigger.world';
    test_ruleset_id text := 'test.trigger.ruleset';
    test_entry_id text := 'test.trigger.entry';
    test_user_id uuid := gen_random_uuid();
    review_id bigint;
    original_updated_at timestamptz;
    new_updated_at timestamptz;
BEGIN
    -- Create temporary test data
    INSERT INTO worlds (id, version, status, doc) 
    VALUES (test_world_id, '1.0.0', 'active', '{"name": "Test Trigger World"}');
    
    INSERT INTO rulesets (id, version, status, doc) 
    VALUES (test_ruleset_id, '1.0.0', 'active', '{"name": "Test Trigger Ruleset"}');
    
    INSERT INTO entry_points (id, slug, type, world_id, ruleset_id, title, description, owner_user_id, lifecycle) 
    VALUES (test_entry_id, 'test-trigger', 'adventure', test_world_id, test_ruleset_id, 'Test Trigger Entry', 'A test entry for trigger testing', test_user_id, 'pending_review');
    
    -- Insert a review and get its creation time
    INSERT INTO content_reviews (target_type, target_id, submitted_by, state, notes) 
    VALUES ('entry_point', test_entry_id, test_user_id, 'open', 'Test review for trigger')
    RETURNING id, updated_at INTO review_id, original_updated_at;
    
    -- Wait a moment to ensure timestamp difference
    PERFORM pg_sleep(0.1);
    
    -- Update the review
    UPDATE content_reviews 
    SET state = 'approved', reviewer_id = test_user_id, notes = 'Approved'
    WHERE id = review_id
    RETURNING updated_at INTO new_updated_at;
    
    -- Check that updated_at changed
    IF original_updated_at >= new_updated_at THEN
        RAISE EXCEPTION 'updated_at trigger not working - timestamp did not update';
    END IF;
    
    RAISE NOTICE 'updated_at trigger working correctly';
    
    -- Clean up test data
    DELETE FROM content_reviews WHERE id = review_id;
    DELETE FROM entry_points WHERE id = test_entry_id;
    DELETE FROM rulesets WHERE id = test_ruleset_id;
    DELETE FROM worlds WHERE id = test_world_id;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Clean up on error
        DELETE FROM content_reviews WHERE id = review_id;
        DELETE FROM entry_points WHERE id = test_entry_id;
        DELETE FROM rulesets WHERE id = test_ruleset_id;
        DELETE FROM worlds WHERE id = test_world_id;
        RAISE;
END $$;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'UGC Ownership & Moderation Verification: PASSED';
    RAISE NOTICE 'All UGC tables, columns, constraints, and indexes are properly configured';
    RAISE NOTICE 'Lifecycle and review flow functionality verified';
    RAISE NOTICE 'The UGC schema is ready for use';
    RAISE NOTICE '========================================';
END $$;
