-- Migration to allow both user_id and cookie_id in characters table
-- This enables seamless guest-to-user migration

-- Drop the existing constraint that requires either user_id OR cookie_id (but not both)
ALTER TABLE characters DROP CONSTRAINT IF EXISTS characters_owner_check;

-- Add new constraint that requires at least one of user_id or cookie_id to be present
ALTER TABLE characters ADD CONSTRAINT characters_owner_check 
  CHECK (
    user_id IS NOT NULL OR cookie_id IS NOT NULL
  );

-- Create a new table to link cookie_ids to user_ids for migration
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

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_cookie_user_links_cookie_id ON cookie_user_links(cookie_id);
CREATE INDEX IF NOT EXISTS idx_cookie_user_links_user_id ON cookie_user_links(user_id);

-- Add RLS policies for cookie_user_links
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

-- Create function to link a cookie to a user
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

-- Create function to get user_id from cookie_id
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

-- Create function to migrate characters from cookie_id to user_id
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

-- Add comments for documentation
COMMENT ON TABLE cookie_user_links IS 'Links cookie_ids to user_ids for seamless guest-to-user migration';
COMMENT ON COLUMN cookie_user_links.cookie_id IS 'Guest cookie ID';
COMMENT ON COLUMN cookie_user_links.user_id IS 'Authenticated user ID';
COMMENT ON FUNCTION link_cookie_to_user IS 'Links a cookie_id to a user_id for migration';
COMMENT ON FUNCTION get_user_id_from_cookie IS 'Gets user_id from cookie_id if linked';
COMMENT ON FUNCTION migrate_characters_to_user IS 'Migrates all characters from cookie_id to user_id';
