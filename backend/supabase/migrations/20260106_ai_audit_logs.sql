-- Create AI Audit Logs table
CREATE TABLE IF NOT EXISTS ai_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES chimera_game_states(id), -- References the permanent game state table
  turn_index INT, -- To track chronological order
  action_type VARCHAR(50), -- 'GENESIS', 'COMBAT', 'CHAT'
  prompt_text TEXT NOT NULL,
  raw_response TEXT,
  token_usage JSONB, -- { "prompt": 100, "completion": 50, "total": 150 }
  cost_stones INT, -- Calculated cost based on usage
  model_used VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE ai_audit_logs ENABLE ROW LEVEL SECURITY;

-- Grant access to service role (backend)
GRANT ALL ON ai_audit_logs TO service_role;

-- Policies
-- Users can view logs for their own games
create policy "Users can view their own audit logs" on ai_audit_logs
  for select using (
    auth.uid() in (
      select player_id from chimera_game_states where id = ai_audit_logs.game_id
    )
  );
