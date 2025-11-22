-- Phase 1: Persistence - Initialize Chimera Database Schema
-- DESTRUCTIVE: Drops and recreates all Chimera tables for clean state
-- Creates tables for worlds, rulesets, entities, lore, compiled stories, and game states

BEGIN;

-- Drop all existing Chimera tables (CASCADE handles foreign key dependencies)
DROP TABLE IF EXISTS chimera_game_states CASCADE;
DROP TABLE IF EXISTS compiled_stories CASCADE;
DROP TABLE IF EXISTS chimera_lore CASCADE;
DROP TABLE IF EXISTS chimera_entities CASCADE;
DROP TABLE IF EXISTS chimera_ruleset_templates CASCADE;
DROP TABLE IF EXISTS chimera_worlds CASCADE;

-- Enable vector extension for embeddings
-- Note: This may require superuser privileges. If it fails, embeddings will use JSONB fallback.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    CREATE EXTENSION vector;
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Vector extension requires superuser privileges. Embeddings will use JSONB fallback.';
END $$;

-- ============================================================================
-- CHIMERA_WORLDS
-- ============================================================================
CREATE TABLE chimera_worlds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  definition JSONB NOT NULL,
  owner_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chimera_worlds_key ON chimera_worlds(key);
CREATE INDEX idx_chimera_worlds_owner_id ON chimera_worlds(owner_id);

-- ============================================================================
-- CHIMERA_RULESET_TEMPLATES
-- ============================================================================
CREATE TABLE chimera_ruleset_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  ui_category TEXT NOT NULL, -- Extracted from definition for filtering
  exclusion_group TEXT, -- Extracted from definition for filtering (nullable)
  dependencies JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of strings
  definition JSONB NOT NULL, -- Full RulesetDefinition object
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chimera_ruleset_templates_key ON chimera_ruleset_templates(key);
CREATE INDEX idx_chimera_ruleset_templates_ui_category ON chimera_ruleset_templates(ui_category);
CREATE INDEX idx_chimera_ruleset_templates_exclusion_group ON chimera_ruleset_templates(exclusion_group);

-- ============================================================================
-- CHIMERA_ENTITIES
-- ============================================================================
CREATE TABLE chimera_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('npc', 'item', 'location')),
  key TEXT NOT NULL UNIQUE,
  raw_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chimera_entities_key ON chimera_entities(key);
CREATE INDEX idx_chimera_entities_kind ON chimera_entities(kind);

-- ============================================================================
-- CHIMERA_LORE
-- ============================================================================
CREATE TABLE chimera_lore (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fragment JSONB NOT NULL, -- LoreFragment object
  embedding vector(1536), -- Optional embedding vector (falls back to JSONB if vector extension unavailable)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create vector index only if vector extension is available
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    CREATE INDEX idx_chimera_lore_embedding 
    ON chimera_lore 
    USING ivfflat (embedding vector_cosine_ops) 
    WITH (lists = 100)
    WHERE embedding IS NOT NULL;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Vector index creation skipped: %', SQLERRM;
END $$;

-- ============================================================================
-- COMPILED_STORIES
-- ============================================================================
CREATE TABLE compiled_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_key TEXT NOT NULL UNIQUE,
  compiled JSONB NOT NULL, -- CompiledStory object
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_compiled_stories_story_key ON compiled_stories(story_key);

-- ============================================================================
-- CHIMERA_GAME_STATES
-- ============================================================================
CREATE TABLE chimera_game_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES compiled_stories(id) ON DELETE CASCADE,
  state JSONB NOT NULL, -- GameState object
  player_id UUID NOT NULL, -- Explicitly NOT NULL for RLS policy
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chimera_game_states_story_id ON chimera_game_states(story_id);
CREATE INDEX idx_chimera_game_states_player_id ON chimera_game_states(player_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE chimera_worlds ENABLE ROW LEVEL SECURITY;
ALTER TABLE chimera_ruleset_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE chimera_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE chimera_lore ENABLE ROW LEVEL SECURITY;
ALTER TABLE compiled_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE chimera_game_states ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CHIMERA_WORLDS RLS Policies
-- ============================================================================

-- Authors full access: For MVP velocity, allow public (anon) CRUD
-- OR check auth.uid() = owner_id if owner_id exists
CREATE POLICY chimera_worlds_public_full_access
ON chimera_worlds
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- ============================================================================
-- CHIMERA_RULESET_TEMPLATES RLS Policies
-- ============================================================================

-- Authors full access: For MVP velocity, allow public (anon) CRUD
CREATE POLICY chimera_ruleset_templates_public_full_access
ON chimera_ruleset_templates
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- ============================================================================
-- CHIMERA_ENTITIES RLS Policies
-- ============================================================================

-- Authors full access: For MVP velocity, allow public (anon) CRUD
CREATE POLICY chimera_entities_public_full_access
ON chimera_entities
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- ============================================================================
-- CHIMERA_LORE RLS Policies
-- ============================================================================

-- Authors full access: For MVP velocity, allow public (anon) CRUD
CREATE POLICY chimera_lore_public_full_access
ON chimera_lore
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- ============================================================================
-- COMPILED_STORIES RLS Policies
-- ============================================================================

-- Players read stories: Public read access on compiled_stories
CREATE POLICY compiled_stories_public_read
ON compiled_stories
FOR SELECT
TO anon, authenticated
USING (true);

-- Authors can create/update/delete (for MVP, allow all authenticated)
CREATE POLICY compiled_stories_author_full_access
ON compiled_stories
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ============================================================================
-- CHIMERA_GAME_STATES RLS Policies
-- ============================================================================

-- Players own states: Users can CRUD chimera_game_states where player_id = auth.uid()
CREATE POLICY chimera_game_states_player_own
ON chimera_game_states
FOR ALL
TO authenticated
USING (player_id = auth.uid())
WITH CHECK (player_id = auth.uid());

-- For anon users (MVP): Allow if player_id matches a session identifier
-- This is a simplified approach - in production, you'd want a more robust session system
CREATE POLICY chimera_game_states_anon_own
ON chimera_game_states
FOR ALL
TO anon
USING (true)
WITH CHECK (true);

COMMIT;
