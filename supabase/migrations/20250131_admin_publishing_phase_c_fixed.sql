-- Admin Publishing Phase C Migration (Fixed)
-- Adds versioning, history, and import/export capabilities

-- ============================================================================
-- RULESET VERSIONING
-- ============================================================================

-- Add versioning columns to rulesets
ALTER TABLE public.rulesets
  ADD COLUMN IF NOT EXISTS version_major int DEFAULT 1,
  ADD COLUMN IF NOT EXISTS version_minor int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS version_patch int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_mutable boolean GENERATED ALWAYS AS (status = 'draft') STORED;

-- Create computed version_semver column
ALTER TABLE public.rulesets
  ADD COLUMN IF NOT EXISTS version_semver text GENERATED ALWAYS AS (
    version_major::text || '.' || version_minor::text || '.' || version_patch::text
  ) STORED;

-- Add unique constraint on slug + version (without IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'rulesets_slug_version_unique'
  ) THEN
    ALTER TABLE public.rulesets
      ADD CONSTRAINT rulesets_slug_version_unique 
      UNIQUE (slug, version_major, version_minor, version_patch);
  END IF;
END $$;

-- ============================================================================
-- RULESET REVISIONS HISTORY
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ruleset_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ruleset_id uuid NOT NULL REFERENCES public.rulesets(id) ON DELETE CASCADE,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  actor uuid NULL -- admin user id if available
);

CREATE INDEX IF NOT EXISTS ruleset_revisions_ruleset_idx ON public.ruleset_revisions(ruleset_id);
CREATE INDEX IF NOT EXISTS ruleset_revisions_created_idx ON public.ruleset_revisions(created_at);

-- ============================================================================
-- CONTENT IMPORT JOBS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.content_import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('world', 'ruleset', 'npc', 'npc_pack', 'entry', 'bundle')),
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'validated', 'applied', 'failed')),
  report jsonb,
  created_at timestamptz DEFAULT now(),
  created_by uuid NULL
);

CREATE INDEX IF NOT EXISTS content_import_jobs_kind_idx ON public.content_import_jobs(kind);
CREATE INDEX IF NOT EXISTS content_import_jobs_status_idx ON public.content_import_jobs(status);

-- ============================================================================
-- ENHANCED CONSTRAINTS
-- ============================================================================

-- Ensure non-empty names for all entities (without IF NOT EXISTS)
DO $$
BEGIN
  -- Worlds name constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'worlds_name_not_empty'
  ) THEN
    ALTER TABLE public.worlds
      ADD CONSTRAINT worlds_name_not_empty CHECK (length(trim(name)) > 0);
  END IF;

  -- Rulesets name constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'rulesets_name_not_empty'
  ) THEN
    ALTER TABLE public.rulesets
      ADD CONSTRAINT rulesets_name_not_empty CHECK (length(trim(name)) > 0);
  END IF;

  -- NPCs name constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'npcs_name_not_empty'
  ) THEN
    ALTER TABLE public.npcs
      ADD CONSTRAINT npcs_name_not_empty CHECK (length(trim(name)) > 0);
  END IF;

  -- NPC Packs name constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'npc_packs_name_not_empty'
  ) THEN
    ALTER TABLE public.npc_packs
      ADD CONSTRAINT npc_packs_name_not_empty CHECK (length(trim(name)) > 0);
  END IF;
END $$;

-- ============================================================================
-- RLS POLICIES FOR NEW TABLES
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE public.ruleset_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_import_jobs ENABLE ROW LEVEL SECURITY;

-- Ruleset revisions policies
CREATE POLICY "Ruleset revisions: Admin can read all" ON public.ruleset_revisions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_profiles.user_id = auth.uid() 
      AND user_profiles.role IN ('admin', 'moderator')
    )
  );

CREATE POLICY "Ruleset revisions: Admin can insert" ON public.ruleset_revisions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_profiles.user_id = auth.uid() 
      AND user_profiles.role IN ('admin', 'moderator')
    )
  );

-- Content import jobs policies
CREATE POLICY "Import jobs: Admin can do everything" ON public.content_import_jobs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_profiles.user_id = auth.uid() 
      AND user_profiles.role IN ('admin', 'moderator')
    )
  );

