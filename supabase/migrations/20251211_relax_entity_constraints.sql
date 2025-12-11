-- ============================================================================
-- Relax Entity Name Constraints
-- Purpose: Ensure duplicate entity names are allowed (private content)
-- Date: 2025-12-11
-- ============================================================================

-- 1. Drop any explicit unique constraint on display_name or name if it exists
-- Note: The Hybrid Schema created in 20251203_chimera_v3_full_migration.sql 
-- put a UNIQUE constraint on 'key', but NOT on 'name' (display_name).
-- Just to be safe, we check for index/constraints that might enforce name uniqueness.

DO $$
BEGIN
    -- Drop constraint if exists on 'name'
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chimera_entities_name_key') THEN
        ALTER TABLE chimera_entities DROP CONSTRAINT chimera_entities_name_key;
    END IF;

    -- Drop index if exists on 'name'
    DROP INDEX IF EXISTS idx_chimera_entities_name_unique;

    -- Note: We KEEP the unique constraint on 'key' because that is the system identifier (slug).
    -- The backend logic will handle collisions by appending suffixes to the key.
END $$;
