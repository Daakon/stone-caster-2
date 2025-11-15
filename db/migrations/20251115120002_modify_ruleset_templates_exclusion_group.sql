-- Modify chimera_ruleset_templates to use exclusion_group_id instead of exclusion_group string
-- Refactor exclusion_group to be a database-backed tag system

BEGIN;

-- Add new exclusion_group_id column
ALTER TABLE public.chimera_ruleset_templates
  ADD COLUMN IF NOT EXISTS exclusion_group_id uuid NULL;

-- Add foreign key constraint
ALTER TABLE public.chimera_ruleset_templates
  ADD CONSTRAINT fk_chimera_ruleset_templates_exclusion_group_id
    FOREIGN KEY (exclusion_group_id)
    REFERENCES public.chimera_exclusion_groups(id)
    ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_chimera_ruleset_templates_exclusion_group_id 
    ON public.chimera_ruleset_templates(exclusion_group_id);

-- Migrate existing exclusion_group string values to exclusion_group_id
-- This will create new exclusion groups for any existing string values
DO $$
DECLARE
    exclusion_group_record RECORD;
    new_group_id uuid;
BEGIN
    -- Loop through unique exclusion_group values that are not null
    FOR exclusion_group_record IN
        SELECT DISTINCT exclusion_group
        FROM public.chimera_ruleset_templates
        WHERE exclusion_group IS NOT NULL
          AND exclusion_group != ''
    LOOP
        -- Normalize the group name (uppercase, replace spaces with underscores)
        DECLARE
            normalized_name text := UPPER(REGEXP_REPLACE(exclusion_group_record.exclusion_group, '\s+', '_', 'g'));
        BEGIN
            -- Check if group already exists
            SELECT id INTO new_group_id
            FROM public.chimera_exclusion_groups
            WHERE group_name = normalized_name;

            -- If not exists, create it
            IF new_group_id IS NULL THEN
                INSERT INTO public.chimera_exclusion_groups (group_name)
                VALUES (normalized_name)
                RETURNING id INTO new_group_id;
            END IF;

            -- Update all ruleset templates with this exclusion_group to use the new id
            UPDATE public.chimera_ruleset_templates
            SET exclusion_group_id = new_group_id
            WHERE exclusion_group = exclusion_group_record.exclusion_group
              AND exclusion_group IS NOT NULL
              AND exclusion_group != '';
        END;
    END LOOP;
END $$;

-- Drop the old exclusion_group column (after migration)
-- Note: We'll keep it for now in case of rollback, but it can be removed later
-- ALTER TABLE public.chimera_ruleset_templates DROP COLUMN IF EXISTS exclusion_group;

COMMIT;

