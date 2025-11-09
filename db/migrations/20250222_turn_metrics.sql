-- Create turn_metrics table for telemetry aggregation
-- Ensure turns table exists (created in core schema migrations)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'turns') THEN
    RAISE EXCEPTION 'turns table does not exist. Please run core schema migrations first.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS turn_metrics (
  turn_id bigint PRIMARY KEY REFERENCES turns(id) ON DELETE CASCADE,
  story_id uuid NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tokens_before INTEGER NOT NULL,
  tokens_after INTEGER NOT NULL,
  trims_count INTEGER NOT NULL DEFAULT 0,
  top_trim_keys TEXT[] DEFAULT '{}',
  model_ms INTEGER NULL,
  rejects JSONB DEFAULT '{}',
  cost_estimate_cents INTEGER NULL
);

-- Index for efficient queries by story and time
CREATE INDEX IF NOT EXISTS idx_turn_metrics_story_created 
  ON turn_metrics(story_id, created_at DESC);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_turn_metrics_created 
  ON turn_metrics(created_at DESC);

COMMENT ON TABLE turn_metrics IS 'Aggregated metrics for turn processing, used for telemetry dashboard';
COMMENT ON COLUMN turn_metrics.turn_id IS 'Foreign key to turns table';
COMMENT ON COLUMN turn_metrics.story_id IS 'Foreign key to stories/games table';
COMMENT ON COLUMN turn_metrics.tokens_before IS 'Token count before budget application';
COMMENT ON COLUMN turn_metrics.tokens_after IS 'Token count after budget application';
COMMENT ON COLUMN turn_metrics.trims_count IS 'Number of sections trimmed';
COMMENT ON COLUMN turn_metrics.top_trim_keys IS 'Top 3 section keys that were trimmed (by tokens removed)';
COMMENT ON COLUMN turn_metrics.model_ms IS 'End-to-end model latency in milliseconds';
COMMENT ON COLUMN turn_metrics.rejects IS 'JSON object with rejection reasons and counts, e.g., {"schema_invalid": 2, "module_not_attached": 1}';
COMMENT ON COLUMN turn_metrics.cost_estimate_cents IS 'Estimated cost in cents based on tokens and model pricing';

