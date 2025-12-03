-- Stone Caster - Phase 1: Consolidate Chimera Schema
-- Purpose: Drop legacy tables and ensure Hybrid Schema compliance
-- Date: 2025-12-03

-- ============================================================================
-- PART 1: Enable pgvector Extension (if not already enabled)
-- ============================================================================

-- Enable the vector extension for chimera_lore embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- PART 2: Drop Legacy Tables
-- ============================================================================

-- Drop AWF analytics/rollup tables
DROP TABLE IF EXISTS awf_rollup_hourly CASCADE;
DROP TABLE IF EXISTS awf_rollup_daily CASCADE;
DROP TABLE IF EXISTS awf_funnels_daily CASCADE;
DROP TABLE IF EXISTS awf_kpi_thresholds CASCADE;
DROP TABLE IF EXISTS awf_dashboard_views CASCADE;
DROP TABLE IF EXISTS awf_incidents CASCADE;

-- Drop Stone/monetization tables
DROP TABLE IF EXISTS stone_packs CASCADE;
DROP TABLE IF EXISTS stone_wallets CASCADE;
DROP TABLE IF EXISTS stone_ledger CASCADE;
DROP TABLE IF EXISTS guest_stone_wallets CASCADE;

-- Drop Mod system tables
DROP TABLE IF EXISTS mod_packs CASCADE;
DROP TABLE IF EXISTS mod_hooks CASCADE;
DROP TABLE IF EXISTS mod_quarantine CASCADE;
DROP TABLE IF EXISTS mod_metrics CASCADE;
DROP TABLE IF EXISTS mod_config CASCADE;
DROP TABLE IF EXISTS mod_pack_registry CASCADE;
DROP TABLE IF EXISTS mod_ratings CASCADE;
DROP TABLE IF EXISTS mod_reports CASCADE;
DROP TABLE IF EXISTS mod_download_tokens CASCADE;
DROP TABLE IF EXISTS mod_pack_metrics CASCADE;
DROP TABLE IF EXISTS mod_pack_dependencies CASCADE;
DROP TABLE IF EXISTS mod_pack_capabilities CASCADE;
DROP TABLE IF EXISTS mod_pack_tags CASCADE;

-- Drop old world/story system tables (replaced by chimera_worlds)
DROP TABLE IF EXISTS world_templates CASCADE;
DROP TABLE IF EXISTS worlds CASCADE;

-- Drop legacy runtime tables (replaced by chimera_game_states)
DROP TABLE IF EXISTS adventures CASCADE;
DROP TABLE IF EXISTS games CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS turns CASCADE;

-- Drop redundant chimera tables (consolidate into main tables)
DROP TABLE IF EXISTS chimera_lore_templates CASCADE;
DROP TABLE IF EXISTS chimera_lore_entries CASCADE;
DROP TABLE IF EXISTS chimera_entity_templates CASCADE;

-- ============================================================================
-- PART 3: Fix chimera_worlds (Hybrid Schema Compliance)
-- ============================================================================

-- Ensure chimera_worlds has the correct Hybrid structure
-- SQL columns for indexing: id, key, name, slug, visibility, tags, owner_user_id
-- JSONB definition: full WorldDefinition object

-- Add missing columns if they don't exist
DO $$
BEGIN
    -- Ensure owner_user_id exists (preferred over owner_id)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chimera_worlds' AND column_name = 'owner_user_id'
    ) THEN
        ALTER TABLE chimera_worlds ADD COLUMN owner_user_id UUID;
    END IF;

    -- Ensure name column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chimera_worlds' AND column_name = 'name'
    ) THEN
        ALTER TABLE chimera_worlds ADD COLUMN name TEXT NOT NULL DEFAULT '';
    END IF;

    -- Ensure slug column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chimera_worlds' AND column_name = 'slug'
    ) THEN
        ALTER TABLE chimera_worlds ADD COLUMN slug TEXT NOT NULL DEFAULT '';
    END IF;

    -- Ensure visibility column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chimera_worlds' AND column_name = 'visibility'
    ) THEN
        -- Create visibility enum if it doesn't exist
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'visibility_enum') THEN
                CREATE TYPE visibility_enum AS ENUM ('private', 'pending_approval', 'public');
            END IF;
        END $$;
        ALTER TABLE chimera_worlds ADD COLUMN visibility visibility_enum NOT NULL DEFAULT 'private';
    END IF;

    -- Ensure tags column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chimera_worlds' AND column_name = 'tags'
    ) THEN
        ALTER TABLE chimera_worlds ADD COLUMN tags TEXT[] DEFAULT ARRAY[]::TEXT[];
    END IF;

    -- Ensure definition JSONB column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chimera_worlds' AND column_name = 'definition'
    ) THEN
        ALTER TABLE chimera_worlds ADD COLUMN definition JSONB NOT NULL DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- Create indexes on SQL columns for fast filtering
