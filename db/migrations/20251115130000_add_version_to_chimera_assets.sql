-- Add version column to all Chimera assets
-- Phase 2: Content Pack system - versioning support

BEGIN;

-- Add version to chimera_worlds
ALTER TABLE public.chimera_worlds
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

-- Add version to chimera_entity_templates
ALTER TABLE public.chimera_entity_templates
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

-- Create chimera_lore_templates table (future table) with version
CREATE TABLE IF NOT EXISTS public.chimera_lore_templates (
    id text PRIMARY KEY,
    owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    visibility public.chimera_world_visibility NOT NULL DEFAULT 'private',
    display_name text NOT NULL,
    description_short text NULL,
    lore_content jsonb NOT NULL DEFAULT '{}',
    version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uk_chimera_lore_templates_id UNIQUE (id),
    CONSTRAINT uk_chimera_lore_templates_owner_user_id_display_name UNIQUE (owner_user_id, display_name)
);

-- Create indexes for chimera_lore_templates
CREATE INDEX IF NOT EXISTS idx_chimera_lore_templates_owner_user_id 
    ON public.chimera_lore_templates(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_chimera_lore_templates_visibility 
    ON public.chimera_lore_templates(visibility);

-- Add comments
COMMENT ON TABLE public.chimera_lore_templates IS 
    'Lore templates (background information, world-building content) for Chimera V2';
COMMENT ON COLUMN public.chimera_lore_templates.version IS 
    'Version number for this lore template. Incremented on updates.';
COMMENT ON COLUMN public.chimera_worlds.version IS 
    'Version number for this world. Incremented on updates.';
COMMENT ON COLUMN public.chimera_entity_templates.version IS 
    'Version number for this entity template. Incremented on updates.';

COMMIT;

