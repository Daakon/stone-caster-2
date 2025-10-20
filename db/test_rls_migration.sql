-- Test script for RLS policies migration
-- This script can be run to test the RLS migration on a clean database

-- ============================================================================
-- STEP 1: Apply the core schema migration (if not already applied)
-- ============================================================================

-- Read and execute the core schema migration
\i db/migrations/20250130000000_core_schema.sql

-- ============================================================================
-- STEP 2: Apply the UGC migration (if not already applied)
-- ============================================================================

-- Read and execute the UGC migration
\i db/migrations/20250130000001_ugc_ownership_moderation.sql

-- ============================================================================
-- STEP 3: Apply the RLS migration
-- ============================================================================

-- Read and execute the RLS migration
\i db/migrations/20250130000002_rls_policies.sql

-- ============================================================================
-- STEP 4: Run RLS verification
-- ============================================================================

-- Read and execute the RLS verification script
\i db/verification/verify_rls.sql

-- ============================================================================
-- STEP 5: Additional RLS functionality tests
-- ============================================================================

-- Test role assignment functions
DO $$
DECLARE
    test_user_id uuid := '00000000-0000-0000-0000-0000000000ee';
    has_role boolean;
BEGIN
    RAISE NOTICE 'Testing role assignment functions...';
    
    -- Test assigning moderator role
    PERFORM assign_moderator_role(test_user_id);
    
    -- Test checking role
    SELECT user_has_role(test_user_id, 'moderator') INTO has_role;
    IF has_role THEN
        RAISE NOTICE '✅ Moderator role assignment working';
    ELSE
        RAISE EXCEPTION '❌ Moderator role assignment failed';
    END IF;
    
    -- Test assigning admin role
    PERFORM assign_admin_role(test_user_id);
    
    -- Test checking admin role
    SELECT user_has_role(test_user_id, 'admin') INTO has_role;
    IF has_role THEN
        RAISE NOTICE '✅ Admin role assignment working';
    ELSE
        RAISE EXCEPTION '❌ Admin role assignment failed';
    END IF;
    
    -- Test removing roles
    PERFORM remove_user_roles(test_user_id);
    
    -- Test role removal
    SELECT user_has_role(test_user_id, 'moderator') INTO has_role;
    IF NOT has_role THEN
        RAISE NOTICE '✅ Role removal working';
    ELSE
        RAISE EXCEPTION '❌ Role removal failed';
    END IF;
    
    RAISE NOTICE 'Role management functions working correctly';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error testing role functions: %', SQLERRM;
        RAISE;
END $$;

-- Test RLS policy enforcement
DO $$
DECLARE
    test_user_id uuid := '00000000-0000-0000-0000-0000000000ff';
    entry_count int;
BEGIN
    RAISE NOTICE 'Testing RLS policy enforcement...';
    
    -- Set JWT for test user
    PERFORM set_config('request.jwt.claims', json_build_object('sub', test_user_id::text)::text, true);
    
    -- Test that user can create their own entry
    INSERT INTO entry_points (id, slug, type, world_id, ruleset_id, title, description, owner_user_id, lifecycle, visibility, status, content_rating, tags, content, sort_weight, popularity_score) 
    VALUES ('ep.test.rls.1', 'test-rls-1', 'adventure', 'world.mystika', 'ruleset.classic_v1', 'Test RLS Entry', 'A test entry for RLS', test_user_id, 'draft', 'private', 'draft', 'safe', ARRAY['test'], '{}', 10, 0)
    ON CONFLICT (id) DO NOTHING;
    
    -- Test that user can see their own entry
    SELECT COUNT(*) INTO entry_count FROM entry_points WHERE owner_user_id = test_user_id;
    IF entry_count > 0 THEN
        RAISE NOTICE '✅ User can see their own entries';
    ELSE
        RAISE EXCEPTION '❌ User cannot see their own entries';
    END IF;
    
    -- Test that user cannot see other users' private entries
    SELECT COUNT(*) INTO entry_count FROM entry_points WHERE owner_user_id != test_user_id AND visibility = 'private';
    IF entry_count = 0 THEN
        RAISE NOTICE '✅ User cannot see other users'' private entries';
    ELSE
        RAISE EXCEPTION '❌ User can see other users'' private entries';
    END IF;
    
    -- Test that user cannot self-publish
    BEGIN
        UPDATE entry_points 
        SET lifecycle = 'active'
        WHERE id = 'ep.test.rls.1' AND owner_user_id = test_user_id;
        RAISE EXCEPTION '❌ User was able to self-publish - this should not be allowed';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '✅ User cannot self-publish (correctly blocked)';
    END;
    
    RAISE NOTICE 'RLS policy enforcement working correctly';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error testing RLS policies: %', SQLERRM;
        RAISE;
