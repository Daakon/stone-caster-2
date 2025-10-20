-- UGC Ownership & Moderation Migration
-- Extends the core schema to support creator-owned content and moderation workflow
-- This is an additive migration on top of the core schema

-- ============================================================================
-- A) AMEND ENTRY_POINTS TABLE
-- ============================================================================

-- Add owner_user_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'entry_points' 
        AND column_name = 'owner_user_id'
    ) THEN
        ALTER TABLE entry_points ADD COLUMN owner_user_id uuid;
        COMMENT ON COLUMN entry_points.owner_user_id IS 'Creator user ID; null for system-owned content';
    END IF;
END $$;

-- Add lifecycle column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'entry_points' 
        AND column_name = 'lifecycle'
    ) THEN
        ALTER TABLE entry_points ADD COLUMN lifecycle text NOT NULL DEFAULT 'draft';
        COMMENT ON COLUMN entry_points.lifecycle IS 'Moderation lifecycle state: draft → pending_review → changes_requested → active → archived/rejected';
    END IF;
END $$;

-- Add lifecycle check constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'chk_entry_points_lifecycle'
    ) THEN
        ALTER TABLE entry_points ADD CONSTRAINT chk_entry_points_lifecycle 
        CHECK (lifecycle IN ('draft', 'pending_review', 'changes_requested', 'active', 'archived', 'rejected'));
    END IF;
END $$;

-- Add owner index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_entry_points_owner ON entry_points (owner_user_id);

-- ============================================================================
-- B) CONTENT_REVIEWS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS content_reviews (
    id bigserial PRIMARY KEY,
    target_type text NOT NULL CHECK (target_type IN ('entry_point', 'prompt_segment', 'npc')),
    target_id text NOT NULL, -- FK not enforced to allow review stubs across schemas
    submitted_by uuid NOT NULL, -- creator uid
    state text NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'approved', 'rejected', 'changes_requested')),
    notes text, -- reviewer notes
    reviewer_id uuid, -- the moderator/admin who acted (null until action)
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add comments to content_reviews columns
COMMENT ON TABLE content_reviews IS 'Review queue for user-generated content';
COMMENT ON COLUMN content_reviews.target_type IS 'Type of content being reviewed';
COMMENT ON COLUMN content_reviews.target_id IS 'ID of the content being reviewed';
COMMENT ON COLUMN content_reviews.submitted_by IS 'User ID of the content creator';
COMMENT ON COLUMN content_reviews.state IS 'Current review state';
COMMENT ON COLUMN content_reviews.notes IS 'Reviewer notes and feedback';
COMMENT ON COLUMN content_reviews.reviewer_id IS 'Moderator/admin who performed the review action';

-- Create indexes for content_reviews
CREATE INDEX IF NOT EXISTS idx_cr_target ON content_reviews (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_cr_state ON content_reviews (state);
CREATE INDEX IF NOT EXISTS idx_cr_submitted_by ON content_reviews (submitted_by);

-- ============================================================================
-- C) CONTENT_REPORTS TABLE (Community Flags)
-- ============================================================================

CREATE TABLE IF NOT EXISTS content_reports (
    id bigserial PRIMARY KEY,
    target_type text NOT NULL CHECK (target_type IN ('entry_point', 'prompt_segment', 'npc', 'turn')),
    target_id text NOT NULL,
    reporter_id uuid NOT NULL,
    reason text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Add comments to content_reports columns
COMMENT ON TABLE content_reports IS 'Community flags for content moderation';
COMMENT ON COLUMN content_reports.target_type IS 'Type of content being reported';
COMMENT ON COLUMN content_reports.target_id IS 'ID of the content being reported';
COMMENT ON COLUMN content_reports.reporter_id IS 'User ID of the reporter';
COMMENT ON COLUMN content_reports.reason IS 'Reason for the report';

-- Create indexes for content_reports
CREATE INDEX IF NOT EXISTS idx_crep_target ON content_reports (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_crep_reporter ON content_reports (reporter_id);

-- ============================================================================
-- D) HELPER TRIGGER (Optional Quality-of-Life)
-- ============================================================================

-- Create updated_at trigger for content_reviews
DO $$
BEGIN
    -- Create the trigger function if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
    ) THEN
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    END IF;
    
    -- Create the trigger if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'content_reviews_updated_at'
    ) THEN
        CREATE TRIGGER content_reviews_updated_at
            BEFORE UPDATE ON content_reviews
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- ============================================================================
-- ROLLBACK BLOCK (commented out)
-- ============================================================================
/*
-- Rollback script - uncomment to drop all UGC objects created by this migration
-- DROP TRIGGER IF EXISTS content_reviews_updated_at ON content_reviews;
-- DROP FUNCTION IF EXISTS update_updated_at_column();
-- DROP INDEX IF EXISTS idx_crep_reporter;
-- DROP INDEX IF EXISTS idx_crep_target;
-- DROP TABLE IF EXISTS content_reports;
-- DROP INDEX IF EXISTS idx_cr_submitted_by;
-- DROP INDEX IF EXISTS idx_cr_state;
-- DROP INDEX IF EXISTS idx_cr_target;
-- DROP TABLE IF EXISTS content_reviews;
-- DROP INDEX IF EXISTS idx_entry_points_owner;
-- ALTER TABLE entry_points DROP CONSTRAINT IF EXISTS chk_entry_points_lifecycle;
-- ALTER TABLE entry_points DROP COLUMN IF EXISTS lifecycle;
-- ALTER TABLE entry_points DROP COLUMN IF EXISTS owner_user_id;
*/
