-- AWF Bundle Migration Phase 1: Adventure Starts Table
-- Creates table for adventure start documents

-- Create adventure_starts table
CREATE TABLE IF NOT EXISTS adventure_starts (
  adventure_ref TEXT PRIMARY KEY,
  doc JSONB NOT NULL,
  use_once BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_adventure_starts_created_at ON adventure_starts(created_at);

-- Add RLS policies
ALTER TABLE adventure_starts ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view adventure starts
CREATE POLICY "Anyone can view adventure starts" ON adventure_starts
  FOR SELECT USING (TRUE);

-- Policy: Service role can manage all adventure starts
CREATE POLICY "Service role can manage all adventure starts" ON adventure_starts
  FOR ALL TO service_role USING (TRUE);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_adventure_starts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_adventure_starts_updated_at
  BEFORE UPDATE ON adventure_starts
  FOR EACH ROW
  EXECUTE FUNCTION update_adventure_starts_updated_at();

-- Add comments
COMMENT ON TABLE adventure_starts IS 'Adventure start documents for AWF bundle system';
COMMENT ON COLUMN adventure_starts.adventure_ref IS 'Reference to the adventure this start belongs to';
COMMENT ON COLUMN adventure_starts.doc IS 'Adventure start document content (JSONB)';
COMMENT ON COLUMN adventure_starts.use_once IS 'Whether this start can only be used once';


