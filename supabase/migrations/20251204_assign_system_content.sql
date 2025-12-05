-- ============================================================================
-- Phase 4.0: Assign System Content to System User
-- Assigns all NULL owner_user_id content to the system user
-- Sets visibility = 'public' for system content
-- Date: 2025-12-04
-- ============================================================================
-- 
-- Prerequisites:
-- 1. Run bootstrap-system-user.ts to create system@stonecaster.io
-- 2. This migration will find that user and assign NULL content to it
-- ============================================================================

DO $$
DECLARE
    system_user_id UUID;
    worlds_count INTEGER;
    entities_count INTEGER;
    lore_count INTEGER;
BEGIN
    -- Step 1: Find the system user
    SELECT id INTO system_user_id
    FROM auth.users
    WHERE email = 'system@stonecaster.io'
    LIMIT 1;
    
    IF system_user_id IS NULL THEN
        RAISE EXCEPTION 'System user (system@stonecaster.io) not found. Please run bootstrap-system-user.ts first.';
    END IF;
    
    RAISE NOTICE 'Found system user: %', system_user_id;
    
    -- Step 2: Count NULL owner content
    SELECT COUNT(*) INTO worlds_count
    FROM chimera_worlds
    WHERE owner_user_id IS NULL;
    
    SELECT COUNT(*) INTO entities_count
    FROM chimera_entities
    WHERE owner_user_id IS NULL;
    
    SELECT COUNT(*) INTO lore_count
    FROM chimera_lore
    WHERE owner_user_id IS NULL;
    
    RAISE NOTICE 'Found NULL owner content: % worlds, % entities, % lore', worlds_count, entities_count, lore_count;
    
    -- Step 3: Assign worlds to system user and set visibility = 'public'
    IF worlds_count > 0 THEN
        UPDATE chimera_worlds
        SET 
            owner_user_id = system_user_id,
            visibility = 'public'
        WHERE owner_user_id IS NULL;
        
        RAISE NOTICE 'Assigned % world(s) to system user', worlds_count;
    END IF;
    
    -- Step 4: Assign entities to system user and set visibility = 'public'
    IF entities_count > 0 THEN
        UPDATE chimera_entities
        SET 
            owner_user_id = system_user_id,
            visibility = 'public'
        WHERE owner_user_id IS NULL;
        
        RAISE NOTICE 'Assigned % entit(ies) to system user', entities_count;
    END IF;
    
    -- Step 5: Assign lore to system user and set visibility = 'public'
    IF lore_count > 0 THEN
        UPDATE chimera_lore
        SET 
            owner_user_id = system_user_id,
            visibility = 'public'
        WHERE owner_user_id IS NULL;
        
        RAISE NOTICE 'Assigned % lore template(s) to system user', lore_count;
    END IF;
    
    -- Step 6: Verify no NULL owner content remains
    SELECT COUNT(*) INTO worlds_count
    FROM chimera_worlds
    WHERE owner_user_id IS NULL;
    
    SELECT COUNT(*) INTO entities_count
    FROM chimera_entities
    WHERE owner_user_id IS NULL;
    
    SELECT COUNT(*) INTO lore_count
    FROM chimera_lore
    WHERE owner_user_id IS NULL;
    
    IF worlds_count > 0 OR entities_count > 0 OR lore_count > 0 THEN
        RAISE WARNING 'Some content still has NULL owner_user_id: % worlds, % entities, % lore', 
            worlds_count, entities_count, lore_count;
    ELSE
        RAISE NOTICE '✅ All content has been assigned to system user';
    END IF;
    
END $$;

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- 
-- Summary:
-- ✅ Found system user (system@stonecaster.io)
-- ✅ Assigned all NULL owner_user_id content to system user
-- ✅ Set visibility = 'public' for all system content
-- 
-- System content is now:
--   - Owned by SYSTEM_USER_ID
--   - visibility = 'public'
--   - Visible via unified RLS: owner_user_id = auth.uid() OR visibility = 'public'

