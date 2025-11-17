-- Create chimera_content_packs and related tables
-- Phase 2: Content Pack system - "Nexus Mod" style container for UGC

BEGIN;

-- Create enum type for pack type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'chimera_pack_type'
  ) THEN
    CREATE TYPE public.chimera_pack_type AS ENUM ('NPC', 'ITEM', 'LORE', 'MIXED');
  END IF;
END
$$;

-- Create chimera_content_packs table
CREATE TABLE IF NOT EXISTS public.chimera_content_packs (
    id text PRIMARY KEY,
    owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    visibility public.chimera_world_visibility NOT NULL DEFAULT 'private',
    is_system_asset boolean NOT NULL DEFAULT false,
    version integer NOT NULL DEFAULT 1,
    display_name text NOT NULL,
    description_short text NULL,
    pack_type public.chimera_pack_type NOT NULL,
    inter_entity_state jsonb NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uk_chimera_content_packs_id UNIQUE (id),
    CONSTRAINT uk_chimera_content_packs_owner_user_id_display_name UNIQUE (owner_user_id, display_name)
);

-- Create link tables
CREATE TABLE IF NOT EXISTS public.chimera_content_pack_entity_links (
    pack_id text NOT NULL REFERENCES public.chimera_content_packs(id) ON DELETE CASCADE,
    entity_template_id text NOT NULL REFERENCES public.chimera_entity_templates(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (pack_id, entity_template_id)
);

CREATE TABLE IF NOT EXISTS public.chimera_content_pack_ruleset_links (
    pack_id text NOT NULL REFERENCES public.chimera_content_packs(id) ON DELETE CASCADE,
    ruleset_template_id text NOT NULL REFERENCES public.chimera_ruleset_templates(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (pack_id, ruleset_template_id)
);

CREATE TABLE IF NOT EXISTS public.chimera_content_pack_lore_links (
    pack_id text NOT NULL REFERENCES public.chimera_content_packs(id) ON DELETE CASCADE,
    lore_template_id text NOT NULL REFERENCES public.chimera_lore_templates(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (pack_id, lore_template_id)
);

CREATE TABLE IF NOT EXISTS public.chimera_pack_dependencies (
    pack_id text NOT NULL REFERENCES public.chimera_content_packs(id) ON DELETE CASCADE,
    depends_on_pack_id text NOT NULL REFERENCES public.chimera_content_packs(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (pack_id, depends_on_pack_id),
    CONSTRAINT chk_chimera_pack_dependencies_no_self_reference CHECK (pack_id != depends_on_pack_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_chimera_content_packs_owner_user_id 
    ON public.chimera_content_packs(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_chimera_content_packs_visibility 
    ON public.chimera_content_packs(visibility);
CREATE INDEX IF NOT EXISTS idx_chimera_content_packs_pack_type 
    ON public.chimera_content_packs(pack_type);
CREATE INDEX IF NOT EXISTS idx_chimera_content_pack_entity_links_pack_id 
    ON public.chimera_content_pack_entity_links(pack_id);
CREATE INDEX IF NOT EXISTS idx_chimera_content_pack_entity_links_entity_template_id 
    ON public.chimera_content_pack_entity_links(entity_template_id);
CREATE INDEX IF NOT EXISTS idx_chimera_content_pack_ruleset_links_pack_id 
    ON public.chimera_content_pack_ruleset_links(pack_id);
CREATE INDEX IF NOT EXISTS idx_chimera_content_pack_ruleset_links_ruleset_template_id 
    ON public.chimera_content_pack_ruleset_links(ruleset_template_id);
CREATE INDEX IF NOT EXISTS idx_chimera_content_pack_lore_links_pack_id 
    ON public.chimera_content_pack_lore_links(pack_id);
CREATE INDEX IF NOT EXISTS idx_chimera_content_pack_lore_links_lore_template_id 
    ON public.chimera_content_pack_lore_links(lore_template_id);
CREATE INDEX IF NOT EXISTS idx_chimera_pack_dependencies_pack_id 
    ON public.chimera_pack_dependencies(pack_id);
CREATE INDEX IF NOT EXISTS idx_chimera_pack_dependencies_depends_on_pack_id 
    ON public.chimera_pack_dependencies(depends_on_pack_id);

-- Add comments
COMMENT ON TABLE public.chimera_content_packs IS 
    'Content packs - "Nexus Mod" style containers for bundling UGC assets (NPCs, Items, Lore, Rulesets)';
COMMENT ON COLUMN public.chimera_content_packs.id IS 
    'Unique identifier for the content pack';
COMMENT ON COLUMN public.chimera_content_packs.owner_user_id IS 
    'User who created this content pack';
COMMENT ON COLUMN public.chimera_content_packs.visibility IS 
    'Visibility level: private (owner only), pending_approval (awaiting review), public (published)';
COMMENT ON COLUMN public.chimera_content_packs.is_system_asset IS 
    'If true, this is a system-provided pack (not user-generated)';
COMMENT ON COLUMN public.chimera_content_packs.version IS 
    'Version number for this pack. Incremented on updates.';
COMMENT ON COLUMN public.chimera_content_packs.pack_type IS 
    'Type of pack: NPC, ITEM, LORE, or MIXED (contains multiple types)';
COMMENT ON COLUMN public.chimera_content_packs.inter_entity_state IS 
    'JSON object containing predefined relationships between entities in this pack';
COMMENT ON TABLE public.chimera_pack_dependencies IS 
    'Dependencies between content packs. A pack may depend on other packs.';

COMMIT;

