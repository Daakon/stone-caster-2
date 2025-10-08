-- Migration: Create players_v3 table for new character creation system
-- This table stores PlayerV3 objects with proper JSONB structure for skills, relationships, etc.

CREATE TABLE IF NOT EXISTS players_v3 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  cookie_id UUID, -- For guest users
  world_slug TEXT NOT NULL,
  version INTEGER DEFAULT 3,
  
  -- Core player data (matches PlayerV3 schema)
  name TEXT NOT NULL CHECK (length(name) >= 1 AND length(name) <= 50),
  role TEXT NOT NULL CHECK (length(role) >= 1 AND length(role) <= 50),
  race TEXT NOT NULL CHECK (length(race) >= 1 AND length(race) <= 50),
  essence TEXT[] NOT NULL CHECK (array_length(essence, 1) >= 1 AND array_length(essence, 1) <= 4),
  age TEXT NOT NULL CHECK (length(age) >= 1 AND length(age) <= 50),
  build TEXT NOT NULL CHECK (length(build) >= 1 AND length(build) <= 50),
  eyes TEXT NOT NULL CHECK (length(eyes) >= 1 AND length(eyes) <= 50),
  traits TEXT[] NOT NULL CHECK (array_length(traits, 1) >= 2 AND array_length(traits, 1) <= 4),
  
  -- Optional narrative fields
  backstory TEXT,
  motivation TEXT,
  
  -- Skills as JSONB with validation
  skills JSONB NOT NULL DEFAULT '{"combat": 50, "stealth": 50, "social": 50, "lore": 50, "survival": 50, "medicine": 50, "craft": 50}',
  inventory TEXT[] NOT NULL DEFAULT '{}',
  
  -- Always empty at creation (unless adventure preset applies)
  relationships JSONB NOT NULL DEFAULT '{}',
  goals JSONB NOT NULL DEFAULT '{"short_term": [], "long_term": []}',
  flags JSONB NOT NULL DEFAULT '{}',
  reputation JSONB NOT NULL DEFAULT '{}',
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  active_game_id UUID REFERENCES games(id) ON DELETE SET NULL
);

-- Add constraints for skills validation
ALTER TABLE players_v3 
ADD CONSTRAINT skills_valid_range 
CHECK (
  jsonb_typeof(skills) = 'object' AND
  (skills->>'combat')::int BETWEEN 0 AND 100 AND
  (skills->>'stealth')::int BETWEEN 0 AND 100 AND
  (skills->>'social')::int BETWEEN 0 AND 100 AND
  (skills->>'lore')::int BETWEEN 0 AND 100 AND
  (skills->>'survival')::int BETWEEN 0 AND 100 AND
  (skills->>'medicine')::int BETWEEN 0 AND 100 AND
  (skills->>'craft')::int BETWEEN 0 AND 100
);

-- Add constraint to ensure either user_id or cookie_id is set
ALTER TABLE players_v3 
ADD CONSTRAINT players_v3_user_or_cookie 
CHECK ((user_id IS NOT NULL) OR (cookie_id IS NOT NULL));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_players_v3_user_id ON players_v3(user_id);
CREATE INDEX IF NOT EXISTS idx_players_v3_cookie_id ON players_v3(cookie_id);
CREATE INDEX IF NOT EXISTS idx_players_v3_world_slug ON players_v3(world_slug);
CREATE INDEX IF NOT EXISTS idx_players_v3_active_game ON players_v3(active_game_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_players_v3_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_players_v3_updated_at
  BEFORE UPDATE ON players_v3
  FOR EACH ROW
  EXECUTE FUNCTION update_players_v3_updated_at();

-- Add RLS policies
ALTER TABLE players_v3 ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own players
CREATE POLICY "Users can view own players" ON players_v3
  FOR SELECT USING (
    auth.uid() = user_id OR 
    (user_id IS NULL AND cookie_id = (SELECT cookie_id FROM guest_identities WHERE user_id = auth.uid()))
  );

-- Policy: Users can insert their own players
CREATE POLICY "Users can insert own players" ON players_v3
  FOR INSERT WITH CHECK (
    auth.uid() = user_id OR 
    (user_id IS NULL AND cookie_id = (SELECT cookie_id FROM guest_identities WHERE user_id = auth.uid()))
  );

-- Policy: Users can update their own players
CREATE POLICY "Users can update own players" ON players_v3
  FOR UPDATE USING (
    auth.uid() = user_id OR 
    (user_id IS NULL AND cookie_id = (SELECT cookie_id FROM guest_identities WHERE user_id = auth.uid()))
  );

-- Policy: Users can delete their own players
CREATE POLICY "Users can delete own players" ON players_v3
  FOR DELETE USING (
    auth.uid() = user_id OR 
    (user_id IS NULL AND cookie_id = (SELECT cookie_id FROM guest_identities WHERE user_id = auth.uid()))
  );

-- Add comment
COMMENT ON TABLE players_v3 IS 'PlayerV3 character data with 0-100 skill scales and world-scoped traits';
COMMENT ON COLUMN players_v3.skills IS 'Skills with 0-100 scale, 50=baseline';
COMMENT ON COLUMN players_v3.relationships IS 'Always empty at creation, populated by adventure presets';
COMMENT ON COLUMN players_v3.goals IS 'Always empty at creation, populated by adventure presets';
COMMENT ON COLUMN players_v3.flags IS 'Always empty at creation, populated by adventure presets';
COMMENT ON COLUMN players_v3.reputation IS 'Always empty at creation, populated by adventure presets';


