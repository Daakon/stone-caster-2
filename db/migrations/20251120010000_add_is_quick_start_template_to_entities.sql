-- Add is_quick_start_template column to chimera_entity_templates
-- Phase 4: Premade Characters - Filtering flag for Quick Start templates
-- This flag distinguishes which system assets should appear in the Quick Start section

BEGIN;

-- Add is_quick_start_template column
ALTER TABLE public.chimera_entity_templates
  ADD COLUMN IF NOT EXISTS is_quick_start_template boolean NOT NULL DEFAULT false;

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_chimera_entity_templates_is_quick_start_template 
  ON public.chimera_entity_templates(is_quick_start_template);

-- Add comment
COMMENT ON COLUMN public.chimera_entity_templates.is_quick_start_template IS 
  'If true, this system asset is a playable quick start template that appears in the Quick Start section. Only applies to system assets (is_system_asset = true).';

COMMIT;

