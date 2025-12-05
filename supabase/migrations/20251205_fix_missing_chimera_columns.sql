-- Phase 4.9: Fix Missing Chimera Columns
-- Adds missing owner_user_id, visibility, and is_official columns to Chimera tables
-- Generated: 2025-12-05

-- Fix Chimera Lore (Missing Owner and World Reference)
-- Note: chimera_lore uses world_id for scoping, but also needs owner_user_id for direct ownership
ALTER TABLE chimera_lore 
  ADD COLUMN IF NOT EXISTS world_id UUID REFERENCES chimera_worlds(id),
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS is_official boolean DEFAULT false;

-- Ensure Chimera Worlds has Visibility/Official (for Catalog filters)
ALTER TABLE chimera_worlds 
  ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS is_official boolean DEFAULT false;

-- Ensure Chimera Entities has Visibility/Official
ALTER TABLE chimera_entities 
  ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS is_official boolean DEFAULT false;

-- Update Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_lore_world_id ON chimera_lore(world_id);
CREATE INDEX IF NOT EXISTS idx_lore_owner ON chimera_lore(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_lore_visibility ON chimera_lore(visibility);
CREATE INDEX IF NOT EXISTS idx_worlds_visibility ON chimera_worlds(visibility);
CREATE INDEX IF NOT EXISTS idx_worlds_official ON chimera_worlds(is_official);
CREATE INDEX IF NOT EXISTS idx_entities_visibility ON chimera_entities(visibility);
CREATE INDEX IF NOT EXISTS idx_entities_official ON chimera_entities(is_official);

-- Add comments for documentation
COMMENT ON COLUMN chimera_lore.world_id IS 'World this lore fragment belongs to (for scoping)';
COMMENT ON COLUMN chimera_lore.owner_user_id IS 'User who owns this lore fragment (for direct ownership queries)';
COMMENT ON COLUMN chimera_lore.visibility IS 'Visibility level: private, unlisted, public';
COMMENT ON COLUMN chimera_lore.is_official IS 'Whether this is official Stone Caster content';
COMMENT ON COLUMN chimera_worlds.visibility IS 'Visibility level: private, unlisted, public';
COMMENT ON COLUMN chimera_worlds.is_official IS 'Whether this is official Stone Caster content';
COMMENT ON COLUMN chimera_entities.visibility IS 'Visibility level: private, unlisted, public';
COMMENT ON COLUMN chimera_entities.is_official IS 'Whether this is official Stone Caster content';
