-- Add Unique Constraints to Existing Tables
-- This migration adds unique constraints to tables that may already exist

-- ============================================================================
-- ADD UNIQUE CONSTRAINTS
-- ============================================================================

-- Add unique constraint to worlds table (if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'uk_worlds_id' 
        AND table_name = 'worlds' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE worlds ADD CONSTRAINT uk_worlds_id UNIQUE (id);
        RAISE NOTICE 'Added unique constraint uk_worlds_id to worlds table';
    ELSE
        RAISE NOTICE 'Unique constraint uk_worlds_id already exists on worlds table';
    END IF;
END $$;

-- Add unique constraint to rulesets table (if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'uk_rulesets_id' 
        AND table_name = 'rulesets' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE rulesets ADD CONSTRAINT uk_rulesets_id UNIQUE (id);
        RAISE NOTICE 'Added unique constraint uk_rulesets_id to rulesets table';
    ELSE
        RAISE NOTICE 'Unique constraint uk_rulesets_id already exists on rulesets table';
    END IF;
END $$;

-- Add unique constraint to entry_points table (if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'uk_entry_points_id' 
        AND table_name = 'entry_points' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE entry_points ADD CONSTRAINT uk_entry_points_id UNIQUE (id);
        RAISE NOTICE 'Added unique constraint uk_entry_points_id to entry_points table';
    ELSE
        RAISE NOTICE 'Unique constraint uk_entry_points_id already exists on entry_points table';
    END IF;
END $$;

-- ============================================================================
-- VERIFY CONSTRAINTS
-- ============================================================================

-- List all unique constraints for verification
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type
FROM information_schema.table_constraints tc
WHERE tc.table_schema = 'public'
    AND tc.table_name IN ('worlds', 'rulesets', 'entry_points')
    AND tc.constraint_type IN ('UNIQUE', 'PRIMARY KEY')
ORDER BY tc.table_name, tc.constraint_name;
