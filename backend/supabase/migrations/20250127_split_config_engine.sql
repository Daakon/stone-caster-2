-- Migration: Split config_engine into 4 specialized columns
-- Date: 2025-01-27
-- Purpose: Optimize compiled_stories table by separating concerns into purpose-built columns

-- Add new specialized JSONB columns (nullable for migration safety)
ALTER TABLE chimera_compiled_stories
ADD COLUMN IF NOT EXISTS config_mechanics JSONB,
ADD COLUMN IF NOT EXISTS config_interpreter JSONB,
ADD COLUMN IF NOT EXISTS config_narrator JSONB,
ADD COLUMN IF NOT EXISTS config_ui JSONB;

-- Add GIN indexes for efficient JSONB queries
CREATE INDEX IF NOT EXISTS idx_compiled_stories_config_mechanics 
    ON chimera_compiled_stories USING GIN (config_mechanics);
CREATE INDEX IF NOT EXISTS idx_compiled_stories_config_interpreter 
    ON chimera_compiled_stories USING GIN (config_interpreter);
CREATE INDEX IF NOT EXISTS idx_compiled_stories_config_narrator 
    ON chimera_compiled_stories USING GIN (config_narrator);
CREATE INDEX IF NOT EXISTS idx_compiled_stories_config_ui 
    ON chimera_compiled_stories USING GIN (config_ui);

-- Note: config_engine, prompt_interpreter_logic, and prompt_narrator_style columns
-- are kept for now but marked as deprecated. They will be removed in a future migration
-- after full verification of the new architecture.
