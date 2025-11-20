-- Create chimera_game_states table
-- Phase 4: The Play Engine - Game state management for Chimera V2 stories
-- This table stores active game sessions (Story Spaces) for users

BEGIN;

-- Create chimera_game_states table
CREATE TABLE IF NOT EXISTS public.chimera_game_states (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id text NOT NULL REFERENCES public.chimera_stories(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    current_game_state jsonb NOT NULL DEFAULT '{}',
    turn_count integer NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended', 'abandoned')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_chimera_game_states_story_id 
    ON public.chimera_game_states(story_id);
CREATE INDEX IF NOT EXISTS idx_chimera_game_states_user_id 
    ON public.chimera_game_states(user_id);
CREATE INDEX IF NOT EXISTS idx_chimera_game_states_status 
    ON public.chimera_game_states(status);
CREATE INDEX IF NOT EXISTS idx_chimera_game_states_user_story 
    ON public.chimera_game_states(user_id, story_id);

-- Add comments for documentation
COMMENT ON TABLE public.chimera_game_states IS 
    'Active game sessions (Story Spaces) for Chimera V2 stories. Each row represents a user playing a story.';
COMMENT ON COLUMN public.chimera_game_states.id IS 
    'Unique identifier for the game state (UUID)';
COMMENT ON COLUMN public.chimera_game_states.story_id IS 
    'Foreign key to chimera_stories.id. The story being played.';
COMMENT ON COLUMN public.chimera_game_states.user_id IS 
    'Foreign key to auth.users.id. The user playing the story.';
COMMENT ON COLUMN public.chimera_game_states.current_game_state IS 
    'The current game state JSONB, structured with tier0_tracked_state, tier1_singular_state, and tier2_relational_state.';
COMMENT ON COLUMN public.chimera_game_states.turn_count IS 
    'Number of turns taken in this game session.';
COMMENT ON COLUMN public.chimera_game_states.status IS 
    'Status of the game: active (ongoing), ended (completed), or abandoned (user stopped playing).';

COMMIT;

