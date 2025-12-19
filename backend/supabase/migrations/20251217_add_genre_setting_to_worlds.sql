-- Add genre and setting columns to chimera_worlds
ALTER TABLE chimera_worlds 
ADD COLUMN IF NOT EXISTS genre text,
ADD COLUMN IF NOT EXISTS setting text;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_chimera_worlds_genre ON chimera_worlds(genre);
CREATE INDEX IF NOT EXISTS idx_chimera_worlds_setting ON chimera_worlds(setting);

-- Backfill data from definition JSONB
-- Attempt to read 'genre' and 'setting' from the root of definition
-- Fallback to 'genre_tags' or 'world_metadata' structure if needed based on typical usage
UPDATE chimera_worlds
SET 
  genre = COALESCE(
    genre, 
    (definition->>'genre'),
    (definition->'world_metadata'->>'genre'),
    -- If genre is an array in some old data, take the first one or null
    CASE 
      WHEN jsonb_typeof(definition->'genre') = 'array' THEN definition->'genre'->>0 
      ELSE NULL 
    END
  ),
  setting = COALESCE(
    setting, 
    (definition->>'setting'),
    (definition->'world_metadata'->>'setting'),
    (definition->'world_metadata'->>'setting_description')
  );

-- Notify schema reload
SELECT pg_notify('pgrst', 'reload schema');
