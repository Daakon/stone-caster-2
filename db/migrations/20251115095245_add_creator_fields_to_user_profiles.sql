-- Add creator profile fields to user_profiles table
-- Phase 2: UGC platform - Creator Profiles

BEGIN;

-- Add creator profile columns to user_profiles table
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS creator_slug text NULL,
  ADD COLUMN IF NOT EXISTS public_bio text NULL,
  ADD COLUMN IF NOT EXISTS profile_image_url text NULL,
  ADD COLUMN IF NOT EXISTS website_url text NULL;

-- Create unique index on creator_slug (only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_creator_slug_unique 
  ON public.user_profiles(creator_slug) 
  WHERE creator_slug IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.user_profiles.creator_slug IS 
  'Unique slug for creator profile URL (e.g., /creators/john-doe)';
COMMENT ON COLUMN public.user_profiles.public_bio IS 
  'Public biography displayed on creator profile page';
COMMENT ON COLUMN public.user_profiles.profile_image_url IS 
  'URL to creator profile image';
COMMENT ON COLUMN public.user_profiles.website_url IS 
  'Creator website URL';

COMMIT;

