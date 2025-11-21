-- =========================================================
-- FINAL HOTFIX: Schema Cache & Column Names
-- =========================================================
-- Fixes missing column references and lost Foreign Key relationships
-- Forces Supabase to re-cache the relationships correctly

BEGIN;

-- =========================================================
-- 1. Ensure chimera_exclusion_groups is defined (UUID PK)
-- =========================================================

DROP TABLE IF EXISTS public.chimera_exclusion_groups CASCADE;

CREATE TABLE public.chimera_exclusion_groups (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    CONSTRAINT pk_chimera_exclusion_groups PRIMARY KEY (id),
    group_name text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create index for group_name lookups
CREATE INDEX IF NOT EXISTS idx_chimera_exclusion_groups_group_name 
  ON public.chimera_exclusion_groups(group_name);

-- Add comments
COMMENT ON TABLE public.chimera_exclusion_groups IS 
  'Exclusion groups for ruleset templates (mutually exclusive rulesets)';
COMMENT ON COLUMN public.chimera_exclusion_groups.id IS 
  'UUID primary key';
COMMENT ON COLUMN public.chimera_exclusion_groups.group_name IS 
  'Unique group name (normalized, uppercase)';

-- =========================================================
-- 2. Ensure chimera_ruleset_templates has its FK re-added
--    (fixes Admin error)
-- =========================================================
-- This table was created in Phase 0/2, so we add the constraint now.

-- Add column if missing from prior simplified scripts
ALTER TABLE public.chimera_ruleset_templates
  ADD COLUMN IF NOT EXISTS exclusion_group_id uuid;

-- Drop existing constraint if it exists (to avoid conflicts)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_ruleset_exclusion_group' 
    AND table_name = 'chimera_ruleset_templates'
  ) THEN
    ALTER TABLE public.chimera_ruleset_templates 
      DROP CONSTRAINT fk_ruleset_exclusion_group;
  END IF;
END $$;

-- Add foreign key constraint
ALTER TABLE public.chimera_ruleset_templates
  ADD CONSTRAINT fk_ruleset_exclusion_group
  FOREIGN KEY (exclusion_group_id) 
  REFERENCES public.chimera_exclusion_groups(id) ON DELETE SET NULL;

-- Create index for exclusion_group_id lookups
CREATE INDEX IF NOT EXISTS idx_chimera_ruleset_templates_exclusion_group_id 
  ON public.chimera_ruleset_templates(exclusion_group_id);

-- Add comment
COMMENT ON COLUMN public.chimera_ruleset_templates.exclusion_group_id IS 
  'UUID reference to chimera_exclusion_groups.id (rulesets in same group are mutually exclusive)';

-- =========================================================
-- 3. Ensure the FK relationship for lore packs is explicitly visible
--    (fixes Packs error)
-- =========================================================
-- This links content packs (parent) to their lore links (child).

-- Drop old/broken FK if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'chimera_content_pack_lore_links_pack_id_fkey' 
    AND table_name = 'chimera_content_pack_lore_links'
  ) THEN
    ALTER TABLE public.chimera_content_pack_lore_links 
      DROP CONSTRAINT chimera_content_pack_lore_links_pack_id_fkey;
  END IF;
END $$;

-- Drop new FK if it exists (to avoid conflicts)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_pack_lore_links' 
    AND table_name = 'chimera_content_pack_lore_links'
  ) THEN
    ALTER TABLE public.chimera_content_pack_lore_links 
      DROP CONSTRAINT fk_pack_lore_links;
  END IF;
END $$;

-- Add foreign key constraint
ALTER TABLE public.chimera_content_pack_lore_links
  ADD CONSTRAINT fk_pack_lore_links
  FOREIGN KEY (pack_id) 
  REFERENCES public.chimera_content_packs(id) ON DELETE CASCADE;

-- Ensure index exists for pack_id lookups
CREATE INDEX IF NOT EXISTS idx_chimera_content_pack_lore_links_pack_id 
  ON public.chimera_content_pack_lore_links(pack_id);

-- Add comment
COMMENT ON CONSTRAINT fk_pack_lore_links ON public.chimera_content_pack_lore_links IS 
  'Foreign key linking lore templates to content packs';

COMMIT;

