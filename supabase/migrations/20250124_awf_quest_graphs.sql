-- Phase 15: Quest Graph & Pacing
-- Migration: 20250124_awf_quest_graphs.sql

-- Create quest_graphs table
CREATE TABLE IF NOT EXISTS quest_graphs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    adventure_ref TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT '1.0.0',
    doc JSONB NOT NULL DEFAULT '{}'::jsonb,
    hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(adventure_ref, version)
);

-- Create quest_graph_indexes table for precomputed graph data
CREATE TABLE IF NOT EXISTS quest_graph_indexes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    graph_id UUID NOT NULL REFERENCES quest_graphs(id) ON DELETE CASCADE,
    node_id TEXT NOT NULL,
    deps JSONB NOT NULL DEFAULT '[]'::jsonb,
    type TEXT NOT NULL,
    synopsis TEXT,
    hint TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_quest_graphs_adventure ON quest_graphs(adventure_ref);
CREATE INDEX IF NOT EXISTS idx_quest_graphs_version ON quest_graphs(version);
CREATE INDEX IF NOT EXISTS idx_quest_graphs_hash ON quest_graphs(hash);
CREATE INDEX IF NOT EXISTS idx_quest_graph_indexes_graph ON quest_graph_indexes(graph_id);
CREATE INDEX IF NOT EXISTS idx_quest_graph_indexes_node ON quest_graph_indexes(node_id);
CREATE INDEX IF NOT EXISTS idx_quest_graph_indexes_type ON quest_graph_indexes(type);

-- Add RLS policies
ALTER TABLE quest_graphs ENABLE ROW LEVEL SECURITY;
ALTER TABLE quest_graph_indexes ENABLE ROW LEVEL SECURITY;

-- RLS policies for quest_graphs (admin only)
DROP POLICY IF EXISTS "Admin can manage quest graphs" ON quest_graphs;
CREATE POLICY "Admin can manage quest graphs" ON quest_graphs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.auth_user_id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );

-- RLS policies for quest_graph_indexes (admin only)
DROP POLICY IF EXISTS "Admin can manage quest graph indexes" ON quest_graph_indexes;
CREATE POLICY "Admin can manage quest graph indexes" ON quest_graph_indexes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.auth_user_id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_quest_graphs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_quest_graphs_updated_at ON quest_graphs;
CREATE TRIGGER trigger_update_quest_graphs_updated_at
  BEFORE UPDATE ON quest_graphs
  FOR EACH ROW
  EXECUTE FUNCTION update_quest_graphs_updated_at();

-- Add comments
COMMENT ON TABLE quest_graphs IS 'Stores quest graph definitions for adventures';
COMMENT ON TABLE quest_graph_indexes IS 'Precomputed graph indexes for fast node lookups';
COMMENT ON COLUMN quest_graphs.adventure_ref IS 'Reference to the adventure (e.g., "whispercross")';
COMMENT ON COLUMN quest_graphs.version IS 'Graph version for tracking changes';
COMMENT ON COLUMN quest_graphs.doc IS 'JSONB document containing the full graph definition';
COMMENT ON COLUMN quest_graphs.hash IS 'Hash of the graph document for integrity checking';

-- Add hot.graph pointer to game_states table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'game_states' AND column_name = 'graph'
    ) THEN
        ALTER TABLE game_states ADD COLUMN graph JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- Create function to get active graph for adventure
CREATE OR REPLACE FUNCTION get_active_graph(p_adventure_ref TEXT)
RETURNS TABLE (
    id UUID,
    adventure_ref TEXT,
    version TEXT,
    doc JSONB,
    hash TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        qg.id,
        qg.adventure_ref,
        qg.version,
        qg.doc,
        qg.hash
    FROM quest_graphs qg
    WHERE qg.adventure_ref = p_adventure_ref
    ORDER BY qg.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Create function to get graph node
CREATE OR REPLACE FUNCTION get_graph_node(
    p_graph_id UUID,
    p_node_id TEXT
)
RETURNS TABLE (
    node_id TEXT,
    type TEXT,
    synopsis TEXT,
    hint TEXT,
    deps JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        qgi.node_id,
        qgi.type,
        qgi.synopsis,
        qgi.hint,
        qgi.deps
    FROM quest_graph_indexes qgi
    WHERE qgi.graph_id = p_graph_id
    AND qgi.node_id = p_node_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to get graph neighbors
CREATE OR REPLACE FUNCTION get_graph_neighbors(
    p_graph_id UUID,
    p_node_id TEXT
)
RETURNS TABLE (
    node_id TEXT,
    type TEXT,
    synopsis TEXT,
    hint TEXT,
    deps JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        qgi.node_id,
        qgi.type,
        qgi.synopsis,
        qgi.hint,
        qgi.deps
    FROM quest_graph_indexes qgi
    WHERE qgi.graph_id = p_graph_id
    AND qgi.node_id != p_node_id
    AND (
        qgi.deps @> jsonb_build_array(p_node_id)
        OR qgi.deps @> jsonb_build_array(jsonb_build_object('from', p_node_id))
    );
END;
$$ LANGUAGE plpgsql;

-- Insert default quest graph for testing
INSERT INTO quest_graphs (adventure_ref, version, doc, hash) VALUES 
('whispercross', '1.0.0', 
 '{
   "graph_id": "adv.whispercross.v1.g1",
   "start": "beat.intro",
   "nodes": [
     {
       "id": "beat.intro",
       "type": "beat",
       "synopsis": "Moonlit glade, first contact with Kiera.",
       "enter_if": [{"flag": "met_kiera", "op": "ne", "val": true}],
       "on_success": [{"act": "OBJECTIVE_UPDATE", "id": "meet_kiera", "status": "complete"}],
       "on_fail": [{"act": "FLAG_SET", "key": "intro_failed", "val": true}],
       "hint": "Try a calm greeting or show a harmless token."
     },
     {
       "id": "beat.trust_test",
       "type": "objective",
       "synopsis": "Prove your worth to Kiera through actions.",
       "enter_if": [{"objective": "meet_kiera", "status": "complete"}],
       "on_success": [{"act": "OBJECTIVE_UPDATE", "id": "gain_trust", "status": "complete"}],
       "on_fail": [{"act": "FLAG_SET", "key": "trust_failed", "val": true}],
       "hint": "Show kindness or help others in need."
     }
   ],
   "edges": [
     {"from": "beat.intro", "to": "beat.trust_test", "guard": [{"objective": "meet_kiera", "status": "complete"}]}
   ]
 }'::jsonb,
 'test-hash-123')
ON CONFLICT (adventure_ref, version) DO NOTHING;


