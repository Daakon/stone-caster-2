-- Phase 4.8: Final Legacy Table Purge
-- Drops all legacy tables that are no longer used by active code
-- Generated: 2025-12-05

-- The Final Purge: Drop legacy tables

-- Legacy Content Tables
DROP TABLE IF EXISTS public.worlds CASCADE;
DROP TABLE IF EXISTS public.npcs CASCADE;
DROP TABLE IF EXISTS public.rulesets CASCADE;
DROP TABLE IF EXISTS public.scenarios CASCADE;

-- Legacy Game System Tables
DROP TABLE IF EXISTS public.characters CASCADE;
DROP TABLE IF EXISTS public.games CASCADE;
DROP TABLE IF EXISTS public.sessions CASCADE;
DROP TABLE IF EXISTS public.turns CASCADE;

-- Legacy Entry Point Tables
DROP TABLE IF EXISTS public.entry_points CASCADE;
DROP TABLE IF EXISTS public.entry_point_rulesets CASCADE;

-- Legacy Module/Story Tables
DROP TABLE IF EXISTS public.story_modules CASCADE;
DROP TABLE IF EXISTS public.world_id_mapping CASCADE;

-- Legacy Template/Prompt Tables
DROP TABLE IF EXISTS public.templates CASCADE;
DROP TABLE IF EXISTS public.prompt_snapshots CASCADE;
DROP TABLE IF EXISTS public.prompt_world_templates CASCADE;
DROP TABLE IF EXISTS public.prompt_combinations CASCADE;
DROP TABLE IF EXISTS public.prompt_core_engine CASCADE;

-- Drop schemas if empty (after tables are dropped)
DROP SCHEMA IF EXISTS prompting CASCADE;

-- Note: The following tables are kept for now (may be used by test/debug routes):
-- - modules (used by actions/boot.ts, but handled gracefully if missing)
-- - These will be removed in a future phase if not needed
