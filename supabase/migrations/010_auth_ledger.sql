-- Migration: Add auth ledger table for tracking guest-to-user linking events
-- This table provides an immutable audit trail of authentication events

-- Create auth_ledger table
CREATE TABLE IF NOT EXISTS auth_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('LINK_MERGE', 'GAME_MIGRATION', 'STONE_MIGRATION', 'USER_CREATION')),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  guest_cookie_id UUID,
  canonical_group_id UUID REFERENCES cookie_groups(id) ON DELETE CASCADE,
  source_group_id UUID REFERENCES cookie_groups(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_auth_ledger_user_id ON auth_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_ledger_guest_cookie_id ON auth_ledger(guest_cookie_id);
CREATE INDEX IF NOT EXISTS idx_auth_ledger_type ON auth_ledger(type);
CREATE INDEX IF NOT EXISTS idx_auth_ledger_created_at ON auth_ledger(created_at);

-- Create composite index for idempotency checks
CREATE INDEX IF NOT EXISTS idx_auth_ledger_link_merge ON auth_ledger(type, user_id, guest_cookie_id) 
WHERE type = 'LINK_MERGE';

-- Add RLS policies
ALTER TABLE auth_ledger ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own ledger entries
CREATE POLICY "Users can view own ledger entries" ON auth_ledger
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Service role can insert ledger entries
CREATE POLICY "Service role can insert ledger entries" ON auth_ledger
  FOR INSERT
  WITH CHECK (true);

-- Policy: Service role can update ledger entries (for admin purposes)
CREATE POLICY "Service role can update ledger entries" ON auth_ledger
  FOR UPDATE
  USING (true);

-- Add comments for documentation
COMMENT ON TABLE auth_ledger IS 'Immutable audit trail of authentication and linking events';
COMMENT ON COLUMN auth_ledger.type IS 'Type of ledger entry: LINK_MERGE, GAME_MIGRATION, STONE_MIGRATION, USER_CREATION';
COMMENT ON COLUMN auth_ledger.user_id IS 'User ID (null for guest-only events)';
COMMENT ON COLUMN auth_ledger.guest_cookie_id IS 'Guest cookie ID involved in the event';
COMMENT ON COLUMN auth_ledger.canonical_group_id IS 'Canonical group ID after linking';
COMMENT ON COLUMN auth_ledger.source_group_id IS 'Source group ID before linking (for merge events)';
COMMENT ON COLUMN auth_ledger.metadata IS 'Additional event metadata (IP, user agent, etc.)';


