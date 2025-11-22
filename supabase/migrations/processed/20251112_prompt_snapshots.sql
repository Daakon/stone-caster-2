-- Phase 5: Prompt Snapshots on Publish
-- Creates prompt_snapshots table to freeze prompt configuration at publish time

BEGIN;

-- Create prompt_snapshots table
CREATE TABLE IF NOT EXISTS public.prompt_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('world', 'story')),
  entity_id text NOT NULL,
  -- For stories: entry_points.id (text)
  -- For worlds: worlds.id (text)
  version int NOT NULL,
  -- Monotonic per (entity_type, entity_id)
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  source_publish_request_id uuid NULL,
  -- References publishing_audit.id if available
  data jsonb NOT NULL,
  -- Contains resolved prompt layers and media references
  CONSTRAINT prompt_snapshots_entity_version_unique UNIQUE (entity_type, entity_id, version)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_prompt_snapshots_entity_created 
  ON public.prompt_snapshots(entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_prompt_snapshots_entity_version 
  ON public.prompt_snapshots(entity_type, entity_id, version DESC);

-- RLS policies
ALTER TABLE public.prompt_snapshots ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admin full access to prompt_snapshots"
  ON public.prompt_snapshots
  FOR ALL
  USING (public.is_admin());

-- Owner read access (optional - for their own entities)
-- Note: This requires joining with worlds/entry_points to check ownership
-- For MVP, we'll keep it admin-only; games/runtime read through backend services
-- CREATE POLICY "Owner read access to prompt_snapshots"
--   ON public.prompt_snapshots
--   FOR SELECT
--   USING (
--     (entity_type = 'world' AND EXISTS (
--       SELECT 1 FROM public.worlds WHERE id = prompt_snapshots.entity_id AND owner_user_id = auth.uid()
--     ))
--     OR
--     (entity_type = 'story' AND EXISTS (
--       SELECT 1 FROM public.entry_points WHERE id = prompt_snapshots.entity_id AND owner_user_id = auth.uid()
--     ))
--   );

COMMENT ON TABLE public.prompt_snapshots IS 'Frozen prompt configurations captured at publish time. Games reference these snapshots to ensure stability even if source entities change.';
COMMENT ON COLUMN public.prompt_snapshots.data IS 'JSONB containing resolved prompt layers (core, ruleset, world, story) and media references (coverMediaId, galleryMediaIds)';
COMMENT ON COLUMN public.prompt_snapshots.source_publish_request_id IS 'References publishing_audit.id for correlation with publish events';

COMMIT;


