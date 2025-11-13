-- Phase 8: Publishing Wizard Sessions
-- Additive migration for wizard save/resume functionality

-- Create wizard sessions table for server-side persistence
CREATE TABLE IF NOT EXISTS publishing_wizard_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('world', 'story', 'npc')),
  entity_id uuid NOT NULL,
  step text NOT NULL CHECK (step IN ('dependencies', 'preflight', 'submit')),
  data jsonb NOT NULL DEFAULT '{}'::jsonb, -- sparse step state (scores, issues, timestamps)
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, entity_type, entity_id)
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_pws_user_entity ON publishing_wizard_sessions(user_id, entity_type, entity_id);

-- Index for cleanup queries (old sessions)
CREATE INDEX IF NOT EXISTS idx_pws_updated_at ON publishing_wizard_sessions(updated_at);

-- RLS policies (if RLS is enabled)
-- Allow users to read/write their own sessions
-- ALTER TABLE publishing_wizard_sessions ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY pws_user_select ON publishing_wizard_sessions FOR SELECT USING (auth.uid() = user_id);
-- CREATE POLICY pws_user_insert ON publishing_wizard_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
-- CREATE POLICY pws_user_update ON publishing_wizard_sessions FOR UPDATE USING (auth.uid() = user_id);
-- CREATE POLICY pws_user_delete ON publishing_wizard_sessions FOR DELETE USING (auth.uid() = user_id);



