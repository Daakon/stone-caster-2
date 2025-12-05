-- ============================================================================
-- Phase 3.99 Fix: Add Missing Visibility Columns & Re-Apply RLS
-- Add visibility column to chimera_entities and chimera_lore
-- Re-apply RLS policies now that columns exist
-- Date: 2025-12-04
-- ============================================================================

-- ============================================================================
-- PART 1: Create visibility_status enum if not exists
-- ============================================================================

DO $$ 
BEGIN
    -- Create enum with values: 'private', 'pending', 'public'
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'visibility_status') THEN
        CREATE TYPE public.visibility_status AS ENUM ('private', 'pending', 'public');
    END IF;
END $$;

-- ============================================================================
-- PART 2: Add visibility column to chimera_worlds (if missing)
-- ============================================================================

-- Check if column exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'chimera_worlds' 
        AND column_name = 'visibility'
    ) THEN
        ALTER TABLE chimera_worlds 
        ADD COLUMN visibility public.visibility_status NOT NULL DEFAULT 'private';
    ELSE
        -- Column exists - check if it needs type conversion
        -- If it's using old visibility_enum with 'pending_approval', convert to 'pending'
        BEGIN
            -- Try to update any 'pending_approval' values to 'pending'
            -- This will only work if the column can be cast to text
            UPDATE chimera_worlds 
            SET visibility = 'pending'::visibility_status 
            WHERE visibility::text = 'pending_approval';
        EXCEPTION
            WHEN OTHERS THEN
                -- If conversion fails, column might already be correct type
                NULL;
        END;
    END IF;
END $$;

-- ============================================================================
-- PART 3: Add visibility column to chimera_entities
-- ============================================================================

ALTER TABLE chimera_entities 
ADD COLUMN IF NOT EXISTS visibility public.visibility_status NOT NULL DEFAULT 'private';

-- ============================================================================
-- PART 4: Add visibility column to chimera_lore
-- ============================================================================

ALTER TABLE chimera_lore 
ADD COLUMN IF NOT EXISTS visibility public.visibility_status NOT NULL DEFAULT 'private';

-- ============================================================================
-- PART 5: Ensure owner_user_id columns exist (required for RLS policies)
-- ============================================================================

-- Add owner_user_id to chimera_worlds if missing
ALTER TABLE chimera_worlds 
ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id);

-- Add owner_user_id to chimera_entities if missing
ALTER TABLE chimera_entities 
ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id);

-- Add owner_user_id to chimera_lore if missing
ALTER TABLE chimera_lore 
ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id);

-- Ensure world_id exists on chimera_lore (required for RLS policies that check world ownership)
ALTER TABLE chimera_lore 
ADD COLUMN IF NOT EXISTS world_id UUID REFERENCES chimera_worlds(id) ON DELETE CASCADE;

