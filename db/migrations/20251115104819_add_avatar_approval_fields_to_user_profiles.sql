-- Add avatar approval workflow fields to user_profiles table
-- Phase 2: Creator Profile - Image Upload with Admin Approval

BEGIN;

-- Create enum type for avatar image status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'avatar_image_status'
  ) THEN
    CREATE TYPE public.avatar_image_status AS ENUM ('none', 'pending', 'approved', 'rejected');
  END IF;
END
$$;

-- Add avatar approval columns to user_profiles table
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS approved_avatar_image_url text NULL,
  ADD COLUMN IF NOT EXISTS pending_avatar_image_url text NULL,
  ADD COLUMN IF NOT EXISTS avatar_image_status public.avatar_image_status NOT NULL DEFAULT 'none';

-- Add comments for documentation
COMMENT ON COLUMN public.user_profiles.approved_avatar_image_url IS 
  'URL to the approved avatar image (displayed publicly after admin approval)';
COMMENT ON COLUMN public.user_profiles.pending_avatar_image_url IS 
  'URL to the pending avatar image (awaiting admin approval)';
COMMENT ON COLUMN public.user_profiles.avatar_image_status IS 
  'Status of the avatar image: none (no image), pending (awaiting approval), approved (displayed), rejected (needs new upload)';

COMMIT;

