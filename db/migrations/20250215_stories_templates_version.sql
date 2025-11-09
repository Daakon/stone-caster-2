-- Add templates_version column to stories/games table
-- For story-level template version pinning

-- Check if games table exists and add column
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS templates_version integer NULL;

-- Add index for filtering
CREATE INDEX IF NOT EXISTS idx_games_templates_version ON games(templates_version);

-- Add comment
COMMENT ON COLUMN games.templates_version IS 'Pinned template version for this game/story. NULL means use latest published.';

