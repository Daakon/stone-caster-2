-- Create turns table for Layer M3
-- Stores turn results and AI responses

CREATE TABLE IF NOT EXISTS turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  option_id UUID NOT NULL, -- The choice/option that was selected
  ai_response JSONB NOT NULL, -- Full AI response (TurnResponse)
  turn_number INTEGER NOT NULL, -- Turn count when this turn was made
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure turns are ordered by game and turn number
  UNIQUE(game_id, turn_number)
);

-- Index for fast lookups by game
CREATE INDEX IF NOT EXISTS idx_turns_game_id ON turns(game_id);

-- Index for ordering turns
CREATE INDEX IF NOT EXISTS idx_turns_game_turn ON turns(game_id, turn_number);

-- RLS policies
ALTER TABLE turns ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see turns for their own games
CREATE POLICY "Users can view turns for own games" ON turns
  FOR SELECT USING (
    game_id IN (
      SELECT id FROM games 
      WHERE user_id = auth.uid() OR 
            cookie_group_id IN (
              SELECT cookie_group_id 
              FROM cookie_groups 
              WHERE user_id = auth.uid()
            )
    )
  );

-- Policy: Users can insert turns for their own games
CREATE POLICY "Users can insert turns for own games" ON turns
  FOR INSERT WITH CHECK (
    game_id IN (
      SELECT id FROM games 
      WHERE user_id = auth.uid() OR 
            cookie_group_id IN (
              SELECT cookie_group_id 
              FROM cookie_groups 
              WHERE user_id = auth.uid()
            )
    )
  );

-- Add comment
COMMENT ON TABLE turns IS 'Stores turn results and AI responses for games';
COMMENT ON COLUMN turns.option_id IS 'The choice/option that was selected for this turn';
COMMENT ON COLUMN turns.ai_response IS 'Full AI response following TurnResponse schema';
COMMENT ON COLUMN turns.turn_number IS 'Turn count when this turn was made (for ordering)';
