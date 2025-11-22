-- Phase 5: Ensure turns.meta is NOT NULL DEFAULT '{}'::jsonb
-- This migration ensures meta column exists and is properly constrained

BEGIN;

-- Check if meta column exists, create if not
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'turns'
      AND column_name = 'meta'
  ) THEN
    -- Add meta column with default
    ALTER TABLE public.turns
      ADD COLUMN meta jsonb NOT NULL DEFAULT '{}'::jsonb;
    RAISE NOTICE 'Added turns.meta column with NOT NULL DEFAULT';
  ELSE
    -- Column exists - ensure it has default and NOT NULL
    -- First, backfill any NULL values
    UPDATE public.turns
    SET meta = '{}'::jsonb
    WHERE meta IS NULL;
    
    -- Add default if missing
    ALTER TABLE public.turns
      ALTER COLUMN meta SET DEFAULT '{}'::jsonb;
    
    -- Set NOT NULL
    ALTER TABLE public.turns
      ALTER COLUMN meta SET NOT NULL;
    
    RAISE NOTICE 'Updated turns.meta to NOT NULL DEFAULT {}';
  END IF;
END $$;

COMMIT;

