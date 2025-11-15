-- Remove tags columns from asset tables
-- Phase 2: Migrate from text[] arrays to database-backed tag system

BEGIN;

-- Remove tags column from chimera_lore_templates
ALTER TABLE public.chimera_lore_templates
  DROP COLUMN IF EXISTS tags;

-- Drop the GIN index on tags if it exists
DROP INDEX IF EXISTS idx_chimera_lore_templates_tags;

-- Note: If other tables have tags columns in the future, add DROP COLUMN statements here
-- Example:
-- ALTER TABLE public.chimera_worlds DROP COLUMN IF EXISTS tags;

COMMIT;

