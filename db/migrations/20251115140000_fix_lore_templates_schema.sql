-- Fix chimera_lore_templates table schema
-- Phase 2: Content Pack system - correct lore template structure

BEGIN;

-- Drop the old lore_templates table if it exists with wrong schema
DROP TABLE IF EXISTS public.chimera_lore_templates CASCADE;

-- Create chimera_lore_templates table with correct schema
CREATE TABLE IF NOT EXISTS public.chimera_lore_templates (
    id text PRIMARY KEY,
    owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    visibility public.chimera_world_visibility NOT NULL DEFAULT 'private',
    is_system_asset boolean NOT NULL DEFAULT false,
    version integer NOT NULL DEFAULT 1,
    display_name text NOT NULL,
    content_chunk text NOT NULL,
    tags text[] DEFAULT '{}',
    embedding vector(1536) NULL, -- Using pgvector extension, 1536 dimensions for OpenAI embeddings
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uk_chimera_lore_templates_id UNIQUE (id),
    CONSTRAINT uk_chimera_lore_templates_owner_user_id_display_name UNIQUE (owner_user_id, display_name)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_chimera_lore_templates_owner_user_id 
    ON public.chimera_lore_templates(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_chimera_lore_templates_visibility 
    ON public.chimera_lore_templates(visibility);
CREATE INDEX IF NOT EXISTS idx_chimera_lore_templates_is_system_asset 
    ON public.chimera_lore_templates(is_system_asset);
CREATE INDEX IF NOT EXISTS idx_chimera_lore_templates_tags 
    ON public.chimera_lore_templates USING GIN(tags);

-- Add comments
COMMENT ON TABLE public.chimera_lore_templates IS 
    'Lore templates (background information, world-building content) for Chimera V2';
COMMENT ON COLUMN public.chimera_lore_templates.id IS 
    'Unique identifier for the lore template';
COMMENT ON COLUMN public.chimera_lore_templates.owner_user_id IS 
    'User who created this lore template';
COMMENT ON COLUMN public.chimera_lore_templates.visibility IS 
    'Visibility level: private (owner only), pending_approval (awaiting review), public (published)';
COMMENT ON COLUMN public.chimera_lore_templates.is_system_asset IS 
    'If true, this is a system-provided lore template (not user-generated)';
COMMENT ON COLUMN public.chimera_lore_templates.version IS 
    'Version number for this lore template. Incremented on updates.';
COMMENT ON COLUMN public.chimera_lore_templates.content_chunk IS 
    'The actual lore content text';
COMMENT ON COLUMN public.chimera_lore_templates.tags IS 
    'Array of tags for categorizing and searching lore';
COMMENT ON COLUMN public.chimera_lore_templates.embedding IS 
    'Vector embedding for semantic search (1536 dimensions for OpenAI embeddings)';

COMMIT;

