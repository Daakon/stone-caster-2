-- AWF Bundle Migration Phase 1: Rollback Migration
-- Drops all AWF-related tables in reverse order

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS game_states CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS injection_map CASCADE;
DROP TABLE IF EXISTS adventure_starts CASCADE;
DROP TABLE IF EXISTS adventures CASCADE;
DROP TABLE IF EXISTS worlds CASCADE;
DROP TABLE IF EXISTS core_contracts CASCADE;

-- Drop custom functions
DROP FUNCTION IF EXISTS update_core_contracts_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_worlds_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_adventures_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_adventure_starts_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_sessions_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_game_states_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_injection_map_updated_at() CASCADE;


