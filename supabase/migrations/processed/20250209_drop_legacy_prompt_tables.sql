-- Drop legacy prompt-related tables and functions
-- These were replaced by v3 assembler which reads directly from entity tables

BEGIN;

-- Drop the prompting schema (contains legacy prompt_segments_for_context function)
DROP SCHEMA IF EXISTS prompting CASCADE;

-- Drop prompt_segments table (if it exists in public schema)
DROP TABLE IF EXISTS public.prompt_segments CASCADE;

-- Drop any indexes on prompt_segments
DROP INDEX IF EXISTS prompt_segments_scope_ref_id_idx;
DROP INDEX IF EXISTS prompt_segments_scope_idx;
DROP INDEX IF EXISTS prompt_segments_ref_id_idx;
DROP INDEX IF EXISTS prompt_segments_active_idx;
DROP INDEX IF EXISTS prompt_segments_version_idx;

COMMIT;

