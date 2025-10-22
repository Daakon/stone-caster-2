-- Fix Worlds Table UUID Migration
-- Converts worlds.id from TEXT to UUID to support admin associations
-- Handles existing foreign key constraints properly

BEGIN;

-- First, check if we need to convert the worlds table
-- The AWF migration created worlds with TEXT id, but admin needs UUID

-- Step 1: Add a new UUID column
ALTER TABLE public.worlds 
ADD COLUMN IF NOT EXISTS new_id uuid DEFAULT gen_random_uuid();

-- Step 2: Update the new_id column to have unique values
UPDATE public.worlds SET new_id = gen_random_uuid() WHERE new_id IS NULL;

-- Step 3: Make new_id NOT NULL
ALTER TABLE public.worlds ALTER COLUMN new_id SET NOT NULL;

-- Step 4: Create a unique index on new_id
CREATE UNIQUE INDEX IF NOT EXISTS worlds_new_id_uq ON public.worlds(new_id);

-- Step 5: Drop existing foreign key constraints that depend on the old id column
-- This is safe because we'll recreate them with the new UUID column
ALTER TABLE public.entry_points DROP CONSTRAINT IF EXISTS entry_points_world_id_fkey;
ALTER TABLE public.games DROP CONSTRAINT IF EXISTS games_world_id_fkey;

-- Step 6: Drop the old primary key constraint
ALTER TABLE public.worlds DROP CONSTRAINT IF EXISTS worlds_pkey;

-- Step 7: Drop the old id column
ALTER TABLE public.worlds DROP COLUMN IF EXISTS id;

-- Step 8: Rename new_id to id
ALTER TABLE public.worlds RENAME COLUMN new_id TO id;

-- Step 9: Add primary key constraint
ALTER TABLE public.worlds ADD CONSTRAINT worlds_pkey PRIMARY KEY (id);

-- Step 10: Recreate the foreign key constraints with the new UUID column
-- First, we need to add UUID columns to the dependent tables and populate them
ALTER TABLE public.entry_points ADD COLUMN IF NOT EXISTS new_world_id uuid;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS new_world_id uuid;

-- Update the new columns with UUID values from the worlds table
-- We need to match on the old TEXT id values
UPDATE public.entry_points 
SET new_world_id = w.new_id 
FROM public.worlds w 
WHERE entry_points.world_id = w.id;

UPDATE public.games 
SET new_world_id = w.new_id 
FROM public.worlds w 
WHERE games.world_id = w.id;

-- Make the new columns NOT NULL
ALTER TABLE public.entry_points ALTER COLUMN new_world_id SET NOT NULL;
ALTER TABLE public.games ALTER COLUMN new_world_id SET NOT NULL;

-- Drop the old TEXT columns
ALTER TABLE public.entry_points DROP COLUMN IF EXISTS world_id;
ALTER TABLE public.games DROP COLUMN IF EXISTS world_id;

-- Rename the new columns
ALTER TABLE public.entry_points RENAME COLUMN new_world_id TO world_id;
ALTER TABLE public.games RENAME COLUMN new_world_id TO world_id;

-- Recreate the foreign key constraints
ALTER TABLE public.entry_points 
ADD CONSTRAINT entry_points_world_id_fkey 
FOREIGN KEY (world_id) REFERENCES public.worlds(id) ON DELETE RESTRICT;

ALTER TABLE public.games 
ADD CONSTRAINT games_world_id_fkey 
FOREIGN KEY (world_id) REFERENCES public.worlds(id) ON DELETE RESTRICT;

-- Step 11: Add status column if it doesn't exist (needed for admin)
ALTER TABLE public.worlds 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived'));

-- Update existing records to have status
UPDATE public.worlds SET status = 'active' WHERE status IS NULL;

-- Make status NOT NULL
ALTER TABLE public.worlds ALTER COLUMN status SET NOT NULL;

COMMIT;
