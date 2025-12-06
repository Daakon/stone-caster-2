-- ============================================================================
-- Stone Caster - Chimera V3 Full Migration
-- Purpose: Complete database migration for Hybrid Schema with vector support
-- Date: 2025-12-03
-- 
-- INSTRUCTIONS: Copy and paste this entire script into Supabase Dashboard SQL Editor
-- ============================================================================

-- ============================================================================
-- PART 1: Enable pgvector Extension
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- PART 2: Drop All Legacy Tables
-- ============================================================================

-- Drop AWF analytics/rollup tables (all awf_* tables)
DROP TABLE IF EXISTS awf_rollup_hourly CASCADE;
DROP TABLE IF EXISTS awf_rollup_daily CASCADE;
DROP TABLE IF EXISTS awf_funnels_daily CASCADE;
DROP TABLE IF EXISTS awf_kpi_thresholds CASCADE;
DROP TABLE IF EXISTS awf_dashboard_views CASCADE;
DROP TABLE IF EXISTS awf_incidents CASCADE;
DROP TABLE IF EXISTS awf_metrics CASCADE;
DROP TABLE IF EXISTS awf_analytics CASCADE;

-- Drop Stone/monetization tables (all stone_* tables)
DROP TABLE IF EXISTS stone_packs CASCADE;
DROP TABLE IF EXISTS stone_wallets CASCADE;
DROP TABLE IF EXISTS stone_ledger CASCADE;
DROP TABLE IF EXISTS guest_stone_wallets CASCADE;

-- Drop Mod system tables (all mod_* tables)
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

-- Drop old world/story system tables
DROP TABLE IF EXISTS world_templates CASCADE;
DROP TABLE IF EXISTS worlds CASCADE;

-- Drop legacy runtime tables
DROP TABLE IF EXISTS adventures CASCADE;
DROP TABLE IF EXISTS games CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS turns CASCADE;

-- Drop any redundant chimera tables that might exist
DROP TABLE IF EXISTS chimera_lore_templates CASCADE;
DROP TABLE IF EXISTS chimera_lore_entries CASCADE;
DROP TABLE IF EXISTS chimera_entity_templates CASCADE;

-- ============================================================================
-- PART 3: Create Enums
-- ============================================================================

-- Visibility enum for worlds
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'visibility_enum') THEN
        CREATE TYPE visibility_enum AS ENUM ('private', 'pending_approval', 'public');
    END IF;
END $$;

-- UI category enum for rulesets
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ui_category_enum') THEN
        CREATE TYPE ui_category_enum AS ENUM ('foundation', 'expansion', 'flavor');
    END IF;
END $$;

-- Entity kind enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'entity_kind_enum') THEN
        CREATE TYPE entity_kind_enum AS ENUM ('npc', 'item', 'location', 'faction', 'creature');
    END IF;
END $$;

-- ============================================================================
-- PART 4: Create chimera_worlds (Hybrid Schema)
-- ============================================================================

CREATE TABLE IF NOT EXISTS chimera_worlds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    visibility visibility_enum NOT NULL DEFAULT 'private',
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    owner_user_id UUID,
    definition JSONB NOT NULL DEFAULT '{}'::jsonb,
    character_schema_contributions JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast filtering (SQL columns)
