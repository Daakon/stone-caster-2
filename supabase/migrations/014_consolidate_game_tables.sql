-- Consolidate game-related tables
-- Remove redundant game_states and game_saves tables
-- Keep only the main games table with proper state management

-- Drop redundant tables
DROP TABLE IF EXISTS game_states CASCADE;
DROP TABLE IF EXISTS game_saves CASCADE;

-- The games table already has state_snapshot JSONB column which is sufficient
-- for storing game state. No need for separate tables.

-- Add comments to clarify the games table structure
COMMENT ON TABLE games IS 'Main games table - stores all game data including state in state_snapshot JSONB column';
COMMENT ON COLUMN games.state_snapshot IS 'Complete game state stored as JSONB - includes character data, world state, flags, etc.';
COMMENT ON COLUMN games.character_id IS 'Character playing this game - links to characters table';
COMMENT ON COLUMN games.user_id IS 'Authenticated user owner';
COMMENT ON COLUMN games.cookie_group_id IS 'Guest cookie group owner';















