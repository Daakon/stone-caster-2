-- Comprehensive NPC Fix
-- This addresses the missing user_id column and API compatibility issues

BEGIN;

-- Add user_id column to the existing NPC table
ALTER TABLE public.npcs 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add index for efficient user-based queries
CREATE INDEX IF NOT EXISTS idx_npcs_user_id ON public.npcs(user_id);

-- Update RLS policies to include user ownership
-- First, drop existing policies that might conflict
DROP POLICY IF EXISTS "NPCs: Users can view their own NPCs" ON public.npcs;
DROP POLICY IF EXISTS "NPCs: Users can create their own NPCs" ON public.npcs;
DROP POLICY IF EXISTS "NPCs: Users can update their own NPCs" ON public.npcs;
DROP POLICY IF EXISTS "NPCs: Users can delete their own NPCs" ON public.npcs;
DROP POLICY IF EXISTS "NPCs: Admin can do everything" ON public.npcs;
DROP POLICY IF EXISTS "NPCs: Users can view public NPCs and their own private NPCs" ON public.npcs;
DROP POLICY IF EXISTS "NPCs: Users can create NPCs" ON public.npcs;
DROP POLICY IF EXISTS "NPCs: Users can update their own NPCs" ON public.npcs;
DROP POLICY IF EXISTS "NPCs: Users can delete their own NPCs" ON public.npcs;

-- Create comprehensive RLS policies
CREATE POLICY "npcs_users_can_view_own_and_public" ON public.npcs
  FOR SELECT USING (
    -- Users can see their own NPCs
    auth.uid() = user_id OR
    -- Users can see public NPCs (where visibility = 'public' or user_id is NULL)
    (visibility = 'public' OR user_id IS NULL) OR
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
