-- RLS Policies Migration
-- Enables Row-Level Security on all tables with comprehensive access control
-- Supports public browsing, creator workspace, moderation, and service role access

-- ============================================================================
-- A) ROLE SUPPORT (APP ROLES)
-- ============================================================================

-- Create app_roles table for moderation roles
CREATE TABLE IF NOT EXISTS app_roles (
    user_id uuid NOT NULL,
    role text NOT NULL CHECK (role IN ('moderator', 'admin')),
    PRIMARY KEY (user_id, role)
);

-- Add comments
COMMENT ON TABLE app_roles IS 'User role assignments for moderation and administration';
COMMENT ON COLUMN app_roles.user_id IS 'User ID from auth.users';
COMMENT ON COLUMN app_roles.role IS 'Role type: moderator or admin';

-- ============================================================================
-- B) ENABLE ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE entry_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- C) ENTRY_POINTS POLICIES
-- ============================================================================

-- Public browse (anon + auth): approved & public only
CREATE POLICY ep_public_read_live
ON entry_points FOR SELECT
TO anon, authenticated
USING (lifecycle = 'active' AND visibility = 'public');

-- Creator workspace (auth users): see & edit own drafts, submit for review
-- Read any of your own entries (all lifecycles)
CREATE POLICY ep_creator_read_own
ON entry_points FOR SELECT
TO authenticated
USING (owner_user_id = auth.uid());

-- Insert new draft owned by creator
CREATE POLICY ep_creator_insert_own
ON entry_points FOR INSERT
TO authenticated
WITH CHECK (owner_user_id = auth.uid() AND lifecycle IN ('draft', 'pending_review', 'changes_requested'));

-- Update own draft/pending/changes_requested (not publish)
CREATE POLICY ep_creator_update_own
ON entry_points FOR UPDATE
TO authenticated
USING (owner_user_id = auth.uid() AND lifecycle IN ('draft', 'pending_review', 'changes_requested'))
WITH CHECK (owner_user_id = auth.uid() AND lifecycle IN ('draft', 'pending_review', 'changes_requested'));

-- Moderator/Admin: full read/write via app_roles
-- Moderation & admin: read all
CREATE POLICY ep_mod_read_all
ON entry_points FOR SELECT
TO authenticated
USING (EXISTS (
    SELECT 1 FROM app_roles ar 
    WHERE ar.user_id = auth.uid() AND ar.role IN ('moderator', 'admin')
));

-- Moderation & admin: write all (including setting lifecycle to 'active'/'rejected')
CREATE POLICY ep_mod_write_all
ON entry_points FOR ALL
TO authenticated
USING (EXISTS (
    SELECT 1 FROM app_roles ar 
    WHERE ar.user_id = auth.uid() AND ar.role IN ('moderator', 'admin')
))
WITH CHECK (EXISTS (
    SELECT 1 FROM app_roles ar 
    WHERE ar.user_id = auth.uid() AND ar.role IN ('moderator', 'admin')
));

-- Service role bypass
CREATE POLICY ep_service_all
ON entry_points FOR ALL
TO service_role
USING (true) WITH CHECK (true);

-- Grants for entry_points
GRANT SELECT ON entry_points TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON entry_points TO authenticated;
GRANT ALL ON entry_points TO service_role;

-- ============================================================================
-- D) GAMES POLICIES (OWNER-ONLY)
-- ============================================================================

-- Owner read
CREATE POLICY games_owner_select 
ON games FOR SELECT 
TO authenticated
USING (owner_user_id = auth.uid());

-- Owner insert
CREATE POLICY games_owner_insert 
ON games FOR INSERT 
TO authenticated
WITH CHECK (owner_user_id = auth.uid());

-- Owner update
CREATE POLICY games_owner_update 
ON games FOR UPDATE 
TO authenticated
USING (owner_user_id = auth.uid())
WITH CHECK (owner_user_id = auth.uid());

