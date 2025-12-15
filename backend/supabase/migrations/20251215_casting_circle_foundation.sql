ALTER TABLE chimera_stories 
ADD COLUMN IF NOT EXISTS world_id UUID REFERENCES chimera_worlds(id),
ADD COLUMN IF NOT EXISTS protagonist_id UUID REFERENCES chimera_entities(id),
ADD COLUMN IF NOT EXISTS cast_ids UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS active_ruleset_ids JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft', -- 'draft' | 'compiled'
ADD COLUMN IF NOT EXISTS title TEXT DEFAULT 'Untitled Story';
