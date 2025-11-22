-- Phase 8: RLS Lock Edits While In Review
-- Prevents regular users from editing entities once they are in_review or published
-- Admins retain full access

BEGIN;

-- ============================================================================
-- ENTRY_POINTS (Stories) - Update policies to check publish_status
-- ============================================================================

-- Drop old update policy
DROP POLICY IF EXISTS ep_creator_update_own ON entry_points;

-- New update policy: only allow updates when publish_status = 'draft'
-- Admins can still update via ep_mod_write_all policy
CREATE POLICY ep_creator_update_own
ON entry_points FOR UPDATE
TO authenticated
USING (
  owner_user_id = auth.uid() 
  AND (publish_status IS NULL OR publish_status = 'draft')
)
WITH CHECK (
  owner_user_id = auth.uid() 
  AND (publish_status IS NULL OR publish_status = 'draft')
);

-- Drop old delete policy if it exists
DROP POLICY IF EXISTS ep_creator_delete_own ON entry_points;

-- Delete policy: only allow deletes when publish_status = 'draft'
CREATE POLICY ep_creator_delete_own
ON entry_points FOR DELETE
TO authenticated
USING (
  owner_user_id = auth.uid() 
  AND (publish_status IS NULL OR publish_status = 'draft')
);

-- ============================================================================
-- WORLDS - Add RLS policies for publish_status
-- ============================================================================

-- Enable RLS if not already enabled
ALTER TABLE worlds ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS worlds_creator_update_own ON worlds;
DROP POLICY IF EXISTS worlds_creator_delete_own ON worlds;
DROP POLICY IF EXISTS worlds_creator_read_own ON worlds;
DROP POLICY IF EXISTS worlds_admin_all ON worlds;

-- Creator read own (any status)
CREATE POLICY worlds_creator_read_own
ON worlds FOR SELECT
TO authenticated
USING (owner_user_id = auth.uid());

-- Creator update own (only draft)
CREATE POLICY worlds_creator_update_own
ON worlds FOR UPDATE
TO authenticated
USING (
  owner_user_id = auth.uid() 
  AND (publish_status IS NULL OR publish_status = 'draft')
)
WITH CHECK (
  owner_user_id = auth.uid() 
  AND (publish_status IS NULL OR publish_status = 'draft')
);

-- Creator delete own (only draft)
CREATE POLICY worlds_creator_delete_own
ON worlds FOR DELETE
TO authenticated
USING (
  owner_user_id = auth.uid() 
  AND (publish_status IS NULL OR publish_status = 'draft')
);

-- Admin full access (bypass publish_status checks)
CREATE POLICY worlds_admin_all
ON worlds FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up 
    WHERE up.id = auth.uid() 
    AND up.role IN ('admin', 'moderator')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles up 
    WHERE up.id = auth.uid() 
    AND up.role IN ('admin', 'moderator')
  )
);

-- Public read (published worlds only)
CREATE POLICY worlds_public_read
ON worlds FOR SELECT
TO anon, authenticated
USING (
  visibility = 'public' 
  AND review_state = 'approved'
  AND (publish_status IS NULL OR publish_status = 'published')
);

-- ============================================================================
-- NPCS - Add RLS policies for publish_status
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS npcs_creator_update_own ON npcs;
DROP POLICY IF EXISTS npcs_creator_delete_own ON npcs;
DROP POLICY IF EXISTS npcs_creator_read_own ON npcs;

-- Creator read own (any status)
CREATE POLICY npcs_creator_read_own
ON npcs FOR SELECT
TO authenticated
USING (owner_user_id = auth.uid());

-- Creator update own (only draft)
CREATE POLICY npcs_creator_update_own
ON npcs FOR UPDATE
TO authenticated
USING (
  owner_user_id = auth.uid() 
  AND (publish_status IS NULL OR publish_status = 'draft')
)
WITH CHECK (
  owner_user_id = auth.uid() 
  AND (publish_status IS NULL OR publish_status = 'draft')
);

-- Creator delete own (only draft)
CREATE POLICY npcs_creator_delete_own
ON npcs FOR DELETE
TO authenticated
USING (
  owner_user_id = auth.uid() 
  AND (publish_status IS NULL OR publish_status = 'draft')
);

-- Admin full access (update existing admin policy if needed)
-- Note: npcs_admin_read_all already exists from previous migration
-- Add admin write policy
DROP POLICY IF EXISTS npcs_admin_write_all ON npcs;

CREATE POLICY npcs_admin_write_all
ON npcs FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

COMMIT;

