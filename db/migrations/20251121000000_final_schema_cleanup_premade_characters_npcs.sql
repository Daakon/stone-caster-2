-- =========================================================
-- FINAL SCHEMA CLEANUP: PREMADE CHARACTERS & NPCS
-- =========================================================
-- Phase 4: Remove world_id_mapping dependency
-- Updates premade_characters and npcs to use UUID world_id directly

BEGIN;

-- =========================================================
-- 1. DROP AND RECREATE premade_characters
--    PK is UUID. FK `world_slug` is removed/replaced by `world_id` (UUID).
-- =========================================================

DROP TABLE IF EXISTS public.premade_characters CASCADE;

CREATE TABLE public.premade_characters (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    CONSTRAINT pk_premade_characters PRIMARY KEY (id),

    world_id uuid REFERENCES public.chimera_worlds(id) ON DELETE CASCADE, -- Canonical FK
    archetype_key character varying NOT NULL, 
    CONSTRAINT uq_premade_characters_world_id_archetype_key UNIQUE (world_id, archetype_key),

    display_name character varying NOT NULL,
    summary text NOT NULL,
    base_traits jsonb NOT NULL DEFAULT '{}'::jsonb,
    is_active boolean NOT NULL DEFAULT true,
    avatar_url text,
    
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_premade_characters_world_id 
  ON public.premade_characters(world_id);
CREATE INDEX IF NOT EXISTS idx_premade_characters_is_active 
  ON public.premade_characters(is_active);
CREATE INDEX IF NOT EXISTS idx_premade_characters_archetype_key 
  ON public.premade_characters(archetype_key);

-- Add comments
COMMENT ON TABLE public.premade_characters IS 
  'Premade character templates for quick character creation';
COMMENT ON COLUMN public.premade_characters.world_id IS 
  'UUID reference to chimera_worlds.id (canonical world table)';
COMMENT ON COLUMN public.premade_characters.archetype_key IS 
  'Unique archetype identifier within a world (e.g., "warrior", "mage")';

-- =========================================================
-- 2. UPDATE npcs table
--    FK `world_id` is converted from TEXT/Slug to UUID.
-- =========================================================

-- Drop existing foreign key constraint if it exists (may reference old worlds table)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'npcs_world_id_fkey' 
    AND table_name = 'npcs'
  ) THEN
    ALTER TABLE public.npcs DROP CONSTRAINT npcs_world_id_fkey;
  END IF;
END $$;

-- Change world_id column type from text to uuid
-- Note: This will fail if there are existing non-UUID values
-- You may need to migrate data first if there are existing rows
ALTER TABLE public.npcs 
  ALTER COLUMN world_id TYPE uuid USING world_id::uuid;

-- Add foreign key constraint to chimera_worlds
ALTER TABLE public.npcs 
  ADD CONSTRAINT npcs_world_id_fkey 
  FOREIGN KEY (world_id) REFERENCES public.chimera_worlds(id) ON DELETE RESTRICT;

-- Update index if it exists (recreate for UUID type)
DROP INDEX IF EXISTS idx_npcs_world;
CREATE INDEX IF NOT EXISTS idx_npcs_world_id 
  ON public.npcs(world_id);

-- Update comment
COMMENT ON COLUMN public.npcs.world_id IS 
  'UUID reference to chimera_worlds.id (canonical world table)';

COMMIT;


