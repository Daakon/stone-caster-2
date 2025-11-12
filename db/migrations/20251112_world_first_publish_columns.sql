-- World-First Publishing safety migration (idempotent)
-- Ensures visibility/review columns use native enums across worlds, entry_points, and npcs tables

BEGIN;

-- ============================================================================
-- ENUM TYPE DEFINITIONS
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'visibility_state'
  ) THEN
    CREATE TYPE public.visibility_state AS ENUM ('private', 'public', 'unlisted');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'review_state_enum'
  ) THEN
    CREATE TYPE public.review_state_enum AS ENUM ('draft', 'pending_review', 'approved', 'rejected');
  END IF;
END
$$;

-- ============================================================================
-- UPDATE RLS / DEPENDENT POLICIES TO BE ENUM-SAFE
-- ============================================================================

-- Note: ep_public_read_live policy will be dropped and recreated with enum-safe comparison below

-- ============================================================================
-- CAPTURE & DROP DEPENDENT VIEWS / POLICIES
-- ============================================================================

CREATE TEMP TABLE IF NOT EXISTS tmp_saved_views (
  name text PRIMARY KEY,
  definition text
);

CREATE TEMP TABLE IF NOT EXISTS tmp_policy_flags (
  name text PRIMARY KEY,
  should_restore boolean NOT NULL DEFAULT false
);

DO $$
DECLARE
  view_definition text;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_views
    WHERE schemaname = 'public'
      AND viewname = 'v_daily_active_public'
  ) THEN
    SELECT pg_get_viewdef('public.v_daily_active_public'::regclass, true)
      INTO view_definition;

    INSERT INTO tmp_saved_views(name, definition)
    VALUES ('v_daily_active_public', view_definition)
    ON CONFLICT (name) DO UPDATE SET definition = EXCLUDED.definition;

    EXECUTE 'DROP VIEW public.v_daily_active_public';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'entry_points'
      AND policyname = 'Entry Points: Anyone can view active public entry points'
  ) THEN
    INSERT INTO tmp_policy_flags(name, should_restore)
    VALUES ('entry_points_public_read', true)
    ON CONFLICT (name) DO UPDATE SET should_restore = true;

    EXECUTE format('DROP POLICY %I ON public.entry_points', 'Entry Points: Anyone can view active public entry points');
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'entry_points'
      AND policyname = 'ep_public_read_live'
  ) THEN
    INSERT INTO tmp_policy_flags(name, should_restore)
    VALUES ('ep_public_read_live', true)
    ON CONFLICT (name) DO UPDATE SET should_restore = true;

    EXECUTE format('DROP POLICY %I ON public.entry_points', 'ep_public_read_live');
  END IF;
END
$$;

-- Drop NPC policies that depend on visibility column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'npcs'
      AND policyname = 'npcs_users_can_view_own_and_public'
  ) THEN
    INSERT INTO tmp_policy_flags(name, should_restore)
    VALUES ('npcs_users_can_view_own_and_public', true)
    ON CONFLICT (name) DO UPDATE SET should_restore = true;

    EXECUTE format('DROP POLICY %I ON public.npcs', 'npcs_users_can_view_own_and_public');
  END IF;
END
$$;

-- ============================================================================
-- DROP LEGACY CHECK CONSTRAINTS (text-based) BEFORE ENUM MIGRATION
-- ============================================================================

DO $$
DECLARE
  constraint_rec RECORD;
BEGIN
  FOR constraint_rec IN
    SELECT constraint_name
    FROM information_schema.constraint_column_usage
    WHERE table_schema = 'public'
      AND table_name = 'worlds'
      AND constraint_name IN ('worlds_visibility_check', 'worlds_review_state_check')
  LOOP
    EXECUTE format('ALTER TABLE public.worlds DROP CONSTRAINT IF EXISTS %I', constraint_rec.constraint_name);
  END LOOP;

  FOR constraint_rec IN
    SELECT constraint_name
    FROM information_schema.constraint_column_usage
    WHERE table_schema = 'public'
      AND table_name = 'entry_points'
      AND constraint_name IN (
        'entry_points_visibility_check',
        'entry_points_publish_visibility_check',
        'entry_points_review_state_check'
      )
  LOOP
    EXECUTE format('ALTER TABLE public.entry_points DROP CONSTRAINT IF EXISTS %I', constraint_rec.constraint_name);
  END LOOP;

  FOR constraint_rec IN
    SELECT constraint_name
    FROM information_schema.constraint_column_usage
    WHERE table_schema = 'public'
      AND table_name = 'npcs'
      AND constraint_name IN ('npcs_visibility_check', 'npcs_review_state_check')
  LOOP
    EXECUTE format('ALTER TABLE public.npcs DROP CONSTRAINT IF EXISTS %I', constraint_rec.constraint_name);
  END LOOP;
END
$$;

-- ============================================================================
-- WORLDS TABLE
-- ============================================================================

