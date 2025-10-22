-- Phase 1: Core vs Rulesets Framework Split - Create core_rulesets table
-- Migration: 20250129_awf_core_rulesets_table.sql
-- Create core_rulesets table for narrative/pacing/style policies

-- Create core_rulesets table
CREATE TABLE IF NOT EXISTS core_rulesets (
  id TEXT NOT NULL,
  version TEXT NOT NULL,
  doc JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, version)
);

-- Create index for core_rulesets
CREATE INDEX IF NOT EXISTS core_rulesets_id_idx ON core_rulesets (id);

-- Add RLS policies for core_rulesets (admin-only)
ALTER TABLE core_rulesets ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "awf_core_rulesets_admin_select" ON core_rulesets;
DROP POLICY IF EXISTS "awf_core_rulesets_admin_write" ON core_rulesets;

-- Create core_rulesets policies (admin-only)
CREATE POLICY "awf_core_rulesets_admin_select" ON core_rulesets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles up 
      WHERE up.user_id = auth.uid() 
      AND up.role IN ('admin')
    )
  );

CREATE POLICY "awf_core_rulesets_admin_write" ON core_rulesets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles up 
      WHERE up.user_id = auth.uid() 
      AND up.role IN ('admin')
    )
  );

-- Add trigger for updated_at timestamp
CREATE OR REPLACE FUNCTION update_core_rulesets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists (idempotent)
DROP TRIGGER IF EXISTS trigger_update_core_rulesets_updated_at ON core_rulesets;

-- Create trigger
CREATE TRIGGER trigger_update_core_rulesets_updated_at
  BEFORE UPDATE ON core_rulesets
  FOR EACH ROW
  EXECUTE FUNCTION update_core_rulesets_updated_at();

-- Add comments
COMMENT ON TABLE core_rulesets IS 'AWF Core Rulesets - narrative/pacing/style policies (separated from core contracts)';
COMMENT ON COLUMN core_rulesets.id IS 'Ruleset identifier (e.g., ruleset.core.default)';
COMMENT ON COLUMN core_rulesets.version IS 'Semantic version (e.g., 1.0.0)';
COMMENT ON COLUMN core_rulesets.doc IS 'Ruleset document JSON';






