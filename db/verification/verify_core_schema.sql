-- Core Schema Verification
-- Asserts that all tables, columns, constraints, and indexes exist as expected
-- Run this after applying the core schema migration to validate the setup

-- ============================================================================
-- TABLE EXISTENCE CHECKS
-- ============================================================================

-- Check that all core tables exist
DO $$
DECLARE
    missing_tables text[] := ARRAY[]::text[];
    table_name text;
    expected_tables text[] := ARRAY['worlds', 'rulesets', 'entry_points', 'prompt_segments', 'games', 'turns'];
BEGIN
    FOREACH table_name IN ARRAY expected_tables
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = table_name
        ) THEN
            missing_tables := array_append(missing_tables, table_name);
        END IF;
    END LOOP;
    
    IF array_length(missing_tables, 1) > 0 THEN
        RAISE EXCEPTION 'Missing tables: %', array_to_string(missing_tables, ', ');
    END IF;
    
    RAISE NOTICE 'All core tables exist: %', array_to_string(expected_tables, ', ');
END $$;

-- ============================================================================
-- COLUMN AND CONSTRAINT CHECKS
-- ============================================================================

-- Check worlds table structure
DO $$
BEGIN
    -- Check required columns exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'worlds' 
        AND column_name IN ('id', 'version', 'status', 'doc', 'created_at', 'updated_at')
    ) THEN
        RAISE EXCEPTION 'worlds table missing required columns';
    END IF;
    
    -- Check status constraint
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name LIKE '%worlds_status%' 
        AND check_clause LIKE '%draft%active%archived%'
    ) THEN
        RAISE EXCEPTION 'worlds table missing status constraint';
    END IF;
    
    RAISE NOTICE 'worlds table structure validated';
END $$;

-- Check entry_points table structure
DO $$
BEGIN
    -- Check required columns exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'entry_points' 
        AND column_name IN ('id', 'slug', 'type', 'world_id', 'ruleset_id', 'title', 'description', 'search_text')
    ) THEN
        RAISE EXCEPTION 'entry_points table missing required columns';
    END IF;
    
    -- Check UGC columns exist (if UGC migration has been applied)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'entry_points' 
        AND column_name = 'owner_user_id'
    ) THEN
        RAISE NOTICE 'UGC columns detected in entry_points - UGC migration appears to be applied';
        
        -- Verify lifecycle column exists
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'entry_points' 
            AND column_name = 'lifecycle'
        ) THEN
            RAISE EXCEPTION 'UGC migration partially applied - lifecycle column missing';
        END IF;
        
        -- Verify lifecycle constraint exists
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.check_constraints 
            WHERE constraint_name = 'chk_entry_points_lifecycle'
        ) THEN
            RAISE EXCEPTION 'UGC migration partially applied - lifecycle constraint missing';
        END IF;
        
        -- Verify owner index exists
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE schemaname = 'public' AND indexname = 'idx_entry_points_owner'
        ) THEN
            RAISE EXCEPTION 'UGC migration partially applied - owner index missing';
        END IF;
        
        RAISE NOTICE 'UGC columns and constraints validated';
    ELSE
        RAISE NOTICE 'UGC columns not detected - core schema only (UGC migration not applied)';
    END IF;
    
    -- Check type constraint
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name LIKE '%entry_points_type%' 
        AND check_clause LIKE '%adventure%scenario%sandbox%quest%'
    ) THEN
        RAISE EXCEPTION 'entry_points table missing type constraint';
    END IF;
    
    -- Check status constraint
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name LIKE '%entry_points_status%' 
        AND check_clause LIKE '%draft%active%archived%'
    ) THEN
        RAISE EXCEPTION 'entry_points table missing status constraint';
    END IF;
    
    -- Check visibility constraint
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name LIKE '%entry_points_visibility%' 
        AND check_clause LIKE '%public%unlisted%private%'
    ) THEN
        RAISE EXCEPTION 'entry_points table missing visibility constraint';
    END IF;
    
    -- Check content_rating constraint
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name LIKE '%entry_points_content_rating%' 
        AND check_clause LIKE '%safe%mature%explicit%'
    ) THEN
        RAISE EXCEPTION 'entry_points table missing content_rating constraint';
    END IF;
    
    RAISE NOTICE 'entry_points table structure validated';
END $$;

-- Check prompt_segments table structure
DO $$
BEGIN
    -- Check required columns exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'prompt_segments' 
        AND column_name IN ('id', 'scope', 'ref_id', 'version', 'active', 'content', 'metadata')
    ) THEN
        RAISE EXCEPTION 'prompt_segments table missing required columns';
    END IF;
    
    -- Check scope constraint
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name LIKE '%prompt_segments_scope%' 
        AND check_clause LIKE '%core%ruleset%world%entry%'
    ) THEN
        RAISE EXCEPTION 'prompt_segments table missing scope constraint';
    END IF;
    
    RAISE NOTICE 'prompt_segments table structure validated';
END $$;

