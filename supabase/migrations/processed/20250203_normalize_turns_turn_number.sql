-- Phase 1: Normalize turns.turn_number column and add pagination support
-- This migration safely normalizes the schema by:
-- 1. Ensuring turn_number column exists (rename idx if needed)
-- 2. Backfilling null values per game
-- 3. Adding constraints and indexes
-- 4. Optional trigger for safety

-- ============================================================================
-- STEP 1: Column Normalization
-- ============================================================================

-- Check if turn_number exists, if not create it or rename idx
DO $$
DECLARE
    has_turn_number BOOLEAN;
    has_idx BOOLEAN;
BEGIN
    -- Check if turn_number column exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'turns'
          AND column_name = 'turn_number'
    ) INTO has_turn_number;

    -- Check if idx column exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'turns'
          AND column_name = 'idx'
    ) INTO has_idx;

    IF NOT has_turn_number THEN
        IF has_idx THEN
            -- Rename idx to turn_number
            ALTER TABLE public.turns RENAME COLUMN idx TO turn_number;
            RAISE NOTICE 'Renamed turns.idx to turns.turn_number';
        ELSE
            -- Add turn_number column
            ALTER TABLE public.turns ADD COLUMN turn_number INTEGER;
            RAISE NOTICE 'Added turns.turn_number column';
        END IF;
    ELSE
        RAISE NOTICE 'turns.turn_number already exists';
    END IF;
END $$;

-- ============================================================================
-- STEP 2: Backfill null turn_number values
-- ============================================================================

-- Backfill turn_number for any rows where it's null
-- Order by created_at, then id to ensure deterministic ordering
DO $$
DECLARE
    game_rec RECORD;
    turn_num INTEGER;
BEGIN
    FOR game_rec IN SELECT DISTINCT game_id FROM public.turns WHERE turn_number IS NULL
    LOOP
        turn_num := 1;
        
        -- Update all null turn_number rows for this game, ordered by created_at and id
        UPDATE public.turns
        SET turn_number = subquery.new_turn_number
        FROM (
            SELECT 
                id,
                ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS new_turn_number
            FROM public.turns
            WHERE game_id = game_rec.game_id
              AND turn_number IS NULL
        ) AS subquery
        WHERE turns.id = subquery.id;
        
        RAISE NOTICE 'Backfilled turn_number for game_id: %', game_rec.game_id;
    END LOOP;
END $$;

-- ============================================================================
-- STEP 3: Constraints and Indexes
-- ============================================================================

-- Set NOT NULL constraint
ALTER TABLE public.turns 
    ALTER COLUMN turn_number SET NOT NULL;

-- Drop existing unique index on (game_id, idx) if it exists
DROP INDEX IF EXISTS public.idx_turns_game_idx;

-- Create unique constraint on (game_id, turn_number)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'turns_game_id_turn_number_unique'
    ) THEN
        ALTER TABLE public.turns
            ADD CONSTRAINT turns_game_id_turn_number_unique
            UNIQUE (game_id, turn_number);
        RAISE NOTICE 'Added unique constraint on (game_id, turn_number)';
    ELSE
        RAISE NOTICE 'Unique constraint on (game_id, turn_number) already exists';
    END IF;
END $$;

-- Create index for ascending pagination (playback)
CREATE INDEX IF NOT EXISTS idx_turns_game_turn_number_asc
    ON public.turns (game_id, turn_number ASC);

-- Create index for descending queries (latest turn)
CREATE INDEX IF NOT EXISTS idx_turns_game_turn_number_desc
    ON public.turns (game_id, turn_number DESC);

-- ============================================================================
-- STEP 4: Optional Trigger (Safety Net)
-- ============================================================================

-- Create function to auto-assign turn_number if not provided
CREATE OR REPLACE FUNCTION public.ensure_turn_number()
RETURNS TRIGGER AS $$
BEGIN
    -- Only set turn_number if it's NULL or 0
    IF NEW.turn_number IS NULL OR NEW.turn_number = 0 THEN
        SELECT COALESCE(MAX(turn_number), 0) + 1
        INTO NEW.turn_number
        FROM public.turns
        WHERE game_id = NEW.game_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (only if it doesn't exist)
DROP TRIGGER IF EXISTS trigger_ensure_turn_number ON public.turns;
CREATE TRIGGER trigger_ensure_turn_number
    BEFORE INSERT ON public.turns
    FOR EACH ROW
    EXECUTE FUNCTION public.ensure_turn_number();

-- ============================================================================
-- ROLLBACK NOTES
-- ============================================================================
/*
To rollback this migration:

1. Drop trigger:
   DROP TRIGGER IF EXISTS trigger_ensure_turn_number ON public.turns;

2. Drop function:
   DROP FUNCTION IF EXISTS public.ensure_turn_number();

3. Drop indexes:
   DROP INDEX IF EXISTS idx_turns_game_turn_number_asc;
   DROP INDEX IF EXISTS idx_turns_game_turn_number_desc;

4. Drop constraint:
   ALTER TABLE public.turns DROP CONSTRAINT IF EXISTS turns_game_id_turn_number_unique;

5. Option A: Keep turn_number but make it nullable
   ALTER TABLE public.turns ALTER COLUMN turn_number DROP NOT NULL;

6. Option B: Rename back to idx (if desired)
   ALTER TABLE public.turns RENAME COLUMN turn_number TO idx;

7. Option C: Drop column entirely (if it was added, not renamed)
   ALTER TABLE public.turns DROP COLUMN IF EXISTS turn_number;
*/

