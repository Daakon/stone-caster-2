-- Naming & Reference Semantics Cleanup Migration
-- Ensures name/slug on worlds/rulesets/entries, implements many-to-many rulesets per entry

BEGIN;

-- ============================================================================
-- 1) Ensure name/slug on worlds are present & unique
-- ============================================================================

ALTER TABLE public.worlds
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS description text;

UPDATE public.worlds
  SET name = COALESCE(name, 'World ' || LEFT(id::text, 8)),
      slug = COALESCE(slug, REGEXP_REPLACE(LOWER(COALESCE(name, 'world-'||LEFT(id::text,8))), '[^a-z0-9]+', '-', 'g'))
WHERE name IS NULL OR slug IS NULL;

ALTER TABLE public.worlds
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_worlds_slug ON public.worlds(slug);

-- ============================================================================
-- 2) Ensure name/slug on rulesets are present & unique
-- ============================================================================

ALTER TABLE public.rulesets
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS description text;

UPDATE public.rulesets
  SET name = COALESCE(name, 'Ruleset ' || LEFT(id::text, 8)),
      slug = COALESCE(slug, REGEXP_REPLACE(LOWER(COALESCE(name, 'ruleset-'||LEFT(id::text,8))), '[^a-z0-9]+', '-', 'g'))
WHERE name IS NULL OR slug IS NULL;

ALTER TABLE public.rulesets
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_rulesets_slug ON public.rulesets(slug);

-- ============================================================================
-- 3) Ensure name/slug on entry_points are present & unique
-- ============================================================================

ALTER TABLE public.entry_points
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS slug text;

UPDATE public.entry_points
  SET name = COALESCE(name, title, 'Entry ' || LEFT(id::text, 8)),
      slug = COALESCE(slug, REGEXP_REPLACE(LOWER(COALESCE(name, title, 'entry-'||LEFT(id::text,8))), '[^a-z0-9]+', '-', 'g'))
WHERE name IS NULL OR slug IS NULL;

ALTER TABLE public.entry_points
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_entry_points_slug ON public.entry_points(slug);

-- ============================================================================
-- 4) Ensure the join table for many rulesets per entry
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.entry_point_rulesets (
  entry_point_id text NOT NULL REFERENCES public.entry_points(id) ON DELETE CASCADE,
  ruleset_id     text NOT NULL REFERENCES public.rulesets(id) ON DELETE RESTRICT,
  sort_order     int  NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entry_point_id, ruleset_id)
);

CREATE INDEX IF NOT EXISTS idx_epr_entry ON public.entry_point_rulesets(entry_point_id);
CREATE INDEX IF NOT EXISTS idx_epr_ruleset ON public.entry_point_rulesets(ruleset_id);
CREATE INDEX IF NOT EXISTS idx_epr_sort ON public.entry_point_rulesets(entry_point_id, sort_order);

-- ============================================================================
-- 5) RLS for entry_point_rulesets (mirrors entry ownership / moderator/admin)
-- ============================================================================

ALTER TABLE public.entry_point_rulesets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS epr_owner_rw ON public.entry_point_rulesets;
CREATE POLICY epr_owner_rw ON public.entry_point_rulesets
FOR ALL
USING (EXISTS (SELECT 1 FROM public.entry_points ep
               WHERE ep.id = entry_point_id
                 AND (ep.owner_user_id = auth.uid()
                      OR EXISTS (SELECT 1 FROM public.app_roles r WHERE r.user_id=auth.uid() AND r.role IN ('moderator','admin')))))
WITH CHECK (EXISTS (SELECT 1 FROM public.entry_points ep
               WHERE ep.id = entry_point_id
                 AND (ep.owner_user_id = auth.uid()
                      OR EXISTS (SELECT 1 FROM public.app_roles r WHERE r.user_id=auth.uid() AND r.role IN ('moderator','admin')))));

-- ============================================================================
-- 6) Constraints
-- ============================================================================

-- Sort order bounds
ALTER TABLE public.entry_point_rulesets
  ADD CONSTRAINT chk_epr_sort_order CHECK (sort_order BETWEEN 0 AND 999);

-- ============================================================================
-- 7) Comments
-- ============================================================================

COMMENT ON TABLE public.entry_point_rulesets IS 'Many-to-many relationship between entry points and rulesets with ordering';
COMMENT ON COLUMN public.entry_point_rulesets.entry_point_id IS 'Entry point identifier';
COMMENT ON COLUMN public.entry_point_rulesets.ruleset_id IS 'Ruleset identifier';
COMMENT ON COLUMN public.entry_point_rulesets.sort_order IS 'Order of ruleset application (0-999, lower numbers first)';
COMMENT ON COLUMN public.entry_point_rulesets.created_at IS 'When the relationship was created';

COMMENT ON COLUMN public.worlds.name IS 'Human-readable world name';
COMMENT ON COLUMN public.worlds.slug IS 'URL-safe world identifier';
COMMENT ON COLUMN public.worlds.description IS 'World description/synopsis';

COMMENT ON COLUMN public.rulesets.name IS 'Human-readable ruleset name';
COMMENT ON COLUMN public.rulesets.slug IS 'URL-safe ruleset identifier';
COMMENT ON COLUMN public.rulesets.description IS 'Ruleset description';

COMMENT ON COLUMN public.entry_points.name IS 'Human-readable entry point name';
COMMENT ON COLUMN public.entry_points.slug IS 'URL-safe entry point identifier';

COMMIT;














