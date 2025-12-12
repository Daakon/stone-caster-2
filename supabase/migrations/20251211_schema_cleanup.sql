-- ============================================================================
-- Schema Cleanup: Slug & Entity Type Standardization
-- Date: 2025-12-11
-- Purpose: 
-- 1. Standardize identifier on 'slug' (deprecate 'key').
-- 2. Standardize categorization on 'entity_type' (deprecate 'kind').
-- 3. Ensure data preservation during rename/drop.
-- 4. Add 'display_name' column as it is core.
-- ============================================================================

DO $$
BEGIN

    -- ----------------------------------------------------------------
    -- 1. Slug & Key Logic
    -- ----------------------------------------------------------------

    -- CASE A: Target 'slug' does NOT exist, Source 'key' DOES exist.
    -- Action: Rename 'key' to 'slug' safely.
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chimera_entities' AND column_name = 'slug') 
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chimera_entities' AND column_name = 'key') 
    THEN
        ALTER TABLE chimera_entities RENAME COLUMN key TO slug;
    
    -- CASE B: Target 'slug' DOES exist, Source 'key' DOES exist.
    -- Action: Metadata copy logic (Copy key -> slug if slug is null), then DROP key.
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chimera_entities' AND column_name = 'slug') 
          AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chimera_entities' AND column_name = 'key') 
    THEN
        -- Preserve data: specific update if slug is NULL
        UPDATE chimera_entities SET slug = key WHERE slug IS NULL;
        -- Now safe to drop key (or we can keep it as legacy for a bit, but instructions say Cleanup/Eliminate)
        ALTER TABLE chimera_entities DROP COLUMN key;
    END IF;

    -- ----------------------------------------------------------------
    -- 2. Entity Type & Kind Logic
    -- ----------------------------------------------------------------

    -- CASE A: Target 'entity_type' does NOT exist, Source 'kind' DOES exist.
    -- Action: Rename 'kind' to 'entity_type'.
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chimera_entities' AND column_name = 'entity_type') 
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chimera_entities' AND column_name = 'kind') 
    THEN
        ALTER TABLE chimera_entities RENAME COLUMN kind TO entity_type;

    -- CASE B: Target 'entity_type' DOES exist, Source 'kind' DOES exist.
    -- Action: Copy kind -> entity_type if entity_type is null, then DROP kind.
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chimera_entities' AND column_name = 'entity_type') 
          AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chimera_entities' AND column_name = 'kind') 
    THEN
        UPDATE chimera_entities SET entity_type = kind WHERE entity_type IS NULL;
        ALTER TABLE chimera_entities DROP COLUMN kind;
    END IF;

    -- ----------------------------------------------------------------
    -- 3. Display Name
    -- ----------------------------------------------------------------
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chimera_entities' AND column_name = 'display_name') THEN
        ALTER TABLE chimera_entities ADD COLUMN display_name TEXT;
        -- Attempt to populate it from raw_data if possible, but raw_data structure varies.
        -- We will leave it nullable or assume application handles it.
        -- (Optional: Extract from raw_data if needed, but risky without knowing structure certainty)
    END IF;

END $$;

-- ----------------------------------------------------------------
-- 4. Final Constraints & Indexes
-- ----------------------------------------------------------------

-- Ensure unique constraint on slug? 
-- The user requested "Relax Entity Name Constraints", but usually slug must be unique.
-- We will add a unique index on slug IF one doesn't exist, scoped to world? 
-- For now, just a standard performance index.
CREATE INDEX IF NOT EXISTS idx_chimera_entities_slug ON chimera_entities(slug);
CREATE INDEX IF NOT EXISTS idx_chimera_entities_entity_type ON chimera_entities(entity_type);
