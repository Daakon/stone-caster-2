-- Add world_data column to characters table for Layer P1
-- This column stores world-specific character data as JSONB

-- Add world_data column to characters table
ALTER TABLE characters ADD COLUMN IF NOT EXISTS world_data JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Add avatar and backstory columns for frontend compatibility
ALTER TABLE characters ADD COLUMN IF NOT EXISTS avatar VARCHAR(100);
ALTER TABLE characters ADD COLUMN IF NOT EXISTS backstory TEXT;

-- Create index for world_data queries (if needed for performance)
CREATE INDEX IF NOT EXISTS idx_characters_world_data ON characters USING GIN (world_data);

-- Add comments for documentation
COMMENT ON COLUMN characters.world_data IS 'World-specific character data stored as JSONB';
COMMENT ON COLUMN characters.avatar IS 'Character avatar identifier for frontend display';
COMMENT ON COLUMN characters.backstory IS 'Character backstory text for frontend display';
