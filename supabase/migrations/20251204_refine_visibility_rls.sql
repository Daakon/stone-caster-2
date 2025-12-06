-- ============================================================================
-- Phase 3.99: Refine Visibility RLS Policies
-- Implement Content Lifecycle (Private -> Pending -> Public)
-- Date: 2025-12-04
-- ============================================================================
--
-- Lifecycle Rules:
-- - System/Null: Visible to ALL (Read-only)
-- - Private: Visible to Owner (Read/Write)
-- - Public: Visible to ALL (Frozen/Read-only for everyone)
-- - Pending: Visible to Owner (Read/Write, awaiting approval)
--
-- ============================================================================
-- PART 1: Drop existing policies for chimera_worlds
-- ============================================================================

DROP POLICY IF EXISTS "chimera_worlds_select_public_or_own" ON chimera_worlds;
DROP POLICY IF EXISTS "chimera_worlds_update_own" ON chimera_worlds;

-- ============================================================================
-- PART 2: New RLS Policies for chimera_worlds
-- ============================================================================

-- SELECT: Allow if owner OR public OR system (NULL owner)
CREATE POLICY "chimera_worlds_select_lifecycle"
  ON chimera_worlds FOR SELECT
  USING (
    owner_user_id = auth.uid()  -- My creations
    OR visibility = 'public'     -- Published content
    OR owner_user_id IS NULL     -- System content
  );

-- INSERT: Allow if setting owner_user_id = auth.uid()
CREATE POLICY "chimera_worlds_insert_own"
  ON chimera_worlds FOR INSERT
  WITH CHECK (owner_user_id = auth.uid());

-- UPDATE: Allow if owner AND not public (prevent modification of published assets)
CREATE POLICY "chimera_worlds_update_own_not_public"
  ON chimera_worlds FOR UPDATE
  USING (
    owner_user_id = auth.uid() 
    AND visibility != 'public'  -- Cannot edit published content
  )
  WITH CHECK (
    owner_user_id = auth.uid() 
    AND visibility != 'public'   -- Cannot change to public via UPDATE (use publish workflow)
  );

-- DELETE: Allow if owner
CREATE POLICY "chimera_worlds_delete_own"
  ON chimera_worlds FOR DELETE
  USING (owner_user_id = auth.uid());

-- ============================================================================
-- PART 3: Drop existing policies for chimera_entities
-- ============================================================================

DROP POLICY IF EXISTS "chimera_entities_select_own_or_public" ON chimera_entities;
DROP POLICY IF EXISTS "chimera_entities_update_own" ON chimera_entities;

-- ============================================================================
-- PART 4: New RLS Policies for chimera_entities
-- ============================================================================

-- SELECT: Allow if owner OR public OR system (NULL owner)
-- Note: Visibility is stored in raw_data JSONB, so we check both SQL column and JSONB
CREATE POLICY "chimera_entities_select_lifecycle"
  ON chimera_entities FOR SELECT
  USING (
    owner_user_id = auth.uid()  -- My creations
    OR (
      -- Public content (check both SQL visibility column if exists, or JSONB)
      (raw_data->>'visibility') = 'public'
      OR visibility = 'public'
    )
    OR owner_user_id IS NULL    -- System content
  );

-- INSERT: Allow if setting owner_user_id = auth.uid()
CREATE POLICY "chimera_entities_insert_own"
  ON chimera_entities FOR INSERT
  WITH CHECK (owner_user_id = auth.uid());

-- UPDATE: Allow if owner AND not public
CREATE POLICY "chimera_entities_update_own_not_public"
  ON chimera_entities FOR UPDATE
  USING (
    owner_user_id = auth.uid() 
    AND (
      (raw_data->>'visibility') != 'public'
      AND (visibility IS NULL OR visibility != 'public')
    )
  )
  WITH CHECK (
    owner_user_id = auth.uid() 
    AND (
      (raw_data->>'visibility') != 'public'
      AND (visibility IS NULL OR visibility != 'public')
    )
  );

-- DELETE: Allow if owner
CREATE POLICY "chimera_entities_delete_own"
  ON chimera_entities FOR DELETE
  USING (owner_user_id = auth.uid());

-- ============================================================================
-- PART 5: Drop existing policies for chimera_lore
-- ============================================================================

DROP POLICY IF EXISTS "chimera_lore_select_world" ON chimera_lore;
DROP POLICY IF EXISTS "chimera_lore_update_world" ON chimera_lore;

-- ============================================================================
-- PART 6: New RLS Policies for chimera_lore
-- ============================================================================

-- Note: Lore ownership is determined by world ownership
-- We need to check if the associated world is owned by user, public, or system