-- Create indexes for owner_user_id columns (for performance)
CREATE INDEX IF NOT EXISTS idx_chimera_worlds_owner_user_id ON chimera_worlds(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_chimera_entities_owner_user_id ON chimera_entities(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_chimera_lore_owner_user_id ON chimera_lore(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_chimera_lore_world_id ON chimera_lore(world_id);

-- ============================================================================
-- PART 6: Create indexes for visibility columns
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_chimera_worlds_visibility ON chimera_worlds(visibility);
CREATE INDEX IF NOT EXISTS idx_chimera_entities_visibility ON chimera_entities(visibility);
CREATE INDEX IF NOT EXISTS idx_chimera_lore_visibility ON chimera_lore(visibility);

-- ============================================================================
-- PART 7: Drop existing RLS policies (if they exist)
-- ============================================================================

-- Worlds policies
DROP POLICY IF EXISTS "chimera_worlds_select_lifecycle" ON chimera_worlds;
DROP POLICY IF EXISTS "chimera_worlds_select_public_or_own" ON chimera_worlds;
DROP POLICY IF EXISTS "chimera_worlds_insert_own" ON chimera_worlds;
DROP POLICY IF EXISTS "chimera_worlds_update_own_not_public" ON chimera_worlds;
DROP POLICY IF EXISTS "chimera_worlds_update_own" ON chimera_worlds;
DROP POLICY IF EXISTS "chimera_worlds_delete_own" ON chimera_worlds;

-- Entities policies
DROP POLICY IF EXISTS "chimera_entities_select_lifecycle" ON chimera_entities;
DROP POLICY IF EXISTS "chimera_entities_select_own_or_public" ON chimera_entities;
DROP POLICY IF EXISTS "chimera_entities_insert_own" ON chimera_entities;
DROP POLICY IF EXISTS "chimera_entities_update_own_not_public" ON chimera_entities;
DROP POLICY IF EXISTS "chimera_entities_update_own" ON chimera_entities;
DROP POLICY IF EXISTS "chimera_entities_delete_own" ON chimera_entities;

-- Lore policies
DROP POLICY IF EXISTS "chimera_lore_select_lifecycle" ON chimera_lore;
DROP POLICY IF EXISTS "chimera_lore_select_world" ON chimera_lore;
DROP POLICY IF EXISTS "chimera_lore_insert_own_world" ON chimera_lore;
DROP POLICY IF EXISTS "chimera_lore_update_own_world_not_public" ON chimera_lore;
DROP POLICY IF EXISTS "chimera_lore_update_world" ON chimera_lore;
DROP POLICY IF EXISTS "chimera_lore_delete_own_world" ON chimera_lore;
DROP POLICY IF EXISTS "chimera_lore_delete_world" ON chimera_lore;

-- ============================================================================
-- PART 8: Create RLS Policies for chimera_worlds
-- ============================================================================

-- SELECT: Allow if owner OR public OR system (NULL owner)
CREATE POLICY "chimera_worlds_select" ON chimera_worlds
    FOR SELECT 
    USING (
        owner_user_id = auth.uid()  -- My creations
        OR visibility = 'public'     -- Published content
        OR owner_user_id IS NULL     -- System content
    );

-- INSERT: Allow if setting owner_user_id = auth.uid()
CREATE POLICY "chimera_worlds_insert" ON chimera_worlds
    FOR INSERT 
    WITH CHECK (owner_user_id = auth.uid());

-- UPDATE: Allow if owner AND not public (prevent modification of published assets)
CREATE POLICY "chimera_worlds_update" ON chimera_worlds
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
CREATE POLICY "chimera_worlds_delete" ON chimera_worlds
    FOR DELETE 
    USING (owner_user_id = auth.uid());

-- ============================================================================
-- PART 9: Create RLS Policies for chimera_entities
-- ============================================================================

-- SELECT: Allow if owner OR public OR system (NULL owner)
CREATE POLICY "chimera_entities_select" ON chimera_entities
    FOR SELECT 
    USING (
        owner_user_id = auth.uid()  -- My creations
        OR visibility = 'public'    -- Published content
        OR owner_user_id IS NULL    -- System content
    );

-- INSERT: Allow if setting owner_user_id = auth.uid()
CREATE POLICY "chimera_entities_insert" ON chimera_entities
    FOR INSERT 
    WITH CHECK (owner_user_id = auth.uid());

-- UPDATE: Allow if owner AND not public
CREATE POLICY "chimera_entities_update" ON chimera_entities
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
CREATE POLICY "chimera_entities_delete" ON chimera_entities
    FOR DELETE 
    USING (owner_user_id = auth.uid());

-- ============================================================================
-- PART 10: Create RLS Policies for chimera_lore
-- ============================================================================

-- SELECT: Allow if owner OR public OR system (NULL owner) OR world is public/owned
CREATE POLICY "chimera_lore_select" ON chimera_lore
    FOR SELECT 
    USING (
        owner_user_id = auth.uid()  -- Direct ownership
        OR visibility = 'public'    -- Published lore
        OR owner_user_id IS NULL    -- System lore
        OR EXISTS (
            SELECT 1 FROM chimera_worlds 
            WHERE id = chimera_lore.world_id 
            AND (
                owner_user_id = auth.uid()  -- My world's lore
                OR visibility = 'public'    -- Public world's lore
                OR owner_user_id IS NULL    -- System world's lore
            )
        )
    );

-- INSERT: Allow if owner OR world is owned by user (and not public)
CREATE POLICY "chimera_lore_insert" ON chimera_lore
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
CREATE POLICY "chimera_lore_update" ON chimera_lore
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
CREATE POLICY "chimera_lore_delete" ON chimera_lore
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
-- ✅ Created visibility_status enum ('private', 'pending', 'public')
-- ✅ Added visibility column to chimera_worlds (if missing)
-- ✅ Added visibility column to chimera_entities
-- ✅ Added visibility column to chimera_lore
-- ✅ Ensured owner_user_id columns exist on all tables
-- ✅ Created indexes on visibility and owner_user_id columns
-- ✅ Applied RLS policies for all three tables

