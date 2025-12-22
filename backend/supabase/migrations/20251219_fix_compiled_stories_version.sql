-- 20251219_fix_compiled_stories_version.sql
-- Description: Switch to sequential versioning partitioned by World

-- 1. Add world_id column (Safely)
ALTER TABLE chimera_compiled_stories 
ADD COLUMN IF NOT EXISTS world_id UUID REFERENCES chimera_worlds(id);

-- 2. Backfill world_id (assuming story_id links to chimera_stories)
UPDATE chimera_compiled_stories cs
SET world_id = s.world_id
FROM chimera_stories s
WHERE cs.story_id = s.id
AND (cs.world_id IS NULL);

-- 3. Renumber versions (Sequential 1, 2, 3... per World)
-- Using 'created_at' as confirmed by local migrations (20251216_compiler_foundation.sql)
WITH sequenced AS (
    SELECT id, 
           ROW_NUMBER() OVER (PARTITION BY world_id ORDER BY created_at ASC) as new_ver
    FROM chimera_compiled_stories
    WHERE world_id IS NOT NULL
)
UPDATE chimera_compiled_stories
SET version = s.new_ver
FROM sequenced s
WHERE chimera_compiled_stories.id = s.id;

-- 4. Alter column type to INTEGER (explicitly)
ALTER TABLE chimera_compiled_stories
ALTER COLUMN version TYPE INTEGER USING version::integer;

-- 5. Add UNIQUE Index (Enforces sequential integrity per world)
DROP INDEX IF EXISTS idx_compiled_stories_world_version;
CREATE UNIQUE INDEX idx_compiled_stories_world_version 
ON chimera_compiled_stories(world_id, version);
