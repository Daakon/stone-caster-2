-- Update turns table for Layer M3
-- Add missing columns to existing turns table

-- Add turn_number column if it doesn't exist
ALTER TABLE turns ADD COLUMN IF NOT EXISTS turn_number INTEGER;

-- Update existing turns to have turn numbers (if any exist)
-- This will set turn_number to 1 for existing turns
UPDATE turns SET turn_number = 1 WHERE turn_number IS NULL;

-- Make turn_number NOT NULL after setting defaults
ALTER TABLE turns ALTER COLUMN turn_number SET NOT NULL;

-- Add unique constraint for game_id and turn_number (if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'turns_game_turn_unique'
    ) THEN
        ALTER TABLE turns ADD CONSTRAINT turns_game_turn_unique UNIQUE(game_id, turn_number);
    END IF;
END $$;

-- Index for fast lookups by game (already exists from M2)
-- CREATE INDEX IF NOT EXISTS idx_turns_game_id ON turns(game_id);

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
              SELECT id 
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
              SELECT id 
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
