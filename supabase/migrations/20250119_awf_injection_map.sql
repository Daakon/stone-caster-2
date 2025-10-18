-- AWF Bundle Migration Phase 1: Injection Map Table
-- Creates table for bundle assembly and act application

-- Create injection_map table
CREATE TABLE IF NOT EXISTS injection_map (
  id TEXT PRIMARY KEY DEFAULT 'default',
  doc JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_injection_map_created_at ON injection_map(created_at);

-- Add RLS policies
ALTER TABLE injection_map ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view injection map
CREATE POLICY "Anyone can view injection map" ON injection_map
  FOR SELECT USING (TRUE);

-- Policy: Service role can manage all injection maps
CREATE POLICY "Service role can manage all injection maps" ON injection_map
  FOR ALL TO service_role USING (TRUE);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_injection_map_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_injection_map_updated_at
  BEFORE UPDATE ON injection_map
  FOR EACH ROW
  EXECUTE FUNCTION update_injection_map_updated_at();

-- Add comments
COMMENT ON TABLE injection_map IS 'Injection map for AWF bundle assembly and act application';
COMMENT ON COLUMN injection_map.id IS 'Injection map identifier (default: "default")';
COMMENT ON COLUMN injection_map.doc IS 'Injection map document content (JSONB)';


