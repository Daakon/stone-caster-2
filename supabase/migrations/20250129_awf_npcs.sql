-- AWF NPC Registry Migration
-- Creates versioned NPC documents for reusable character pool

-- Create npcs table
CREATE TABLE IF NOT EXISTS public.npcs (
  id TEXT NOT NULL,
  version TEXT NOT NULL,
  doc JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, version)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS npcs_id_idx ON public.npcs (id);
CREATE INDEX IF NOT EXISTS npcs_tags_gin ON public.npcs USING GIN ((doc->'npc'->'tags'));

-- Add RLS policies
ALTER TABLE public.npcs ENABLE ROW LEVEL SECURITY;

-- Policy: Admin can view all NPCs
CREATE POLICY "awf_npcs_admin_select" ON public.npcs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up 
      WHERE up.auth_user_id = auth.uid() 
      AND up.role IN ('admin')
    )
  );

-- Policy: Admin can manage all NPCs
CREATE POLICY "awf_npcs_admin_write" ON public.npcs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up 
      WHERE up.auth_user_id = auth.uid() 
      AND up.role IN ('admin')
    )
  );

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_npcs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_npcs_updated_at
  BEFORE UPDATE ON public.npcs
  FOR EACH ROW
  EXECUTE FUNCTION update_npcs_updated_at();

-- Add comments
COMMENT ON TABLE public.npcs IS 'Versioned NPC documents for AWF bundle system';
COMMENT ON COLUMN public.npcs.id IS 'NPC identifier';
COMMENT ON COLUMN public.npcs.version IS 'Version of the NPC document';
COMMENT ON COLUMN public.npcs.doc IS 'NPC document content (JSONB)';