ALTER TABLE public.worlds
  ADD COLUMN IF NOT EXISTS visibility public.visibility_state NOT NULL DEFAULT 'private';

ALTER TABLE public.worlds
  ALTER COLUMN visibility DROP DEFAULT,
  ALTER COLUMN visibility TYPE public.visibility_state USING visibility::public.visibility_state,
  ALTER COLUMN visibility SET DEFAULT 'private';

ALTER TABLE public.worlds
  ADD COLUMN IF NOT EXISTS review_state public.review_state_enum NOT NULL DEFAULT 'draft';

ALTER TABLE public.worlds
  ALTER COLUMN review_state DROP DEFAULT,
  ALTER COLUMN review_state TYPE public.review_state_enum USING review_state::public.review_state_enum,
  ALTER COLUMN review_state SET DEFAULT 'draft';

ALTER TABLE public.worlds
  ADD COLUMN IF NOT EXISTS owner_user_id uuid NULL;

ALTER TABLE public.worlds
  ADD COLUMN IF NOT EXISTS version_int integer NOT NULL DEFAULT 1;

ALTER TABLE public.worlds
  ADD COLUMN IF NOT EXISTS parent_id uuid NULL;

ALTER TABLE public.worlds
  ADD COLUMN IF NOT EXISTS review_reason text NULL,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_worlds_visibility ON public.worlds(visibility);
CREATE INDEX IF NOT EXISTS idx_worlds_review_state ON public.worlds(review_state);

-- ============================================================================
-- ENTRY_POINTS TABLE (stories)
-- ============================================================================

ALTER TABLE public.entry_points
  ADD COLUMN IF NOT EXISTS visibility public.visibility_state NOT NULL DEFAULT 'private';

ALTER TABLE public.entry_points
  ALTER COLUMN visibility DROP DEFAULT,
  ALTER COLUMN visibility TYPE public.visibility_state USING visibility::public.visibility_state,
  ALTER COLUMN visibility SET DEFAULT 'private';

ALTER TABLE public.entry_points
  ADD COLUMN IF NOT EXISTS publish_visibility public.visibility_state NOT NULL DEFAULT 'private';

ALTER TABLE public.entry_points
  ALTER COLUMN publish_visibility DROP DEFAULT,
  ALTER COLUMN publish_visibility TYPE public.visibility_state USING publish_visibility::public.visibility_state,
  ALTER COLUMN publish_visibility SET DEFAULT 'private';

ALTER TABLE public.entry_points
  ADD COLUMN IF NOT EXISTS review_state public.review_state_enum NOT NULL DEFAULT 'draft';

ALTER TABLE public.entry_points
  ALTER COLUMN review_state DROP DEFAULT,
  ALTER COLUMN review_state TYPE public.review_state_enum USING review_state::public.review_state_enum,
  ALTER COLUMN review_state SET DEFAULT 'draft';

ALTER TABLE public.entry_points
  ADD COLUMN IF NOT EXISTS owner_user_id uuid NULL;

ALTER TABLE public.entry_points
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

ALTER TABLE public.entry_points
  ADD COLUMN IF NOT EXISTS parent_id uuid NULL;

ALTER TABLE public.entry_points
  ADD COLUMN IF NOT EXISTS review_reason text NULL,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz NULL;

ALTER TABLE public.entry_points
  ADD COLUMN IF NOT EXISTS dependency_invalid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS blocked_reason text NULL;

CREATE INDEX IF NOT EXISTS idx_entry_points_publish_visibility
  ON public.entry_points(publish_visibility);

CREATE INDEX IF NOT EXISTS idx_entry_points_review_state
  ON public.entry_points(review_state);

CREATE INDEX IF NOT EXISTS idx_entry_points_dependency_invalid
  ON public.entry_points(dependency_invalid);

-- ============================================================================
-- NPCS TABLE
-- ============================================================================

ALTER TABLE public.npcs
  ADD COLUMN IF NOT EXISTS visibility public.visibility_state NOT NULL DEFAULT 'private';

ALTER TABLE public.npcs
  ALTER COLUMN visibility DROP DEFAULT,
  ALTER COLUMN visibility TYPE public.visibility_state USING visibility::public.visibility_state,
  ALTER COLUMN visibility SET DEFAULT 'private';

ALTER TABLE public.npcs
  ADD COLUMN IF NOT EXISTS review_state public.review_state_enum NOT NULL DEFAULT 'draft';

ALTER TABLE public.npcs
  ALTER COLUMN review_state DROP DEFAULT,
  ALTER COLUMN review_state TYPE public.review_state_enum USING review_state::public.review_state_enum,
  ALTER COLUMN review_state SET DEFAULT 'draft';

ALTER TABLE public.npcs
  ADD COLUMN IF NOT EXISTS owner_user_id uuid NULL;

ALTER TABLE public.npcs
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

