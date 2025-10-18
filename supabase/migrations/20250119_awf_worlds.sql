-- AWF Bundle Migration Phase 1: Worlds Table
-- Creates versioned content table for worlds

-- Create worlds table
CREATE TABLE IF NOT EXISTS worlds (
  id TEXT NOT NULL,
  version TEXT NOT NULL,
  doc JSONB NOT NULL,
  hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, version)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_worlds_created_at ON worlds(created_at);
CREATE INDEX IF NOT EXISTS idx_worlds_id ON worlds(id);

-- Add RLS policies
ALTER TABLE worlds ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view worlds
CREATE POLICY "Anyone can view worlds" ON worlds
  FOR SELECT USING (TRUE);

-- Policy: Service role can manage all worlds
CREATE POLICY "Service role can manage all worlds" ON worlds
  FOR ALL TO service_role USING (TRUE);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_worlds_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_worlds_updated_at
  BEFORE UPDATE ON worlds
  FOR EACH ROW
  EXECUTE FUNCTION update_worlds_updated_at();

-- Add comments
COMMENT ON TABLE worlds IS 'Versioned world documents for AWF bundle system';
COMMENT ON COLUMN worlds.id IS 'World identifier';
COMMENT ON COLUMN worlds.version IS 'Version of the world document';
COMMENT ON COLUMN worlds.doc IS 'World document content (JSONB)';
COMMENT ON COLUMN worlds.hash IS 'Content hash for integrity verification';


