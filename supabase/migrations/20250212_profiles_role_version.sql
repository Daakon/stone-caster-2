-- Phase B3: Add role_version column for cache invalidation
BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role_version INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS profiles_role_version_idx ON public.profiles (role_version);

COMMENT ON COLUMN public.profiles.role_version IS 'Monotonically incrementing version for cache invalidation. Increment when role changes.';

COMMIT;

