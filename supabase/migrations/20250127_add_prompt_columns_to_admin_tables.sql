-- Add prompt columns to admin tables for JSONB support
-- This migration adds prompt columns to npcs, rulesets, entries, and other admin tables

BEGIN;

-- Add prompt column to npcs table
ALTER TABLE public.npcs 
ADD COLUMN IF NOT EXISTS prompt jsonb DEFAULT '{}';

-- Add prompt column to rulesets table (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rulesets' AND table_schema = 'public') THEN
    ALTER TABLE public.rulesets 
    ADD COLUMN IF NOT EXISTS prompt jsonb DEFAULT '{}';
  END IF;
END $$;

-- Add prompt column to entries table (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'entries' AND table_schema = 'public') THEN
    ALTER TABLE public.entries 
    ADD COLUMN IF NOT EXISTS prompt jsonb DEFAULT '{}';
  END IF;
END $$;

-- Add prompt column to entry_points table (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'entry_points' AND table_schema = 'public') THEN
    ALTER TABLE public.entry_points 
    ADD COLUMN IF NOT EXISTS prompt jsonb DEFAULT '{}';
  END IF;
END $$;

-- Add prompt column to npc_packs table
ALTER TABLE public.npc_packs 
ADD COLUMN IF NOT EXISTS prompt jsonb DEFAULT '{}';

-- Add indexes for better performance on JSONB columns
CREATE INDEX IF NOT EXISTS npcs_prompt_gin_idx ON public.npcs USING gin (prompt);
CREATE INDEX IF NOT EXISTS npc_packs_prompt_gin_idx ON public.npc_packs USING gin (prompt);

-- Add indexes for other tables if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rulesets' AND table_schema = 'public') THEN
    CREATE INDEX IF NOT EXISTS rulesets_prompt_gin_idx ON public.rulesets USING gin (prompt);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'entries' AND table_schema = 'public') THEN
    CREATE INDEX IF NOT EXISTS entries_prompt_gin_idx ON public.entries USING gin (prompt);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'entry_points' AND table_schema = 'public') THEN
    CREATE INDEX IF NOT EXISTS entry_points_prompt_gin_idx ON public.entry_points USING gin (prompt);
  END IF;
END $$;

-- Add comments to document the new columns
COMMENT ON COLUMN public.npcs.prompt IS 'JSONB field for storing NPC prompt data and AI instructions';
COMMENT ON COLUMN public.npc_packs.prompt IS 'JSONB field for storing NPC pack prompt data and AI instructions';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rulesets' AND table_schema = 'public') THEN
    COMMENT ON COLUMN public.rulesets.prompt IS 'JSONB field for storing ruleset prompt data and AI instructions';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'entries' AND table_schema = 'public') THEN
    COMMENT ON COLUMN public.entries.prompt IS 'JSONB field for storing entry prompt data and AI instructions';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'entry_points' AND table_schema = 'public') THEN
    COMMENT ON COLUMN public.entry_points.prompt IS 'JSONB field for storing entry point prompt data and AI instructions';
  END IF;
END $$;

COMMIT;
