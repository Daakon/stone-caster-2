-- AWF Bundle Migration Phase 1: Sessions Table
-- Creates table for AWF runtime sessions

-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id TEXT NOT NULL,
  world_ref TEXT NOT NULL,
  adventure_ref TEXT NOT NULL,
  turn_id INTEGER NOT NULL DEFAULT 1,
  is_first_turn BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_player_id ON sessions(player_id);
CREATE INDEX IF NOT EXISTS idx_sessions_world_ref ON sessions(world_ref);
CREATE INDEX IF NOT EXISTS idx_sessions_adventure_ref ON sessions(adventure_ref);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);

-- Add RLS policies
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "Users can view their own sessions" ON sessions;
DROP POLICY IF EXISTS "Users can insert their own sessions" ON sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON sessions;
DROP POLICY IF EXISTS "Users can delete their own sessions" ON sessions;
DROP POLICY IF EXISTS "Service role can manage all sessions" ON sessions;

-- Policy: Users can view their own sessions
CREATE POLICY "Users can view their own sessions" ON sessions
  FOR SELECT USING (player_id = auth.uid()::text OR player_id = auth.jwt() ->> 'sub');

-- Policy: Users can insert their own sessions
CREATE POLICY "Users can insert their own sessions" ON sessions
  FOR INSERT WITH CHECK (player_id = auth.uid()::text OR player_id = auth.jwt() ->> 'sub');

-- Policy: Users can update their own sessions
CREATE POLICY "Users can update their own sessions" ON sessions
  FOR UPDATE USING (player_id = auth.uid()::text OR player_id = auth.jwt() ->> 'sub');

-- Policy: Users can delete their own sessions
CREATE POLICY "Users can delete their own sessions" ON sessions
  FOR DELETE USING (player_id = auth.uid()::text OR player_id = auth.jwt() ->> 'sub');

-- Policy: Service role can manage all sessions
CREATE POLICY "Service role can manage all sessions" ON sessions
  FOR ALL TO service_role USING (TRUE);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists (idempotent)
DROP TRIGGER IF EXISTS trigger_update_sessions_updated_at ON sessions;

CREATE TRIGGER trigger_update_sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_sessions_updated_at();

-- Add comments
COMMENT ON TABLE sessions IS 'AWF runtime sessions for stateless model flow';
COMMENT ON COLUMN sessions.session_id IS 'Unique session identifier';
COMMENT ON COLUMN sessions.player_id IS 'Player identifier (user ID or cookie ID)';
COMMENT ON COLUMN sessions.world_ref IS 'Reference to the world for this session';
COMMENT ON COLUMN sessions.adventure_ref IS 'Reference to the adventure for this session';
COMMENT ON COLUMN sessions.turn_id IS 'Current turn number in the session';
COMMENT ON COLUMN sessions.is_first_turn IS 'Whether this is the first turn of the session';