ALTER TABLE public.npcs
  ADD COLUMN IF NOT EXISTS parent_id uuid NULL;

ALTER TABLE public.npcs
  ADD COLUMN IF NOT EXISTS review_reason text NULL,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz NULL;

ALTER TABLE public.npcs
  ADD COLUMN IF NOT EXISTS dependency_invalid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS blocked_reason text NULL;

CREATE INDEX IF NOT EXISTS idx_npcs_visibility ON public.npcs(visibility);
CREATE INDEX IF NOT EXISTS idx_npcs_review_state ON public.npcs(review_state);
CREATE INDEX IF NOT EXISTS idx_npcs_dependency_invalid ON public.npcs(dependency_invalid);

-- ============================================================================
-- BACKFILL EXISTING PUBLIC CONTENT TO APPROVED
-- ============================================================================

UPDATE public.worlds
SET review_state = 'approved'
WHERE visibility = 'public'::public.visibility_state
  AND review_state = 'draft'::public.review_state_enum;

UPDATE public.entry_points
SET review_state = 'approved'
WHERE publish_visibility = 'public'::public.visibility_state
  AND review_state = 'draft'::public.review_state_enum;

UPDATE public.npcs
SET review_state = 'approved'
WHERE visibility = 'public'::public.visibility_state
  AND review_state = 'draft'::public.review_state_enum;

-- ============================================================================
-- RESTORE DEPENDENT VIEWS
-- ============================================================================

DO $$
DECLARE
  view_definition text;
  policy_should_restore boolean;
BEGIN
  -- Restore view with enum-safe comparisons
  SELECT definition INTO view_definition
  FROM tmp_saved_views
  WHERE name = 'v_daily_active_public';

  IF view_definition IS NOT NULL THEN
    -- Replace all text-based visibility comparisons with enum-safe comparisons
    -- Replace 'public'::text with 'public'::public.visibility_state
    view_definition := regexp_replace(view_definition, '''public''::text', '''public''::public.visibility_state', 'g');
    -- Replace visibility = 'public' (without cast) with enum cast
    view_definition := regexp_replace(view_definition, 'visibility\s*=\s*''public''(?!::)', 'visibility = ''public''::public.visibility_state', 'g');
    -- Replace entry_points.visibility = 'public'::text with enum cast
    view_definition := regexp_replace(view_definition, 'entry_points\.visibility\s*=\s*''public''::text', 'entry_points.visibility = ''public''::public.visibility_state', 'g');
    -- Replace any remaining visibility::text = 'public' patterns
    view_definition := regexp_replace(view_definition, 'visibility::text\s*=\s*''public''', 'visibility = ''public''::public.visibility_state', 'g');
    
    EXECUTE format('CREATE VIEW public.v_daily_active_public AS %s', view_definition);
  END IF;

  -- Restore entry_points_public_read policy with enum-safe comparison
  SELECT tpf.should_restore INTO policy_should_restore
  FROM tmp_policy_flags tpf
  WHERE tpf.name = 'entry_points_public_read';

  IF policy_should_restore THEN
    EXECUTE '
      CREATE POLICY "Entry Points: Anyone can view active public entry points"
      ON public.entry_points
      FOR SELECT
      TO anon, authenticated
      USING (lifecycle = ''active'' AND visibility = ''public''::public.visibility_state)
    ';
  END IF;

  -- Restore ep_public_read_live policy with enum-safe comparison
  SELECT tpf.should_restore INTO policy_should_restore
  FROM tmp_policy_flags tpf
  WHERE tpf.name = 'ep_public_read_live';

  IF policy_should_restore THEN
    EXECUTE '
      CREATE POLICY ep_public_read_live
      ON public.entry_points
      FOR SELECT
      TO anon, authenticated
      USING (lifecycle = ''active'' AND visibility = ''public''::public.visibility_state)
    ';
  END IF;

  -- Restore npcs_users_can_view_own_and_public policy with enum-safe comparison
  SELECT tpf.should_restore INTO policy_should_restore
  FROM tmp_policy_flags tpf
  WHERE tpf.name = 'npcs_users_can_view_own_and_public';

  IF policy_should_restore THEN
    -- Recreate policy with enum-safe visibility check
    -- Note: Uses owner_user_id (new standard) - if user_id column exists, it should be migrated separately
    EXECUTE '
      CREATE POLICY npcs_users_can_view_own_and_public
      ON public.npcs
      FOR SELECT
      USING (
        -- Users can see their own NPCs
        auth.uid() = owner_user_id OR
        -- Users can see public NPCs (enum-safe check)
        visibility = ''public''::public.visibility_state OR
        -- Admins can see all NPCs
        EXISTS (
          SELECT 1 FROM public.user_profiles up 
          WHERE up.auth_user_id = auth.uid() 
          AND up.role IN (''admin'', ''moderator'')
        )
      )
    ';
  END IF;
END
$$;

COMMIT;
