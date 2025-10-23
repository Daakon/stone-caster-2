-- Add user ownership to NPCs table
-- NPCs should be private to the player who created them

BEGIN;

-- Add user_id column to npcs table
ALTER TABLE public.npcs 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add index for efficient user-based queries
CREATE INDEX IF NOT EXISTS idx_npcs_user_id ON public.npcs(user_id);

-- Update RLS policies to enforce user ownership
DROP POLICY IF EXISTS "NPCs: Anyone can view active NPCs" ON public.npcs;
DROP POLICY IF EXISTS "NPCs: Admin can do everything" ON public.npcs;

-- New RLS policies for user ownership
CREATE POLICY "NPCs: Users can view their own NPCs" ON public.npcs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "NPCs: Users can create their own NPCs" ON public.npcs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "NPCs: Users can update their own NPCs" ON public.npcs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "NPCs: Users can delete their own NPCs" ON public.npcs
  FOR DELETE USING (auth.uid() = user_id);

-- Admin override policy (admins can see all NPCs)
CREATE POLICY "NPCs: Admin can do everything" ON public.npcs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_profiles.user_id = auth.uid() 
      AND user_profiles.role IN ('admin', 'moderator')
    )
  );

-- Add comment for documentation
COMMENT ON COLUMN public.npcs.user_id IS 'User who owns this NPC - NPCs are private to their creator';

COMMIT;
