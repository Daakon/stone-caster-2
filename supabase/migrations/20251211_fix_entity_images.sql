-- ============================================================================
-- Fix: Entity Images Columns
-- Date: 2025-12-11
-- Purpose: Ensure primary_image_url and icon_image_url exist for Entity Persistence.
-- ============================================================================

DO $$
BEGIN
    -- 1. Add primary_image_url if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chimera_entities' AND column_name = 'primary_image_url') THEN
        ALTER TABLE chimera_entities ADD COLUMN primary_image_url TEXT;
    END IF;

    -- 2. Add icon_image_url if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chimera_entities' AND column_name = 'icon_image_url') THEN
        ALTER TABLE chimera_entities ADD COLUMN icon_image_url TEXT;
    END IF;

    -- 3. Verify core columns exist (just safety check, no action needed if valid)
    -- This relies on previous migrations executing correctly.

END $$;
