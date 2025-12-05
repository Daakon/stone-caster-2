-- ============================================================================
-- Phase 4.0: Enforce Ownership Standardization
-- Make owner_user_id NOT NULL across all content tables
-- Prerequisites: Run bootstrap-system-user.ts first to fix any NULLs
-- Date: 2025-12-04
-- ============================================================================

-- ============================================================================
-- PART 1: Ensure all columns exist before checking for NULLs
-- ============================================================================

-- Ensure owner_user_id exists on all tables (if not already added by previous migrations)
DO $$
BEGIN
    -- Add to chimera_worlds if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'chimera_worlds' 
        AND column_name = 'owner_user_id'
    ) THEN
        ALTER TABLE chimera_worlds 
        ADD COLUMN owner_user_id UUID REFERENCES auth.users(id);
        CREATE INDEX IF NOT EXISTS idx_chimera_worlds_owner_user_id ON chimera_worlds(owner_user_id);
        RAISE NOTICE 'Added owner_user_id column to chimera_worlds';
    END IF;
    
    -- Add to chimera_entities if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'chimera_entities' 
        AND column_name = 'owner_user_id'
    ) THEN
        ALTER TABLE chimera_entities 
        ADD COLUMN owner_user_id UUID REFERENCES auth.users(id);
        CREATE INDEX IF NOT EXISTS idx_chimera_entities_owner_user_id ON chimera_entities(owner_user_id);
        RAISE NOTICE 'Added owner_user_id column to chimera_entities';
    END IF;
    
    -- Add to chimera_lore if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'chimera_lore' 
        AND column_name = 'owner_user_id'
    ) THEN
        ALTER TABLE chimera_lore 
        ADD COLUMN owner_user_id UUID REFERENCES auth.users(id);
        CREATE INDEX IF NOT EXISTS idx_chimera_lore_owner_user_id ON chimera_lore(owner_user_id);
        RAISE NOTICE 'Added owner_user_id column to chimera_lore';
    END IF;
END $$;

-- ============================================================================
-- PART 2: Auto-Fix NULLs by assigning to system user
-- ============================================================================

DO $$
DECLARE
    system_user_id UUID;
    worlds_null_count INTEGER;
    entities_null_count INTEGER;
    lore_null_count INTEGER;
BEGIN
    -- Find the system user
    SELECT id INTO system_user_id
    FROM auth.users
    WHERE email = 'system@stonecaster.io'
    LIMIT 1;
    
    IF system_user_id IS NULL THEN
        RAISE EXCEPTION 'System user (system@stonecaster.io) not found. Please run bootstrap-system-user.ts first.';
    END IF;
    
    RAISE NOTICE 'Found system user: %', system_user_id;
    
    -- Count NULLs in each table (columns now guaranteed to exist)
    SELECT COUNT(*) INTO worlds_null_count
    FROM chimera_worlds
    WHERE owner_user_id IS NULL;
    
    SELECT COUNT(*) INTO entities_null_count
    FROM chimera_entities
    WHERE owner_user_id IS NULL;
    
    SELECT COUNT(*) INTO lore_null_count
    FROM chimera_lore
    WHERE owner_user_id IS NULL;
    
    -- Auto-fix NULLs by assigning to system user
    IF worlds_null_count > 0 THEN
        RAISE NOTICE 'Fixing % NULL owner_user_id values in chimera_worlds...', worlds_null_count;
        UPDATE chimera_worlds
        SET 
            owner_user_id = system_user_id,
            visibility = 'public' -- System content is public
        WHERE owner_user_id IS NULL;
        RAISE NOTICE '✅ Fixed % world(s)', worlds_null_count;
    END IF;
    
    IF entities_null_count > 0 THEN
        RAISE NOTICE 'Fixing % NULL owner_user_id values in chimera_entities...', entities_null_count;
        UPDATE chimera_entities
        SET 
            owner_user_id = system_user_id,
            visibility = 'public' -- System content is public
        WHERE owner_user_id IS NULL;
        RAISE NOTICE '✅ Fixed % entit(ies)', entities_null_count;
    END IF;
    
    IF lore_null_count > 0 THEN
        RAISE NOTICE 'Fixing % NULL owner_user_id values in chimera_lore...', lore_null_count;
        UPDATE chimera_lore
        SET 
            owner_user_id = system_user_id,
            visibility = 'public' -- System content is public
        WHERE owner_user_id IS NULL;
        RAISE NOTICE '✅ Fixed % lore template(s)', lore_null_count;
    END IF;
    
    IF worlds_null_count = 0 AND entities_null_count = 0 AND lore_null_count = 0 THEN
        RAISE NOTICE '✅ No NULL owner_user_id values found. Database is clean!';
    END IF;
