-- Create game_states table for managing game state
CREATE TABLE IF NOT EXISTS game_states (
  id TEXT PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  turn_index INTEGER NOT NULL DEFAULT 0,
  current_scene TEXT NOT NULL,
  character_data JSONB,
  world_data JSONB NOT NULL,
  adventure_data JSONB,
  flags JSONB DEFAULT '{}',
  ledgers JSONB DEFAULT '{}',
  presence TEXT DEFAULT 'present',
  last_acts JSONB DEFAULT '[]',
  style_hint TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_game_states_game_id ON game_states(game_id);
CREATE INDEX IF NOT EXISTS idx_game_states_turn_index ON game_states(game_id, turn_index);
CREATE INDEX IF NOT EXISTS idx_game_states_created_at ON game_states(created_at);

-- Add RLS policies
ALTER TABLE game_states ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access game states for games they own
CREATE POLICY "Users can access their own game states" ON game_states
  FOR ALL USING (
    game_id IN (
      SELECT id FROM games WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can insert game states for their own games
CREATE POLICY "Users can insert game states for their own games" ON game_states
  FOR INSERT WITH CHECK (
    game_id IN (
      SELECT id FROM games WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can update game states for their own games
CREATE POLICY "Users can update game states for their own games" ON game_states
  FOR UPDATE USING (
    game_id IN (
      SELECT id FROM games WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can delete game states for their own games
CREATE POLICY "Users can delete game states for their own games" ON game_states
  FOR DELETE USING (
    game_id IN (
      SELECT id FROM games WHERE user_id = auth.uid()
    )
  );

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_game_states_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_game_states_updated_at
  BEFORE UPDATE ON game_states
  FOR EACH ROW
  EXECUTE FUNCTION update_game_states_updated_at();

-- Add comments
COMMENT ON TABLE game_states IS 'Stores game state snapshots for each turn';
COMMENT ON COLUMN game_states.id IS 'Unique identifier for the game state record';
COMMENT ON COLUMN game_states.game_id IS 'Reference to the game this state belongs to';
COMMENT ON COLUMN game_states.turn_index IS 'Turn number this state represents';
COMMENT ON COLUMN game_states.current_scene IS 'Current scene ID in the game';
COMMENT ON COLUMN game_states.character_data IS 'Character data snapshot';
COMMENT ON COLUMN game_states.world_data IS 'World template data';
COMMENT ON COLUMN game_states.adventure_data IS 'Adventure data if applicable';
COMMENT ON COLUMN game_states.flags IS 'Game flags and state variables';
COMMENT ON COLUMN game_states.ledgers IS 'Game ledgers and tracking data';
COMMENT ON COLUMN game_states.presence IS 'Current presence state';
COMMENT ON COLUMN game_states.last_acts IS 'Last actions taken by the player';
COMMENT ON COLUMN game_states.style_hint IS 'Style hint for AI generation';



















