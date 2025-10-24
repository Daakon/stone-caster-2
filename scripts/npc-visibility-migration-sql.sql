-- NPC Visibility and Authors Migration
-- Run this SQL in your Supabase SQL Editor to fix the visibility column issue

BEGIN;

-- Add visibility and author fields to npcs table
ALTER TABLE public.npcs 
ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
ADD COLUMN IF NOT EXISTS author_name text,
ADD COLUMN IF NOT EXISTS author_type text DEFAULT 'user' CHECK (author_type IN ('user', 'system', 'original'));

-- Add index for visibility filtering
CREATE INDEX IF NOT EXISTS idx_npcs_visibility ON public.npcs(visibility);
CREATE INDEX IF NOT EXISTS idx_npcs_author_type ON public.npcs(author_type);

-- Update existing NPCs to have proper author information
-- Set all existing NPCs as original characters (since they were created before user ownership)
UPDATE public.npcs 
SET 
  author_name = 'Original Character',
  author_type = 'original'
WHERE author_name IS NULL;

-- Update RLS policies to support both private and public NPCs
-- First, drop existing policies if they exist
DROP POLICY IF EXISTS "NPCs: Users can view their own NPCs" ON public.npcs;
DROP POLICY IF EXISTS "NPCs: Users can create their own NPCs" ON public.npcs;
DROP POLICY IF EXISTS "NPCs: Users can update their own NPCs" ON public.npcs;
DROP POLICY IF EXISTS "NPCs: Users can delete their own NPCs" ON public.npcs;
DROP POLICY IF EXISTS "NPCs: Admin can do everything" ON public.npcs;
DROP POLICY IF EXISTS "NPCs: Anyone can view active NPCs" ON public.npcs;

-- New RLS policies for dual visibility model
-- Note: These policies assume user_id column exists (from previous migration)
CREATE POLICY "NPCs: Users can view public NPCs and their own private NPCs" ON public.npcs
  FOR SELECT USING (
    visibility = 'public' OR 
    (visibility = 'private' AND auth.uid() = user_id)
  );

CREATE POLICY "NPCs: Users can create NPCs" ON public.npcs
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND 
    visibility IN ('private', 'public')
  );

CREATE POLICY "NPCs: Users can update their own NPCs" ON public.npcs
  FOR UPDATE USING (
    auth.uid() = user_id
  );

CREATE POLICY "NPCs: Users can delete their own NPCs" ON public.npcs
  FOR DELETE USING (
    auth.uid() = user_id
  );

-- Admin override policy (admins can see and manage all NPCs)
CREATE POLICY "NPCs: Admin can do everything" ON public.npcs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_profiles.user_id = auth.uid() 
      AND user_profiles.role IN ('admin', 'moderator')
    )
  );

-- Add comments for documentation
COMMENT ON COLUMN public.npcs.visibility IS 'Whether the NPC is private (user-only) or public (shared)';
COMMENT ON COLUMN public.npcs.author_name IS 'Display name of the NPC author';
COMMENT ON COLUMN public.npcs.author_type IS 'Type of author: user, system, or original character';

-- Insert some sample public NPCs with different author types
INSERT INTO public.npcs (id, name, description, status, visibility, author_name, author_type, prompt) VALUES
  ('550e8400-e29b-41d4-a716-446655440004', 'Gandalf the Grey', 'A wise wizard mentor from Middle-earth', 'active', 'public', 'J.R.R. Tolkien', 'original', 'You are Gandalf the Grey, a wise and powerful wizard. You speak in riddles and provide guidance to adventurers.'),
  ('550e8400-e29b-41d4-a716-446655440005', 'Captain Kirk', 'Bold starship captain from Star Trek', 'active', 'public', 'Gene Roddenberry', 'original', 'You are Captain James T. Kirk, commanding officer of the USS Enterprise. You are bold, decisive, and always ready for adventure.'),
  ('550e8400-e29b-41d4-a716-446655440006', 'System Assistant', 'Helpful AI assistant for game mechanics', 'active', 'public', 'Stone Caster', 'system', 'You are a helpful assistant that provides guidance on game rules and mechanics.')
ON CONFLICT (id) DO NOTHING;

COMMIT;
