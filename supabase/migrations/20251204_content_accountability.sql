-- ============================================================================
-- Phase 4.1: Content Accountability & Official Status
-- Add audit trail columns for tracking official content and publishers
-- Date: 2025-12-04
-- ============================================================================

-- ============================================================================
-- PART 1: Add Accountability Columns to chimera_worlds
-- ============================================================================

ALTER TABLE chimera_worlds 
    ADD COLUMN IF NOT EXISTS is_official BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS published_by UUID REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_chimera_worlds_official ON chimera_worlds(is_official) WHERE is_official = true;
CREATE INDEX IF NOT EXISTS idx_chimera_worlds_published_by ON chimera_worlds(published_by);
CREATE INDEX IF NOT EXISTS idx_chimera_worlds_published_at ON chimera_worlds(published_at);

-- Add comments
COMMENT ON COLUMN chimera_worlds.is_official IS 
    'True if this is official StoneCaster content. Official content is owned by admins but visible to all.';
COMMENT ON COLUMN chimera_worlds.published_by IS 
    'User ID of the admin who published this content. NULL if never published or published by non-admin.';
COMMENT ON COLUMN chimera_worlds.published_at IS 
    'Timestamp when this content was first published (visibility changed to public).';

-- ============================================================================
-- PART 2: Add Accountability Columns to chimera_entities
-- ============================================================================

ALTER TABLE chimera_entities 
    ADD COLUMN IF NOT EXISTS is_official BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS published_by UUID REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_chimera_entities_official ON chimera_entities(is_official) WHERE is_official = true;
CREATE INDEX IF NOT EXISTS idx_chimera_entities_published_by ON chimera_entities(published_by);
CREATE INDEX IF NOT EXISTS idx_chimera_entities_published_at ON chimera_entities(published_at);

-- Add comments
COMMENT ON COLUMN chimera_entities.is_official IS 
    'True if this is official StoneCaster content. Official content is owned by admins but visible to all.';
COMMENT ON COLUMN chimera_entities.published_by IS 
    'User ID of the admin who published this content. NULL if never published or published by non-admin.';
COMMENT ON COLUMN chimera_entities.published_at IS 
    'Timestamp when this content was first published (visibility changed to public).';

-- ============================================================================
-- PART 3: Add Accountability Columns to chimera_lore
-- ============================================================================

ALTER TABLE chimera_lore 
    ADD COLUMN IF NOT EXISTS is_official BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS published_by UUID REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_chimera_lore_official ON chimera_lore(is_official) WHERE is_official = true;
CREATE INDEX IF NOT EXISTS idx_chimera_lore_published_by ON chimera_lore(published_by);
CREATE INDEX IF NOT EXISTS idx_chimera_lore_published_at ON chimera_lore(published_at);

-- Add comments
COMMENT ON COLUMN chimera_lore.is_official IS 
    'True if this is official StoneCaster content. Official content is owned by admins but visible to all.';
COMMENT ON COLUMN chimera_lore.published_by IS 
    'User ID of the admin who published this content. NULL if never published or published by non-admin.';
COMMENT ON COLUMN chimera_lore.published_at IS 
    'Timestamp when this content was first published (visibility changed to public).';

-- ============================================================================
-- PART 4: Update RLS Policies for Admin Editing of Official Content
-- ============================================================================

-- Drop existing update policies
DROP POLICY IF EXISTS "chimera_worlds_update_unified" ON chimera_worlds;
DROP POLICY IF EXISTS "chimera_entities_update_unified" ON chimera_entities;
DROP POLICY IF EXISTS "chimera_lore_update_unified" ON chimera_lore;

-- Worlds: Allow owner to update OR admin to update official content
CREATE POLICY "chimera_worlds_update_unified" ON chimera_worlds
    FOR UPDATE 
    USING (
        owner_user_id = auth.uid()  -- Owner can update
        OR (
            is_official = true 
            AND EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() 
                AND role IN ('admin', 'system')
            )
        )  -- Admin can update official content
    )
    WITH CHECK (
        owner_user_id = auth.uid() 
        OR (
            is_official = true 
            AND EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() 
                AND role IN ('admin', 'system')
            )
        )
    );

-- Entities: Allow owner to update OR admin to update official content
CREATE POLICY "chimera_entities_update_unified" ON chimera_entities
    FOR UPDATE 
    USING (
        owner_user_id = auth.uid()  -- Owner can update
        OR (
            is_official = true 
            AND EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() 
                AND role IN ('admin', 'system')
            )
        )  -- Admin can update official content
    )
    WITH CHECK (
        owner_user_id = auth.uid() 
        OR (
            is_official = true 
            AND EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() 
                AND role IN ('admin', 'system')
            )
        )
    );

-- Lore: Allow owner to update OR admin to update official content
CREATE POLICY "chimera_lore_update_unified" ON chimera_lore
    FOR UPDATE 
    USING (
        (
            owner_user_id = auth.uid()  -- Direct ownership
            AND visibility != 'public'
        )
        OR EXISTS (
            SELECT 1 FROM chimera_worlds 
            WHERE id = chimera_lore.world_id 
            AND owner_user_id = auth.uid()
            AND visibility != 'public'  -- World owner can update lore for non-public worlds
        )
        OR (
            is_official = true 
            AND EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() 
                AND role IN ('admin', 'system')
            )
        )  -- Admin can update official lore
    )
    WITH CHECK (
        (
            owner_user_id = auth.uid()
            AND visibility != 'public'
        )
        OR EXISTS (
            SELECT 1 FROM chimera_worlds 
            WHERE id = chimera_lore.world_id 
            AND owner_user_id = auth.uid()
            AND visibility != 'public'
        )
        OR (
            is_official = true 
            AND EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() 
                AND role IN ('admin', 'system')
            )
        )
    );

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Summary:
-- ✅ Added is_official, published_by, published_at columns to all content tables
-- ✅ Created indexes for fast official content lookups
-- ✅ Updated RLS policies to allow admins to edit official content
-- ✅ Added documentation comments
-- 
-- Next Steps:
-- 1. Run mark-official-content.ts to mark legacy content as official
-- 2. Update backend services to track published_by when visibility changes to 'public'

