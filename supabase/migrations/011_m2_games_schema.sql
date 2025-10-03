-- Layer M2 - Games Spawn & Single-Active Constraint Schema
-- Creates tables for games, adventures, turns, and related functionality

-- Create adventures table (static content from M0)
CREATE TABLE IF NOT EXISTS adventures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(100) NOT NULL UNIQUE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  world_slug VARCHAR(100) NOT NULL,
  tags JSONB DEFAULT '[]'::jsonb,
  scenarios JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create games table
CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adventure_id UUID NOT NULL REFERENCES adventures(id) ON DELETE RESTRICT,
  character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  cookie_group_id UUID REFERENCES cookie_groups(id) ON DELETE CASCADE,
  world_slug VARCHAR(100) NOT NULL,
  state_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  turn_count INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'abandoned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_played_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Ensure either user_id or cookie_group_id is present (but not both)
  CONSTRAINT games_owner_check CHECK (
    (user_id IS NOT NULL AND cookie_group_id IS NULL) OR 
    (user_id IS NULL AND cookie_group_id IS NOT NULL)
  )
);

-- Create turns table
CREATE TABLE IF NOT EXISTS turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  option_id UUID, -- Will be used in M3 for turn options
  ai_response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add active_game_id column to characters table for single-active constraint
ALTER TABLE characters ADD COLUMN IF NOT EXISTS active_game_id UUID REFERENCES games(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX idx_adventures_slug ON adventures(slug);
CREATE INDEX idx_adventures_world_slug ON adventures(world_slug);
CREATE INDEX idx_adventures_active ON adventures(is_active) WHERE is_active = true;

CREATE INDEX idx_games_adventure_id ON games(adventure_id);
CREATE INDEX idx_games_character_id ON games(character_id);
CREATE INDEX idx_games_user_id ON games(user_id);
CREATE INDEX idx_games_cookie_group_id ON games(cookie_group_id);
CREATE INDEX idx_games_world_slug ON games(world_slug);
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_games_created_at ON games(created_at DESC);
CREATE INDEX idx_games_last_played_at ON games(last_played_at DESC);

CREATE INDEX idx_turns_game_id ON turns(game_id);
CREATE INDEX idx_turns_created_at ON turns(created_at DESC);

CREATE INDEX idx_characters_active_game_id ON characters(active_game_id);

-- Enable Row Level Security
ALTER TABLE adventures ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE turns ENABLE ROW LEVEL SECURITY;

-- RLS Policies for adventures (public read access)
CREATE POLICY "Anyone can view active adventures"
  ON adventures FOR SELECT
  USING (is_active = true);

-- RLS Policies for games
CREATE POLICY "Users can view their own games"
  ON games FOR SELECT
  USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
    (auth.uid() IS NULL AND cookie_group_id IS NOT NULL)
  );

CREATE POLICY "Users can insert their own games"
  ON games FOR INSERT
  WITH CHECK (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
    (auth.uid() IS NULL AND cookie_group_id IS NOT NULL)
  );

CREATE POLICY "Users can update their own games"
  ON games FOR UPDATE
  USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
    (auth.uid() IS NULL AND cookie_group_id IS NOT NULL)
  );

CREATE POLICY "Users can delete their own games"
  ON games FOR DELETE
  USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
    (auth.uid() IS NULL AND cookie_group_id IS NOT NULL)
  );

-- RLS Policies for turns
CREATE POLICY "Users can view turns for their own games"
  ON turns FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM games 
      WHERE games.id = turns.game_id 
      AND (
        (auth.uid() IS NOT NULL AND games.user_id = auth.uid()) OR
        (auth.uid() IS NULL AND games.cookie_group_id IS NOT NULL)
      )
    )
  );

CREATE POLICY "Users can insert turns for their own games"
  ON turns FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM games 
      WHERE games.id = turns.game_id 
      AND (
        (auth.uid() IS NOT NULL AND games.user_id = auth.uid()) OR
        (auth.uid() IS NULL AND games.cookie_group_id IS NOT NULL)
      )
    )
  );

-- Service role policies for server-side operations
CREATE POLICY "Service role can manage all adventures"
  ON adventures FOR ALL
  TO service_role
  USING (TRUE);

CREATE POLICY "Service role can manage all games"
  ON games FOR ALL
  TO service_role
  USING (TRUE);