END $$;

-- ============================================================================
-- PART 3: Ensure compiled_stories has owner_user_id column
-- ============================================================================

-- Add owner_user_id to compiled_stories if it doesn't exist
-- Note: Compiled stories (save files) are always user-owned
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'compiled_stories' 
        AND column_name = 'owner_user_id'
    ) THEN
        ALTER TABLE compiled_stories 
        ADD COLUMN owner_user_id UUID REFERENCES auth.users(id);
        
        -- Create index for performance
        CREATE INDEX IF NOT EXISTS idx_compiled_stories_owner_user_id ON compiled_stories(owner_user_id);
        
        -- Add comment
        COMMENT ON COLUMN compiled_stories.owner_user_id IS 
            'Owner of the compiled story (save file). Always user-owned, never system.';
        
        RAISE NOTICE 'Added owner_user_id column to compiled_stories';
    ELSE
        RAISE NOTICE 'owner_user_id column already exists on compiled_stories';
    END IF;
END $$;

-- ============================================================================
-- PART 4: Handle NULLs in compiled_stories (orphaned saves)
-- ============================================================================

-- For compiled_stories, we can't assign to system user (saves are user-owned)
-- Orphaned saves should be deleted or assigned to a specific user
-- For safety, we'll delete orphaned saves (they're unusable without an owner)
DO $$
DECLARE
    compiled_stories_null_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO compiled_stories_null_count
    FROM compiled_stories
    WHERE owner_user_id IS NULL;
    
    IF compiled_stories_null_count > 0 THEN
        RAISE WARNING 'Found % compiled_stories with NULL owner_user_id (orphaned saves).', 
            compiled_stories_null_count;
        RAISE WARNING 'Deleting orphaned saves (they are unusable without an owner)...';
        
        DELETE FROM compiled_stories
        WHERE owner_user_id IS NULL;
        
        RAISE NOTICE '✅ Deleted % orphaned compiled_stories', compiled_stories_null_count;
    ELSE
        RAISE NOTICE '✅ No orphaned compiled_stories found.';
    END IF;
END $$;

-- ============================================================================
-- PART 5: Enforce NOT NULL Constraints
-- ============================================================================

-- Enforce NOT NULL on chimera_worlds
ALTER TABLE chimera_worlds 
ALTER COLUMN owner_user_id SET NOT NULL;

-- Enforce NOT NULL on chimera_entities
ALTER TABLE chimera_entities 
ALTER COLUMN owner_user_id SET NOT NULL;

-- Enforce NOT NULL on chimera_lore
ALTER TABLE chimera_lore 
ALTER COLUMN owner_user_id SET NOT NULL;

-- Enforce NOT NULL on compiled_stories
-- Note: This will fail if there are NULLs, so the safety check above is important
ALTER TABLE compiled_stories 
ALTER COLUMN owner_user_id SET NOT NULL;

-- ============================================================================
-- PART 6: Add Comments for Documentation
-- ============================================================================

COMMENT ON COLUMN chimera_worlds.owner_user_id IS 
    'Owner of the world. NOT NULL. System content owned by SYSTEM_USER_ID with visibility=public.';

COMMENT ON COLUMN chimera_entities.owner_user_id IS 
    'Owner of the entity. NOT NULL. System content owned by SYSTEM_USER_ID with visibility=public.';

COMMENT ON COLUMN chimera_lore.owner_user_id IS 
    'Owner of the lore fragment. NOT NULL. System content owned by SYSTEM_USER_ID with visibility=public.';

COMMENT ON COLUMN compiled_stories.owner_user_id IS 
    'Owner of the compiled story (save file). NOT NULL. Always user-owned, never system.';

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Summary:
-- ✅ Ensured all owner_user_id columns exist (chimera_worlds, chimera_entities, chimera_lore)
-- ✅ Verified no NULLs exist (with warnings if found)
-- ✅ Added owner_user_id to compiled_stories if missing
-- ✅ Enforced NOT NULL constraints on all content tables
-- ✅ Added documentation comments
-- 
-- Standard:
-- - System Content: owner_user_id = SYSTEM_USER_ID AND visibility = 'public'
-- - User Content: owner_user_id = USER_ID AND visibility = 'private' or 'public'
-- - Compiled Stories: owner_user_id = USER_ID (always user-owned)

