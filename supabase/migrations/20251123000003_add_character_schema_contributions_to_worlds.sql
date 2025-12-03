-- Fix chimera_worlds table schema - Add all missing columns required by API
-- This migration adds: name, slug, description_short, description_long, visibility, character_schema_contributions
-- Also ensures owner_user_id exists (may have been added in previous migration)

BEGIN;

-- Create enum type for world visibility if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'chimera_world_visibility'
  ) THEN
    CREATE TYPE public.chimera_world_visibility AS ENUM ('private', 'pending_approval', 'public');
    RAISE NOTICE 'Created chimera_world_visibility enum type';
  ELSE
    RAISE NOTICE 'chimera_world_visibility enum type already exists';
  END IF;
END $$;

-- Add all missing columns
DO $$
BEGIN
  -- Add name column (maps to display_name in API)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'chimera_worlds' AND column_name = 'name'
  ) THEN
    ALTER TABLE public.chimera_worlds ADD COLUMN name TEXT;
    -- Backfill from key if key exists and name is null
    UPDATE public.chimera_worlds SET name = key WHERE name IS NULL AND key IS NOT NULL;
    -- Make it NOT NULL after backfill
    ALTER TABLE public.chimera_worlds ALTER COLUMN name SET NOT NULL;
    RAISE NOTICE 'Added name column to chimera_worlds';
  END IF;

  -- Add slug column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'chimera_worlds' AND column_name = 'slug'
  ) THEN
    ALTER TABLE public.chimera_worlds ADD COLUMN slug TEXT;
    -- Generate slug from name/key for existing rows
    UPDATE public.chimera_worlds 
    SET slug = LOWER(REGEXP_REPLACE(COALESCE(name, key), '[^a-z0-9]+', '-', 'g'))
    WHERE slug IS NULL;
    -- Make it NOT NULL after backfill
    ALTER TABLE public.chimera_worlds ALTER COLUMN slug SET NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_chimera_worlds_slug ON public.chimera_worlds(slug);
    RAISE NOTICE 'Added slug column to chimera_worlds';
  END IF;

  -- Add description_short column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'chimera_worlds' AND column_name = 'description_short'
  ) THEN
    ALTER TABLE public.chimera_worlds ADD COLUMN description_short TEXT;
    RAISE NOTICE 'Added description_short column to chimera_worlds';
  END IF;

  -- Add description_long column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'chimera_worlds' AND column_name = 'description_long'
  ) THEN
    ALTER TABLE public.chimera_worlds ADD COLUMN description_long TEXT;
    RAISE NOTICE 'Added description_long column to chimera_worlds';
  END IF;

  -- Add visibility column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'chimera_worlds' AND column_name = 'visibility'
  ) THEN
    ALTER TABLE public.chimera_worlds 
      ADD COLUMN visibility public.chimera_world_visibility NOT NULL DEFAULT 'private';
    CREATE INDEX IF NOT EXISTS idx_chimera_worlds_visibility ON public.chimera_worlds(visibility);
    RAISE NOTICE 'Added visibility column to chimera_worlds';
  END IF;

  -- Add character_schema_contributions column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'chimera_worlds' AND column_name = 'character_schema_contributions'
  ) THEN
    ALTER TABLE public.chimera_worlds
      ADD COLUMN character_schema_contributions jsonb NOT NULL DEFAULT '{}'::jsonb;
    COMMENT ON COLUMN public.chimera_worlds.character_schema_contributions IS 
      'JSON schema definitions (e.g., { "essence_alignment": { ... } }) that the World contributes to character creation';
    CREATE INDEX IF NOT EXISTS idx_chimera_worlds_character_schema_contributions 
      ON public.chimera_worlds USING gin (character_schema_contributions);
    RAISE NOTICE 'Added character_schema_contributions column to chimera_worlds';
  END IF;

  -- Ensure owner_user_id exists (may have been added in previous migration)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'chimera_worlds' AND column_name = 'owner_user_id'
  ) THEN
    -- Check if owner_id exists and migrate data
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'chimera_worlds' AND column_name = 'owner_id'
    ) THEN
      ALTER TABLE public.chimera_worlds ADD COLUMN owner_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
      UPDATE public.chimera_worlds SET owner_user_id = owner_id WHERE owner_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_chimera_worlds_owner_user_id ON public.chimera_worlds(owner_user_id);
      RAISE NOTICE 'Added owner_user_id column to chimera_worlds (migrated from owner_id)';
    ELSE
      ALTER TABLE public.chimera_worlds 
        ADD COLUMN owner_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
      CREATE INDEX IF NOT EXISTS idx_chimera_worlds_owner_user_id ON public.chimera_worlds(owner_user_id);
      RAISE NOTICE 'Added owner_user_id column to chimera_worlds';
    END IF;
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN public.chimera_worlds.name IS 'Display name for the world (maps to display_name in API)';
COMMENT ON COLUMN public.chimera_worlds.slug IS 'URL-friendly slug generated from name';
COMMENT ON COLUMN public.chimera_worlds.description_short IS 'Short description (max 500 chars)';
COMMENT ON COLUMN public.chimera_worlds.description_long IS 'Long description';
COMMENT ON COLUMN public.chimera_worlds.visibility IS 'Visibility level: private, pending_approval, or public';

COMMIT;