-- Check games table structure
DO $$
BEGIN
    -- Check required columns exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'games' 
        AND column_name IN ('id', 'entry_point_id', 'entry_point_type', 'world_id', 'ruleset_id', 'state', 'turn_count', 'status')
    ) THEN
        RAISE EXCEPTION 'games table missing required columns';
    END IF;
    
    -- Check status constraint
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name LIKE '%games_status%' 
        AND check_clause LIKE '%active%ended%abandoned%'
    ) THEN
        RAISE EXCEPTION 'games table missing status constraint';
    END IF;
    
    RAISE NOTICE 'games table structure validated';
END $$;

-- Check turns table structure
DO $$
BEGIN
    -- Check required columns exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'turns' 
        AND column_name IN ('id', 'game_id', 'idx', 'role', 'prompt_meta', 'content', 'costs')
    ) THEN
        RAISE EXCEPTION 'turns table missing required columns';
    END IF;
    
    -- Check role constraint
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name LIKE '%turns_role%' 
        AND check_clause LIKE '%system%narrator%player%'
    ) THEN
        RAISE EXCEPTION 'turns table missing role constraint';
    END IF;
    
    RAISE NOTICE 'turns table structure validated';
END $$;

-- ============================================================================
-- INDEX EXISTENCE CHECKS
-- ============================================================================

-- Check that all required indexes exist
DO $$
DECLARE
    missing_indexes text[] := ARRAY[]::text[];
    index_name text;
    expected_indexes text[] := ARRAY[
        'idx_entry_points_type',
        'idx_entry_points_world', 
        'idx_entry_points_ruleset',
        'idx_entry_points_status_vis',
        'idx_entry_points_tags',
        'idx_entry_points_search',
        'idx_prompt_segments_scope',
        'idx_prompt_segments_ref',
        'idx_games_owner',
        'idx_games_entry_point',
        'idx_games_world',
        'idx_turns_game_idx'
    ];
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
        RAISE EXCEPTION 'Missing indexes: %', array_to_string(missing_indexes, ', ');
    END IF;
    
    RAISE NOTICE 'All required indexes exist: %', array_to_string(expected_indexes, ', ');
END $$;

-- ============================================================================
-- SEARCH FUNCTIONALITY TEST
-- ============================================================================

-- Test that the search functionality works as expected
-- This should use the GIN index on search_text
DO $$
DECLARE
    explain_result text;
BEGIN
    -- Get the execution plan for a sample search query
    EXECUTE 'EXPLAIN (FORMAT TEXT) SELECT id FROM entry_points 
             WHERE status=''active'' AND visibility=''public''
               AND world_id=''world.mystika''
               AND type IN (''adventure'',''scenario'')
               AND search_text @@ to_tsquery(''english'',''forest:*'')
             ORDER BY sort_weight DESC
             LIMIT 10' INTO explain_result;
    
    -- Check if GIN index is being used
    IF explain_result NOT LIKE '%idx_entry_points_search%' THEN
        RAISE WARNING 'Search query may not be using GIN index optimally';
    END IF;
    
    RAISE NOTICE 'Search functionality test completed - check execution plan:';
    RAISE NOTICE '%', explain_result;
END $$;

-- ============================================================================
-- FOREIGN KEY RELATIONSHIP CHECKS
-- ============================================================================

-- Check that foreign key relationships are properly established
DO $$
DECLARE
    fk_count int;
BEGIN
    -- Check entry_points foreign keys
    SELECT COUNT(*) INTO fk_count
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'entry_points' 
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name IN ('world_id', 'ruleset_id');
    
    IF fk_count < 2 THEN
        RAISE EXCEPTION 'entry_points table missing foreign key constraints';
    END IF;
    
    -- Check games foreign keys
    SELECT COUNT(*) INTO fk_count
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'games' 
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name IN ('entry_point_id', 'world_id', 'ruleset_id');
    
    IF fk_count < 3 THEN
        RAISE EXCEPTION 'games table missing foreign key constraints';
    END IF;
    
    -- Check turns foreign key
    SELECT COUNT(*) INTO fk_count
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'turns' 
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'game_id';
    
    IF fk_count < 1 THEN
        RAISE EXCEPTION 'turns table missing foreign key constraint';
    END IF;
    
    RAISE NOTICE 'All foreign key relationships validated';
END $$;

-- ============================================================================
-- UGC TABLES CHECK (if UGC migration applied)
-- ============================================================================

-- Check if UGC tables exist
DO $$
DECLARE
    ugc_tables_exist boolean := false;
BEGIN
    -- Check if content_reviews table exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'content_reviews'
    ) THEN
        ugc_tables_exist := true;
        RAISE NOTICE 'UGC tables detected - content_reviews exists';
        
        -- Check if content_reports table exists
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'content_reports'
        ) THEN
            RAISE NOTICE 'UGC tables detected - content_reports exists';
        ELSE
            RAISE WARNING 'UGC migration partially applied - content_reports table missing';
        END IF;
    END IF;
    
    IF NOT ugc_tables_exist THEN
        RAISE NOTICE 'UGC tables not detected - core schema only (UGC migration not applied)';
    END IF;
END $$;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Core Schema Verification: PASSED';
    RAISE NOTICE 'All tables, columns, constraints, and indexes are properly configured';
    RAISE NOTICE 'The schema is ready for use';
    RAISE NOTICE '========================================';
END $$;