-- SELECT: Allow if world is owned by user OR world is public OR world is system
CREATE POLICY "chimera_lore_select_lifecycle"
  ON chimera_lore FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chimera_worlds 
      WHERE id = chimera_lore.world_id 
      AND (
        owner_user_id = auth.uid()  -- My world's lore
        OR visibility = 'public'    -- Public world's lore
        OR owner_user_id IS NULL    -- System world's lore
      )
    )
  );

-- INSERT: Allow if world is owned by user
CREATE POLICY "chimera_lore_insert_own_world"
  ON chimera_lore FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chimera_worlds 
      WHERE id = chimera_lore.world_id 
      AND owner_user_id = auth.uid()
      AND visibility != 'public'  -- Cannot add lore to published worlds
    )
  );

-- UPDATE: Allow if world is owned by user AND world is not public
CREATE POLICY "chimera_lore_update_own_world_not_public"
  ON chimera_lore FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM chimera_worlds 
      WHERE id = chimera_lore.world_id 
      AND owner_user_id = auth.uid()
      AND visibility != 'public'  -- Cannot edit lore for published worlds
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chimera_worlds 
      WHERE id = chimera_lore.world_id 
      AND owner_user_id = auth.uid()
      AND visibility != 'public'
    )
  );

-- DELETE: Allow if world is owned by user
CREATE POLICY "chimera_lore_delete_own_world"
  ON chimera_lore FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM chimera_worlds 
      WHERE id = chimera_lore.world_id 
      AND owner_user_id = auth.uid()
    )
  );

-- ============================================================================
-- PART 7: Add owner_user_id column to chimera_lore if missing
-- ============================================================================

-- Add owner_user_id to chimera_lore for direct ownership tracking
ALTER TABLE chimera_lore 
ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_chimera_lore_owner ON chimera_lore(owner_user_id);

-- Add comment
COMMENT ON COLUMN chimera_lore.owner_user_id IS 
    'Owner of the lore template. Used for RLS and My Creations filtering.';

-- ============================================================================
-- PART 8: Update lore policies to also check direct ownership
-- ============================================================================

-- Drop and recreate SELECT policy to include direct ownership
DROP POLICY IF EXISTS "chimera_lore_select_lifecycle" ON chimera_lore;

CREATE POLICY "chimera_lore_select_lifecycle"
  ON chimera_lore FOR SELECT
  USING (
    owner_user_id = auth.uid()  -- Direct ownership
    OR EXISTS (
      SELECT 1 FROM chimera_worlds 
      WHERE id = chimera_lore.world_id 
      AND (
        owner_user_id = auth.uid()  -- My world's lore
        OR visibility = 'public'    -- Public world's lore
        OR owner_user_id IS NULL    -- System world's lore
      )
    )
    OR owner_user_id IS NULL    -- System lore (no owner)
  );

-- Update INSERT policy to allow direct ownership
DROP POLICY IF EXISTS "chimera_lore_insert_own_world" ON chimera_lore;

CREATE POLICY "chimera_lore_insert_own_world"
  ON chimera_lore FOR INSERT
  WITH CHECK (
    owner_user_id = auth.uid()  -- Direct ownership
    OR EXISTS (
      SELECT 1 FROM chimera_worlds 
      WHERE id = chimera_lore.world_id 
      AND owner_user_id = auth.uid()
      AND visibility != 'public'
    )
  );

-- Update UPDATE policy to allow direct ownership
DROP POLICY IF EXISTS "chimera_lore_update_own_world_not_public" ON chimera_lore;

CREATE POLICY "chimera_lore_update_own_world_not_public"
  ON chimera_lore FOR UPDATE
  USING (
    (
      owner_user_id = auth.uid()  -- Direct ownership
      AND EXISTS (
        SELECT 1 FROM chimera_worlds 
        WHERE id = chimera_lore.world_id 
        AND visibility != 'public'
      )
    )
    OR EXISTS (
      SELECT 1 FROM chimera_worlds 
      WHERE id = chimera_lore.world_id 
      AND owner_user_id = auth.uid()
      AND visibility != 'public'
    )
  )
  WITH CHECK (
    (
      owner_user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM chimera_worlds 
        WHERE id = chimera_lore.world_id 
        AND visibility != 'public'
      )
    )
    OR EXISTS (
      SELECT 1 FROM chimera_worlds 
      WHERE id = chimera_lore.world_id 
      AND owner_user_id = auth.uid()
      AND visibility != 'public'
    )
  );

-- Update DELETE policy to allow direct ownership
DROP POLICY IF EXISTS "chimera_lore_delete_own_world" ON chimera_lore;

CREATE POLICY "chimera_lore_delete_own_world"
  ON chimera_lore FOR DELETE
  USING (
    owner_user_id = auth.uid()  -- Direct ownership
    OR EXISTS (
      SELECT 1 FROM chimera_worlds 
      WHERE id = chimera_lore.world_id 
      AND owner_user_id = auth.uid()
    )
  );

