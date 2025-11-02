-- Drop entries table and related structures
-- This table was redundant with entry_points and has been removed from the codebase
-- Also removes entry_id column from entry_points that referenced entries

BEGIN;

-- First, drop the entry_id foreign key constraint and column from entry_points
ALTER TABLE IF EXISTS public.entry_points 
  DROP CONSTRAINT IF EXISTS entry_points_entry_id_fkey;
  
DROP INDEX IF EXISTS entry_points_entry_id_idx;

ALTER TABLE IF EXISTS public.entry_points 
  DROP COLUMN IF EXISTS entry_id;

-- Drop any indexes on entries table
DROP INDEX IF EXISTS entries_slug_idx;
DROP INDEX IF EXISTS entries_world_id_idx;
DROP INDEX IF EXISTS entries_status_idx;
DROP INDEX IF EXISTS entries_difficulty_idx;
DROP INDEX IF EXISTS entries_visibility_idx;
DROP INDEX IF EXISTS entries_entry_point_idx;
DROP INDEX IF EXISTS entries_tags_gin_idx;
DROP INDEX IF EXISTS entries_prompt_gin_idx;

-- Drop the entries table
DROP TABLE IF EXISTS public.entries CASCADE;

COMMIT;

