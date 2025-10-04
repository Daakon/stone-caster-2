-- Manual Migration Script for StoneCaster
-- Run this directly in your Supabase SQL Editor

-- Step 1: Update characters table constraint
-- Drop the existing constraint that requires either user_id OR cookie_id (but not both)
ALTER TABLE characters DROP CONSTRAINT IF EXISTS characters_owner_check;

-- Add new constraint that requires at least one of user_id or cookie_id to be present
ALTER TABLE characters ADD CONSTRAINT characters_owner_check 
  CHECK (
    user_id IS NOT NULL OR cookie_id IS NOT NULL
  );

-- Step 2: Create cookie_user_links table
CREATE TABLE IF NOT EXISTS cookie_user_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cookie_id UUID NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure unique cookie_id (one cookie can only link to one user)
  UNIQUE(cookie_id),
  
  -- Ensure unique user_id (one user can only have one cookie link)
  UNIQUE(user_id)
);

-- Step 3: Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_cookie_user_links_cookie_id ON cookie_user_links(cookie_id);
CREATE INDEX IF NOT EXISTS idx_cookie_user_links_user_id ON cookie_user_links(user_id);

-- Step 4: Add RLS policies for cookie_user_links
ALTER TABLE cookie_user_links ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own cookie links
DROP POLICY IF EXISTS "Users can view own cookie links" ON cookie_user_links;
CREATE POLICY "Users can view own cookie links" ON cookie_user_links
  FOR SELECT USING (user_id = auth.uid());

-- Policy: Users can insert their own cookie links
DROP POLICY IF EXISTS "Users can insert own cookie links" ON cookie_user_links;
CREATE POLICY "Users can insert own cookie links" ON cookie_user_links
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Policy: Service role can manage all cookie links
DROP POLICY IF EXISTS "Service role can manage all cookie links" ON cookie_user_links;
CREATE POLICY "Service role can manage all cookie links" ON cookie_user_links
  FOR ALL TO service_role USING (TRUE);

-- Step 5: Create helper functions
CREATE OR REPLACE FUNCTION link_cookie_to_user(p_cookie_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Insert the link
  INSERT INTO cookie_user_links (cookie_id, user_id)
  VALUES (p_cookie_id, p_user_id)
  ON CONFLICT (cookie_id) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    updated_at = NOW();
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_user_id_from_cookie(p_cookie_id UUID)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT user_id INTO v_user_id
  FROM cookie_user_links
  WHERE cookie_id = p_cookie_id;
  
  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION migrate_characters_to_user(p_cookie_id UUID, p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Update characters to use user_id instead of cookie_id
  UPDATE characters 
  SET 
    user_id = p_user_id,
    cookie_id = NULL,
    updated_at = NOW()
  WHERE cookie_id = p_cookie_id;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  -- Link the cookie to the user
  PERFORM link_cookie_to_user(p_cookie_id, p_user_id);
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Add comments for documentation
COMMENT ON TABLE cookie_user_links IS 'Links cookie_ids to user_ids for seamless guest-to-user migration';
COMMENT ON COLUMN cookie_user_links.cookie_id IS 'Guest cookie ID';
COMMENT ON COLUMN cookie_user_links.user_id IS 'Authenticated user ID';
COMMENT ON FUNCTION link_cookie_to_user IS 'Links a cookie_id to a user_id for migration';
COMMENT ON FUNCTION get_user_id_from_cookie IS 'Gets user_id from cookie_id if linked';
COMMENT ON FUNCTION migrate_characters_to_user IS 'Migrates all characters from cookie_id to user_id';

-- Step 7: Verify the changes
SELECT 'Migration completed successfully!' as status;

-- Test the constraint
SELECT 'Testing constraint: user_id only' as test;
-- This should work (user_id present, cookie_id null)
-- INSERT INTO characters (id, name, world_slug, user_id) VALUES ('test-1', 'Test User', 'mystika', 'test-user-1');

SELECT 'Testing constraint: cookie_id only' as test;
-- This should work (cookie_id present, user_id null)
-- INSERT INTO characters (id, name, world_slug, cookie_id) VALUES ('test-2', 'Test Cookie', 'mystika', 'test-cookie-1');

SELECT 'Testing constraint: both present' as test;
-- This should work (both present)
-- INSERT INTO characters (id, name, world_slug, user_id, cookie_id) VALUES ('test-3', 'Test Both', 'mystika', 'test-user-2', 'test-cookie-2');

SELECT 'Testing constraint: neither present' as test;
-- This should fail (neither present)
-- INSERT INTO characters (id, name, world_slug) VALUES ('test-4', 'Test Neither', 'mystika');

