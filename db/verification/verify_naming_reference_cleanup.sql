-- Verification script for naming and reference cleanup migration
-- Ensures all components are properly created and configured

-- ============================================================================
-- 1) Worlds Table Verification
-- ============================================================================

-- Check name column exists and is NOT NULL
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'worlds'
        AND column_name = 'name'
        AND is_nullable = 'NO'
    ) THEN
        RAISE EXCEPTION 'Worlds name column missing or nullable';
    END IF;
END $$;

-- Check slug column exists and is NOT NULL
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'worlds'
        AND column_name = 'slug'
        AND is_nullable = 'NO'
    ) THEN
        RAISE EXCEPTION 'Worlds slug column missing or nullable';
    END IF;
END $$;

-- Check unique constraint on slug
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'ux_worlds_slug'
    ) THEN
        RAISE EXCEPTION 'Unique constraint on worlds.slug missing';
    END IF;
END $$;

-- ============================================================================
-- 2) Rulesets Table Verification
-- ============================================================================

-- Check name column exists and is NOT NULL
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'rulesets'
        AND column_name = 'name'
        AND is_nullable = 'NO'
    ) THEN
        RAISE EXCEPTION 'Rulesets name column missing or nullable';
    END IF;
END $$;

-- Check slug column exists and is NOT NULL
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'rulesets'
        AND column_name = 'slug'
        AND is_nullable = 'NO'
    ) THEN
        RAISE EXCEPTION 'Rulesets slug column missing or nullable';
    END IF;
END $$;

-- Check unique constraint on slug
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'ux_rulesets_slug'
    ) THEN
        RAISE EXCEPTION 'Unique constraint on rulesets.slug missing';
    END IF;
END $$;

-- ============================================================================
-- 3) Entry Points Table Verification
-- ============================================================================

-- Check name column exists and is NOT NULL
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'entry_points'
        AND column_name = 'name'
        AND is_nullable = 'NO'
    ) THEN
        RAISE EXCEPTION 'Entry points name column missing or nullable';
    END IF;
END $$;

-- Check slug column exists and is NOT NULL
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'entry_points'
        AND column_name = 'slug'
        AND is_nullable = 'NO'
    ) THEN
        RAISE EXCEPTION 'Entry points slug column missing or nullable';
    END IF;
END $$;

-- Check unique constraint on slug
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'ux_entry_points_slug'
    ) THEN
        RAISE EXCEPTION 'Unique constraint on entry_points.slug missing';
    END IF;
END $$;

-- ============================================================================
-- 4) Entry Point Rulesets Join Table Verification
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

-- Check primary key
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
        AND table_name = 'entry_point_rulesets'
        AND constraint_type = 'PRIMARY KEY'
    ) THEN
        RAISE EXCEPTION 'Primary key constraint missing on entry_point_rulesets';
    END IF;
END $$;

-- Check foreign keys
DO $$
BEGIN
    -- Check entry_point_id FK
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

    -- Check ruleset_id FK
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

-- Check indexes
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

SELECT 'Naming and reference cleanup migration verification: PASSED' as status;













