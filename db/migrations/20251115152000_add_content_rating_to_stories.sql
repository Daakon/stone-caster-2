-- Add content_rating column to chimera_stories
-- Phase 3: Story Wizard - Content rating selection

BEGIN;

-- Add content_rating column to chimera_stories
ALTER TABLE public.chimera_stories
  ADD COLUMN IF NOT EXISTS content_rating text NOT NULL DEFAULT 'safe' 
    CHECK (content_rating IN ('safe', 'mature', 'explicit'));

-- Add comment
COMMENT ON COLUMN public.chimera_stories.content_rating IS 
    'Content rating: safe (family-friendly), mature (may contain mature themes), explicit (adult content)';

COMMIT;

