-- Add use_chimera_engine column to entry_points table
-- This field indicates whether an entry point should use the Chimera V2 engine

BEGIN;

-- Add use_chimera_engine column to entry_points table
ALTER TABLE public.entry_points
  ADD COLUMN IF NOT EXISTS use_chimera_engine boolean NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.entry_points.use_chimera_engine IS 
  'Indicates whether this entry point should use the Chimera V2 engine instead of the V1 engine';

COMMIT;

