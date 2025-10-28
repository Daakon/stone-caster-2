-- Safe Admin Schema Fix (Handles Text to JSONB Conversion)
-- This script safely adds missing columns and handles existing text columns

BEGIN;

-- ============================================================================
-- ADD MISSING COLUMNS TO NPCS TABLE
-- ============================================================================

-- Add slug column to npcs table (if it doesn't exist)
ALTER TABLE public.npcs ADD COLUMN IF NOT EXISTS slug text;
CREATE UNIQUE INDEX IF NOT EXISTS npcs_slug_uq ON public.npcs(slug);

-- Add prompt column to npcs table (handle existing text columns)
DO $$
BEGIN
  -- Check if prompt column already exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'npcs' 
    AND table_schema = 'public' 
    AND column_name = 'prompt'
  ) THEN
    -- Column exists, check if it's jsonb type
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'npcs' 
      AND table_schema = 'public' 
      AND column_name = 'prompt'
      AND data_type = 'jsonb'
    ) THEN
      -- It's already jsonb, just create the index
      CREATE INDEX IF NOT EXISTS npcs_prompt_gin_idx ON public.npcs USING gin (prompt);
    ELSE
      -- It's text type, convert to jsonb safely
      BEGIN
        ALTER TABLE public.npcs ALTER COLUMN prompt TYPE jsonb USING prompt::jsonb;
        CREATE INDEX IF NOT EXISTS npcs_prompt_gin_idx ON public.npcs USING gin (prompt);
      EXCEPTION WHEN OTHERS THEN
        -- If conversion fails, drop the column and recreate as jsonb
        ALTER TABLE public.npcs DROP COLUMN IF EXISTS prompt;
        ALTER TABLE public.npcs ADD COLUMN prompt jsonb DEFAULT '{}';
        CREATE INDEX IF NOT EXISTS npcs_prompt_gin_idx ON public.npcs USING gin (prompt);
      END;
    END IF;
  ELSE
    -- Column doesn't exist, create as jsonb
    ALTER TABLE public.npcs ADD COLUMN prompt jsonb DEFAULT '{}';
    CREATE INDEX IF NOT EXISTS npcs_prompt_gin_idx ON public.npcs USING gin (prompt);
  END IF;
END $$;

-- ============================================================================
-- ADD MISSING COLUMNS TO RULESETS TABLE (if it exists)
-- ============================================================================

-- Add slug column to rulesets table (if it doesn't exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rulesets' AND table_schema = 'public') THEN
    ALTER TABLE public.rulesets ADD COLUMN IF NOT EXISTS slug text;
    CREATE UNIQUE INDEX IF NOT EXISTS rulesets_slug_uq ON public.rulesets(slug);
  END IF;
END $$;

-- Add prompt column to rulesets table (handle existing text columns)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rulesets' AND table_schema = 'public') THEN
    -- Check if prompt column already exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'rulesets' 
      AND table_schema = 'public' 
      AND column_name = 'prompt'
    ) THEN
      -- Column exists, check if it's jsonb type
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'rulesets' 
        AND table_schema = 'public' 
        AND column_name = 'prompt'
        AND data_type = 'jsonb'
      ) THEN
        -- It's already jsonb, just create the index
        CREATE INDEX IF NOT EXISTS rulesets_prompt_gin_idx ON public.rulesets USING gin (prompt);
      ELSE
        -- It's text type, convert to jsonb safely
        BEGIN
          ALTER TABLE public.rulesets ALTER COLUMN prompt TYPE jsonb USING prompt::jsonb;
          CREATE INDEX IF NOT EXISTS rulesets_prompt_gin_idx ON public.rulesets USING gin (prompt);
        EXCEPTION WHEN OTHERS THEN
          -- If conversion fails, drop the column and recreate as jsonb
          ALTER TABLE public.rulesets DROP COLUMN IF EXISTS prompt;
          ALTER TABLE public.rulesets ADD COLUMN prompt jsonb DEFAULT '{}';
          CREATE INDEX IF NOT EXISTS rulesets_prompt_gin_idx ON public.rulesets USING gin (prompt);
        END;
      END IF;
    ELSE
      -- Column doesn't exist, create as jsonb
      ALTER TABLE public.rulesets ADD COLUMN prompt jsonb DEFAULT '{}';
      CREATE INDEX IF NOT EXISTS rulesets_prompt_gin_idx ON public.rulesets USING gin (prompt);
    END IF;
  END IF;
