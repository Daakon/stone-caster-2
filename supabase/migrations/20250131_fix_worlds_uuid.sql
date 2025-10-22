-- Fix Worlds Table UUID Migration
-- Converts worlds.id from TEXT to UUID to support admin associations

BEGIN;

-- First, check if we need to convert the worlds table
-- The AWF migration created worlds with TEXT id, but admin needs UUID

-- Add a new UUID column
ALTER TABLE public.worlds 
ADD COLUMN IF NOT EXISTS new_id uuid DEFAULT gen_random_uuid();

-- Update the new_id column to have unique values
UPDATE public.worlds SET new_id = gen_random_uuid() WHERE new_id IS NULL;

-- Make new_id NOT NULL
ALTER TABLE public.worlds ALTER COLUMN new_id SET NOT NULL;

-- Create a unique index on new_id
CREATE UNIQUE INDEX IF NOT EXISTS worlds_new_id_uq ON public.worlds(new_id);

-- Drop the old primary key constraint
ALTER TABLE public.worlds DROP CONSTRAINT IF EXISTS worlds_pkey;

-- Drop the old id column
ALTER TABLE public.worlds DROP COLUMN IF EXISTS id;

-- Rename new_id to id
ALTER TABLE public.worlds RENAME COLUMN new_id TO id;

-- Add primary key constraint
ALTER TABLE public.worlds ADD CONSTRAINT worlds_pkey PRIMARY KEY (id);

-- Add status column if it doesn't exist (needed for admin)
ALTER TABLE public.worlds 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived'));

-- Update existing records to have status
UPDATE public.worlds SET status = 'active' WHERE status IS NULL;

-- Make status NOT NULL
ALTER TABLE public.worlds ALTER COLUMN status SET NOT NULL;

COMMIT;
