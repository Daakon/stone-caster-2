-- User Profiles Migration: Link auth users to profiles with guest cookie support
-- This migration creates the user_profiles table and integrates with existing auth/cookie system

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cookie_group_id UUID UNIQUE REFERENCES cookie_groups(id) ON DELETE SET NULL,
  display_name VARCHAR(100) NOT NULL,
  avatar_url TEXT,
  email VARCHAR(255), -- Denormalized from auth.users for convenience
  preferences JSONB NOT NULL DEFAULT '{
    "showTips": true,
    "theme": "auto",
    "notifications": {
      "email": true,
      "push": false
    }
  }'::jsonb,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create csrf_tokens table for profile update protection
CREATE TABLE IF NOT EXISTS csrf_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_auth_user_id ON user_profiles(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_cookie_group_id ON user_profiles(cookie_group_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_display_name ON user_profiles(display_name);
CREATE INDEX IF NOT EXISTS idx_user_profiles_last_seen ON user_profiles(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_csrf_tokens_user_id ON csrf_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_csrf_tokens_token ON csrf_tokens(token);
CREATE INDEX IF NOT EXISTS idx_csrf_tokens_expires_at ON csrf_tokens(expires_at);

-- Create updated_at trigger
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to create user profile on auth user creation
CREATE OR REPLACE FUNCTION create_user_profile_on_auth_signup()
RETURNS TRIGGER AS $$
DECLARE
  v_display_name VARCHAR(100);
  v_email VARCHAR(255);
BEGIN
  -- Extract display name from email or use default
  v_display_name := COALESCE(
    split_part(NEW.email, '@', 1),
    'User_' || substr(NEW.id::text, 1, 8)
  );
  
  -- Store email for convenience
  v_email := NEW.email;
  
  -- Create user profile
  INSERT INTO user_profiles (
    auth_user_id,
    display_name,
    email,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    v_display_name,
    v_email,
    NOW(),
    NOW()
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create profile when auth user is created
DROP TRIGGER IF EXISTS trigger_create_user_profile ON auth.users;
CREATE TRIGGER trigger_create_user_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_profile_on_auth_signup();

-- Function to link cookie group to user profile
CREATE OR REPLACE FUNCTION link_cookie_group_to_user(
  p_auth_user_id UUID,
  p_cookie_group_id UUID
)
RETURNS VOID AS $$
BEGIN
  -- Update user profile to link cookie group
  UPDATE user_profiles
  SET cookie_group_id = p_cookie_group_id,
      updated_at = NOW()
  WHERE auth_user_id = p_auth_user_id;
  
  -- Update cookie group to link user
  UPDATE cookie_groups
  SET user_id = p_auth_user_id,
      updated_at = NOW()
  WHERE id = p_cookie_group_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get user profile by auth user ID
CREATE OR REPLACE FUNCTION get_user_profile_by_auth_id(p_auth_user_id UUID)
RETURNS TABLE (
  id UUID,
  auth_user_id UUID,
  cookie_group_id UUID,
  display_name VARCHAR(100),
  avatar_url TEXT,
  email VARCHAR(255),
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
    up.preferences,
    up.last_seen_at,
    up.created_at,
    up.updated_at
  FROM user_profiles up
  WHERE up.auth_user_id = p_auth_user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update user profile
CREATE OR REPLACE FUNCTION update_user_profile(
  p_auth_user_id UUID,
  p_display_name VARCHAR(100) DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL,
  p_preferences JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE user_profiles
  SET 
    display_name = COALESCE(p_display_name, display_name),
    avatar_url = COALESCE(p_avatar_url, avatar_url),
    preferences = COALESCE(p_preferences, preferences),
    last_seen_at = NOW(),
    updated_at = NOW()
  WHERE auth_user_id = p_auth_user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update last seen timestamp
CREATE OR REPLACE FUNCTION update_user_last_seen(p_auth_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE user_profiles
  SET last_seen_at = NOW(),
      updated_at = NOW()
  WHERE auth_user_id = p_auth_user_id;
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE csrf_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
CREATE POLICY "Users can view their own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = auth_user_id);

CREATE POLICY "Service role can manage all profiles"
  ON user_profiles FOR ALL
  TO service_role
  USING (TRUE);

-- RLS Policies for csrf_tokens
CREATE POLICY "Users can manage their own CSRF tokens"
  ON csrf_tokens FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all CSRF tokens"
  ON csrf_tokens FOR ALL
  TO service_role
  USING (TRUE);

-- Update existing game_saves table to support both user_id and cookie_id
-- This allows guest games to be linked to cookie groups
ALTER TABLE game_saves 
ADD COLUMN IF NOT EXISTS cookie_id UUID REFERENCES cookie_group_members(cookie_id) ON DELETE CASCADE;

-- Create index for cookie_id
CREATE INDEX IF NOT EXISTS idx_game_saves_cookie_id ON game_saves(cookie_id);

-- Update RLS policy for game_saves to support both auth users and cookie groups
DROP POLICY IF EXISTS "Users can view their own game saves" ON game_saves;
CREATE POLICY "Users can view their own game saves"
  ON game_saves FOR SELECT
  USING (
    auth.uid() = user_id OR 
    cookie_id IN (
      SELECT cgm.cookie_id 
      FROM cookie_group_members cgm
      JOIN cookie_groups cg ON cgm.group_id = cg.id
      WHERE cg.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own game saves" ON game_saves;
CREATE POLICY "Users can insert their own game saves"
  ON game_saves FOR INSERT
  WITH CHECK (
    auth.uid() = user_id OR 
    cookie_id IN (
      SELECT cgm.cookie_id 
      FROM cookie_group_members cgm
      JOIN cookie_groups cg ON cgm.group_id = cg.id
      WHERE cg.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own game saves" ON game_saves;
CREATE POLICY "Users can update their own game saves"
  ON game_saves FOR UPDATE
  USING (
    auth.uid() = user_id OR 
    cookie_id IN (
      SELECT cgm.cookie_id 
      FROM cookie_group_members cgm
      JOIN cookie_groups cg ON cgm.group_id = cg.id
      WHERE cg.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their own game saves" ON game_saves;
CREATE POLICY "Users can delete their own game saves"
  ON game_saves FOR DELETE
  USING (
    auth.uid() = user_id OR 
    cookie_id IN (
      SELECT cgm.cookie_id 
      FROM cookie_group_members cgm
      JOIN cookie_groups cg ON cgm.group_id = cg.id
      WHERE cg.user_id = auth.uid()
    )
  );

-- Update characters table to support both user_id and cookie_id
ALTER TABLE characters 
ADD COLUMN IF NOT EXISTS cookie_id UUID REFERENCES cookie_group_members(cookie_id) ON DELETE CASCADE;

-- Create index for cookie_id
CREATE INDEX IF NOT EXISTS idx_characters_cookie_id ON characters(cookie_id);

-- Update RLS policy for characters to support both auth users and cookie groups
DROP POLICY IF EXISTS "Users can view their own characters" ON characters;
CREATE POLICY "Users can view their own characters"
  ON characters FOR SELECT
  USING (
    auth.uid() = user_id OR 
    cookie_id IN (
      SELECT cgm.cookie_id 
      FROM cookie_group_members cgm
      JOIN cookie_groups cg ON cgm.group_id = cg.id
      WHERE cg.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own characters" ON characters;
CREATE POLICY "Users can insert their own characters"
  ON characters FOR INSERT
  WITH CHECK (
    auth.uid() = user_id OR 
    cookie_id IN (
      SELECT cgm.cookie_id 
      FROM cookie_group_members cgm
      JOIN cookie_groups cg ON cgm.group_id = cg.id
      WHERE cg.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own characters" ON characters;
CREATE POLICY "Users can update their own characters"
  ON characters FOR UPDATE
  USING (
    auth.uid() = user_id OR 
    cookie_id IN (
      SELECT cgm.cookie_id 
      FROM cookie_group_members cgm
      JOIN cookie_groups cg ON cgm.group_id = cg.id
      WHERE cg.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their own characters" ON characters;
CREATE POLICY "Users can delete their own characters"
  ON characters FOR DELETE
  USING (
    auth.uid() = user_id OR 
    cookie_id IN (
      SELECT cgm.cookie_id 
      FROM cookie_group_members cgm
      JOIN cookie_groups cg ON cgm.group_id = cg.id
      WHERE cg.user_id = auth.uid()
    )
  );
