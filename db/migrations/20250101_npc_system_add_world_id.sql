-- Add world_id column to existing NPCs table
-- This migration bridges the gap between create-admin-tables.sql and 20250101_npc_system.sql

-- ============================================================================
-- ADD MISSING COLUMNS TO EXISTING NPCS TABLE
-- ============================================================================

-- Add world_id column (nullable for now, since existing NPCs don't have it)
ALTER TABLE public.npcs 
  ADD COLUMN IF NOT EXISTS world_id text;

-- Add other columns from NPC system migration if they don't exist
ALTER TABLE public.npcs 
  ADD COLUMN IF NOT EXISTS archetype text,
  ADD COLUMN IF NOT EXISTS role_tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS portrait_url text,
  ADD COLUMN IF NOT EXISTS doc jsonb DEFAULT '{}';

-- Add foreign key constraint on world_id (only if worlds table exists)
-- Note: This will fail if worlds table doesn't exist yet
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'worlds') THEN
    -- Add foreign key constraint if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'npcs_world_id_fkey' 
      AND table_name = 'npcs'
    ) THEN
      ALTER TABLE public.npcs 
        ADD CONSTRAINT npcs_world_id_fkey 
        FOREIGN KEY (world_id) REFERENCES worlds(id) ON DELETE RESTRICT;
    END IF;
  END IF;
END $$;

-- Add index for world-based queries
CREATE INDEX IF NOT EXISTS idx_npcs_world ON public.npcs(world_id);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN public.npcs.world_id IS 'World this NPC belongs to (nullable for backward compatibility)';
COMMENT ON COLUMN public.npcs.archetype IS 'NPC archetype (e.g., Warden, Scholar, Warrior)';
COMMENT ON COLUMN public.npcs.role_tags IS 'Array of role tags (e.g., companion, guide, merchant)';
COMMENT ON COLUMN public.npcs.portrait_url IS 'Optional portrait image URL';
COMMENT ON COLUMN public.npcs.doc IS 'Additional NPC metadata and characteristics';

