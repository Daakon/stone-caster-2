-- Guest Identity System: Cookie Groups, Linking, and Maintenance
-- This migration creates the foundation for guest identity management

-- Create cookie_groups table
CREATE TABLE IF NOT EXISTS cookie_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create cookie_group_members table
CREATE TABLE IF NOT EXISTS cookie_group_members (
  cookie_id UUID PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES cookie_groups(id) ON DELETE CASCADE,
  device_label TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create guest_stone_wallets table
CREATE TABLE IF NOT EXISTS guest_stone_wallets (
  group_id UUID PRIMARY KEY REFERENCES cookie_groups(id) ON DELETE CASCADE,
  casting_stones INTEGER NOT NULL DEFAULT 0 CHECK (casting_stones >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create cookie_issue_requests table for rate limiting
CREATE TABLE IF NOT EXISTS cookie_issue_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address INET NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_cookie_groups_user_id ON cookie_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_cookie_group_members_group_id ON cookie_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_cookie_group_members_last_seen ON cookie_group_members(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_guest_stone_wallets_group_id ON guest_stone_wallets(group_id);
CREATE INDEX IF NOT EXISTS idx_cookie_issue_requests_ip_address ON cookie_issue_requests(ip_address);
CREATE INDEX IF NOT EXISTS idx_cookie_issue_requests_created_at ON cookie_issue_requests(created_at);

-- Create updated_at triggers
DROP TRIGGER IF EXISTS update_cookie_groups_updated_at ON cookie_groups;
CREATE TRIGGER update_cookie_groups_updated_at
  BEFORE UPDATE ON cookie_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_guest_stone_wallets_updated_at ON guest_stone_wallets;
CREATE TRIGGER update_guest_stone_wallets_updated_at
  BEFORE UPDATE ON guest_stone_wallets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to update last_seen_at for cookie group members
CREATE OR REPLACE FUNCTION update_cookie_member_last_seen()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_seen_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update last_seen_at on cookie group member access
DROP TRIGGER IF EXISTS trigger_update_cookie_member_last_seen ON cookie_group_members;
CREATE TRIGGER trigger_update_cookie_member_last_seen
  BEFORE UPDATE ON cookie_group_members
  FOR EACH ROW
  EXECUTE FUNCTION update_cookie_member_last_seen();

-- Function to create a new cookie group with a member
CREATE OR REPLACE FUNCTION create_cookie_group_with_member(
  p_cookie_id UUID,
  p_device_label TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_group_id UUID;
BEGIN
  -- Create new cookie group
  INSERT INTO cookie_groups (id) VALUES (DEFAULT) RETURNING id INTO v_group_id;
  
  -- Add member to group
  INSERT INTO cookie_group_members (cookie_id, group_id, device_label)
  VALUES (p_cookie_id, v_group_id, p_device_label);
  
  -- Create guest wallet for group
  INSERT INTO guest_stone_wallets (group_id, casting_stones)
  VALUES (v_group_id, 0);
  
  RETURN v_group_id;
END;
$$ LANGUAGE plpgsql;

-- Function to merge cookie groups (for linking on auth)
CREATE OR REPLACE FUNCTION merge_cookie_groups(
  p_source_group_id UUID,
  p_target_group_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_source_balance INTEGER;
BEGIN
  -- Get source group's guest wallet balance
  SELECT casting_stones INTO v_source_balance
  FROM guest_stone_wallets
  WHERE group_id = p_source_group_id;
  
  -- Add source balance to target group
  UPDATE guest_stone_wallets
  SET casting_stones = casting_stones + COALESCE(v_source_balance, 0),
      updated_at = NOW()
  WHERE group_id = p_target_group_id;
  
  -- Move all members from source to target group
  UPDATE cookie_group_members
  SET group_id = p_target_group_id,
      last_seen_at = NOW()
  WHERE group_id = p_source_group_id;
  
  -- Delete source group's guest wallet
  DELETE FROM guest_stone_wallets WHERE group_id = p_source_group_id;
  
  -- Delete empty source group
  DELETE FROM cookie_groups WHERE id = p_source_group_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get guest games for a cookie group
CREATE OR REPLACE FUNCTION get_guest_games_for_group(p_group_id UUID)
RETURNS TABLE (
  game_id UUID,
  cookie_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT gs.id as game_id, cgm.cookie_id
  FROM game_saves gs
  JOIN cookie_group_members cgm ON gs.cookie_id = cgm.cookie_id
  WHERE cgm.group_id = p_group_id;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE cookie_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE cookie_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_stone_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE cookie_issue_requests ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (for server-side operations)
CREATE POLICY "Service role can manage cookie groups" ON cookie_groups
  FOR ALL
  TO service_role
  USING (TRUE);

CREATE POLICY "Service role can manage cookie group members" ON cookie_group_members
  FOR ALL
  TO service_role
  USING (TRUE);

CREATE POLICY "Service role can manage guest stone wallets" ON guest_stone_wallets
  FOR ALL
  TO service_role
  USING (TRUE);

CREATE POLICY "Service role can manage cookie issue requests" ON cookie_issue_requests
  FOR ALL
  TO service_role
  USING (TRUE);

-- Authenticated users can read their own cookie group
CREATE POLICY "Users can read their own cookie group" ON cookie_groups
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Authenticated users can read their own cookie group members
CREATE POLICY "Users can read their own cookie group members" ON cookie_group_members
  FOR SELECT
  TO authenticated
  USING (
    group_id IN (
      SELECT id FROM cookie_groups WHERE user_id = auth.uid()
    )
  );

-- Authenticated users can read their own guest stone wallet
CREATE POLICY "Users can read their own guest stone wallet" ON guest_stone_wallets
  FOR SELECT
  TO authenticated
  USING (
    group_id IN (
      SELECT id FROM cookie_groups WHERE user_id = auth.uid()
    )
  );
