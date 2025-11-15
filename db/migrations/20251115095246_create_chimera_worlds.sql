-- Create chimera_worlds and chimera_world_ruleset_link tables
-- Phase 2: UGC platform - World creation

BEGIN;

-- Create enum type for world visibility
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'chimera_world_visibility'
  ) THEN
    CREATE TYPE public.chimera_world_visibility AS ENUM ('private', 'pending_approval', 'public');
  END IF;
END
$$;

-- Create chimera_worlds table
CREATE TABLE IF NOT EXISTS public.chimera_worlds (
    id text PRIMARY KEY,
    owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    visibility public.chimera_world_visibility NOT NULL DEFAULT 'private',
    display_name text NOT NULL,
    description_short text NULL,
    description_long text NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uk_chimera_worlds_id UNIQUE (id)
);

-- Create chimera_world_ruleset_link junction table
CREATE TABLE IF NOT EXISTS public.chimera_world_ruleset_link (
    world_id text NOT NULL REFERENCES public.chimera_worlds(id) ON DELETE CASCADE,
    ruleset_template_id text NOT NULL REFERENCES public.chimera_ruleset_templates(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (world_id, ruleset_template_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_chimera_worlds_owner_user_id 
  ON public.chimera_worlds(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_chimera_worlds_visibility 
  ON public.chimera_worlds(visibility);
CREATE INDEX IF NOT EXISTS idx_chimera_world_ruleset_link_world_id 
  ON public.chimera_world_ruleset_link(world_id);
CREATE INDEX IF NOT EXISTS idx_chimera_world_ruleset_link_ruleset_template_id 
  ON public.chimera_world_ruleset_link(ruleset_template_id);

-- Add comments for documentation
COMMENT ON TABLE public.chimera_worlds IS 
  'User-created worlds for the Chimera V2 engine';
COMMENT ON COLUMN public.chimera_worlds.visibility IS 
  'World visibility: private (only owner), pending_approval (submitted for review), public (published)';
COMMENT ON TABLE public.chimera_world_ruleset_link IS 
  'Junction table linking worlds to MODIFIER ruleset templates';

COMMIT;

