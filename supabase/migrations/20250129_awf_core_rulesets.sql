-- AWF Core Rulesets Table
-- Creates versioned content table for core rulesets (narrative/pacing/style policies)

-- Create core_rulesets table
CREATE TABLE IF NOT EXISTS core_rulesets (
  id TEXT NOT NULL,
  version TEXT NOT NULL,
  doc JSONB NOT NULL,
  hash TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, version)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_core_rulesets_active ON core_rulesets(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_core_rulesets_created_at ON core_rulesets(created_at);

-- Add RLS policies
ALTER TABLE core_rulesets ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view active core rulesets
CREATE POLICY "Anyone can view active core rulesets" ON core_rulesets
  FOR SELECT USING (active = true);

-- Policy: Service role can manage all core rulesets
CREATE POLICY "Service role can manage all core rulesets" ON core_rulesets
  FOR ALL TO service_role USING (TRUE);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_core_rulesets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_core_rulesets_updated_at
  BEFORE UPDATE ON core_rulesets
  FOR EACH ROW
  EXECUTE FUNCTION update_core_rulesets_updated_at();

-- Add comments
COMMENT ON TABLE core_rulesets IS 'Versioned core ruleset documents for AWF bundle system';
COMMENT ON COLUMN core_rulesets.id IS 'Core ruleset identifier';
COMMENT ON COLUMN core_rulesets.version IS 'Version of the core ruleset';
COMMENT ON COLUMN core_rulesets.doc IS 'Core ruleset document content (JSONB)';
COMMENT ON COLUMN core_rulesets.hash IS 'Content hash for integrity verification';
COMMENT ON COLUMN core_rulesets.active IS 'Whether this version is currently active';
