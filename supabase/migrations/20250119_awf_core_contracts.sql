-- AWF Bundle Migration Phase 1: Core Contracts Table
-- Creates versioned content table for core contracts

-- Create core_contracts table
CREATE TABLE IF NOT EXISTS core_contracts (
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
CREATE INDEX IF NOT EXISTS idx_core_contracts_active ON core_contracts(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_core_contracts_created_at ON core_contracts(created_at);

-- Add RLS policies
ALTER TABLE core_contracts ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view active core contracts
CREATE POLICY "Anyone can view active core contracts" ON core_contracts
  FOR SELECT USING (active = true);

-- Policy: Service role can manage all core contracts
CREATE POLICY "Service role can manage all core contracts" ON core_contracts
  FOR ALL TO service_role USING (TRUE);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_core_contracts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_core_contracts_updated_at
  BEFORE UPDATE ON core_contracts
  FOR EACH ROW
  EXECUTE FUNCTION update_core_contracts_updated_at();

-- Add comments
COMMENT ON TABLE core_contracts IS 'Versioned core contract documents for AWF bundle system';
COMMENT ON COLUMN core_contracts.id IS 'Core contract identifier';
COMMENT ON COLUMN core_contracts.version IS 'Version of the core contract';
COMMENT ON COLUMN core_contracts.doc IS 'Core contract document content (JSONB)';
COMMENT ON COLUMN core_contracts.hash IS 'Content hash for integrity verification';
COMMENT ON COLUMN core_contracts.active IS 'Whether this version is currently active';


