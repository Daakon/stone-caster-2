-- Fix missing columns for admin tables
-- This script adds the missing slug and prompt columns to all admin tables

BEGIN;

-- Add slug column to npcs table (if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'npcs' 
    AND table_schema = 'public' 
    AND column_name = 'slug'
  ) THEN
    ALTER TABLE public.npcs ADD COLUMN slug text;
    CREATE UNIQUE INDEX IF NOT EXISTS npcs_slug_uq ON public.npcs(slug);
  END IF;
END $$;

-- Add prompt column to npcs table
ALTER TABLE public.npcs 
ADD COLUMN IF NOT EXISTS prompt jsonb DEFAULT '{}';

-- Add slug column to rulesets table (if it exists and doesn't have slug)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rulesets' AND table_schema = 'public') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'rulesets' 
      AND table_schema = 'public' 
      AND column_name = 'slug'
    ) THEN
      ALTER TABLE public.rulesets ADD COLUMN slug text;
      CREATE UNIQUE INDEX IF NOT EXISTS rulesets_slug_uq ON public.rulesets(slug);
    END IF;
  END IF;
END $$;

-- Add slug column to entries table (if it exists and doesn't have slug)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'entries' AND table_schema = 'public') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'entries' 
      AND table_schema = 'public' 
      AND column_name = 'slug'
    ) THEN
      ALTER TABLE public.entries ADD COLUMN slug text;
      CREATE UNIQUE INDEX IF NOT EXISTS entries_slug_uq ON public.entries(slug);
    END IF;
  END IF;
END $$;

-- Add slug column to entry_points table (if it exists and doesn't have slug)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'entry_points' AND table_schema = 'public') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'entry_points' 
      AND table_schema = 'public' 
      AND column_name = 'slug'
    ) THEN
      ALTER TABLE public.entry_points ADD COLUMN slug text;
      CREATE UNIQUE INDEX IF NOT EXISTS entry_points_slug_uq ON public.entry_points(slug);
    END IF;
  END IF;
END $$;

-- Add slug column to npc_packs table (if it exists and doesn't have slug)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'npc_packs' AND table_schema = 'public') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'npc_packs' 
      AND table_schema = 'public' 
      AND column_name = 'slug'
    ) THEN
      ALTER TABLE public.npc_packs ADD COLUMN slug text;
      CREATE UNIQUE INDEX IF NOT EXISTS npc_packs_slug_uq ON public.npc_packs(slug);
    END IF;
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

-- Add prompt column to npc_packs table (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'npc_packs' AND table_schema = 'public') THEN
    ALTER TABLE public.npc_packs 
    ADD COLUMN IF NOT EXISTS prompt jsonb DEFAULT '{}';
  END IF;
END $$;

-- Add indexes for better performance on JSONB columns
CREATE INDEX IF NOT EXISTS npcs_prompt_gin_idx ON public.npcs USING gin (prompt);

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

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'npc_packs' AND table_schema = 'public') THEN
    CREATE INDEX IF NOT EXISTS npc_packs_prompt_gin_idx ON public.npc_packs USING gin (prompt);
  END IF;
END $$;

-- Add comments to document the new columns
COMMENT ON COLUMN public.npcs.prompt IS 'JSONB field for storing NPC prompt data and AI instructions';

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

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'npc_packs' AND table_schema = 'public') THEN
    COMMENT ON COLUMN public.npc_packs.prompt IS 'JSONB field for storing NPC pack prompt data and AI instructions';
  END IF;
END $$;

-- Verify the columns were added
SELECT 
  table_name,
  column_name, 
  data_type, 
  is_nullable, 
  column_default 
FROM information_schema.columns 
WHERE table_name IN ('npcs', 'rulesets', 'entries', 'entry_points', 'npc_packs')
  AND table_schema = 'public'
  AND column_name = 'prompt'
ORDER BY table_name, ordinal_position;

COMMIT;