CREATE POLICY "Service role can manage all turns"
  ON turns FOR ALL
  TO service_role
  USING (TRUE);

-- Create triggers for updated_at
CREATE TRIGGER update_adventures_updated_at
  BEFORE UPDATE ON adventures
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_games_updated_at
  BEFORE UPDATE ON games
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default adventures (from static content)
INSERT INTO adventures (slug, title, description, world_slug, tags, scenarios, is_active) VALUES
-- Mystika adventures
('mystika-tutorial', 'The Mystika Tutorial', 'Learn the basics of magic in the mystical realm of Mystika', 'mystika', '["tutorial", "beginner", "magic"]'::jsonb, '["The Awakening", "First Spells", "The Test"]'::jsonb, true),
('mystika-forest-quest', 'Forest of Whispers', 'A mysterious quest through the enchanted forest', 'mystika', '["forest", "mystery", "magic"]'::jsonb, '["Enter the Forest", "The Whispering Trees", "The Hidden Grove"]'::jsonb, true),
('mystika-tower-challenge', 'Tower of Trials', 'Climb the ancient tower and face magical challenges', 'mystika', '["tower", "challenge", "magic"]'::jsonb, '["The Tower Entrance", "Floor of Fire", "Floor of Ice", "The Summit"]'::jsonb, true),

-- Aetherium adventures
('aetherium-space-station', 'Space Station Alpha', 'Explore the abandoned space station in the Aetherium system', 'aetherium', '["space", "sci-fi", "exploration"]'::jsonb, '["Docking", "Station Tour", "The Discovery"]'::jsonb, true),
('aetherium-alien-contact', 'First Contact', 'Make first contact with an alien species', 'aetherium', '["alien", "diplomacy", "sci-fi"]'::jsonb, '["The Signal", "The Meeting", "The Decision"]'::jsonb, true),

-- Voidreach adventures
('voidreach-void-exploration', 'Into the Void', 'Explore the mysterious void between dimensions', 'voidreach', '["void", "exploration", "mystery"]'::jsonb, '["The Portal", "Void Navigation", "The Discovery"]'::jsonb, true),

-- Whispercross adventures
('whispercross-haunted-town', 'The Haunted Town', 'Investigate the supernatural occurrences in Whispercross', 'whispercross', '["haunted", "supernatural", "investigation"]'::jsonb, '["Arrival", "The Investigation", "The Revelation"]'::jsonb, true),

-- Paragon City adventures
('paragon-city-superhero-origin', 'Rise of a Hero', 'Discover your superpowers and become a hero in Paragon City', 'paragon-city', '["superhero", "origin", "powers"]'::jsonb, '["The Incident", "Power Discovery", "First Heroics"]'::jsonb, true),

-- Veloria adventures
('veloria-court-intrigue', 'Court of Hearts', 'Navigate the political intrigue of the Velorian court', 'veloria', '["court", "politics", "intrigue"]'::jsonb, '["The Invitation", "Court Politics", "The Conspiracy"]'::jsonb, true),

-- Noctis Veil adventures
('noctis-veil-shadow-hunt', 'Shadow Hunt', 'Hunt dangerous creatures in the shadow realm of Noctis Veil', 'noctis-veil', '["shadow", "hunt", "danger"]'::jsonb, '["The Hunt Begins", "Shadow Creatures", "The Final Hunt"]'::jsonb, true);

-- Add comments for documentation
COMMENT ON TABLE adventures IS 'Static adventure content from M0 - defines available adventures for each world';
COMMENT ON TABLE games IS 'Active game instances - tracks game state and progress';
COMMENT ON TABLE turns IS 'Individual turns within games - stores AI responses and player actions';
COMMENT ON COLUMN games.character_id IS 'Character playing the game (optional - can be characterless)';
COMMENT ON COLUMN games.user_id IS 'Authenticated user owner (mutually exclusive with cookie_group_id)';
COMMENT ON COLUMN games.cookie_group_id IS 'Guest cookie group owner (mutually exclusive with user_id)';
COMMENT ON COLUMN games.state_snapshot IS 'Current game state (world state, NPCs, etc.)';
COMMENT ON COLUMN games.turn_count IS 'Number of turns taken in this game';
COMMENT ON COLUMN games.status IS 'Game status: active, completed, paused, abandoned';
COMMENT ON COLUMN characters.active_game_id IS 'Currently active game for this character (enforces single-active constraint)';
