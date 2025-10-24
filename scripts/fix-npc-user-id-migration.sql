-- Fix NPC user_id column for AWF NPC table
-- This adds user_id to the existing AWF NPC table structure

BEGIN;

-- Add user_id column to the AWF NPC table
ALTER TABLE public.npcs 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add index for efficient user-based queries
CREATE INDEX IF NOT EXISTS idx_npcs_user_id ON public.npcs(user_id);

-- Update existing RLS policies to include user ownership
-- First, drop the existing admin-only policies
DROP POLICY IF EXISTS "awf_npcs_admin_select" ON public.npcs;
DROP POLICY IF EXISTS "awf_npcs_admin_write" ON public.npcs;

-- Create new RLS policies that support both user ownership and admin access
CREATE POLICY "npcs_users_can_view_own_and_public" ON public.npcs
  FOR SELECT USING (
    -- Users can see their own NPCs
    auth.uid() = user_id OR
    -- Users can see public NPCs (where user_id is NULL or visibility allows it)
    user_id IS NULL OR
    -- Admins can see all NPCs
    EXISTS (
      SELECT 1 FROM public.user_profiles up 
      WHERE up.auth_user_id = auth.uid() 
      AND up.role IN ('admin', 'moderator')
    )
  );

CREATE POLICY "npcs_users_can_create_own" ON public.npcs
  FOR INSERT WITH CHECK (
    -- Users can create NPCs with their own user_id
    auth.uid() = user_id OR
    -- Admins can create NPCs for any user
    EXISTS (
      SELECT 1 FROM public.user_profiles up 
      WHERE up.auth_user_id = auth.uid() 
      AND up.role IN ('admin', 'moderator')
    )
  );

CREATE POLICY "npcs_users_can_update_own" ON public.npcs
  FOR UPDATE USING (
    -- Users can update their own NPCs
    auth.uid() = user_id OR
    -- Admins can update any NPCs
    EXISTS (
      SELECT 1 FROM public.user_profiles up 
      WHERE up.auth_user_id = auth.uid() 
      AND up.role IN ('admin', 'moderator')
    )
  );

CREATE POLICY "npcs_users_can_delete_own" ON public.npcs
  FOR DELETE USING (
    -- Users can delete their own NPCs
    auth.uid() = user_id OR
    -- Admins can delete any NPCs
    EXISTS (
      SELECT 1 FROM public.user_profiles up 
      WHERE up.auth_user_id = auth.uid() 
      AND up.role IN ('admin', 'moderator')
    )
  );

-- Add comment for documentation
COMMENT ON COLUMN public.npcs.user_id IS 'User who owns this NPC - NULL for system/public NPCs';

COMMIT;
