-- AWF Phase 10: Turn Write-Ahead Log
-- Creates table for crash recovery and idempotent turn processing

-- Create turn_wal table
CREATE TABLE IF NOT EXISTS turn_wal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  turn_id INTEGER NOT NULL,
  awf_raw JSONB NOT NULL,
  applied BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, turn_id),
  FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_turn_wal_session_id ON turn_wal(session_id);
CREATE INDEX IF NOT EXISTS idx_turn_wal_turn_id ON turn_wal(session_id, turn_id);
CREATE INDEX IF NOT EXISTS idx_turn_wal_applied ON turn_wal(applied);
CREATE INDEX IF NOT EXISTS idx_turn_wal_created_at ON turn_wal(created_at);

-- Add RLS policies
ALTER TABLE turn_wal ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view WAL for their own sessions
CREATE POLICY "Users can view their own turn WAL" ON turn_wal
  FOR SELECT USING (
    session_id IN (
      SELECT session_id FROM sessions 
      WHERE player_id = auth.uid()::text OR player_id = auth.jwt() ->> 'sub'
    )
  );

-- Policy: Users can insert WAL for their own sessions
CREATE POLICY "Users can insert their own turn WAL" ON turn_wal
  FOR INSERT WITH CHECK (
    session_id IN (
      SELECT session_id FROM sessions 
      WHERE player_id = auth.uid()::text OR player_id = auth.jwt() ->> 'sub'
    )
  );

-- Policy: Users can update WAL for their own sessions
CREATE POLICY "Users can update their own turn WAL" ON turn_wal
  FOR UPDATE USING (
    session_id IN (
      SELECT session_id FROM sessions 
      WHERE player_id = auth.uid()::text OR player_id = auth.jwt() ->> 'sub'
    )
  );

-- Policy: Users can delete WAL for their own sessions
CREATE POLICY "Users can delete their own turn WAL" ON turn_wal
  FOR DELETE USING (
    session_id IN (
      SELECT session_id FROM sessions 
      WHERE player_id = auth.uid()::text OR player_id = auth.jwt() ->> 'sub'
    )
  );

-- Policy: Service role can manage all turn WAL
CREATE POLICY "Service role can manage all turn WAL" ON turn_wal
  FOR ALL TO service_role USING (TRUE);


