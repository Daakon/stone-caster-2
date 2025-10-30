-- NPC System Migration
-- Creates NPC catalog, entry point bindings, and relationship tracking
-- NOTE: NPCs table is created by create-admin-tables.sql
-- Run 20250101_npc_system_add_world_id.sql first to add missing columns

-- ============================================================================
-- NPC CATALOG TABLE
-- ============================================================================

-- NPCs table is created by create-admin-tables.sql (with UUID id)
-- To add missing columns (world_id, archetype, role_tags, etc.):
-- Run: db/migrations/20250101_npc_system_add_world_id.sql

-- Verify npcs table exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'npcs') THEN
    RAISE EXCEPTION 'npcs table does not exist. Run create-admin-tables.sql first.';
  END IF;
END $$;

-- ============================================================================
-- ENTRY POINT NPC BINDINGS
-- ============================================================================

-- Note: entry_points.id is TEXT, npcs.id is UUID (from create-admin-tables.sql)
CREATE TABLE IF NOT EXISTS entry_point_npcs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_point_id text NOT NULL REFERENCES entry_points(id) ON DELETE CASCADE,
    npc_id uuid NOT NULL REFERENCES npcs(id) ON DELETE CASCADE,
    role_hint text,
    weight int NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (entry_point_id, npc_id)
);

-- Index for entry point queries
CREATE INDEX IF NOT EXISTS idx_ep_npcs_ep ON entry_point_npcs(entry_point_id);
CREATE INDEX IF NOT EXISTS idx_ep_npcs_npc ON entry_point_npcs(npc_id);

-- ============================================================================
-- NPC RELATIONSHIPS (Game-specific)
-- ============================================================================

-- Note: npcs.id is UUID (from create-admin-tables.sql)
CREATE TABLE IF NOT EXISTS npc_relationships (
    game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    npc_id uuid NOT NULL REFERENCES npcs(id) ON DELETE CASCADE,
    trust int NOT NULL DEFAULT 0,
    warmth int NOT NULL DEFAULT 0,
    respect int NOT NULL DEFAULT 0,
    romance int NOT NULL DEFAULT 0,
    awe int NOT NULL DEFAULT 0,
    fear int NOT NULL DEFAULT 0,
    desire int NOT NULL DEFAULT 0,
    flags jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (game_id, npc_id)
);

-- Index for game-based queries
CREATE INDEX IF NOT EXISTS idx_rel_game ON npc_relationships(game_id);
CREATE INDEX IF NOT EXISTS idx_rel_npc ON npc_relationships(npc_id);

-- ============================================================================
-- HELPER FUNCTIONS (Optional)
-- ============================================================================

-- Function to get visible NPCs for an entry point with their relationships
-- This is commented out but can be uncommented for DB-side logic
/*
CREATE OR REPLACE FUNCTION npc_visible_prompt(
    p_entry_point_id text,
    p_game_id uuid
) RETURNS TABLE (
    npc_id text,
    tier int,
    content text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        n.id as npc_id,
        CASE 
            WHEN r.trust + r.warmth + r.respect + r.romance + r.awe - r.fear >= 120 THEN 3
            WHEN r.trust + r.warmth + r.respect + r.romance + r.awe - r.fear >= 80 THEN 2
            WHEN r.trust + r.warmth + r.respect + r.romance + r.awe - r.fear >= 40 THEN 1
            ELSE 0
        END as tier,
        ps.content
    FROM entry_point_npcs epn
    JOIN npcs n ON epn.npc_id = n.id
    LEFT JOIN npc_relationships r ON r.game_id = p_game_id AND r.npc_id = n.id
    JOIN prompt_segments ps ON ps.scope = 'npc' AND ps.ref_id = n.id
    WHERE epn.entry_point_id = p_entry_point_id
    AND ps.active = true
    ORDER BY epn.weight DESC, n.name;
END;
$$ LANGUAGE plpgsql;
*/

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE entry_point_npcs IS 'Binding between entry points and NPCs with role hints';
COMMENT ON TABLE npc_relationships IS 'Game-specific relationship tracking for NPCs';

COMMENT ON COLUMN entry_point_npcs.id IS 'Unique binding identifier';
COMMENT ON COLUMN entry_point_npcs.entry_point_id IS 'Entry point this binding belongs to (TEXT)';
COMMENT ON COLUMN entry_point_npcs.npc_id IS 'NPC identifier (UUID from npcs table)';
COMMENT ON COLUMN entry_point_npcs.role_hint IS 'Suggested role for this NPC in the entry point';
COMMENT ON COLUMN entry_point_npcs.weight IS 'Priority weight for NPC selection (higher = more important)';

COMMENT ON COLUMN npc_relationships.game_id IS 'Game this relationship belongs to';
COMMENT ON COLUMN npc_relationships.npc_id IS 'NPC identifier (UUID from npcs table)';
COMMENT ON COLUMN npc_relationships.trust IS 'Trust level (-100 to 100)';
COMMENT ON COLUMN npc_relationships.warmth IS 'Warmth/affection level (-100 to 100)';
COMMENT ON COLUMN npc_relationships.respect IS 'Respect level (-100 to 100)';
COMMENT ON COLUMN npc_relationships.romance IS 'Romantic interest level (-100 to 100)';
COMMENT ON COLUMN npc_relationships.awe IS 'Awe/fear level (-100 to 100)';
COMMENT ON COLUMN npc_relationships.fear IS 'Fear level (-100 to 100)';
COMMENT ON COLUMN npc_relationships.desire IS 'Desire level (-100 to 100)';
COMMENT ON COLUMN npc_relationships.flags IS 'Additional relationship flags and notes';

-- ============================================================================
-- ROLLBACK (Commented out - uncomment if needed)
-- ============================================================================

/*
-- Drop in reverse order to avoid foreign key issues
DROP FUNCTION IF EXISTS npc_visible_prompt(text, uuid);
DROP TABLE IF EXISTS npc_relationships;
DROP TABLE IF EXISTS entry_point_npcs;
DROP TABLE IF EXISTS npcs;
*/
