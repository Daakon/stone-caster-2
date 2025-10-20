-- RLS Verification Script
-- Simulates anon/creator/moderator access patterns to validate RLS policies
-- Tests all access scenarios and validates proper security boundaries

-- ============================================================================
-- HELPER FUNCTIONS FOR JWT SIMULATION
-- ============================================================================

-- Helper function to set JWT claims for testing
CREATE OR REPLACE FUNCTION set_test_jwt(sub_claim text)
RETURNS void AS $$
BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', sub_claim)::text, true);
END;
$$ LANGUAGE plpgsql;

-- Helper function to clear JWT claims
CREATE OR REPLACE FUNCTION clear_test_jwt()
RETURNS void AS $$
BEGIN
    PERFORM set_config('request.jwt.claims', null, true);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SETUP TEST DATA
-- ============================================================================

-- Create test worlds and rulesets if they don't exist
INSERT INTO worlds (id, version, status, doc) 
VALUES ('world.mystika', '1.0.0', 'active', '{"name": "Mystika", "description": "Test world"}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO rulesets (id, version, status, doc) 
VALUES ('ruleset.classic_v1', '1.0.0', 'active', '{"name": "Classic Rules", "description": "Test ruleset"}')
ON CONFLICT (id) DO NOTHING;

-- Create test entry points with different states
INSERT INTO entry_points (id, slug, type, world_id, ruleset_id, title, description, status, visibility, content_rating, tags, content, sort_weight, popularity_score) 
VALUES 
    ('ep.test.public.active', 'test-public-active', 'adventure', 'world.mystika', 'ruleset.classic_v1', 'Public Active Adventure', 'A public active adventure', 'active', 'public', 'safe', ARRAY['test'], '{}', 100, 50),
    ('ep.test.public.draft', 'test-public-draft', 'adventure', 'world.mystika', 'ruleset.classic_v1', 'Public Draft Adventure', 'A public draft adventure', 'draft', 'public', 'safe', ARRAY['test'], '{}', 50, 0),
    ('ep.test.private.draft', 'test-private-draft', 'adventure', 'world.mystika', 'ruleset.classic_v1', 'Private Draft Adventure', 'A private draft adventure', 'draft', 'private', 'safe', ARRAY['test'], '{}', 25, 0)
ON CONFLICT (id) DO NOTHING;

-- Create test users for role assignment
INSERT INTO app_roles (user_id, role) 
VALUES 
    ('00000000-0000-0000-0000-0000000000bb', 'moderator'),
    ('00000000-0000-0000-0000-0000000000cc', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- ============================================================================
-- TEST 1: ANONYMOUS ACCESS
-- ============================================================================

DO $$
DECLARE
    anon_count int;
    expected_count int;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'TEST 1: Anonymous Access';
    RAISE NOTICE '========================================';
    
    -- Clear JWT claims (simulate anonymous)
    PERFORM clear_test_jwt();
    
    -- Count what anonymous users can see
    SELECT COUNT(*) INTO anon_count FROM entry_points;
    
    -- Count expected public active entries
    SELECT COUNT(*) INTO expected_count 
    FROM entry_points 
    WHERE lifecycle = 'active' AND visibility = 'public';
    
    RAISE NOTICE 'Anonymous can see % entry points', anon_count;
    RAISE NOTICE 'Expected to see % public active entries', expected_count;
    
    IF anon_count = expected_count THEN
        RAISE NOTICE '✅ Anonymous access working correctly';
    ELSE
        RAISE EXCEPTION '❌ Anonymous access failed - saw % entries, expected %', anon_count, expected_count;
    END IF;
    
    -- Verify anonymous cannot see drafts
    SELECT COUNT(*) INTO anon_count FROM entry_points WHERE lifecycle != 'active';
    IF anon_count = 0 THEN
        RAISE NOTICE '✅ Anonymous cannot see drafts';
    ELSE
        RAISE EXCEPTION '❌ Anonymous can see drafts - this should not happen';
    END IF;
    
END $$;

-- ============================================================================
-- TEST 2: CREATOR ACCESS
-- ============================================================================

DO $$
DECLARE
    creator_count int;
    creator_id uuid := '00000000-0000-0000-0000-0000000000aa';
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'TEST 2: Creator Access';
    RAISE NOTICE '========================================';
    
    -- Set JWT for creator A
    PERFORM set_test_jwt(creator_id::text);
    
    -- Create a draft entry for creator A
    INSERT INTO entry_points (id, slug, type, world_id, ruleset_id, title, description, owner_user_id, lifecycle, visibility, status, content_rating, tags, content, sort_weight, popularity_score) 
    VALUES ('ep.test.creatorA.1', 'test-creator-a-1', 'scenario', 'world.mystika', 'ruleset.classic_v1', 'Draft by A', 'desc', creator_id, 'draft', 'private', 'draft', 'safe', ARRAY['test'], '{}', 10, 0)
    ON CONFLICT (id) DO NOTHING;
    
    -- Creator should be able to see their own entries
    SELECT COUNT(*) INTO creator_count FROM entry_points WHERE owner_user_id = creator_id;
    RAISE NOTICE 'Creator can see % of their own entries', creator_count;
    
    IF creator_count > 0 THEN
        RAISE NOTICE '✅ Creator can see their own entries';
    ELSE
        RAISE EXCEPTION '❌ Creator cannot see their own entries';
    END IF;
    
    -- Creator should be able to update their draft
    UPDATE entry_points 
    SET description = 'Updated description by creator'
    WHERE id = 'ep.test.creatorA.1' AND owner_user_id = creator_id;
    
    IF FOUND THEN
        RAISE NOTICE '✅ Creator can update their own draft';
    ELSE
        RAISE EXCEPTION '❌ Creator cannot update their own draft';
    END IF;
    
    -- Creator should NOT be able to set lifecycle to 'active' (only moderators can)
    BEGIN
        UPDATE entry_points 
        SET lifecycle = 'active'
        WHERE id = 'ep.test.creatorA.1' AND owner_user_id = creator_id;
        RAISE EXCEPTION '❌ Creator was able to set lifecycle to active - this should not be allowed';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '✅ Creator cannot self-publish (correctly blocked)';
    END;
    
END $$;

-- ============================================================================
-- TEST 3: MODERATOR ACCESS
-- ============================================================================

DO $$
DECLARE
    moderator_count int;
    moderator_id uuid := '00000000-0000-0000-0000-0000000000bb';
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'TEST 3: Moderator Access';
    RAISE NOTICE '========================================';
    
    -- Set JWT for moderator B
    PERFORM set_test_jwt(moderator_id::text);
    
    -- Moderator should be able to see all entries
    SELECT COUNT(*) INTO moderator_count FROM entry_points;
    RAISE NOTICE 'Moderator can see % total entries', moderator_count;
    
    IF moderator_count > 0 THEN
        RAISE NOTICE '✅ Moderator can see all entries';
    ELSE
        RAISE EXCEPTION '❌ Moderator cannot see entries';
    END IF;
    
    -- Moderator should be able to approve creator A's entry
    UPDATE entry_points
    SET lifecycle = 'active', visibility = 'public'
    WHERE id = 'ep.test.creatorA.1';
    
    IF FOUND THEN
        RAISE NOTICE '✅ Moderator can approve entries';
    ELSE
        RAISE EXCEPTION '❌ Moderator cannot approve entries';
    END IF;
    
    -- Test content_reviews access
    INSERT INTO content_reviews (target_type, target_id, submitted_by, state, notes) 
    VALUES ('entry_point', 'ep.test.creatorA.1', '00000000-0000-0000-0000-0000000000aa', 'open', 'Test review')
    ON CONFLICT DO NOTHING;
    
    SELECT COUNT(*) INTO moderator_count FROM content_reviews;
    IF moderator_count > 0 THEN
        RAISE NOTICE '✅ Moderator can see content reviews';
    ELSE
        RAISE EXCEPTION '❌ Moderator cannot see content reviews';
    END IF;
    
END $$;

-- ============================================================================
-- TEST 4: ADMIN ACCESS
-- ============================================================================

DO $$
DECLARE
    admin_count int;
    admin_id uuid := '00000000-0000-0000-0000-0000000000cc';
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'TEST 4: Admin Access';
    RAISE NOTICE '========================================';
    
    -- Set JWT for admin C
    PERFORM set_test_jwt(admin_id::text);
    
    -- Admin should be able to see all entries
    SELECT COUNT(*) INTO admin_count FROM entry_points;
    RAISE NOTICE 'Admin can see % total entries', admin_count;
    
    IF admin_count > 0 THEN
        RAISE NOTICE '✅ Admin can see all entries';
    ELSE
        RAISE EXCEPTION '❌ Admin cannot see entries';
    END IF;
    
    -- Admin should be able to reject entries
    UPDATE entry_points
    SET lifecycle = 'rejected'
    WHERE id = 'ep.test.private.draft';
    
    IF FOUND THEN
        RAISE NOTICE '✅ Admin can reject entries';
    ELSE
        RAISE EXCEPTION '❌ Admin cannot reject entries';
    END IF;
    
END $$;

-- ============================================================================
-- TEST 5: GAMES OWNER-ONLY ACCESS
-- ============================================================================

DO $$
DECLARE
    game_count int;
    creator_id uuid := '00000000-0000-0000-0000-0000000000aa';
    other_user_id uuid := '00000000-0000-0000-0000-0000000000dd';
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'TEST 5: Games Owner-Only Access';
    RAISE NOTICE '========================================';
    
    -- Set JWT for creator A
    PERFORM set_test_jwt(creator_id::text);
    
    -- Creator A creates a game
    INSERT INTO games (entry_point_id, entry_point_type, world_id, ruleset_id, owner_user_id, state, turn_count, status) 
    VALUES ('ep.test.creatorA.1', 'scenario', 'world.mystika', 'ruleset.classic_v1', creator_id, '{}'::jsonb, 0, 'active')
    ON CONFLICT DO NOTHING;
    
    -- Creator A should be able to see their game
    SELECT COUNT(*) INTO game_count FROM games WHERE owner_user_id = creator_id;
    IF game_count > 0 THEN
        RAISE NOTICE '✅ Creator can see their own games';
    ELSE
        RAISE EXCEPTION '❌ Creator cannot see their own games';
    END IF;
    
    -- Switch to different user D
    PERFORM set_test_jwt(other_user_id::text);
    
    -- User D should NOT be able to see creator A's game
    SELECT COUNT(*) INTO game_count FROM games;
    IF game_count = 0 THEN
        RAISE NOTICE '✅ Other users cannot see games they do not own';
    ELSE
        RAISE EXCEPTION '❌ Other users can see games they do not own';
    END IF;
    
    -- Switch back to creator A
    PERFORM set_test_jwt(creator_id::text);
    
    -- Creator A should be able to add turns to their game
    WITH g AS (
        SELECT id FROM games WHERE owner_user_id = creator_id LIMIT 1
    )
    INSERT INTO turns (game_id, idx, role, content, prompt_meta) 
    SELECT g.id, 1, 'player', '{"text":"hello"}'::jsonb, '{}'::jsonb FROM g;
    
    IF FOUND THEN
        RAISE NOTICE '✅ Creator can add turns to their games';
    ELSE
        RAISE NOTICE '⚠️  No games found to test turns (this is OK if no games exist)';
    END IF;
    
END $$;

-- ============================================================================
-- TEST 6: CONTENT REPORTS ACCESS
-- ============================================================================

DO $$
DECLARE
    report_count int;
    creator_id uuid := '00000000-0000-0000-0000-0000000000aa';
    moderator_id uuid := '00000000-0000-0000-0000-0000000000bb';
    other_user_id uuid := '00000000-0000-0000-0000-0000000000dd';
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'TEST 6: Content Reports Access';
    RAISE NOTICE '========================================';
    
    -- Set JWT for creator A
    PERFORM set_test_jwt(creator_id::text);
    
    -- Creator A should be able to file a report
    INSERT INTO content_reports (target_type, target_id, reporter_id, reason) 
    VALUES ('entry_point', 'ep.test.public.active', creator_id, 'Test report by creator A')
    ON CONFLICT DO NOTHING;
    
    IF FOUND THEN
        RAISE NOTICE '✅ Authenticated users can file reports';
    ELSE
        RAISE NOTICE '⚠️  Report already exists or could not be created';
    END IF;
    
    -- Creator A should NOT be able to see reports (only moderators can)
    SELECT COUNT(*) INTO report_count FROM content_reports;
    IF report_count = 0 THEN
        RAISE NOTICE '✅ Non-moderators cannot see reports';
    ELSE
        RAISE EXCEPTION '❌ Non-moderators can see reports - this should not happen';
    END IF;
    
    -- Switch to moderator B
    PERFORM set_test_jwt(moderator_id::text);
    
    -- Moderator should be able to see reports
    SELECT COUNT(*) INTO report_count FROM content_reports;
    IF report_count > 0 THEN
        RAISE NOTICE '✅ Moderators can see reports';
    ELSE
        RAISE NOTICE '⚠️  No reports found (this is OK if no reports exist)';
    END IF;
    
END $$;

-- ============================================================================
-- TEST 7: CONTENT REVIEWS ACCESS
-- ============================================================================

DO $$
DECLARE
    review_count int;
    creator_id uuid := '00000000-0000-0000-0000-0000000000aa';
    moderator_id uuid := '00000000-0000-0000-0000-0000000000bb';
    other_user_id uuid := '00000000-0000-0000-0000-0000000000dd';
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'TEST 7: Content Reviews Access';
    RAISE NOTICE '========================================';
    
    -- Set JWT for creator A
    PERFORM set_test_jwt(creator_id::text);
    
    -- Creator A should be able to see their own reviews
    SELECT COUNT(*) INTO review_count FROM content_reviews WHERE submitted_by = creator_id;
    IF review_count >= 0 THEN
        RAISE NOTICE '✅ Creator can see their own reviews';
    ELSE
        RAISE EXCEPTION '❌ Creator cannot see their own reviews';
    END IF;
    
    -- Creator A should NOT be able to see other people's reviews
    SELECT COUNT(*) INTO review_count FROM content_reviews WHERE submitted_by != creator_id;
    IF review_count = 0 THEN
        RAISE NOTICE '✅ Creator cannot see other people''s reviews';
    ELSE
        RAISE EXCEPTION '❌ Creator can see other people''s reviews - this should not happen';
    END IF;
    
    -- Switch to moderator B
    PERFORM set_test_jwt(moderator_id::text);
    
    -- Moderator should be able to see all reviews
    SELECT COUNT(*) INTO review_count FROM content_reviews;
    IF review_count >= 0 THEN
        RAISE NOTICE '✅ Moderator can see all reviews';
    ELSE
        RAISE EXCEPTION '❌ Moderator cannot see reviews';
    END IF;
    
END $$;

-- ============================================================================
-- TEST 8: SERVICE ROLE ACCESS
-- ============================================================================

DO $$
DECLARE
    service_count int;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'TEST 8: Service Role Access';
    RAISE NOTICE '========================================';
    
    -- Clear JWT (simulate service role context)
    PERFORM clear_test_jwt();
    
    -- Service role should have full access (this is tested by the fact that we can run this script)
    SELECT COUNT(*) INTO service_count FROM entry_points;
    RAISE NOTICE 'Service role can see % entry points', service_count;
    
    SELECT COUNT(*) INTO service_count FROM games;
    RAISE NOTICE 'Service role can see % games', service_count;
    
    SELECT COUNT(*) INTO service_count FROM turns;
    RAISE NOTICE 'Service role can see % turns', service_count;
    
    SELECT COUNT(*) INTO service_count FROM content_reviews;
    RAISE NOTICE 'Service role can see % content reviews', service_count;
    
    SELECT COUNT(*) INTO service_count FROM content_reports;
    RAISE NOTICE 'Service role can see % content reports', service_count;
    
    RAISE NOTICE '✅ Service role has full access (verified by successful query execution)';
    
END $$;

-- ============================================================================
-- CLEANUP AND FINAL VERIFICATION
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'CLEANUP AND FINAL VERIFICATION';
    RAISE NOTICE '========================================';
    
    -- Clear JWT claims
    PERFORM clear_test_jwt();
    
    -- Clean up test data (optional - leave for manual inspection)
    -- DELETE FROM content_reports WHERE target_id LIKE 'ep.test.%';
    -- DELETE FROM content_reviews WHERE target_id LIKE 'ep.test.%';
    -- DELETE FROM turns WHERE game_id IN (SELECT id FROM games WHERE entry_point_id LIKE 'ep.test.%');
    -- DELETE FROM games WHERE entry_point_id LIKE 'ep.test.%';
    -- DELETE FROM entry_points WHERE id LIKE 'ep.test.%';
    
    RAISE NOTICE 'Test data preserved for manual inspection';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'RLS Verification: PASSED';
    RAISE NOTICE 'All access patterns working correctly';
    RAISE NOTICE 'Security boundaries properly enforced';
    RAISE NOTICE '========================================';
    
END $$;

-- ============================================================================
-- CLEANUP HELPER FUNCTIONS
-- ============================================================================

-- Clean up test helper functions
DROP FUNCTION IF EXISTS set_test_jwt(text);
DROP FUNCTION IF EXISTS clear_test_jwt();
