-- Fix games.world_id to be UUID and reference world_id_mapping instead of worlds
-- This is needed because worlds has a composite primary key (id, version)
-- and we use UUIDs from world_id_mapping for foreign keys

-- Step 1: Drop the old foreign key constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public'
    AND constraint_name = 'games_world_id_fkey'
    AND table_name = 'games'
  ) THEN
    ALTER TABLE public.games
      DROP CONSTRAINT games_world_id_fkey;
    
    RAISE NOTICE 'Dropped old games_world_id_fkey constraint';
  ELSE
    RAISE NOTICE 'games_world_id_fkey constraint not found, skipping drop';
  END IF;
END $$;

-- Step 2: Convert world_id from TEXT to UUID
-- First, check if world_id is TEXT and needs conversion
DO $$
DECLARE
  current_type TEXT;
  row_count INTEGER;
BEGIN
  -- Get current data type
  SELECT data_type INTO current_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'games'
    AND column_name = 'world_id';
  
  RAISE NOTICE 'Current games.world_id type: %', current_type;
  
  IF current_type = 'text' THEN
    -- Check how many rows have world_id
    SELECT COUNT(*) INTO row_count FROM public.games WHERE world_id IS NOT NULL;
    RAISE NOTICE 'Found % games with world_id', row_count;
    
    -- If there are existing games, we'll convert them during the ALTER COLUMN
    -- First add a temporary UUID column
    ALTER TABLE public.games ADD COLUMN IF NOT EXISTS world_id_uuid UUID;
    
    IF row_count > 0 THEN
      -- Convert TEXT slugs to UUIDs using world_id_mapping
      UPDATE public.games g
      SET world_id_uuid = wm.uuid_id
      FROM public.world_id_mapping wm
      WHERE g.world_id = wm.text_id
        AND g.world_id IS NOT NULL;
      
      RAISE NOTICE 'Converted % game world_id values from TEXT slug to UUID in temporary column', row_count;
    END IF;
    
    -- Drop the old TEXT column
    ALTER TABLE public.games DROP COLUMN IF EXISTS world_id;
    
    -- Rename the UUID column to world_id
    ALTER TABLE public.games RENAME COLUMN world_id_uuid TO world_id;
    
    -- Make it NOT NULL if it wasn't already
    ALTER TABLE public.games ALTER COLUMN world_id SET NOT NULL;
    
    RAISE NOTICE 'Changed games.world_id column type from TEXT to UUID';
    
  ELSIF current_type = 'uuid' THEN
    RAISE NOTICE 'games.world_id is already UUID, no conversion needed';
  ELSE
    RAISE NOTICE 'games.world_id has unexpected type: %, manual review needed', current_type;
  END IF;
END $$;

-- Step 3: Add the correct foreign key constraint to world_id_mapping
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public'
    AND constraint_name = 'games_world_id_fkey'
    AND table_name = 'games'
  ) THEN
    ALTER TABLE public.games
      ADD CONSTRAINT games_world_id_fkey 
      FOREIGN KEY (world_id) 
      REFERENCES public.world_id_mapping(uuid_id) 
      ON DELETE RESTRICT;
    
    RAISE NOTICE 'Added games_world_id_fkey foreign key constraint to world_id_mapping';
  ELSE
    RAISE NOTICE 'games_world_id_fkey already exists';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'games_world_id_fkey already exists (caught exception)';
END $$;

