-- ============================================================================
-- Golden Schema Fix: Data Integrity & Asset Management
-- Date: 2025-12-11
-- Description:
-- 1. Creates 'chimera_assets' as the central registry for all uploaded assets.
-- 2. Updates 'chimera_entities' to align with canonical schema (key -> slug, add world_id).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Create `chimera_assets` table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chimera_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES auth.users(id), -- Null means System/Official Asset
    url TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'image',
    category TEXT, -- e.g., 'cover', 'portrait', 'token'
    meta JSONB DEFAULT '{}'::jsonb, -- Stores fileSize, mimeType, dimensions, etc.
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create Indexes for performance
CREATE INDEX IF NOT EXISTS idx_chimera_assets_owner_id ON chimera_assets(owner_id);
CREATE INDEX IF NOT EXISTS idx_chimera_assets_url ON chimera_assets(url);

-- Comments
COMMENT ON TABLE chimera_assets IS 'Central registry for all user and system uploaded assets.';
COMMENT ON COLUMN chimera_assets.owner_id IS 'Owner of the asset. NULL implies a System or Official asset.';

-- ----------------------------------------------------------------------------
-- 2. Modify `chimera_entities` table
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    -- Rename 'key' to 'slug' safely
    -- Check if 'key' exists and 'slug' does NOT exist
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chimera_entities' AND column_name = 'key'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chimera_entities' AND column_name = 'slug'
    ) THEN
        ALTER TABLE chimera_entities RENAME COLUMN key TO slug;
    END IF;

    -- Add 'world_id' if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chimera_entities' AND column_name = 'world_id'
    ) THEN
        ALTER TABLE chimera_entities ADD COLUMN world_id UUID REFERENCES chimera_worlds(id);
    END IF;

    -- Add 'icon_image_url' if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chimera_entities' AND column_name = 'icon_image_url'
    ) THEN
        ALTER TABLE chimera_entities ADD COLUMN icon_image_url TEXT;
    END IF;

    -- Verify 'raw_data' exists (just a check, alter if missing would be severe, assume creation script handled it)
    -- But let's ensure it exists to be safe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chimera_entities' AND column_name = 'raw_data'
    ) THEN
         ALTER TABLE chimera_entities ADD COLUMN raw_data JSONB DEFAULT '{}'::jsonb;
    END IF;

    -- Verify 'primary_image_url' exists (often mapped from 'image' or similar)
    -- If the requested schema implies it should exist, we add it. 
    -- (Note: Implementation plan mentioned "Verify: Ensure primary_image_url exists")
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chimera_entities' AND column_name = 'primary_image_url'
    ) THEN
        ALTER TABLE chimera_entities ADD COLUMN primary_image_url TEXT;
    END IF;

END $$;

-- Add index for world_id if it was just added or existed without one (IF NOT EXISTS handles it)
CREATE INDEX IF NOT EXISTS idx_chimera_entities_world_id ON chimera_entities(world_id);

-- Update Comments
COMMENT ON COLUMN chimera_entities.slug IS 'Unique identifier string for the entity within a scope (renamed from key).';
COMMENT ON COLUMN chimera_entities.world_id IS 'Foreign key to the world this entity belongs to.';
