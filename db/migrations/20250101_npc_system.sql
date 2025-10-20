-- NPC System Migration
-- Creates NPC catalog, entry point bindings, and relationship tracking

-- ============================================================================
-- NPC CATALOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS npcs (
    id text PRIMARY KEY,
    world_id text NOT NULL REFERENCES worlds(id) ON DELETE RESTRICT,
    name text NOT NULL,
    archetype text,
    role_tags text[] NOT NULL DEFAULT '{}',
    portrait_url text,
    doc jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for world-based queries
CREATE INDEX IF NOT EXISTS idx_npcs_world ON npcs(world_id);

-- ============================================================================
-- ENTRY POINT NPC BINDINGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS entry_point_npcs (
    entry_point_id text NOT NULL REFERENCES entry_points(id) ON DELETE CASCADE,
    npc_id text NOT NULL REFERENCES npcs(id) ON DELETE CASCADE,
    role_hint text,
    weight int NOT NULL DEFAULT 1,
    PRIMARY KEY (entry_point_id, npc_id)
);

-- Index for entry point queries
CREATE INDEX IF NOT EXISTS idx_ep_npcs_ep ON entry_point_npcs(entry_point_id);

-- ============================================================================
-- NPC RELATIONSHIPS (Game-specific)
-- ============================================================================

CREATE TABLE IF NOT EXISTS npc_relationships (
    game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    npc_id text NOT NULL REFERENCES npcs(id) ON DELETE CASCADE,
    trust int NOT NULL DEFAULT 0,
    warmth int NOT NULL DEFAULT 0,
    respect int NOT NULL DEFAULT 0,
    romance int NOT NULL DEFAULT 0,
    awe int NOT NULL DEFAULT 0,
    fear int NOT NULL DEFAULT 0,
    desire int NOT NULL DEFAULT 0,
    flags jsonb NOT NULL DEFAULT '{}',
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (game_id, npc_id)
);

-- Index for game-based queries
CREATE INDEX IF NOT EXISTS idx_rel_game ON npc_relationships(game_id);

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

COMMENT ON TABLE npcs IS 'NPC catalog with world association and metadata';
COMMENT ON TABLE entry_point_npcs IS 'Binding between entry points and NPCs with role hints';
COMMENT ON TABLE npc_relationships IS 'Game-specific relationship tracking for NPCs';

COMMENT ON COLUMN npcs.id IS 'Unique NPC identifier (e.g., npc.mystika.kiera)';
COMMENT ON COLUMN npcs.world_id IS 'World this NPC belongs to';
COMMENT ON COLUMN npcs.name IS 'Display name of the NPC';
COMMENT ON COLUMN npcs.archetype IS 'NPC archetype (e.g., Warden, Scholar, Warrior)';
COMMENT ON COLUMN npcs.role_tags IS 'Array of role tags (e.g., companion, guide, merchant)';
COMMENT ON COLUMN npcs.portrait_url IS 'Optional portrait image URL';
COMMENT ON COLUMN npcs.doc IS 'Additional NPC metadata and characteristics';

COMMENT ON COLUMN entry_point_npcs.role_hint IS 'Suggested role for this NPC in the entry point';
COMMENT ON COLUMN entry_point_npcs.weight IS 'Priority weight for NPC selection (higher = more important)';

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
