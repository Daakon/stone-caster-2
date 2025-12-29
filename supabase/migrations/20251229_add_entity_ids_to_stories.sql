-- Add entity_ids column to chimera_stories
-- Purpose: Hybrid Schema alignment for entities, moving them from JSONB to SQL array for better queryability and consistency with compiled_stories.

-- 1. Add the column
ALTER TABLE chimera_stories
ADD COLUMN IF NOT EXISTS entity_ids UUID[] DEFAULT '{}';

-- 2. Create Index (GIN for array operations)
CREATE INDEX IF NOT EXISTS idx_chimera_stories_entity_ids ON chimera_stories USING GIN(entity_ids);

-- 3. Backfill data from configuration->'entityIds'
-- We use COALESCE to safely handle cases where configuration is null or entityIds is missing.
-- We cast to UUID[] to ensure type safety.
UPDATE chimera_stories
SET entity_ids = ARRAY(
    SELECT jsonb_array_elements_text(
        CASE 
            WHEN configuration->'entityIds' IS NOT NULL AND jsonb_typeof(configuration->'entityIds') = 'array'
            THEN configuration->'entityIds'
            WHEN configuration->'entity_ids' IS NOT NULL AND jsonb_typeof(configuration->'entity_ids') = 'array'
            THEN configuration->'entity_ids'
            ELSE '[]'::jsonb
        END
    )::uuid
);

-- 4. Comment
COMMENT ON COLUMN chimera_stories.entity_ids IS 'Array of Entity IDs referenced by this story draft. Used for compilation and asset management.';