-- Service role full
CREATE POLICY games_service_all 
ON games FOR ALL 
TO service_role
USING (true) WITH CHECK (true);

-- Grants for games
GRANT SELECT, INSERT, UPDATE ON games TO authenticated;
GRANT ALL ON games TO service_role;

-- ============================================================================
-- E) TURNS POLICIES (OWNER VIA GAME)
-- ============================================================================

-- Read turns for owned games
CREATE POLICY turns_owner_select 
ON turns FOR SELECT 
TO authenticated
USING (EXISTS (
    SELECT 1 FROM games g 
    WHERE g.id = turns.game_id AND g.owner_user_id = auth.uid()
));

-- Insert turns for owned games
CREATE POLICY turns_owner_insert 
ON turns FOR INSERT 
TO authenticated
WITH CHECK (EXISTS (
    SELECT 1 FROM games g 
    WHERE g.id = turns.game_id AND g.owner_user_id = auth.uid()
));

-- Service role full
CREATE POLICY turns_service_all 
ON turns FOR ALL 
TO service_role
USING (true) WITH CHECK (true);

-- Grants for turns
GRANT SELECT, INSERT ON turns TO authenticated;
GRANT ALL ON turns TO service_role;

-- ============================================================================
-- F) CONTENT_REVIEWS POLICIES (REVIEW QUEUE)
-- ============================================================================

-- Creator: see only your own review rows (for things you submitted)
CREATE POLICY cr_creator_read_own 
ON content_reviews FOR SELECT 
TO authenticated
USING (submitted_by = auth.uid());

-- Creator: open a review only for things you own (enforced by app logic; here we allow insert)
CREATE POLICY cr_creator_insert 
ON content_reviews FOR INSERT 
TO authenticated
WITH CHECK (submitted_by = auth.uid());

-- Moderator/Admin: read & write all
CREATE POLICY cr_mod_read_all 
ON content_reviews FOR SELECT 
TO authenticated
USING (EXISTS (
    SELECT 1 FROM app_roles ar 
    WHERE ar.user_id = auth.uid() AND ar.role IN ('moderator', 'admin')
));

CREATE POLICY cr_mod_write_all 
ON content_reviews FOR ALL 
TO authenticated
USING (EXISTS (
    SELECT 1 FROM app_roles ar 
    WHERE ar.user_id = auth.uid() AND ar.role IN ('moderator', 'admin')
))
WITH CHECK (EXISTS (
    SELECT 1 FROM app_roles ar 
    WHERE ar.user_id = auth.uid() AND ar.role IN ('moderator', 'admin')
));

-- Service role bypass
CREATE POLICY cr_service_all 
ON content_reviews FOR ALL 
TO service_role
USING (true) WITH CHECK (true);

-- Grants for content_reviews
GRANT SELECT, INSERT, UPDATE, DELETE ON content_reviews TO authenticated;
GRANT ALL ON content_reviews TO service_role;

-- ============================================================================
-- G) CONTENT_REPORTS POLICIES (COMMUNITY FLAGS)
-- ============================================================================

-- Any authenticated user can file a report
CREATE POLICY crep_auth_insert 
ON content_reports FOR INSERT 
TO authenticated
WITH CHECK (reporter_id = auth.uid());

-- Only moderators/admins can view reports
CREATE POLICY crep_mod_read_all 
ON content_reports FOR SELECT 
TO authenticated
USING (EXISTS (
    SELECT 1 FROM app_roles ar 
    WHERE ar.user_id = auth.uid() AND ar.role IN ('moderator', 'admin')
));

-- Service role bypass
CREATE POLICY crep_service_all 
ON content_reports FOR ALL 
TO service_role
USING (true) WITH CHECK (true);

-- Grants for content_reports
GRANT SELECT, INSERT ON content_reports TO authenticated;
GRANT ALL ON content_reports TO service_role;

