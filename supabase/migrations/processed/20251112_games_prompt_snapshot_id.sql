-- Phase 5: Add prompt_snapshot_id to games table
-- Links games to frozen prompt snapshots for stability

BEGIN;

-- Add prompt_snapshot_id column to games table
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS prompt_snapshot_id uuid NULL
  REFERENCES public.prompt_snapshots(id) ON DELETE SET NULL;

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_games_prompt_snapshot_id 
  ON public.games(prompt_snapshot_id)
  WHERE prompt_snapshot_id IS NOT NULL;

COMMENT ON COLUMN public.games.prompt_snapshot_id IS 'References prompt_snapshots.id. When set, game uses frozen prompt configuration from snapshot instead of live entity data. Ensures game stability even if source entities change.';

COMMIT;


