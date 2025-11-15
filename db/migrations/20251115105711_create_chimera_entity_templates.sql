-- Create chimera_entity_templates table
-- Phase 2: Entity Template (NPC) Tools

BEGIN;

-- Create enum type for entity type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'chimera_entity_type'
  ) THEN
    CREATE TYPE public.chimera_entity_type AS ENUM ('NPC', 'ITEM', 'FACTION');
  END IF;
END
$$;

-- Create entity templates table
CREATE TABLE IF NOT EXISTS public.chimera_entity_templates (
    id text PRIMARY KEY,
    owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    visibility public.chimera_world_visibility NOT NULL DEFAULT 'private',
    display_name text NOT NULL,
    description_short text NULL,
    entity_type public.chimera_entity_type NOT NULL,
    base_state_json jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uk_chimera_entity_templates_id UNIQUE (id),
    CONSTRAINT uk_chimera_entity_templates_owner_user_id_display_name UNIQUE (owner_user_id, display_name)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_chimera_entity_templates_owner_user_id 
    ON public.chimera_entity_templates(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_chimera_entity_templates_visibility 
    ON public.chimera_entity_templates(visibility);
CREATE INDEX IF NOT EXISTS idx_chimera_entity_templates_entity_type 
    ON public.chimera_entity_templates(entity_type);

-- Add comments
COMMENT ON TABLE public.chimera_entity_templates IS 
    'Entity templates (NPCs, Items, Factions) created by users for Chimera V2 worlds';
COMMENT ON COLUMN public.chimera_entity_templates.id IS 
    'Unique identifier for the entity template';
COMMENT ON COLUMN public.chimera_entity_templates.owner_user_id IS 
    'User who created this entity template';
COMMENT ON COLUMN public.chimera_entity_templates.visibility IS 
    'Visibility level: private (owner only), pending_approval (awaiting review), public (visible to all)';
COMMENT ON COLUMN public.chimera_entity_templates.display_name IS 
    'Display name for the entity';
COMMENT ON COLUMN public.chimera_entity_templates.description_short IS 
    'Short description of the entity';
COMMENT ON COLUMN public.chimera_entity_templates.entity_type IS 
    'Type of entity: NPC, ITEM, or FACTION';
COMMENT ON COLUMN public.chimera_entity_templates.base_state_json IS 
    'JSON object containing the base state of the entity (stats, properties, etc.)';

COMMIT;

