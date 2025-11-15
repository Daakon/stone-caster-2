-- Create chimera_stories tables
-- Phase 2: Story Creation Tools

BEGIN;

-- Create stories table
CREATE TABLE IF NOT EXISTS public.chimera_stories (
    id text PRIMARY KEY,
    owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    visibility public.chimera_world_visibility NOT NULL DEFAULT 'private',
    display_name text NOT NULL,
    description_short text NULL,
    world_id text NULL REFERENCES public.chimera_worlds(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uk_chimera_stories_id UNIQUE (id),
    CONSTRAINT uk_chimera_stories_owner_user_id_display_name UNIQUE (owner_user_id, display_name)
);

-- Create story-ruleset links table
CREATE TABLE IF NOT EXISTS public.chimera_story_links (
    story_id text NOT NULL REFERENCES public.chimera_stories(id) ON DELETE CASCADE,
    ruleset_template_id text NOT NULL REFERENCES public.chimera_ruleset_templates(id) ON DELETE CASCADE,
    PRIMARY KEY (story_id, ruleset_template_id)
);

-- Create story-entity links table
CREATE TABLE IF NOT EXISTS public.chimera_story_entity_links (
    story_id text NOT NULL REFERENCES public.chimera_stories(id) ON DELETE CASCADE,
    entity_template_id text NOT NULL REFERENCES public.chimera_entity_templates(id) ON DELETE CASCADE,
    PRIMARY KEY (story_id, entity_template_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_chimera_stories_owner_user_id 
    ON public.chimera_stories(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_chimera_stories_visibility 
    ON public.chimera_stories(visibility);
CREATE INDEX IF NOT EXISTS idx_chimera_stories_world_id 
    ON public.chimera_stories(world_id);
CREATE INDEX IF NOT EXISTS idx_chimera_story_links_story_id 
    ON public.chimera_story_links(story_id);
CREATE INDEX IF NOT EXISTS idx_chimera_story_links_ruleset_template_id 
    ON public.chimera_story_links(ruleset_template_id);
CREATE INDEX IF NOT EXISTS idx_chimera_story_entity_links_story_id 
    ON public.chimera_story_entity_links(story_id);
CREATE INDEX IF NOT EXISTS idx_chimera_story_entity_links_entity_template_id 
    ON public.chimera_story_entity_links(entity_template_id);

-- Add comments
COMMENT ON TABLE public.chimera_stories IS 
    'Stories created by users for Chimera V2 engine';
COMMENT ON COLUMN public.chimera_stories.id IS 
    'Unique identifier for the story';
COMMENT ON COLUMN public.chimera_stories.owner_user_id IS 
    'User who created this story';
COMMENT ON COLUMN public.chimera_stories.visibility IS 
    'Visibility level: private (owner only), pending_approval (awaiting review), public (visible to all)';
COMMENT ON COLUMN public.chimera_stories.display_name IS 
    'Display name for the story';
COMMENT ON COLUMN public.chimera_stories.description_short IS 
    'Short description of the story';
COMMENT ON COLUMN public.chimera_stories.world_id IS 
    'Reference to the world this story belongs to';
COMMENT ON TABLE public.chimera_story_links IS 
    'Links stories to ruleset templates (MAIN_SYSTEM, SUBSYSTEM, MODIFIER)';
COMMENT ON TABLE public.chimera_story_entity_links IS 
    'Links stories to entity templates (NPCs, Items, Factions)';

COMMIT;

