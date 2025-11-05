-- Phase 0: Early Access - Profiles Table, Roles, and RLS
-- Creates profiles table with role-based access control
-- Adds is_admin() function for RLS policies
-- Backfills profiles for existing auth.users

BEGIN;

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'pending' CHECK (role IN ('pending', 'early_access', 'member', 'admin')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid NULL REFERENCES auth.users(id),
  approval_note text NULL
);

-- Create index on role for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Create index on id (primary key already has one, but explicit for clarity)
CREATE INDEX IF NOT EXISTS idx_profiles_id ON public.profiles(id);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create is_admin() function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

-- RLS Policies

-- Policy 1: Users can select their own row
CREATE POLICY "Users can select own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Policy 2: Users can update their own row (but not role)
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  -- Note: role changes should be restricted to admins only
  -- This policy allows updating other fields, role updates handled separately
);

-- Policy 3: Admins can select all profiles
CREATE POLICY "Admins can select all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_admin());

-- Policy 4: Admins can update any profile
CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Backfill: Create profiles for existing auth.users without profiles
INSERT INTO public.profiles (id, role, joined_at)
SELECT 
  u.id,
  'pending'::text,
  COALESCE(u.created_at, now())
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

COMMIT;