-- ============================================================================
-- RPC FUNCTIONS FOR PUBLISHING
-- ============================================================================

-- Function to publish a ruleset
CREATE OR REPLACE FUNCTION public.publish_ruleset(ruleset_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  ruleset_record public.rulesets%ROWTYPE;
  revision_id uuid;
  result jsonb;
BEGIN
  -- Get the ruleset
  SELECT * INTO ruleset_record FROM public.rulesets WHERE id = ruleset_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ruleset not found');
  END IF;
  
  -- Check if already active
  IF ruleset_record.status = 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ruleset is already active');
  END IF;
  
  -- Create revision snapshot
  INSERT INTO public.ruleset_revisions (ruleset_id, snapshot, actor)
  VALUES (ruleset_id, to_jsonb(ruleset_record), auth.uid())
  RETURNING id INTO revision_id;
  
  -- Update ruleset to active
  UPDATE public.rulesets 
  SET 
    status = 'active',
    published_at = now()
  WHERE id = ruleset_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'ruleset_id', ruleset_id,
    'revision_id', revision_id,
    'version', ruleset_record.version_semver
  );
END;
$$;

-- Function to clone a ruleset with version bump
CREATE OR REPLACE FUNCTION public.clone_ruleset(
  ruleset_id uuid,
  bump_type text DEFAULT 'minor'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  ruleset_record public.rulesets%ROWTYPE;
  new_version_major int;
  new_version_minor int;
  new_version_patch int;
  new_slug text;
  new_id uuid;
  result jsonb;
BEGIN
  -- Get the ruleset
  SELECT * INTO ruleset_record FROM public.rulesets WHERE id = ruleset_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ruleset not found');
  END IF;
  
  -- Calculate new version
  new_version_major := ruleset_record.version_major;
  new_version_minor := ruleset_record.version_minor;
  new_version_patch := ruleset_record.version_patch;
  
  CASE bump_type
    WHEN 'major' THEN
      new_version_major := new_version_major + 1;
      new_version_minor := 0;
      new_version_patch := 0;
    WHEN 'minor' THEN
      new_version_minor := new_version_minor + 1;
      new_version_patch := 0;
    WHEN 'patch' THEN
      new_version_patch := new_version_patch + 1;
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'Invalid bump type');
  END CASE;
  
  -- Generate new slug
  new_slug := ruleset_record.slug || '-v' || new_version_major || '-' || new_version_minor || '-' || new_version_patch;
  
  -- Create new ruleset
  INSERT INTO public.rulesets (
    name, slug, description, status, version_major, version_minor, version_patch
  ) VALUES (
    ruleset_record.name || ' (v' || new_version_major || '.' || new_version_minor || '.' || new_version_patch || ')',
    new_slug,
    ruleset_record.description,
    'draft',
    new_version_major,
    new_version_minor,
    new_version_patch
  ) RETURNING id INTO new_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'original_id', ruleset_id,
    'new_id', new_id,
    'new_version', new_version_major || '.' || new_version_minor || '.' || new_version_patch
  );
END;
$$;

-- ============================================================================
-- SEED DATA FOR TESTING
-- ============================================================================

-- Insert some sample rulesets with versioning
INSERT INTO public.rulesets (name, description, status, version_major, version_minor, version_patch) VALUES
  ('D&D 5e Core', 'Core D&D 5th Edition rules', 'active', 1, 0, 0),
  ('Pathfinder Core', 'Core Pathfinder rules', 'draft', 2, 1, 0),
  ('Custom Fantasy', 'Custom fantasy ruleset', 'active', 1, 2, 3)
ON CONFLICT (slug, version_major, version_minor, version_patch) DO NOTHING;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.ruleset_revisions IS 'Append-only history of ruleset changes';
COMMENT ON TABLE public.content_import_jobs IS 'Tracks import/export operations';
COMMENT ON FUNCTION public.publish_ruleset IS 'Publishes a draft ruleset to active status';
COMMENT ON FUNCTION public.clone_ruleset IS 'Clones a ruleset with version bump';







