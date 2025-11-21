-- Add is_system_asset and world_id columns to chimera_entity_templates
-- Phase 4: Premade Characters (System Assets) Integration
-- This enables system-owned premade characters that can be used across stories

BEGIN;

-- Add is_system_asset column
ALTER TABLE public.chimera_entity_templates
  ADD COLUMN IF NOT EXISTS is_system_asset boolean NOT NULL DEFAULT false;

-- Add world_id column (nullable - can be null for global system assets)
ALTER TABLE public.chimera_entity_templates
  ADD COLUMN IF NOT EXISTS world_id text NULL REFERENCES public.chimera_worlds(id) ON DELETE SET NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_chimera_entity_templates_is_system_asset 
  ON public.chimera_entity_templates(is_system_asset);
CREATE INDEX IF NOT EXISTS idx_chimera_entity_templates_world_id 
  ON public.chimera_entity_templates(world_id);

-- Add comments
COMMENT ON COLUMN public.chimera_entity_templates.is_system_asset IS 
  'If true, this entity is a system asset (premade character) that can be used by all users';
COMMENT ON COLUMN public.chimera_entity_templates.world_id IS 
  'World this entity belongs to. NULL for global system assets, or specific world_id for world-specific premades';

COMMIT;


