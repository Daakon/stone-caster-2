-- Create chimera_lore_entries table
-- Phase 1: Pure RAG Lore System - Story-specific lore entries
-- This table stores lore entries that are specific to a story and will be vectorized for RAG

BEGIN;

-- Create chimera_lore_entries table
CREATE TABLE IF NOT EXISTS public.chimera_lore_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id text NOT NULL REFERENCES public.chimera_stories(id) ON DELETE CASCADE,
    display_name text NOT NULL,
    entry_text text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create index on story_id for performance
CREATE INDEX IF NOT EXISTS idx_chimera_lore_entries_story_id 
    ON public.chimera_lore_entries(story_id);

-- Add comments
COMMENT ON TABLE public.chimera_lore_entries IS 
    'Story-specific lore entries for Pure RAG system. These entries are vectorized by the compiler for semantic search during narrative generation.';
COMMENT ON COLUMN public.chimera_lore_entries.id IS 
    'Unique identifier for the lore entry (UUID)';
COMMENT ON COLUMN public.chimera_lore_entries.story_id IS 
    'Foreign key to chimera_stories.id. Lore entries are story-specific.';
COMMENT ON COLUMN public.chimera_lore_entries.display_name IS 
    'Display name for the lore entry (for UI purposes)';
COMMENT ON COLUMN public.chimera_lore_entries.entry_text IS 
    'The actual lore content text that will be vectorized for RAG search';

COMMIT;

