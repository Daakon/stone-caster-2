-- Core Schema Migration - Greenfield Implementation
-- Creates the foundational tables for the Stone Caster system
-- No legacy references - clean slate implementation

-- ============================================================================
-- WORLDS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS worlds (
    id text PRIMARY KEY,
    version text NOT NULL DEFAULT '1.0.0',
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived')),
    doc jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uk_worlds_id UNIQUE (id)
);

-- ============================================================================
-- RULESETS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS rulesets (
    id text PRIMARY KEY,
    version text NOT NULL DEFAULT '1.0.0',
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived')),
    doc jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uk_rulesets_id UNIQUE (id)
);

-- ============================================================================
-- ENTRY_POINTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS entry_points (
    id text PRIMARY KEY,
    slug text UNIQUE NOT NULL,
    type text NOT NULL CHECK (type IN ('adventure', 'scenario', 'sandbox', 'quest')),
    world_id text NOT NULL REFERENCES worlds(id) ON DELETE RESTRICT,
    ruleset_id text NOT NULL REFERENCES rulesets(id) ON DELETE RESTRICT,
    title text NOT NULL,
    subtitle text,
    description text NOT NULL,
    synopsis text,
    status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
    visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'unlisted', 'private')),
    content_rating text NOT NULL DEFAULT 'safe' CHECK (content_rating IN ('safe', 'mature', 'explicit')),
    tags text[] NOT NULL DEFAULT '{}',
    content jsonb NOT NULL DEFAULT '{}',
    i18n jsonb NOT NULL DEFAULT '{}',
    search_text tsvector,
    sort_weight int NOT NULL DEFAULT 0,
    popularity_score int NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uk_entry_points_id UNIQUE (id)
);

-- ============================================================================
-- PROMPT_SEGMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS prompt_segments (
    id bigserial PRIMARY KEY,
    scope text NOT NULL CHECK (scope IN ('core', 'ruleset', 'world', 'entry', 'entry_start', 'npc', 'game_state', 'player', 'rng', 'input')),
    ref_id text, -- nullable (used for scopes that need a target like world/entry/npc)
    version text NOT NULL DEFAULT '1.0.0',
    active boolean NOT NULL DEFAULT true,
    content text NOT NULL,
    metadata jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- GAMES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS games (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_point_id text NOT NULL REFERENCES entry_points(id) ON DELETE RESTRICT,
    entry_point_type text NOT NULL, -- denormalized for quick filters; must match entry_points.type
    world_id text NOT NULL REFERENCES worlds(id) ON DELETE RESTRICT,
    ruleset_id text NOT NULL REFERENCES rulesets(id) ON DELETE RESTRICT,
    owner_user_id uuid,
    state jsonb NOT NULL DEFAULT '{"hot":{},"warm":{},"cold":{}}'::jsonb,
    turn_count int NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended', 'abandoned')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- TURNS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS turns (
    id bigserial PRIMARY KEY,
    game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    idx int NOT NULL,
    role text NOT NULL CHECK (role IN ('system', 'narrator', 'player')),
    prompt_meta jsonb NOT NULL DEFAULT '{}',
    content jsonb NOT NULL,
    costs jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- SEARCH TEXT TRIGGER
-- ============================================================================

-- Function to update search_text
CREATE OR REPLACE FUNCTION update_entry_points_search_text()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_text := 
        setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(NEW.synopsis, '')), 'B') ||
        to_tsvector('english', coalesce(NEW.description, '')) ||
        to_tsvector('english', coalesce(array_to_string(NEW.tags, ' '), ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update search_text
CREATE TRIGGER trigger_update_entry_points_search_text
    BEFORE INSERT OR UPDATE ON entry_points
    FOR EACH ROW
    EXECUTE FUNCTION update_entry_points_search_text();

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Entry Points Indexes
CREATE INDEX IF NOT EXISTS idx_entry_points_type ON entry_points (type);
CREATE INDEX IF NOT EXISTS idx_entry_points_world ON entry_points (world_id);
CREATE INDEX IF NOT EXISTS idx_entry_points_ruleset ON entry_points (ruleset_id);
CREATE INDEX IF NOT EXISTS idx_entry_points_status_vis ON entry_points (status, visibility);
CREATE INDEX IF NOT EXISTS idx_entry_points_tags ON entry_points USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_entry_points_search ON entry_points USING GIN (search_text);

-- Prompt Segments Indexes
CREATE INDEX IF NOT EXISTS idx_prompt_segments_scope ON prompt_segments (scope);
CREATE INDEX IF NOT EXISTS idx_prompt_segments_ref ON prompt_segments (ref_id);

-- Games Indexes
CREATE INDEX IF NOT EXISTS idx_games_owner ON games (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_games_entry_point ON games (entry_point_id);
CREATE INDEX IF NOT EXISTS idx_games_world ON games (world_id);

-- Turns Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_turns_game_idx ON turns (game_id, idx);

-- ============================================================================
-- ROLLBACK BLOCK (commented out)
-- ============================================================================
/*
-- Rollback script - uncomment to drop all objects created by this migration
-- DROP INDEX IF EXISTS idx_turns_game_idx;
-- DROP INDEX IF EXISTS idx_games_world;
-- DROP INDEX IF EXISTS idx_games_entry_point;
-- DROP INDEX IF EXISTS idx_games_owner;
-- DROP INDEX IF EXISTS idx_prompt_segments_ref;
-- DROP INDEX IF EXISTS idx_prompt_segments_scope;
-- DROP INDEX IF EXISTS idx_entry_points_search;
-- DROP INDEX IF EXISTS idx_entry_points_tags;
-- DROP INDEX IF EXISTS idx_entry_points_status_vis;
-- DROP INDEX IF EXISTS idx_entry_points_ruleset;
-- DROP INDEX IF EXISTS idx_entry_points_world;
-- DROP INDEX IF EXISTS idx_entry_points_type;
-- DROP TABLE IF EXISTS turns;
-- DROP TABLE IF EXISTS games;
-- DROP TABLE IF EXISTS prompt_segments;
-- DROP TABLE IF EXISTS entry_points;
-- DROP TABLE IF EXISTS rulesets;
-- DROP TABLE IF EXISTS worlds;
*/