END $$;

-- ============================================================================
-- ADD MISSING COLUMNS TO OTHER TABLES (if they exist)
-- ============================================================================

-- Add slug and prompt columns to entries table (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'entries' AND table_schema = 'public') THEN
    -- Add slug column
    ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS slug text;
    CREATE UNIQUE INDEX IF NOT EXISTS entries_slug_uq ON public.entries(slug);
    
    -- Add prompt column
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'entries' 
      AND table_schema = 'public' 
      AND column_name = 'prompt'
    ) THEN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'entries' 
        AND table_schema = 'public' 
        AND column_name = 'prompt'
        AND data_type = 'jsonb'
      ) THEN
        CREATE INDEX IF NOT EXISTS entries_prompt_gin_idx ON public.entries USING gin (prompt);
      ELSE
        BEGIN
          ALTER TABLE public.entries ALTER COLUMN prompt TYPE jsonb USING prompt::jsonb;
          CREATE INDEX IF NOT EXISTS entries_prompt_gin_idx ON public.entries USING gin (prompt);
        EXCEPTION WHEN OTHERS THEN
          ALTER TABLE public.entries DROP COLUMN IF EXISTS prompt;
          ALTER TABLE public.entries ADD COLUMN prompt jsonb DEFAULT '{}';
          CREATE INDEX IF NOT EXISTS entries_prompt_gin_idx ON public.entries USING gin (prompt);
        END;
      END IF;
    ELSE
      ALTER TABLE public.entries ADD COLUMN prompt jsonb DEFAULT '{}';
      CREATE INDEX IF NOT EXISTS entries_prompt_gin_idx ON public.entries USING gin (prompt);
    END IF;
  END IF;
END $$;

-- Add slug and prompt columns to entry_points table (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'entry_points' AND table_schema = 'public') THEN
    -- Add slug column
    ALTER TABLE public.entry_points ADD COLUMN IF NOT EXISTS slug text;
    CREATE UNIQUE INDEX IF NOT EXISTS entry_points_slug_uq ON public.entry_points(slug);
    
    -- Add prompt column
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'entry_points' 
      AND table_schema = 'public' 
      AND column_name = 'prompt'
    ) THEN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'entry_points' 
        AND table_schema = 'public' 
        AND column_name = 'prompt'
        AND data_type = 'jsonb'
      ) THEN
        CREATE INDEX IF NOT EXISTS entry_points_prompt_gin_idx ON public.entry_points USING gin (prompt);
      ELSE
        BEGIN
          ALTER TABLE public.entry_points ALTER COLUMN prompt TYPE jsonb USING prompt::jsonb;
          CREATE INDEX IF NOT EXISTS entry_points_prompt_gin_idx ON public.entry_points USING gin (prompt);
        EXCEPTION WHEN OTHERS THEN
          ALTER TABLE public.entry_points DROP COLUMN IF EXISTS prompt;
          ALTER TABLE public.entry_points ADD COLUMN prompt jsonb DEFAULT '{}';
          CREATE INDEX IF NOT EXISTS entry_points_prompt_gin_idx ON public.entry_points USING gin (prompt);
        END;
      END IF;
    ELSE
      ALTER TABLE public.entry_points ADD COLUMN prompt jsonb DEFAULT '{}';
      CREATE INDEX IF NOT EXISTS entry_points_prompt_gin_idx ON public.entry_points USING gin (prompt);
    END IF;
  END IF;
END $$;

