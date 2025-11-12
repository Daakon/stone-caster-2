-- Scenario Graph Migration
-- Add scene_graph column to scenarios table

ALTER TABLE scenarios
ADD COLUMN IF NOT EXISTS scene_graph jsonb NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS entry_node text NULL;

-- Add index for graph queries
CREATE INDEX IF NOT EXISTS idx_scenarios_scene_graph ON scenarios USING gin (scene_graph);

-- Add comment
COMMENT ON COLUMN scenarios.scene_graph IS 'Scenario graph with nodes, edges, and guards';
COMMENT ON COLUMN scenarios.entry_node IS 'Entry node ID for the scenario graph';

