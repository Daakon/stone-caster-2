-- Create idempotency_keys table for Layer M3
-- Prevents duplicate turns and double-spending

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(255) NOT NULL,
  owner_id VARCHAR(255) NOT NULL, -- user_id or cookie_group_id
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  operation VARCHAR(50) NOT NULL DEFAULT 'turn',
  request_hash VARCHAR(64) NOT NULL, -- SHA256 hash of request data
  response_data JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  -- Ensure unique idempotency keys per owner/game/operation
  UNIQUE(key, owner_id, game_id, operation)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_lookup 
ON idempotency_keys(key, owner_id, game_id, operation);

-- Index for cleanup of old records
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created_at 
ON idempotency_keys(created_at);

-- RLS policies
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own idempotency records
CREATE POLICY "Users can view own idempotency records" ON idempotency_keys
  FOR SELECT USING (
    auth.uid()::text = owner_id OR 
    owner_id IN (
      SELECT id::text 
      FROM cookie_groups 
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can insert their own idempotency records
CREATE POLICY "Users can insert own idempotency records" ON idempotency_keys
  FOR INSERT WITH CHECK (
    auth.uid()::text = owner_id OR 
    owner_id IN (
      SELECT id::text 
      FROM cookie_groups 
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can update their own idempotency records
CREATE POLICY "Users can update own idempotency records" ON idempotency_keys
  FOR UPDATE USING (
    auth.uid()::text = owner_id OR 
    owner_id IN (
      SELECT id::text 
      FROM cookie_groups 
      WHERE user_id = auth.uid()
    )
  );

-- Add comment
COMMENT ON TABLE idempotency_keys IS 'Stores idempotency keys to prevent duplicate operations and double-spending';
COMMENT ON COLUMN idempotency_keys.key IS 'Idempotency key (UUID) from client request';
COMMENT ON COLUMN idempotency_keys.owner_id IS 'Owner ID (user_id or cookie_group_id)';
COMMENT ON COLUMN idempotency_keys.operation IS 'Operation type (e.g., turn, purchase)';
COMMENT ON COLUMN idempotency_keys.request_hash IS 'SHA256 hash of request data for validation';
COMMENT ON COLUMN idempotency_keys.response_data IS 'Cached response data for duplicate requests';
