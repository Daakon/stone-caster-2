-- Create chimera_exclusion_groups table
-- Refactor exclusion_group to be a database-backed tag system

BEGIN;

-- Create exclusion groups table
CREATE TABLE IF NOT EXISTS public.chimera_exclusion_groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_name text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uk_chimera_exclusion_groups_group_name UNIQUE (group_name)
);

-- Create index on group_name for faster lookups
CREATE INDEX IF NOT EXISTS idx_chimera_exclusion_groups_group_name 
    ON public.chimera_exclusion_groups(group_name);

-- Add comments
COMMENT ON TABLE public.chimera_exclusion_groups IS 
    'Exclusion groups for ruleset templates - groups where only one ruleset can be active at a time';
COMMENT ON COLUMN public.chimera_exclusion_groups.id IS 
    'Unique identifier for the exclusion group';
COMMENT ON COLUMN public.chimera_exclusion_groups.group_name IS 
    'Normalized group name (e.g., TIME_SYSTEM, COMBAT_STYLE)';

COMMIT;

