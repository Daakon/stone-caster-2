-- Verification script for entry_point_rulesets migration
-- Ensures all components are properly created

-- ============================================================================
-- 1) Table Structure Verification
-- ============================================================================

-- Check table exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'entry_point_rulesets'
    ) THEN
        RAISE EXCEPTION 'Table entry_point_rulesets does not exist';
    END IF;
END $$;

-- Check columns exist
DO $$
BEGIN
    -- Check required columns
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'entry_point_rulesets'
        AND column_name = 'entry_point_id'
    ) THEN
        RAISE EXCEPTION 'Column entry_point_id missing';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'entry_point_rulesets'
        AND column_name = 'ruleset_id'
    ) THEN
        RAISE EXCEPTION 'Column ruleset_id missing';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'entry_point_rulesets'
        AND column_name = 'sort_order'
    ) THEN
        RAISE EXCEPTION 'Column sort_order missing';
    END IF;
END $$;

-- ============================================================================
-- 2) Primary Key Verification
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
        AND table_name = 'entry_point_rulesets'
        AND constraint_type = 'PRIMARY KEY'
        AND constraint_name LIKE '%_pkey'
    ) THEN
        RAISE EXCEPTION 'Primary key constraint missing';
    END IF;
END $$;

-- ============================================================================
-- 3) Foreign Key Verification
-- ============================================================================

-- Check entry_point_id FK
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = 'public' 
        AND tc.table_name = 'entry_point_rulesets'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'entry_point_id'
        AND kcu.referenced_table_name = 'entry_points'
    ) THEN
        RAISE EXCEPTION 'Foreign key to entry_points missing';
    END IF;
END $$;

-- Check ruleset_id FK
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = 'public' 
        AND tc.table_name = 'entry_point_rulesets'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'ruleset_id'
        AND kcu.referenced_table_name = 'rulesets'
    ) THEN
        RAISE EXCEPTION 'Foreign key to rulesets missing';
    END IF;
END $$;

-- ============================================================================
-- 4) Index Verification
-- ============================================================================

DO $$
BEGIN
    -- Check entry_point_id index
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'entry_point_rulesets'
        AND indexname = 'idx_epr_entry'
    ) THEN
        RAISE EXCEPTION 'Index idx_epr_entry missing';
    END IF;

    -- Check ruleset_id index
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'entry_point_rulesets'
        AND indexname = 'idx_epr_ruleset'
    ) THEN
        RAISE EXCEPTION 'Index idx_epr_ruleset missing';
    END IF;

    -- Check sort order index
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'entry_point_rulesets'
        AND indexname = 'idx_epr_sort'
    ) THEN
        RAISE EXCEPTION 'Index idx_epr_sort missing';
    END IF;
END $$;

-- ============================================================================
-- 5) RLS Policy Verification
-- ============================================================================

DO $$
BEGIN
    -- Check RLS is enabled
    IF NOT EXISTS (
        SELECT 1 FROM pg_class 
        WHERE relname = 'entry_point_rulesets' 
        AND relrowsecurity = true
    ) THEN
        RAISE EXCEPTION 'RLS not enabled on entry_point_rulesets';
    END IF;

    -- Check policy exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'entry_point_rulesets'
        AND policyname = 'epr_owner_rw'
    ) THEN
        RAISE EXCEPTION 'RLS policy epr_owner_rw missing';
    END IF;
END $$;

-- ============================================================================
-- 6) Constraint Verification
-- ============================================================================

DO $$
BEGIN
    -- Check sort_order constraint
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_schema = 'public' 
        AND constraint_name = 'chk_epr_sort_order'
    ) THEN
        RAISE EXCEPTION 'Sort order constraint missing';
    END IF;
END $$;

-- ============================================================================
-- 7) Success Message
-- ============================================================================

SELECT 'entry_point_rulesets migration verification: PASSED' as status;

















