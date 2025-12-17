-- Add opening_text column to chimera_stories
ALTER TABLE chimera_stories
ADD COLUMN IF NOT EXISTS opening_text TEXT DEFAULT NULL;

-- Ensure description_short exists (it should, but just in case)
ALTER TABLE chimera_stories
ADD COLUMN IF NOT EXISTS description_short TEXT DEFAULT NULL;

-- Ensure active_ruleset_ids exists (it should, but strictly enforcing schema)
ALTER TABLE chimera_stories
ADD COLUMN IF NOT EXISTS active_ruleset_ids JSONB DEFAULT '[]'::jsonb;
