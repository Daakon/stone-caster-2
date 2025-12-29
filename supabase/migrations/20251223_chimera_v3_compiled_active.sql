ALTER TABLE chimera_compiled_stories ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_compiled_stories_active ON chimera_compiled_stories(story_id, is_active);
