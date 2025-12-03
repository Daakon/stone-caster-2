-- Add description_long column to chimera_entity_templates
-- This migration adds the missing description_long column that should exist alongside description_short

BEGIN;

-- Check if table exists, if not create it with both description columns
DO $$
BEGIN
  -- Check if chimera_entity_templates table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'chimera_entity_templates'
  ) THEN
    -- Create enum type for entity type if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_type WHERE typname = 'chimera_entity_type'
    ) THEN
      CREATE TYPE public.chimera_entity_type AS ENUM ('NPC', 'ITEM', 'FACTION');
    END IF;

    -- Create enum type for visibility if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_type WHERE typname = 'chimera_world_visibility'
    ) THEN
      CREATE TYPE public.chimera_world_visibility AS ENUM ('private', 'pending_approval', 'public');
    END IF;

    -- Create table with both description columns
    CREATE TABLE public.chimera_entity_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      visibility public.chimera_world_visibility NOT NULL DEFAULT 'private',
      display_name TEXT NOT NULL,
      description_short TEXT,
      description_long TEXT,
      entity_type public.chimera_entity_type NOT NULL,
      base_state_json JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uk_chimera_entity_templates_owner_user_id_display_name UNIQUE (owner_user_id, display_name)
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_chimera_entity_templates_owner_user_id 
      ON public.chimera_entity_templates(owner_user_id);
    CREATE INDEX IF NOT EXISTS idx_chimera_entity_templates_visibility 
      ON public.chimera_entity_templates(visibility);
    CREATE INDEX IF NOT EXISTS idx_chimera_entity_templates_entity_type 
      ON public.chimera_entity_templates(entity_type);

    RAISE NOTICE 'Created chimera_entity_templates table with description_short and description_long columns';
  ELSE
    -- Table exists, add description_long if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'chimera_entity_templates' 
      AND column_name = 'description_long'
    ) THEN
      ALTER TABLE public.chimera_entity_templates
        ADD COLUMN description_long TEXT;
      
      RAISE NOTICE 'Added description_long column to chimera_entity_templates';
    ELSE
      RAISE NOTICE 'description_long column already exists in chimera_entity_templates';
    END IF;

    -- Also ensure description_short exists (in case it's missing)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'chimera_entity_templates' 
      AND column_name = 'description_short'
    ) THEN
      ALTER TABLE public.chimera_entity_templates
        ADD COLUMN description_short TEXT;
      
      RAISE NOTICE 'Added description_short column to chimera_entity_templates';
    END IF;
  END IF;
END $$;

-- Add comments
COMMENT ON COLUMN public.chimera_entity_templates.description_short IS 
  'Short description of the entity (max 500 chars)';
COMMENT ON COLUMN public.chimera_entity_templates.description_long IS 
  'Long description of the entity (unlimited text)';

COMMIT;

