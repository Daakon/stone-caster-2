-- AWF Bundle Migration Phase 1: Adventures Table
-- Creates versioned content table for adventures

-- Create adventures table
CREATE TABLE IF NOT EXISTS adventures (
  id TEXT NOT NULL,
  world_ref TEXT NOT NULL,
  version TEXT NOT NULL,
  doc JSONB NOT NULL,
  hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, version)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_adventures_world_ref ON adventures(world_ref);
CREATE INDEX IF NOT EXISTS idx_adventures_created_at ON adventures(created_at);
CREATE INDEX IF NOT EXISTS idx_adventures_id ON adventures(id);

-- Add RLS policies
ALTER TABLE adventures ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view adventures
CREATE POLICY "Anyone can view adventures" ON adventures
  FOR SELECT USING (TRUE);

-- Policy: Service role can manage all adventures
CREATE POLICY "Service role can manage all adventures" ON adventures
  FOR ALL TO service_role USING (TRUE);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_adventures_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_adventures_updated_at
  BEFORE UPDATE ON adventures
  FOR EACH ROW
  EXECUTE FUNCTION update_adventures_updated_at();

-- Add comments
COMMENT ON TABLE adventures IS 'Versioned adventure documents for AWF bundle system';
COMMENT ON COLUMN adventures.id IS 'Adventure identifier';
COMMENT ON COLUMN adventures.world_ref IS 'Reference to the world this adventure belongs to';
COMMENT ON COLUMN adventures.version IS 'Version of the adventure document';
COMMENT ON COLUMN adventures.doc IS 'Adventure document content (JSONB)';
COMMENT ON COLUMN adventures.hash IS 'Content hash for integrity verification';


