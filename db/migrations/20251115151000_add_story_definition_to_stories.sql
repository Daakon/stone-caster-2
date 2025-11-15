-- Add story_definition JSONB column to chimera_stories
-- Phase 3: Story Editor - JSON definition storage

BEGIN;

-- Add story_definition column to chimera_stories
ALTER TABLE public.chimera_stories
  ADD COLUMN IF NOT EXISTS story_definition jsonb NULL DEFAULT '{}';

-- Add index for story_definition queries (GIN index for JSONB)
CREATE INDEX IF NOT EXISTS idx_chimera_stories_story_definition 
    ON public.chimera_stories USING GIN(story_definition);

-- Add comment
COMMENT ON COLUMN public.chimera_stories.story_definition IS 
    'JSON object containing the story definition (narrative structure, scenes, choices, etc.). Edited in the Story Editor tab.';

COMMIT;