-- ============================================================================
-- HELPER FUNCTIONS FOR ROLE MANAGEMENT
-- ============================================================================

-- Function to assign moderator role
CREATE OR REPLACE FUNCTION assign_moderator_role(user_uuid uuid)
RETURNS void AS $$
BEGIN
    INSERT INTO app_roles (user_id, role) 
    VALUES (user_uuid, 'moderator')
    ON CONFLICT (user_id, role) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to assign admin role
CREATE OR REPLACE FUNCTION assign_admin_role(user_uuid uuid)
RETURNS void AS $$
BEGIN
    INSERT INTO app_roles (user_id, role) 
    VALUES (user_uuid, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to remove user roles
CREATE OR REPLACE FUNCTION remove_user_roles(user_uuid uuid)
RETURNS void AS $$
BEGIN
    DELETE FROM app_roles WHERE user_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has role
CREATE OR REPLACE FUNCTION user_has_role(user_uuid uuid, role_name text)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM app_roles 
        WHERE user_id = user_uuid AND role = role_name
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments to helper functions
COMMENT ON FUNCTION assign_moderator_role(uuid) IS 'Assign moderator role to a user';
COMMENT ON FUNCTION assign_admin_role(uuid) IS 'Assign admin role to a user';
COMMENT ON FUNCTION remove_user_roles(uuid) IS 'Remove all roles from a user';
COMMENT ON FUNCTION user_has_role(uuid, text) IS 'Check if user has a specific role';

-- ============================================================================
-- ROLLBACK BLOCK (commented out)
-- ============================================================================
/*
-- Rollback script - uncomment to drop all RLS objects created by this migration
-- DROP FUNCTION IF EXISTS user_has_role(uuid, text);
-- DROP FUNCTION IF EXISTS remove_user_roles(uuid);
-- DROP FUNCTION IF EXISTS assign_admin_role(uuid);
-- DROP FUNCTION IF EXISTS assign_moderator_role(uuid);
-- DROP POLICY IF EXISTS crep_service_all ON content_reports;
-- DROP POLICY IF EXISTS crep_mod_read_all ON content_reports;
-- DROP POLICY IF EXISTS crep_auth_insert ON content_reports;
-- DROP POLICY IF EXISTS cr_service_all ON content_reviews;
-- DROP POLICY IF EXISTS cr_mod_write_all ON content_reviews;
-- DROP POLICY IF EXISTS cr_mod_read_all ON content_reviews;
-- DROP POLICY IF EXISTS cr_creator_insert ON content_reviews;
-- DROP POLICY IF EXISTS cr_creator_read_own ON content_reviews;
-- DROP POLICY IF EXISTS turns_service_all ON turns;
-- DROP POLICY IF EXISTS turns_owner_insert ON turns;
-- DROP POLICY IF EXISTS turns_owner_select ON turns;
-- DROP POLICY IF EXISTS games_service_all ON games;
-- DROP POLICY IF EXISTS games_owner_update ON games;
-- DROP POLICY IF EXISTS games_owner_insert ON games;
-- DROP POLICY IF EXISTS games_owner_select ON games;
-- DROP POLICY IF EXISTS ep_service_all ON entry_points;
-- DROP POLICY IF EXISTS ep_mod_write_all ON entry_points;
-- DROP POLICY IF EXISTS ep_mod_read_all ON entry_points;
-- DROP POLICY IF EXISTS ep_creator_update_own ON entry_points;
-- DROP POLICY IF EXISTS ep_creator_insert_own ON entry_points;
-- DROP POLICY IF EXISTS ep_creator_read_own ON entry_points;
-- DROP POLICY IF EXISTS ep_public_read_live ON entry_points;
-- ALTER TABLE content_reports DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE content_reviews DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE turns DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE games DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE entry_points DISABLE ROW LEVEL SECURITY;
-- DROP TABLE IF EXISTS app_roles;
*/