CREATE INDEX IF NOT EXISTS idx_chimera_worlds_key ON chimera_worlds(key);
CREATE INDEX IF NOT EXISTS idx_chimera_worlds_owner_user_id ON chimera_worlds(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_chimera_worlds_visibility ON chimera_worlds(visibility);
CREATE INDEX IF NOT EXISTS idx_chimera_worlds_tags ON chimera_worlds USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_chimera_worlds_slug ON chimera_worlds(slug);

-- Indexes for JSONB queries
CREATE INDEX IF NOT EXISTS idx_chimera_worlds_definition ON chimera_worlds USING GIN(definition);
CREATE INDEX IF NOT EXISTS idx_chimera_worlds_character_schema ON chimera_worlds USING GIN(character_schema_contributions);

-- Constraints
ALTER TABLE chimera_worlds 
    ADD CONSTRAINT chimera_worlds_definition_not_empty 
    CHECK (definition IS NOT NULL AND definition != '{}'::jsonb);

COMMENT ON TABLE chimera_worlds IS 
    'Hybrid Schema: SQL columns (name, slug, visibility, tags, owner_user_id) for indexing/filtering. JSONB definition contains full WorldDefinition.';

-- ============================================================================
-- PART 5: Create chimera_ruleset_templates (Hybrid Schema)
-- ============================================================================

CREATE TABLE IF NOT EXISTS chimera_ruleset_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    ui_category ui_category_enum NOT NULL,
    exclusion_group TEXT,
    dependencies JSONB DEFAULT '[]'::jsonb,
    definition JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast filtering (SQL columns)
CREATE INDEX IF NOT EXISTS idx_chimera_ruleset_templates_key ON chimera_ruleset_templates(key);
CREATE INDEX IF NOT EXISTS idx_chimera_ruleset_templates_ui_category ON chimera_ruleset_templates(ui_category);
CREATE INDEX IF NOT EXISTS idx_chimera_ruleset_templates_exclusion_group ON chimera_ruleset_templates(exclusion_group);
CREATE INDEX IF NOT EXISTS idx_chimera_ruleset_templates_dependencies ON chimera_ruleset_templates USING GIN(dependencies);

-- Indexes for JSONB queries
CREATE INDEX IF NOT EXISTS idx_chimera_ruleset_templates_definition ON chimera_ruleset_templates USING GIN(definition);

-- Constraints
ALTER TABLE chimera_ruleset_templates 
    ADD CONSTRAINT chimera_ruleset_templates_definition_not_empty 
    CHECK (definition IS NOT NULL AND definition != '{}'::jsonb);

COMMENT ON TABLE chimera_ruleset_templates IS 
    'Hybrid Schema: SQL columns (key, ui_category, exclusion_group, dependencies) for indexing/filtering. JSONB definition contains full RulesetDefinition.';

-- ============================================================================
-- PART 6: Create chimera_entities (Hybrid Schema)
-- ============================================================================

CREATE TABLE IF NOT EXISTS chimera_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    kind entity_kind_enum NOT NULL,
    raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast filtering (SQL columns)
CREATE INDEX IF NOT EXISTS idx_chimera_entities_key ON chimera_entities(key);
CREATE INDEX IF NOT EXISTS idx_chimera_entities_kind ON chimera_entities(kind);

-- Indexes for JSONB queries
CREATE INDEX IF NOT EXISTS idx_chimera_entities_raw_data ON chimera_entities USING GIN(raw_data);

-- Constraints
ALTER TABLE chimera_entities 
    ADD CONSTRAINT chimera_entities_raw_data_not_empty 
    CHECK (raw_data IS NOT NULL AND raw_data != '{}'::jsonb);

COMMENT ON TABLE chimera_entities IS 
    'Hybrid Schema: SQL columns (kind, key) for indexing/filtering. JSONB raw_data contains full EntityTemplate.';

-- ============================================================================
-- PART 7: Create chimera_lore (Vector Enabled)
-- ============================================================================

CREATE TABLE IF NOT EXISTS chimera_lore (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fragment JSONB NOT NULL DEFAULT '{}'::jsonb,
    embedding vector(1536),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vector similarity index (IVFFlat for fast approximate search)
CREATE INDEX IF NOT EXISTS idx_chimera_lore_embedding 
    ON chimera_lore USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- GIN index on fragment JSONB for fast queries
CREATE INDEX IF NOT EXISTS idx_chimera_lore_fragment 
    ON chimera_lore USING GIN(fragment);

-- Constraints
ALTER TABLE chimera_lore 
    ADD CONSTRAINT chimera_lore_fragment_not_empty 
    CHECK (fragment IS NOT NULL AND fragment != '{}'::jsonb);

COMMENT ON TABLE chimera_lore IS 
    'Vector-enabled RAG table. fragment (JSONB) contains lore data. embedding (vector(1536)) for similarity search.';

-- ============================================================================
-- PART 8: Create compiled_stories (Artifact Storage)
-- ============================================================================

CREATE TABLE IF NOT EXISTS compiled_stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_key TEXT UNIQUE NOT NULL,
    compiled JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_compiled_stories_story_key ON compiled_stories(story_key);
CREATE INDEX IF NOT EXISTS idx_compiled_stories_compiled ON compiled_stories USING GIN(compiled);

-- Constraints
ALTER TABLE compiled_stories 
    ADD CONSTRAINT compiled_stories_compiled_not_empty 
    CHECK (compiled IS NOT NULL AND compiled != '{}'::jsonb);

COMMENT ON TABLE compiled_stories IS 
    'Artifact storage for compiled Story Dimensions. compiled (JSONB) contains full CompiledStory.';

-- ============================================================================
-- PART 9: Create chimera_game_states (Runtime Persistence)
-- ============================================================================

CREATE TABLE IF NOT EXISTS chimera_game_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID NOT NULL,
    state JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chimera_game_states_story_id ON chimera_game_states(story_id);
CREATE INDEX IF NOT EXISTS idx_chimera_game_states_state ON chimera_game_states USING GIN(state);
CREATE INDEX IF NOT EXISTS idx_chimera_game_states_created_at ON chimera_game_states(created_at DESC);

-- Constraints
ALTER TABLE chimera_game_states 
    ADD CONSTRAINT chimera_game_states_state_not_empty 
    CHECK (state IS NOT NULL AND state != '{}'::jsonb);

COMMENT ON TABLE chimera_game_states IS 
    'Runtime persistence for game states. state (JSONB) contains full GameState with tier1_mechanical + tier0_narrative.';

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Summary:
-- ✅ Enabled pgvector extension
-- ✅ Dropped all legacy tables (awf_*, stone_*, mod_*, world_templates, worlds, adventures, games, sessions, turns)
-- ✅ Created chimera_worlds (Hybrid Schema with SQL columns + JSONB definition)
-- ✅ Created chimera_ruleset_templates (Hybrid Schema)
-- ✅ Created chimera_entities (Hybrid Schema)
-- ✅ Created chimera_lore (Vector-enabled with vector(1536) column)
-- ✅ Created compiled_stories (Artifact storage)
-- ✅ Created chimera_game_states (Runtime persistence)
-- ✅ Created all necessary indexes (B-tree for SQL columns, GIN for JSONB, IVFFlat for vectors)

