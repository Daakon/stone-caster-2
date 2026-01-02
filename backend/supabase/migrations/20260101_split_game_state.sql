-- Migration: 20260101_split_game_state
-- Description: Refactors chimera_game_states to support Adaptive State Engine

-- Drop the monolithic state if it exists
ALTER TABLE chimera_game_states
  DROP COLUMN IF EXISTS state;

-- Add segmented columns
ALTER TABLE chimera_game_states
  ADD COLUMN IF NOT EXISTS mechanical_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS narrative_focus JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS scene_registry JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS action_queue JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Add documentation comments
COMMENT ON COLUMN chimera_game_states.mechanical_state IS 'Stores deterministic data (Stats, Entities, Indexes)';
COMMENT ON COLUMN chimera_game_states.narrative_focus IS 'Stores context for the LLM (Descriptions, History)';
COMMENT ON COLUMN chimera_game_states.scene_registry IS 'Stores background simulation state (Node status, NPC locations)';
COMMENT ON COLUMN chimera_game_states.action_queue IS 'Stores pending deterministic events';
