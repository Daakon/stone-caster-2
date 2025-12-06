-- ============================================================================
-- Phase 3.5: Fix Chimera Schema Gaps
-- Add missing columns for ownership tracking and world scoping
-- Date: 2025-12-04
-- ============================================================================

-- ============================================================================
-- PART 1: Add owner_user_id to chimera_entities (for My Creations & RLS)
-- ============================================================================

ALTER TABLE chimera_entities 
ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_chimera_entities_owner ON chimera_entities(owner_user_id);

-- Add comment
COMMENT ON COLUMN chimera_entities.owner_user_id IS 
    'Owner of the entity. Used for RLS and My Creations filtering.';

-- ============================================================================
-- PART 2: Add world_id to chimera_lore (for Filtering by World)
-- ============================================================================

ALTER TABLE chimera_lore 
ADD COLUMN IF NOT EXISTS world_id UUID REFERENCES chimera_worlds(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_chimera_lore_world ON chimera_lore(world_id);

-- Add comment
COMMENT ON COLUMN chimera_lore.world_id IS 
    'World this lore fragment belongs to. Used for filtering and RLS.';

-- ============================================================================
-- PART 3: Update RLS Policies (Security)
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "chimera_entities_select_all" ON chimera_entities;
DROP POLICY IF EXISTS "chimera_entities_select_own" ON chimera_entities;
DROP POLICY IF EXISTS "chimera_lore_select_authenticated" ON chimera_lore;
DROP POLICY IF EXISTS "chimera_lore_select_world" ON chimera_lore;

-- Policy: Users can SELECT their own entities OR public entities
CREATE POLICY "chimera_entities_select_own_or_public" ON chimera_entities
  FOR SELECT
  USING (
    owner_user_id = auth.uid()
    OR (
      -- Check if entity is marked as public in raw_data
      (raw_data->>'visibility') = 'public'
      OR (raw_data->>'visibility') IS NULL
    )
  );

-- Policy: Users can INSERT entities (must set owner_user_id = auth.uid())
CREATE POLICY "chimera_entities_insert_own" ON chimera_entities
  FOR INSERT
  WITH CHECK (owner_user_id = auth.uid());

-- Policy: Users can UPDATE their own entities
CREATE POLICY "chimera_entities_update_own" ON chimera_entities
  FOR UPDATE
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

-- Policy: Users can DELETE their own entities
CREATE POLICY "chimera_entities_delete_own" ON chimera_entities
  FOR DELETE
  USING (owner_user_id = auth.uid());

-- Policy: Users can SELECT lore fragments for worlds they own or that are public
CREATE POLICY "chimera_lore_select_world" ON chimera_lore
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chimera_worlds 
      WHERE id = chimera_lore.world_id 
      AND (
        owner_user_id = auth.uid() 
        OR visibility = 'public'
      )
    )
  );

-- Policy: Users can INSERT lore fragments (must belong to a world they own)
CREATE POLICY "chimera_lore_insert_world" ON chimera_lore
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chimera_worlds 
      WHERE id = chimera_lore.world_id 
      AND owner_user_id = auth.uid()
    )
  );

-- Policy: Users can UPDATE lore fragments (must belong to a world they own)
CREATE POLICY "chimera_lore_update_world" ON chimera_lore
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM chimera_worlds 
      WHERE id = chimera_lore.world_id 
      AND owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chimera_worlds 
      WHERE id = chimera_lore.world_id 
      AND owner_user_id = auth.uid()
    )
  );

-- Policy: Users can DELETE lore fragments (must belong to a world they own)
CREATE POLICY "chimera_lore_delete_world" ON chimera_lore
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM chimera_worlds 
      WHERE id = chimera_lore.world_id 
      AND owner_user_id = auth.uid()
    )
  );

