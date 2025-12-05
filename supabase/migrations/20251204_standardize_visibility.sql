-- ============================================================================
-- Phase 4.0: Standardize Visibility Logic - Remove IS NULL Checks
-- Replace complex IS NULL policies with unified ownership/visibility checks
-- System content will be owned by SYSTEM_USER_ID AND visibility = 'public'
-- Date: 2025-12-04
-- ============================================================================

-- ============================================================================
-- PART 1: Drop existing RLS policies (with IS NULL checks)
-- ============================================================================

-- Worlds policies
DROP POLICY IF EXISTS "chimera_worlds_select" ON chimera_worlds;
DROP POLICY IF EXISTS "chimera_worlds_insert" ON chimera_worlds;
DROP POLICY IF EXISTS "chimera_worlds_update" ON chimera_worlds;
DROP POLICY IF EXISTS "chimera_worlds_delete" ON chimera_worlds;

-- Entities policies
DROP POLICY IF EXISTS "chimera_entities_select" ON chimera_entities;
DROP POLICY IF EXISTS "chimera_entities_insert" ON chimera_entities;
DROP POLICY IF EXISTS "chimera_entities_update" ON chimera_entities;
DROP POLICY IF EXISTS "chimera_entities_delete" ON chimera_entities;

-- Lore policies
DROP POLICY IF EXISTS "chimera_lore_select" ON chimera_lore;
DROP POLICY IF EXISTS "chimera_lore_insert" ON chimera_lore;
DROP POLICY IF EXISTS "chimera_lore_update" ON chimera_lore;
DROP POLICY IF EXISTS "chimera_lore_delete" ON chimera_lore;

-- ============================================================================
-- PART 2: Create Unified RLS Policies for chimera_worlds
-- ============================================================================

-- SELECT: Unified logic - I can see it if I own it OR if it is public
-- (System content is owned by SYSTEM_USER_ID AND visibility = 'public', so it's naturally included)
CREATE POLICY "chimera_worlds_select_unified" ON chimera_worlds
    FOR SELECT 
    USING (
        owner_user_id = auth.uid()  -- My creations
        OR visibility = 'public'     -- Published content (includes system content)
    );

-- INSERT: Allow if setting owner_user_id = auth.uid()
CREATE POLICY "chimera_worlds_insert_unified" ON chimera_worlds
    FOR INSERT 
    WITH CHECK (owner_user_id = auth.uid());

-- UPDATE: Allow if owner AND not public (prevent modification of published assets)
CREATE POLICY "chimera_worlds_update_unified" ON chimera_worlds
    FOR UPDATE 
    USING (
        owner_user_id = auth.uid() 
        AND visibility != 'public'  -- Cannot edit published content
    )
    WITH CHECK (
        owner_user_id = auth.uid() 
        AND visibility != 'public'   -- Cannot change to public via UPDATE (use publish workflow)
    );

-- DELETE: Allow if owner
CREATE POLICY "chimera_worlds_delete_unified" ON chimera_worlds
    FOR DELETE 
    USING (owner_user_id = auth.uid());

-- ============================================================================
-- PART 3: Create Unified RLS Policies for chimera_entities
-- ============================================================================

-- SELECT: Unified logic - I can see it if I own it OR if it is public
CREATE POLICY "chimera_entities_select_unified" ON chimera_entities
    FOR SELECT 
    USING (
        owner_user_id = auth.uid()  -- My creations
        OR visibility = 'public'    -- Published content (includes system content)
    );

-- INSERT: Allow if setting owner_user_id = auth.uid()
CREATE POLICY "chimera_entities_insert_unified" ON chimera_entities
    FOR INSERT 
    WITH CHECK (owner_user_id = auth.uid());

-- UPDATE: Allow if owner AND not public
CREATE POLICY "chimera_entities_update_unified" ON chimera_entities
    FOR UPDATE 
    USING (
        owner_user_id = auth.uid() 
        AND visibility != 'public'  -- Cannot edit published content
    )
    WITH CHECK (
        owner_user_id = auth.uid() 
        AND visibility != 'public'   -- Cannot change to public via UPDATE
    );

-- DELETE: Allow if owner
CREATE POLICY "chimera_entities_delete_unified" ON chimera_entities
    FOR DELETE 
    USING (owner_user_id = auth.uid());

-- ============================================================================
-- PART 4: Create Unified RLS Policies for chimera_lore
-- ============================================================================

-- SELECT: Unified logic - I can see it if:
--   - I own it directly, OR
--   - It is public, OR
--   - It belongs to a world I own or that is public
CREATE POLICY "chimera_lore_select_unified" ON chimera_lore
    FOR SELECT 
    USING (
        owner_user_id = auth.uid()  -- Direct ownership
        OR visibility = 'public'     -- Published lore (includes system content)
        OR EXISTS (
            SELECT 1 FROM chimera_worlds 
            WHERE id = chimera_lore.world_id 
            AND (
                owner_user_id = auth.uid()  -- My world's lore
                OR visibility = 'public'    -- Public world's lore
            )
        )
    );

-- INSERT: Allow if owner OR world is owned by user (and not public)
CREATE POLICY "chimera_lore_insert_unified" ON chimera_lore
    FOR INSERT 
    WITH CHECK (
        owner_user_id = auth.uid()  -- Direct ownership
        OR EXISTS (
            SELECT 1 FROM chimera_worlds 
            WHERE id = chimera_lore.world_id 
            AND owner_user_id = auth.uid()
            AND visibility != 'public'  -- Cannot add lore to published worlds
        )
    );

-- UPDATE: Allow if owner AND not public OR world is owned by user AND not public
CREATE POLICY "chimera_lore_update_unified" ON chimera_lore
    FOR UPDATE 
    USING (
        (
            owner_user_id = auth.uid()  -- Direct ownership
            AND visibility != 'public'
        )
        OR EXISTS (
            SELECT 1 FROM chimera_worlds 
            WHERE id = chimera_lore.world_id 
            AND owner_user_id = auth.uid()
            AND visibility != 'public'  -- Cannot edit lore for published worlds
        )
    )
    WITH CHECK (
        (
            owner_user_id = auth.uid()
            AND visibility != 'public'
        )
        OR EXISTS (
            SELECT 1 FROM chimera_worlds 
            WHERE id = chimera_lore.world_id 
            AND owner_user_id = auth.uid()
            AND visibility != 'public'
        )
    );

-- DELETE: Allow if owner OR world is owned by user
CREATE POLICY "chimera_lore_delete_unified" ON chimera_lore
    FOR DELETE 
    USING (
        owner_user_id = auth.uid()  -- Direct ownership
        OR EXISTS (
            SELECT 1 FROM chimera_worlds 
            WHERE id = chimera_lore.world_id 
            AND owner_user_id = auth.uid()
        )
    );

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Summary:
-- ✅ Dropped old RLS policies with IS NULL checks
-- ✅ Created unified policies using: owner_user_id = auth.uid() OR visibility = 'public'
-- ✅ System content will be visible when owned by SYSTEM_USER_ID AND visibility = 'public'
-- 
-- Next Steps:
-- 1. Run bootstrap-system-user.ts to create system@stonecaster.io
-- 2. Run assign-system-content.sql migration to assign NULL owner_user_id to SYSTEM_USER_ID
-- 3. Update all system content to visibility = 'public'

