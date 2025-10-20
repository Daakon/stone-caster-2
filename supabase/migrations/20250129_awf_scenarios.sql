-- AWF Scenarios Migration
-- Creates versioned scenario documents for game startpoints

-- Create scenarios table
CREATE TABLE IF NOT EXISTS public.scenarios (
  id TEXT NOT NULL,
  version TEXT NOT NULL,
  doc JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, version)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS scenarios_id_idx ON public.scenarios (id);
CREATE INDEX IF NOT EXISTS scenarios_world_ref_idx ON public.scenarios ((doc->>'world_ref'));
CREATE INDEX IF NOT EXISTS scenarios_adventure_ref_idx ON public.scenarios ((doc->>'adventure_ref'));
CREATE INDEX IF NOT EXISTS scenarios_tags_gin ON public.scenarios USING GIN ((doc->'scenario'->'tags'));

-- Add RLS policies
ALTER TABLE public.scenarios ENABLE ROW LEVEL SECURITY;

-- Policy: Admin can view all scenarios
CREATE POLICY "awf_scenarios_admin_select" ON public.scenarios
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up 
      WHERE up.auth_user_id = auth.uid() 
      AND up.role IN ('admin')
    )
  );

-- Policy: Admin can manage all scenarios
CREATE POLICY "awf_scenarios_admin_write" ON public.scenarios
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up 
      WHERE up.auth_user_id = auth.uid() 
      AND up.role IN ('admin')
    )
  );

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_scenarios_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_scenarios_updated_at
  BEFORE UPDATE ON public.scenarios
  FOR EACH ROW
  EXECUTE FUNCTION update_scenarios_updated_at();

-- Add comments
COMMENT ON TABLE public.scenarios IS 'Versioned scenario documents for AWF bundle system';
COMMENT ON COLUMN public.scenarios.id IS 'Scenario identifier';
COMMENT ON COLUMN public.scenarios.version IS 'Version of the scenario document';
COMMENT ON COLUMN public.scenarios.doc IS 'Scenario document content (JSONB)';
