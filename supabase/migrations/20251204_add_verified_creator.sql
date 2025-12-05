-- ============================================================================
-- Phase 4.2: Verified Creator System & Auto-Approval Logic
-- Add is_verified_creator flag to profiles for auto-approval publishing
-- Date: 2025-12-04
-- ============================================================================

-- ============================================================================
-- PART 1: Add Verified Creator Flag to Profiles
-- ============================================================================

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_verified_creator BOOLEAN NOT NULL DEFAULT false;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_profiles_verified_creator ON public.profiles(is_verified_creator) WHERE is_verified_creator = true;

-- Add comment
COMMENT ON COLUMN public.profiles.is_verified_creator IS 
    'True if user is a verified creator who can publish content directly without admin approval. Admins can also publish directly.';

-- ============================================================================
-- PART 2: Update profiles_view to Include Verified Flag
-- ============================================================================

-- Drop existing view
DROP VIEW IF EXISTS public.profiles_view;

-- Recreate view with is_verified_creator column
CREATE OR REPLACE VIEW public.profiles_view AS
SELECT
  p.id,
  p.role,
  p.is_verified_creator, -- NEW COLUMN
  au.updated_at,
  au.created_at,
  au.email,
  au.last_sign_in_at,
  au.raw_user_meta_data
FROM public.profiles p
JOIN auth.users au ON p.id = au.id;

-- Set ownership and permissions
ALTER VIEW public.profiles_view OWNER TO postgres;
GRANT SELECT ON public.profiles_view TO authenticated;

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Summary:
-- ✅ Added is_verified_creator column to profiles table
-- ✅ Created index for fast verified creator lookups
-- ✅ Updated profiles_view to include is_verified_creator
-- ✅ Added documentation comment
-- 
-- Next Steps:
-- 1. Update backend routes to enforce auto-approval logic
-- 2. Update roles service to manage is_verified_creator flag
-- 3. Create pending submissions query for admins

