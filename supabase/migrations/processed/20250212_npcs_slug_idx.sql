-- Phase A3: NPC Slug Index
-- Adds index for slug lookups (either column or doc JSONB)
-- Also adds index on lower(name) for short query prefix search

BEGIN;

-- Index on slug column (if it exists)
CREATE INDEX IF NOT EXISTS npcs_slug_idx ON public.npcs (slug);

-- Index on doc->>'slug' (for JSONB slug storage)
CREATE INDEX IF NOT EXISTS npcs_doc_slug_idx ON public.npcs ((doc->>'slug'));

-- Index on lower(name) for prefix search performance (short queries <= 2 chars)
CREATE INDEX IF NOT EXISTS npcs_name_lower_idx ON public.npcs (lower(name));

COMMIT;

