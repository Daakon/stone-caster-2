-- Stone Caster - Phase 1: Legacy Purge & Chimera Foundation
-- Purpose: Drop all legacy tables and ensure Chimera Hybrid Schema compliance
-- Date: 2025-12-04

-- ============================================================================
-- PART 1: Enable pgvector Extension (if not already enabled)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- PART 2: Drop Legacy Tables (CASCADE)
-- ============================================================================

-- Drop all AWF tables (analytics, rollups, dashboards)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename LIKE 'awf_%'
    ) LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
        RAISE NOTICE 'Dropped table: %', r.tablename;
    END LOOP;
END $$;

-- Drop all Stone tables (wallets, ledgers, packs)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename LIKE 'stone_%'
    ) LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
        RAISE NOTICE 'Dropped table: %', r.tablename;
    END LOOP;
END $$;

-- Drop all Mod tables (packs, registry, hooks)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename LIKE 'mod_%'
    ) LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
        RAISE NOTICE 'Dropped table: %', r.tablename;
    END LOOP;
END $$;

-- Drop legacy world/story system tables
DROP TABLE IF EXISTS world_templates CASCADE;
DROP TABLE IF EXISTS worlds CASCADE;

-- Drop legacy runtime tables
DROP TABLE IF EXISTS adventures CASCADE;
DROP TABLE IF EXISTS games CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS turns CASCADE;

-- Drop legacy moderation/review tables
DROP TABLE IF EXISTS content_reviews CASCADE;
DROP TABLE IF EXISTS content_reports CASCADE;
DROP TABLE IF EXISTS review_actions CASCADE;

-- ============================================================================
-- PART 3: Create/Alter chimera_worlds (Hybrid Schema)
-- ============================================================================

CREATE TABLE IF NOT EXISTS chimera_worlds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'pending_approval', 'public')),
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    owner_user_id UUID,
    definition JSONB NOT NULL DEFAULT '{}'::jsonb,
    character_schema_contributions JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_chimera_worlds_key ON chimera_worlds(key);
CREATE INDEX IF NOT EXISTS idx_chimera_worlds_owner_user_id ON chimera_worlds(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_chimera_worlds_visibility ON chimera_worlds(visibility);
CREATE INDEX IF NOT EXISTS idx_chimera_worlds_tags ON chimera_worlds USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_chimera_worlds_definition ON chimera_worlds USING GIN(definition);
CREATE INDEX IF NOT EXISTS idx_chimera_worlds_character_schema_contributions ON chimera_worlds USING GIN(character_schema_contributions);

-- Add comment
COMMENT ON TABLE chimera_worlds IS 
    'Hybrid Schema: SQL columns (name, slug, visibility, tags, owner_user_id) for indexing/filtering. JSONB definition contains full WorldDefinition.';

-- ============================================================================
-- PART 4: Create/Alter chimera_ruleset_templates (Hybrid Schema)
-- ============================================================================

CREATE TABLE IF NOT EXISTS chimera_ruleset_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    ui_category TEXT NOT NULL CHECK (ui_category IN ('foundation', 'expansion', 'flavor')),
    exclusion_group TEXT,
    dependencies JSONB DEFAULT '[]'::jsonb,
    definition JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_chimera_ruleset_templates_key ON chimera_ruleset_templates(key);
CREATE INDEX IF NOT EXISTS idx_chimera_ruleset_templates_ui_category ON chimera_ruleset_templates(ui_category);
CREATE INDEX IF NOT EXISTS idx_chimera_ruleset_templates_exclusion_group ON chimera_ruleset_templates(exclusion_group);
CREATE INDEX IF NOT EXISTS idx_chimera_ruleset_templates_dependencies ON chimera_ruleset_templates USING GIN(dependencies);
CREATE INDEX IF NOT EXISTS idx_chimera_ruleset_templates_definition ON chimera_ruleset_templates USING GIN(definition);

-- Add comment
COMMENT ON TABLE chimera_ruleset_templates IS 
    'Hybrid Schema: SQL columns (key, ui_category, exclusion_group, dependencies) for indexing/filtering. JSONB definition contains full RulesetDefinition.';

-- ============================================================================
-- PART 5: Create/Alter chimera_entities (Hybrid Schema)
-- ============================================================================

CREATE TABLE IF NOT EXISTS chimera_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('npc', 'item', 'location', 'faction', 'creature')),
    raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_chimera_entities_key ON chimera_entities(key);
CREATE INDEX IF NOT EXISTS idx_chimera_entities_kind ON chimera_entities(kind);
CREATE INDEX IF NOT EXISTS idx_chimera_entities_raw_data ON chimera_entities USING GIN(raw_data);

-- Add comment
COMMENT ON TABLE chimera_entities IS 
    'Hybrid Schema: SQL columns (key, kind) for indexing/filtering. JSONB raw_data contains full EntityTemplate.';

-- ============================================================================
-- PART 6: Create/Alter chimera_lore (Vector Enabled)
-- ============================================================================

CREATE TABLE IF NOT EXISTS chimera_lore (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fragment JSONB NOT NULL DEFAULT '{}'::jsonb,
    embedding vector(1536),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for vector similarity search
CREATE INDEX IF NOT EXISTS idx_chimera_lore_embedding 
    ON chimera_lore USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- Create GIN index on fragment JSONB
CREATE INDEX IF NOT EXISTS idx_chimera_lore_fragment ON chimera_lore USING GIN(fragment);

-- Add comment
COMMENT ON TABLE chimera_lore IS 
    'Vector-enabled RAG table. fragment (JSONB) contains lore data. embedding (vector(1536)) for similarity search.';

-- ============================================================================
-- PART 7: Create/Alter compiled_stories (Artifact Storage)
-- ============================================================================

CREATE TABLE IF NOT EXISTS compiled_stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_key TEXT UNIQUE NOT NULL,
    compiled JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_compiled_stories_story_key ON compiled_stories(story_key);
CREATE INDEX IF NOT EXISTS idx_compiled_stories_compiled ON compiled_stories USING GIN(compiled);

-- Add comment
COMMENT ON TABLE compiled_stories IS 
    'Artifact storage for compiled Story Dimensions. compiled (JSONB) contains full CompiledStory.';

-- ============================================================================
-- PART 8: Create/Alter chimera_game_states (Runtime Persistence)
-- ============================================================================

CREATE TABLE IF NOT EXISTS chimera_game_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID NOT NULL,
    state JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_chimera_game_states_story_id ON chimera_game_states(story_id);
CREATE INDEX IF NOT EXISTS idx_chimera_game_states_state ON chimera_game_states USING GIN(state);

-- Add comment
COMMENT ON TABLE chimera_game_states IS 
    'Runtime persistence for game states. state (JSONB) contains full GameState with tier1_mechanical + tier0_narrative.';

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Summary:
-- 1. Enabled pgvector extension
-- 2. Dropped all legacy tables (awf_*, stone_*, mod_*, world_templates, worlds, adventures, games, sessions, turns, content_reviews, content_reports, review_actions)
-- 3. Created/ensured chimera_worlds with Hybrid Schema
-- 4. Created/ensured chimera_ruleset_templates with Hybrid Schema
-- 5. Created/ensured chimera_entities with Hybrid Schema
-- 6. Created/ensured chimera_lore with vector support
-- 7. Created/ensured compiled_stories for artifact storage
-- 8. Created/ensured chimera_game_states for runtime persistence

