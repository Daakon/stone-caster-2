-- AWF Bundle Migration Phase 1: Game States Table
-- Creates table for AWF runtime game states

-- Create game_states table
CREATE TABLE IF NOT EXISTS game_states (
  session_id UUID PRIMARY KEY,
  hot JSONB NOT NULL DEFAULT '{}',
  warm JSONB NOT NULL DEFAULT '{"episodic":[],"pins":[]}'::jsonb,
  cold JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_game_states_updated_at ON game_states(updated_at);

-- Add RLS policies
ALTER TABLE game_states ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view game states for their own sessions
CREATE POLICY "Users can view their own game states" ON game_states
  FOR SELECT USING (
    session_id IN (
      SELECT session_id FROM sessions 
      WHERE player_id = auth.uid()::text OR player_id = auth.jwt() ->> 'sub'
    )
  );

-- Policy: Users can insert game states for their own sessions
CREATE POLICY "Users can insert their own game states" ON game_states
  FOR INSERT WITH CHECK (
    session_id IN (
      SELECT session_id FROM sessions 
      WHERE player_id = auth.uid()::text OR player_id = auth.jwt() ->> 'sub'
    )
  );

-- Policy: Users can update game states for their own sessions
CREATE POLICY "Users can update their own game states" ON game_states
  FOR UPDATE USING (
    session_id IN (
      SELECT session_id FROM sessions 
      WHERE player_id = auth.uid()::text OR player_id = auth.jwt() ->> 'sub'
    )
  );

-- Policy: Users can delete game states for their own sessions
CREATE POLICY "Users can delete their own game states" ON game_states
  FOR DELETE USING (
    session_id IN (
      SELECT session_id FROM sessions 
      WHERE player_id = auth.uid()::text OR player_id = auth.jwt() ->> 'sub'
    )
  );

-- Policy: Service role can manage all game states
CREATE POLICY "Service role can manage all game states" ON game_states
  FOR ALL TO service_role USING (TRUE);

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
COMMENT ON TABLE game_states IS 'AWF runtime game states for stateless model flow';
COMMENT ON COLUMN game_states.session_id IS 'Reference to the session this state belongs to';
COMMENT ON COLUMN game_states.hot IS 'Hot state data (frequently changing)';
COMMENT ON COLUMN game_states.warm IS 'Warm state data (moderately changing)';
COMMENT ON COLUMN game_states.cold IS 'Cold state data (rarely changing)';


