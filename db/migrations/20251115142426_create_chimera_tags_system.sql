-- Create chimera_tags and chimera_asset_tags tables
-- Phase 2: Refactor tags from freeform arrays to database-backed, admin-curated system

BEGIN;

-- Create chimera_tags table
CREATE TABLE IF NOT EXISTS public.chimera_tags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tag_name text NOT NULL UNIQUE,
    is_approved boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uk_chimera_tags_tag_name UNIQUE (tag_name)
);

-- Create chimera_asset_tags polymorphic link table
CREATE TABLE IF NOT EXISTS public.chimera_asset_tags (
    tag_id uuid NOT NULL REFERENCES public.chimera_tags(id) ON DELETE CASCADE,
    asset_id text NOT NULL,
    asset_type text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tag_id, asset_id, asset_type),
    CONSTRAINT chk_chimera_asset_tags_asset_type CHECK (
        asset_type IN ('lore_template', 'world', 'entity_template', 'content_pack', 'story')
    )
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_chimera_tags_tag_name 
    ON public.chimera_tags(tag_name);
CREATE INDEX IF NOT EXISTS idx_chimera_tags_is_approved 
    ON public.chimera_tags(is_approved);
CREATE INDEX IF NOT EXISTS idx_chimera_asset_tags_tag_id 
    ON public.chimera_asset_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_chimera_asset_tags_asset_id 
    ON public.chimera_asset_tags(asset_id);
CREATE INDEX IF NOT EXISTS idx_chimera_asset_tags_asset_type 
    ON public.chimera_asset_tags(asset_type);
CREATE INDEX IF NOT EXISTS idx_chimera_asset_tags_composite 
    ON public.chimera_asset_tags(asset_id, asset_type);

-- Add comments
COMMENT ON TABLE public.chimera_tags IS 
    'Curated tags for categorizing Chimera assets. Tags must be approved by admins before being visible.';
COMMENT ON COLUMN public.chimera_tags.id IS 
    'Unique identifier for the tag';
COMMENT ON COLUMN public.chimera_tags.tag_name IS 
    'Normalized tag name (e.g., "FACTION", "HISTORY", "MAGIC")';
COMMENT ON COLUMN public.chimera_tags.is_approved IS 
    'If false, tag is pending admin approval and not visible in selectable lists';
COMMENT ON TABLE public.chimera_asset_tags IS 
    'Polymorphic link table connecting tags to various asset types (lore, worlds, entities, packs, stories)';
COMMENT ON COLUMN public.chimera_asset_tags.asset_id IS 
    'The ID of the asset (text, matches the asset table primary key)';
COMMENT ON COLUMN public.chimera_asset_tags.asset_type IS 
    'Type of asset: lore_template, world, entity_template, content_pack, or story';

COMMIT;

