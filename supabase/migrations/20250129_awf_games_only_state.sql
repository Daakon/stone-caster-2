-- Phase 1: Core vs Rulesets Framework Split - Games-Only State
-- Migration: 20250129_awf_games_only_state.sql
-- Consolidate all runtime state into games.state_snapshot.meta

-- 1) Ensure games has state_snapshot JSONB
ALTER TABLE IF EXISTS public.games
  ADD COLUMN IF NOT EXISTS state_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 2) Sessions table is optional. If it exists, strip state-like columns; keep ephemeral fields only.
-- Add ephemeral fields to sessions if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='sessions') THEN
    -- Add ephemeral fields
    ALTER TABLE public.sessions
      ADD COLUMN IF NOT EXISTS game_id UUID,
      ADD COLUMN IF NOT EXISTS ruleset_ref TEXT,
      ADD COLUMN IF NOT EXISTS locale TEXT,
      ADD COLUMN IF NOT EXISTS turn_id INT4 DEFAULT 1,
      ADD COLUMN IF NOT EXISTS is_first_turn BOOLEAN DEFAULT true;
    
    -- Remove state columns that duplicate game snapshot
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sessions' AND column_name='world_ref') THEN
      ALTER TABLE public.sessions DROP COLUMN world_ref;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sessions' AND column_name='adventure_ref') THEN
      ALTER TABLE public.sessions DROP COLUMN adventure_ref;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sessions' AND column_name='player_id') THEN
      ALTER TABLE public.sessions DROP COLUMN player_id;
    END IF;
    
    -- Enforce FK to games if sessions table exists
    ALTER TABLE public.sessions
      DROP CONSTRAINT IF EXISTS sessions_game_id_fkey;
    ALTER TABLE public.sessions
      ADD CONSTRAINT sessions_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 3) Seed a minimal valid state snapshot (dev only)
-- Creates a dummy game row if none exists with proper state_snapshot.meta
INSERT INTO public.games (id, state_snapshot, user_id, cookie_group_id, world_slug, status)
SELECT 
  gen_random_uuid(),
  jsonb_build_object(
    'meta', jsonb_build_object(
      'world_ref', 'world.mystika@1.0.0',
      'adventure_ref', 'adv.whispercross@1.0.0',
      'scenario_ref', 'scenario.inn_last_ember@1.0.0',
      'ruleset_ref', 'ruleset.core.default@1.0.0',
      'locale', 'en-US'
    ),
    'hot', jsonb_build_object(),
    'warm', jsonb_build_object(),
    'cold', jsonb_build_object()
  ),
  NULL, -- user_id (guest game)
  (SELECT id FROM cookie_groups LIMIT 1), -- Use first cookie group
  'mystika',
  'active'
WHERE NOT EXISTS (SELECT 1 FROM public.games);

-- Add comments
COMMENT ON COLUMN games.state_snapshot IS 'Complete game state including meta (world_ref, adventure_ref, ruleset_ref, locale) and hot/warm/cold state';
COMMENT ON COLUMN sessions.game_id IS 'Reference to the game this session belongs to (if sessions table exists)';
COMMENT ON COLUMN sessions.ruleset_ref IS 'Optional ruleset override for this session';
COMMENT ON COLUMN sessions.locale IS 'Optional locale override for this session';






