-- Update chimera_stories table for Phase 3
-- Add is_system_asset and version columns, create content pack links table

BEGIN;

-- Add is_system_asset column to chimera_stories
ALTER TABLE public.chimera_stories
  ADD COLUMN IF NOT EXISTS is_system_asset boolean NOT NULL DEFAULT false;

-- Add version column to chimera_stories
ALTER TABLE public.chimera_stories
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

-- Create story-content pack links table
CREATE TABLE IF NOT EXISTS public.chimera_story_content_pack_links (
    story_id text NOT NULL REFERENCES public.chimera_stories(id) ON DELETE CASCADE,
    pack_id text NOT NULL REFERENCES public.chimera_content_packs(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (story_id, pack_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_chimera_story_content_pack_links_story_id 
    ON public.chimera_story_content_pack_links(story_id);
CREATE INDEX IF NOT EXISTS idx_chimera_story_content_pack_links_pack_id 
    ON public.chimera_story_content_pack_links(pack_id);

-- Add comments
COMMENT ON COLUMN public.chimera_stories.is_system_asset IS 
    'If true, this is a system-provided story (not user-generated)';
COMMENT ON COLUMN public.chimera_stories.version IS 
    'Version number for this story. Incremented on updates.';
COMMENT ON TABLE public.chimera_story_content_pack_links IS 
    'Links stories to content packs. Content packs provide additional rulesets, entities, and lore.';

COMMIT;

