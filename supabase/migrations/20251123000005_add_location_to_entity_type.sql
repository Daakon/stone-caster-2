-- Add 'LOCATION' to chimera_entity_type enum
-- This migration adds LOCATION as a valid entity type alongside NPC, ITEM, and FACTION

BEGIN;

-- Add 'LOCATION' to the enum type
-- PostgreSQL doesn't support adding values to enums directly, so we need to:
-- 1. Create a new enum with the new value
-- 2. Update the column to use the new enum
-- 3. Drop the old enum
-- 4. Rename the new enum to the original name

DO $$
BEGIN
  -- Check if LOCATION already exists in the enum
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'LOCATION' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'chimera_entity_type')
  ) THEN
    -- Add LOCATION to the existing enum
    ALTER TYPE public.chimera_entity_type ADD VALUE IF NOT EXISTS 'LOCATION';
    RAISE NOTICE 'Added LOCATION to chimera_entity_type enum';
  ELSE
    RAISE NOTICE 'LOCATION already exists in chimera_entity_type enum';
  END IF;
END $$;

COMMIT;


