-- Add description_short and description_long columns to chimera_ruleset_templates
-- These fields will be stored in the definition JSONB and also as separate columns for querying

BEGIN;

-- Add description columns if they don't exist
ALTER TABLE chimera_ruleset_templates
  ADD COLUMN IF NOT EXISTS description_short TEXT,
  ADD COLUMN IF NOT EXISTS description_long TEXT;

-- Add comments
COMMENT ON COLUMN chimera_ruleset_templates.description_short IS 
  'Short description (max 255 chars) - shown in lists and dependency views';
COMMENT ON COLUMN chimera_ruleset_templates.description_long IS 
  'Long description (max 2000 chars) - shown in detail views';

COMMIT;

