-- AWF Phase 10: Session Snapshots
-- Creates table for atomic save/resume snapshots

-- Create snapshots table
CREATE TABLE IF NOT EXISTS snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  label TEXT,
  content_hash TEXT NOT NULL,
  payload JSONB NOT NULL,
  UNIQUE(session_id, content_hash),
  FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_snapshots_session_id ON snapshots(session_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_content_hash ON snapshots(content_hash);
CREATE INDEX IF NOT EXISTS idx_snapshots_created_at ON snapshots(created_at);

-- Add RLS policies
ALTER TABLE snapshots ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view snapshots for their own sessions
CREATE POLICY "Users can view their own snapshots" ON snapshots
  FOR SELECT USING (
    session_id IN (
      SELECT session_id FROM sessions 
      WHERE player_id = auth.uid()::text OR player_id = auth.jwt() ->> 'sub'
    )
  );

-- Policy: Users can insert snapshots for their own sessions
CREATE POLICY "Users can insert their own snapshots" ON snapshots
  FOR INSERT WITH CHECK (
    session_id IN (
      SELECT session_id FROM sessions 
      WHERE player_id = auth.uid()::text OR player_id = auth.jwt() ->> 'sub'
    )
  );

-- Policy: Users can update snapshots for their own sessions
CREATE POLICY "Users can update their own snapshots" ON snapshots
  FOR UPDATE USING (
    session_id IN (
      SELECT session_id FROM sessions 
      WHERE player_id = auth.uid()::text OR player_id = auth.jwt() ->> 'sub'
    )
  );

-- Policy: Users can delete snapshots for their own sessions
CREATE POLICY "Users can delete their own snapshots" ON snapshots
  FOR DELETE USING (
    session_id IN (
      SELECT session_id FROM sessions 
      WHERE player_id = auth.uid()::text OR player_id = auth.jwt() ->> 'sub'
    )
  );

-- Policy: Service role can manage all snapshots
CREATE POLICY "Service role can manage all snapshots" ON snapshots
  FOR ALL TO service_role USING (TRUE);