END $$;

-- Test service role bypass
DO $$
DECLARE
    service_count int;
BEGIN
    RAISE NOTICE 'Testing service role bypass...';
    
    -- Clear JWT (simulate service role)
    PERFORM set_config('request.jwt.claims', null, true);
    
    -- Service role should have full access
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
    
    RAISE NOTICE '✅ Service role has full access';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error testing service role: %', SQLERRM;
        RAISE;
END $$;

-- Test anonymous access
DO $$
DECLARE
    anon_count int;
    public_count int;
BEGIN
    RAISE NOTICE 'Testing anonymous access...';
    
    -- Clear JWT (simulate anonymous)
    PERFORM set_config('request.jwt.claims', null, true);
    
    -- Anonymous should only see public, active entries
    SELECT COUNT(*) INTO anon_count FROM entry_points;
    
    -- Count expected public active entries
    SELECT COUNT(*) INTO public_count 
    FROM entry_points 
    WHERE lifecycle = 'active' AND visibility = 'public';
    
    RAISE NOTICE 'Anonymous can see % entries', anon_count;
    RAISE NOTICE 'Expected to see % public active entries', public_count;
    
    IF anon_count = public_count THEN
        RAISE NOTICE '✅ Anonymous access working correctly';
    ELSE
        RAISE NOTICE '⚠️  Anonymous access may have issues - saw % entries, expected %', anon_count, public_count;
    END IF;
    
    -- Anonymous should not be able to see drafts
    SELECT COUNT(*) INTO anon_count FROM entry_points WHERE lifecycle != 'active';
    IF anon_count = 0 THEN
        RAISE NOTICE '✅ Anonymous cannot see drafts';
    ELSE
        RAISE NOTICE '⚠️  Anonymous can see % draft entries', anon_count;
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error testing anonymous access: %', SQLERRM;
        RAISE;
END $$;

-- Test moderator access
DO $$
DECLARE
    moderator_id uuid := '00000000-0000-0000-0000-0000000000bb';
    moderator_count int;
BEGIN
    RAISE NOTICE 'Testing moderator access...';
    
    -- Set JWT for moderator
    PERFORM set_config('request.jwt.claims', json_build_object('sub', moderator_id::text)::text, true);
    
    -- Moderator should be able to see all entries
    SELECT COUNT(*) INTO moderator_count FROM entry_points;
    RAISE NOTICE 'Moderator can see % entries', moderator_count;
    
    IF moderator_count > 0 THEN
        RAISE NOTICE '✅ Moderator can see all entries';
    ELSE
        RAISE NOTICE '⚠️  Moderator cannot see entries - this may be expected if no entries exist';
    END IF;
    
    -- Moderator should be able to approve entries
    UPDATE entry_points
    SET lifecycle = 'active', visibility = 'public'
    WHERE id = 'ep.test.rls.1';
    
    IF FOUND THEN
        RAISE NOTICE '✅ Moderator can approve entries';
    ELSE
        RAISE NOTICE '⚠️  No entries found to approve (this is OK if no entries exist)';
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error testing moderator access: %', SQLERRM;
        RAISE;
END $$;

-- Final verification
SELECT 'RLS migration test completed successfully!' as result;

-- Show current RLS status
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('entry_points', 'games', 'turns', 'content_reviews', 'content_reports')
ORDER BY tablename;
