-- Prompt Traces Migration
-- Optional audit trail for narrator/system turns: compact prompt trace with pieces, policy, timings
-- Admin-only access via backend; no PII; safe defaults
--
-- SECURITY: This table is accessible ONLY via service role (backend).
-- No RLS policies for anon/auth (they cannot access traces).
-- Admin role check is enforced at API route level.
-- All prompt snippets are redacted and capped before storage.

BEGIN;

-- Ensure prompting schema exists
CREATE SCHEMA IF NOT EXISTS prompting;

-- Create prompt_traces table
CREATE TABLE IF NOT EXISTS prompting.prompt_traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  turn_id UUID NOT NULL REFERENCES turns(id) ON DELETE CASCADE,
  turn_number INTEGER NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('start', 'turn')),
  source TEXT NOT NULL DEFAULT 'entry-point',
  version TEXT NOT NULL DEFAULT 'v3',
  token_pct NUMERIC NOT NULL,
  policy JSONB NOT NULL DEFAULT '[]'::jsonb,
  pieces JSONB NOT NULL, -- array of {scope, slug, version, tokens}
  timings JSONB NOT NULL, -- {assembleMs, aiMs, totalMs}
  prompt_snippet TEXT NOT NULL, -- first 2000 chars after redaction
  prompt_hash TEXT, -- sha256 hash for deduplication
  ruleset_slug TEXT,
  npc_trimmed_count INTEGER DEFAULT 0,
  by_scope JSONB, -- Token distribution by scope: {core: x, ruleset: y, world: z, entry: a, npc: b}
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_prompt_traces_game_turn 
  ON prompting.prompt_traces(game_id, turn_number DESC);

CREATE INDEX IF NOT EXISTS idx_prompt_traces_created_at 
  ON prompting.prompt_traces(created_at DESC);

-- RLS Policies
ALTER TABLE prompting.prompt_traces ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (backend only)
CREATE POLICY "Service role full access" ON prompting.prompt_traces
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Deny all other access by default (admin-only via backend)
CREATE POLICY "Deny anon and auth" ON prompting.prompt_traces
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- Comments
COMMENT ON TABLE prompting.prompt_traces IS 'Compact audit trail for prompt assembly (admin-only, redacted, capped)';
COMMENT ON COLUMN prompting.prompt_traces.prompt_snippet IS 'First 2000 chars of redacted prompt (no PII)';
COMMENT ON COLUMN prompting.prompt_traces.pieces IS 'Array of {scope, slug, version, tokens}';
COMMENT ON COLUMN prompting.prompt_traces.policy IS 'Array of policy actions (e.g., NPC_DROPPED)';
COMMENT ON COLUMN prompting.prompt_traces.timings IS 'Object with assembleMs, aiMs, totalMs';

COMMIT;

