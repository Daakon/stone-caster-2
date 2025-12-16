-- ============================================================================
-- Add world_id to chimera_entities
-- Purpose: Support strict schema alignment by querying entities by world_id
-- Date: 2025-12-11
-- ============================================================================

DO $$
BEGIN
    -- Add world_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chimera_entities' AND column_name = 'world_id') THEN
        ALTER TABLE chimera_entities ADD COLUMN world_id UUID REFERENCES chimera_worlds(id);
        
        -- Create index for performance
        CREATE INDEX idx_chimera_entities_world_id ON chimera_entities(world_id);
        
        -- Comment
        COMMENT ON COLUMN chimera_entities.world_id IS 'Foreign key to chimera_worlds. Previously stored only in JSONB.';
    END IF;
END $$;
