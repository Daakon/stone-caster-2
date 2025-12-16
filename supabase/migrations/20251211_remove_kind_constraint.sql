-- ============================================================================
-- Fix: Remove Legacy Kind Constraint
-- Date: 2025-12-11
-- Description: Drops legacy check constraint on 'kind' and adds new one for 'entity_type' supporting Uppercase.
-- ============================================================================

-- 1. Drop the legacy constraint (which enforced lowercase or limited values on 'kind')
ALTER TABLE chimera_entities DROP CONSTRAINT IF EXISTS chimera_entities_kind_check;

-- 2. Add new constraint on 'entity_type' checking for Uppercase values
-- dependent on 'entity_type' column existence (from previous cleanup migration)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chimera_entities' AND column_name = 'entity_type'
    ) THEN
        -- Drop if exists (re-run safety)
        ALTER TABLE chimera_entities DROP CONSTRAINT IF EXISTS chimera_entities_entity_type_check;
        
        -- SANITIZATION: Update existing rows to Uppercase to match new constraint
        UPDATE chimera_entities SET entity_type = UPPER(entity_type);
        
        -- Add new constraint
        ALTER TABLE chimera_entities 
        ADD CONSTRAINT chimera_entities_entity_type_check 
        CHECK (entity_type IN ('NPC', 'LOCATION', 'ITEM', 'FACTION'));
    END IF;
END $$;