CREATE INDEX IF NOT EXISTS idx_chimera_worlds_key ON chimera_worlds(key);
CREATE INDEX IF NOT EXISTS idx_chimera_worlds_owner_user_id ON chimera_worlds(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_chimera_worlds_visibility ON chimera_worlds(visibility);
CREATE INDEX IF NOT EXISTS idx_chimera_worlds_tags ON chimera_worlds USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_chimera_worlds_definition ON chimera_worlds USING GIN(definition);

-- Add constraint: definition must contain canonical data
-- Note: This is enforced at application level, but we add a check constraint
ALTER TABLE chimera_worlds 
    ADD CONSTRAINT chimera_worlds_definition_not_empty 
    CHECK (definition IS NOT NULL AND definition != '{}'::jsonb);

-- ============================================================================
-- PART 4: Fix chimera_lore (Vector Support)
-- ============================================================================

-- Ensure chimera_lore has the correct structure for RAG
-- Required: id, fragment (JSONB), embedding (vector(1536)), created_at, updated_at

DO $$
BEGIN
    -- Ensure fragment JSONB column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chimera_lore' AND column_name = 'fragment'
    ) THEN
        ALTER TABLE chimera_lore ADD COLUMN fragment JSONB NOT NULL DEFAULT '{}'::jsonb;
    END IF;

    -- Ensure embedding column exists with vector type
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chimera_lore' AND column_name = 'embedding'
    ) THEN
        ALTER TABLE chimera_lore ADD COLUMN embedding vector(1536);
    ELSE
        -- Check if embedding is the correct type
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'chimera_lore' 
            AND column_name = 'embedding' 
            AND udt_name != 'vector'
        ) THEN
            -- Drop and recreate with correct type
            ALTER TABLE chimera_lore DROP COLUMN IF EXISTS embedding;
            ALTER TABLE chimera_lore ADD COLUMN embedding vector(1536);
        END IF;
    END IF;

    -- Ensure timestamps exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chimera_lore' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE chimera_lore ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chimera_lore' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE chimera_lore ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;
END $$;

-- Create indexes for vector similarity search
CREATE INDEX IF NOT EXISTS idx_chimera_lore_embedding 
    ON chimera_lore USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- Create GIN index on fragment JSONB for fast queries
CREATE INDEX IF NOT EXISTS idx_chimera_lore_fragment 
    ON chimera_lore USING GIN(fragment);

-- ============================================================================
-- PART 5: Ensure Other Core Chimera Tables Exist
-- ============================================================================

-- Verify chimera_ruleset_templates exists (Hybrid pattern)
-- Note: This migration assumes it exists. If not, it should be created separately.

-- Verify chimera_entities exists (Hybrid pattern)
-- Note: This migration assumes it exists. If not, it should be created separately.

-- Verify compiled_stories exists (Artifact storage)
-- Note: This migration assumes it exists. If not, it should be created separately.

-- Verify chimera_game_states exists (Runtime persistence)
-- Note: This migration assumes it exists. If not, it should be created separately.

-- ============================================================================
-- PART 6: Cleanup and Validation
-- ============================================================================

-- Add comment to document the Hybrid Schema pattern
COMMENT ON TABLE chimera_worlds IS 
    'Hybrid Schema: SQL columns (name, slug, visibility, tags, owner_user_id) for indexing/filtering. JSONB definition contains full WorldDefinition.';

COMMENT ON TABLE chimera_lore IS 
    'Vector-enabled RAG table. fragment (JSONB) contains lore data. embedding (vector(1536)) for similarity search.';

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Summary:
-- 1. Enabled pgvector extension
-- 2. Dropped all legacy tables (awf_*, stone_*, mod_*, old worlds/games/adventures)
-- 3. Fixed chimera_worlds to ensure Hybrid Schema compliance
-- 4. Fixed chimera_lore to ensure vector support
-- 5. Created necessary indexes for performance

