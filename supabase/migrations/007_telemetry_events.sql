-- Telemetry Events table for observability and monitoring
-- Stores structured telemetry events with user context and sampling

CREATE TABLE IF NOT EXISTS telemetry_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  cookie_id UUID NULL,
  trace_id UUID NOT NULL,
  name TEXT NOT NULL,
  props JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_telemetry_events_trace_id ON telemetry_events(trace_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_user_id ON telemetry_events(user_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_cookie_id ON telemetry_events(cookie_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_name ON telemetry_events(name);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_created_at ON telemetry_events(created_at);

-- RLS Policies
ALTER TABLE telemetry_events ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (for server-side operations)
CREATE POLICY "Service role can manage telemetry events" ON telemetry_events
  FOR ALL
  TO service_role
  USING (TRUE);

-- Authenticated users can only read their own telemetry events
CREATE POLICY "Users can read their own telemetry events" ON telemetry_events
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Function to clean up old telemetry events (for maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_telemetry_events(retention_days INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM telemetry_events 
  WHERE created_at < NOW() - INTERVAL '1 day' * retention_days;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
