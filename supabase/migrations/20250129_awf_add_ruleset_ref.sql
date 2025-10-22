-- Phase 1: Core vs Rulesets Framework Split - Add ruleset_ref to sessions
-- Migration: 20250129_awf_add_ruleset_ref.sql
-- Add ruleset_ref column to existing sessions table

-- Add ruleset_ref column to sessions table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sessions' AND column_name = 'ruleset_ref'
    ) THEN
        ALTER TABLE sessions ADD COLUMN ruleset_ref TEXT;
    END IF;
END $$;

-- Add comment for the new column
COMMENT ON COLUMN sessions.ruleset_ref IS 'Reference to active ruleset (e.g., ruleset.core.default@1.0.0)';




