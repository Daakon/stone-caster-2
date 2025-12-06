-- ============================================================================
-- Phase 3.6: Create profiles_view for Role Management
-- View to join profiles and auth.users for displaying user roles with emails
-- Date: 2025-12-04
-- ============================================================================

-- View to join profiles and auth.users
-- This allows the Admin UI to display both Role (from public.profiles) 
-- and Email (from auth.users) without complex client-side joins
CREATE OR REPLACE VIEW public.profiles_view AS
SELECT
  p.id,
  p.role,
  au.updated_at,
  au.created_at,
  au.email,
  au.last_sign_in_at,
  au.raw_user_meta_data
FROM public.profiles p
JOIN auth.users au ON p.id = au.id;

-- Grant access permissions
ALTER VIEW public.profiles_view OWNER TO postgres;
GRANT SELECT ON public.profiles_view TO authenticated;

-- Note: RLS does not apply to Views automatically.
-- If strictly for Admins, we will filter in the application layer
-- or simple RLS on the underlying table if security_invoker is used.

