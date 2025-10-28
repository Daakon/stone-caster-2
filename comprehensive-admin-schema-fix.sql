-- Comprehensive Admin Schema Fix
-- This script fixes all the schema mismatches found in the admin system

BEGIN;

-- ============================================================================
-- CHECK CURRENT SCHEMAS
-- ============================================================================

-- Check what columns exist in each table
DO $$
DECLARE
    tbl_name text;
    column_info record;
BEGIN
    FOR tbl_name IN SELECT unnest(ARRAY['npcs', 'rulesets', 'entries', 'entry_points', 'npc_packs']) LOOP
        RAISE NOTICE '=== % TABLE SCHEMA ===', tbl_name;
        
        FOR column_info IN 
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = tbl_name AND table_schema = 'public'
            ORDER BY ordinal_position
        LOOP
            RAISE NOTICE 'Column: % | Type: % | Nullable: % | Default: %', 
                column_info.column_name, 
                column_info.data_type, 
                column_info.is_nullable, 
                column_info.column_default;
        END LOOP;
        
        RAISE NOTICE '';
    END LOOP;
END $$;

-- ============================================================================
-- ADD MISSING COLUMNS TO NPCS TABLE
-- ============================================================================

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
    RAISE NOTICE 'Added slug column to npcs table';
  ELSE
    RAISE NOTICE 'Slug column already exists in npcs table';
  END IF;
END $$;

-- Add prompt column to npcs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'npcs' 
    AND table_schema = 'public' 
    AND column_name = 'prompt'
  ) THEN
    ALTER TABLE public.npcs ADD COLUMN prompt jsonb DEFAULT '{}';
    CREATE INDEX IF NOT EXISTS npcs_prompt_gin_idx ON public.npcs USING gin (prompt);
    RAISE NOTICE 'Added prompt column to npcs table';
  ELSE
    RAISE NOTICE 'Prompt column already exists in npcs table';
  END IF;
END $$;

-- ============================================================================
-- ADD MISSING COLUMNS TO RULESETS TABLE
-- ============================================================================

-- Add slug column to rulesets table (if it doesn't exist)
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
      RAISE NOTICE 'Added slug column to rulesets table';
    ELSE
      RAISE NOTICE 'Slug column already exists in rulesets table';
    END IF;
  ELSE
    RAISE NOTICE 'Rulesets table does not exist';
  END IF;
END $$;

-- Add prompt column to rulesets table (if it doesn't exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rulesets' AND table_schema = 'public') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'rulesets' 
      AND table_schema = 'public' 
      AND column_name = 'prompt'
    ) THEN
      ALTER TABLE public.rulesets ADD COLUMN prompt jsonb DEFAULT '{}';
      CREATE INDEX IF NOT EXISTS rulesets_prompt_gin_idx ON public.rulesets USING gin (prompt);
      RAISE NOTICE 'Added prompt column to rulesets table';
    ELSE
      RAISE NOTICE 'Prompt column already exists in rulesets table';
    END IF;
  ELSE
    RAISE NOTICE 'Rulesets table does not exist';
  END IF;
END $$;

-- ============================================================================
-- ADD MISSING COLUMNS TO OTHER ADMIN TABLES
-- ============================================================================

-- Add slug and prompt columns to entries table (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'entries' AND table_schema = 'public') THEN
    -- Add slug column
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'entries' 
      AND table_schema = 'public' 
      AND column_name = 'slug'
    ) THEN
      ALTER TABLE public.entries ADD COLUMN slug text;
      CREATE UNIQUE INDEX IF NOT EXISTS entries_slug_uq ON public.entries(slug);
      RAISE NOTICE 'Added slug column to entries table';
    END IF;
    
    -- Add prompt column
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'entries' 
      AND table_schema = 'public' 
      AND column_name = 'prompt'
    ) THEN
      ALTER TABLE public.entries ADD COLUMN prompt jsonb DEFAULT '{}';
      CREATE INDEX IF NOT EXISTS entries_prompt_gin_idx ON public.entries USING gin (prompt);
      RAISE NOTICE 'Added prompt column to entries table';
    END IF;
  ELSE
    RAISE NOTICE 'Entries table does not exist';
  END IF;
END $$;

-- Add slug and prompt columns to entry_points table (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'entry_points' AND table_schema = 'public') THEN
    -- Add slug column
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'entry_points' 
      AND table_schema = 'public' 
      AND column_name = 'slug'
    ) THEN
      ALTER TABLE public.entry_points ADD COLUMN slug text;
      CREATE UNIQUE INDEX IF NOT EXISTS entry_points_slug_uq ON public.entry_points(slug);
      RAISE NOTICE 'Added slug column to entry_points table';
    END IF;
    
    -- Add prompt column
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'entry_points' 
      AND table_schema = 'public' 
      AND column_name = 'prompt'
    ) THEN
      ALTER TABLE public.entry_points ADD COLUMN prompt jsonb DEFAULT '{}';
      CREATE INDEX IF NOT EXISTS entry_points_prompt_gin_idx ON public.entry_points USING gin (prompt);
      RAISE NOTICE 'Added prompt column to entry_points table';
    END IF;
  ELSE
    RAISE NOTICE 'Entry_points table does not exist';
  END IF;
END $$;

-- Add slug and prompt columns to npc_packs table (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'npc_packs' AND table_schema = 'public') THEN
    -- Add slug column
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'npc_packs' 
      AND table_schema = 'public' 
      AND column_name = 'slug'
    ) THEN
      ALTER TABLE public.npc_packs ADD COLUMN slug text;
      CREATE UNIQUE INDEX IF NOT EXISTS npc_packs_slug_uq ON public.npc_packs(slug);
      RAISE NOTICE 'Added slug column to npc_packs table';
    END IF;
    
    -- Add prompt column
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'npc_packs' 
      AND table_schema = 'public' 
      AND column_name = 'prompt'
    ) THEN
      ALTER TABLE public.npc_packs ADD COLUMN prompt jsonb DEFAULT '{}';
      CREATE INDEX IF NOT EXISTS npc_packs_prompt_gin_idx ON public.npc_packs USING gin (prompt);
      RAISE NOTICE 'Added prompt column to npc_packs table';
    END IF;
  ELSE
    RAISE NOTICE 'Npc_packs table does not exist';
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

-- ============================================================================
-- VERIFY THE CHANGES
-- ============================================================================

-- Show final schema for all admin tables
DO $$
DECLARE
    tbl_name text;
    column_info record;
BEGIN
    RAISE NOTICE '=== FINAL SCHEMA VERIFICATION ===';
    
    FOR tbl_name IN SELECT unnest(ARRAY['npcs', 'rulesets', 'entries', 'entry_points', 'npc_packs']) LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tbl_name AND table_schema = 'public') THEN
            RAISE NOTICE '=== % TABLE FINAL SCHEMA ===', tbl_name;
            
            FOR column_info IN 
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns 
                WHERE table_name = tbl_name AND table_schema = 'public'
                ORDER BY ordinal_position
            LOOP
                RAISE NOTICE 'Column: % | Type: % | Nullable: % | Default: %', 
                    column_info.column_name, 
                    column_info.data_type, 
                    column_info.is_nullable, 
                    column_info.column_default;
            END LOOP;
            
            RAISE NOTICE '';
        END IF;
    END LOOP;
END $$;

COMMIT;

-- ============================================================================
-- SUMMARY
-- ============================================================================

SELECT 
  'Schema fix completed successfully!' as status,
  'All admin tables now have slug and prompt columns' as message;
