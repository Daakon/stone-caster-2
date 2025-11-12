-- Fix prompt_snapshots.turn_id type mismatch
-- If prompt_snapshots.turn_id is UUID but should be bigint (to match turns.id)

-- Only run if the table exists and has the wrong type
DO $$
BEGIN
  -- Check if prompt_snapshots exists and turn_id is UUID
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'prompt_snapshots' 
    AND column_name = 'turn_id'
    AND data_type = 'uuid'
  ) THEN
    -- Drop the foreign key constraint if it exists
    ALTER TABLE prompt_snapshots 
    DROP CONSTRAINT IF EXISTS prompt_snapshots_turn_id_fkey;
    
    -- Change column type from uuid to bigint
    ALTER TABLE prompt_snapshots 
    ALTER COLUMN turn_id TYPE bigint USING NULL;
    
    -- Re-add the foreign key constraint with correct type
    ALTER TABLE prompt_snapshots
    ADD CONSTRAINT prompt_snapshots_turn_id_fkey 
    FOREIGN KEY (turn_id) REFERENCES turns(id) ON DELETE SET NULL;
    
    RAISE NOTICE 'Fixed prompt_snapshots.turn_id from uuid to bigint';
  ELSE
    RAISE NOTICE 'prompt_snapshots.turn_id is already correct or table does not exist';
  END IF;
END $$;

