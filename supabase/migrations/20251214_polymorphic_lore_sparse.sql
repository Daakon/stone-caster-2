-- Add Sparse Columns for Context
ALTER TABLE chimera_lore 
ADD COLUMN entity_id UUID REFERENCES chimera_entities(id) ON DELETE CASCADE,
ADD COLUMN story_id UUID REFERENCES chimera_stories(id) ON DELETE CASCADE;

-- Indexes for fast RAG filtering
CREATE INDEX idx_lore_entity ON chimera_lore(entity_id);
CREATE INDEX idx_lore_story ON chimera_lore(story_id);

-- Add comments for clarity
COMMENT ON COLUMN chimera_lore.entity_id IS 'If set, this lore belongs to a specific entity context.';
COMMENT ON COLUMN chimera_lore.story_id IS 'If set, this lore belongs to a specific story context.';