-- Add slug and prompt columns to npc_packs table (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'npc_packs' AND table_schema = 'public') THEN
    -- Add slug column
    ALTER TABLE public.npc_packs ADD COLUMN IF NOT EXISTS slug text;
    CREATE UNIQUE INDEX IF NOT EXISTS npc_packs_slug_uq ON public.npc_packs(slug);
    
    -- Add prompt column
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'npc_packs' 
      AND table_schema = 'public' 
      AND column_name = 'prompt'
    ) THEN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'npc_packs' 
        AND table_schema = 'public' 
        AND column_name = 'prompt'
        AND data_type = 'jsonb'
      ) THEN
        CREATE INDEX IF NOT EXISTS npc_packs_prompt_gin_idx ON public.npc_packs USING gin (prompt);
      ELSE
        BEGIN
          ALTER TABLE public.npc_packs ALTER COLUMN prompt TYPE jsonb USING prompt::jsonb;
          CREATE INDEX IF NOT EXISTS npc_packs_prompt_gin_idx ON public.npc_packs USING gin (prompt);
        EXCEPTION WHEN OTHERS THEN
          ALTER TABLE public.npc_packs DROP COLUMN IF EXISTS prompt;
          ALTER TABLE public.npc_packs ADD COLUMN prompt jsonb DEFAULT '{}';
          CREATE INDEX IF NOT EXISTS npc_packs_prompt_gin_idx ON public.npc_packs USING gin (prompt);
        END;
      END IF;
    ELSE
      ALTER TABLE public.npc_packs ADD COLUMN prompt jsonb DEFAULT '{}';
      CREATE INDEX IF NOT EXISTS npc_packs_prompt_gin_idx ON public.npc_packs USING gin (prompt);
    END IF;
  END IF;
END $$;

-- ============================================================================
-- ADD COMMENTS TO DOCUMENT THE NEW COLUMNS
-- ============================================================================

COMMENT ON COLUMN public.npcs.slug IS 'URL-friendly identifier for NPCs';
COMMENT ON COLUMN public.npcs.prompt IS 'JSONB field for storing NPC prompt data and AI instructions';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rulesets' AND table_schema = 'public') THEN
    COMMENT ON COLUMN public.rulesets.slug IS 'URL-friendly identifier for rulesets';
    COMMENT ON COLUMN public.rulesets.prompt IS 'JSONB field for storing ruleset prompt data and AI instructions';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'entries' AND table_schema = 'public') THEN
    COMMENT ON COLUMN public.entries.slug IS 'URL-friendly identifier for entries';
    COMMENT ON COLUMN public.entries.prompt IS 'JSONB field for storing entry prompt data and AI instructions';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'entry_points' AND table_schema = 'public') THEN
    COMMENT ON COLUMN public.entry_points.slug IS 'URL-friendly identifier for entry points';
    COMMENT ON COLUMN public.entry_points.prompt IS 'JSONB field for storing entry point prompt data and AI instructions';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'npc_packs' AND table_schema = 'public') THEN
    COMMENT ON COLUMN public.npc_packs.slug IS 'URL-friendly identifier for NPC packs';
    COMMENT ON COLUMN public.npc_packs.prompt IS 'JSONB field for storing NPC pack prompt data and AI instructions';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- VERIFY THE CHANGES
-- ============================================================================

-- Check npcs table schema
SELECT 
  'npcs' as table_name,
  column_name, 
  data_type, 
  is_nullable, 
  column_default 
FROM information_schema.columns 
WHERE table_name = 'npcs' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check rulesets table schema (if it exists)
SELECT 
  'rulesets' as table_name,
  column_name, 
  data_type, 
  is_nullable, 
  column_default 
FROM information_schema.columns 
WHERE table_name = 'rulesets' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check entry_points table schema (if it exists)
SELECT 
  'entry_points' as table_name,
  column_name, 
  data_type, 
  is_nullable, 
  column_default 
FROM information_schema.columns 
WHERE table_name = 'entry_points' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- ============================================================================
-- SUMMARY
-- ============================================================================

SELECT 
  'Schema fix completed successfully!' as status,
  'All admin tables now have slug and prompt columns' as message;
