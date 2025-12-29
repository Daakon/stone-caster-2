ALTER TABLE chimera_compiled_stories 
ADD COLUMN IF NOT EXISTS ruleset_ids UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS entity_ids UUID[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_compiled_stories_ruleset_ids ON chimera_compiled_stories USING GIN (ruleset_ids);
CREATE INDEX IF NOT EXISTS idx_compiled_stories_entity_ids ON chimera_compiled_stories USING GIN (entity_ids);
