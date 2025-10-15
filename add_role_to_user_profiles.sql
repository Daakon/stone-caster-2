-- Add role column to user_profiles table
-- This migration adds a role column to store user roles in the application database

-- Add role column to user_profiles
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'prompt_admin'));

-- Create index for role-based queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- Update the get_user_profile_by_auth_id function to include role
CREATE OR REPLACE FUNCTION get_user_profile_by_auth_id(p_auth_user_id UUID)
RETURNS TABLE (
  id UUID,
  auth_user_id UUID,
  cookie_group_id UUID,
  display_name VARCHAR(100),
  avatar_url TEXT,
  email VARCHAR(255),
  role TEXT,
  preferences JSONB,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    up.id,
    up.auth_user_id,
    up.cookie_group_id,
    up.display_name,
    up.avatar_url,
    up.email,
    up.role,
    up.preferences,
    up.last_seen_at,
    up.created_at,
    up.updated_at
  FROM user_profiles up
  WHERE up.auth_user_id = p_auth_user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update user role
CREATE OR REPLACE FUNCTION update_user_role(
  p_auth_user_id UUID,
  p_role TEXT
)
RETURNS VOID AS $$
BEGIN
  UPDATE user_profiles
  SET role = p_role,
      updated_at = NOW()
  WHERE auth_user_id = p_auth_user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get user role by auth user ID
CREATE OR REPLACE FUNCTION get_user_role(p_auth_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM user_profiles
  WHERE auth_user_id = p_auth_user_id;
  
  RETURN COALESCE(user_role, 'user');
END;
$$ LANGUAGE plpgsql;
