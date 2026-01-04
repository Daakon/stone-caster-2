-- Add genesis_config column to chimera_stories table
ALTER TABLE chimera_stories 
ADD COLUMN IF NOT EXISTS genesis_config JSONB DEFAULT '{}'::jsonb;
