
import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase'; // Assuming strict supabase types exist, if not I'll fall back to any or define partial
// If @/types/supabase doesn't exist, I'll use generic any for now and refine later, or better, define the expected shape.
// To be safe and "Strict", I will define the DB shapes locally if needed or use 'any' with a cast to a strong return type.

export type SessionStatus = 'loading' | 'ready' | 'needs_genesis' | 'error';

// We define what the Validator *returns* as a valid Context.
// These should be usable by the UI.
export interface ValidatedStory {
    id: string;
    title: string;
    world_id: string;
    // Add other relevant fields from chimera_stories
}

export interface ValidatedWorld {
    id: string;
    name: string;
    // Add other relevant fields from chimera_worlds
}

export interface ValidatedPlayer {
    id: string;
    name: string;
    // Add other relevant fields from chimera_entities
}

export interface GameContext {
    story: ValidatedStory & { world: ValidatedWorld };
    // world is nested in story in the fetch, but we can flatten or keep it. 
    // The user's example had: return { status: 'ready', context: { story, world, player } };
    // But the fetch was: .select('*, world:chimera_worlds(*)')
    // So 'story' variable holds the story AND the nested world.
    // I will separate them in the returned context for clarity, or match the user's structure.
    // User example: context: { story, world, player }
    // I will explicitly extract world from story for the context.

    world: ValidatedWorld;
    player: ValidatedPlayer;
}

/**
 * Rigorously checks if the game is ready to play.
 * Returns 'ready' only if all data artifacts exist.
 * Returns 'needs_genesis' if valid context exists but game hasn't started.
 */
export async function validateSessionIntegrity(
    supabase: SupabaseClient,
    storyId: string
): Promise<{ status: SessionStatus; context?: GameContext; error?: string }> {
    try {
        // 1. Load Context (The "Stage")
        const { data: storyData, error: sErr } = await supabase
            .from('chimera_stories')
            .select('*, world:chimera_worlds(*)')
            .eq('id', storyId)
            .single();

        if (sErr || !storyData) {
            return { status: 'error', error: sErr?.message || 'Story not found.' };
        }

        // Cast response to expected shape
        const story = storyData as any; // Safe cast for now, assuming DB structure
        const world = story.world;

        if (!world) {
            return { status: 'error', error: 'Linked World not found for this Story.' };
        }

        // 2. Load Actor (The "Player")
        // 2. Load Actor (The "Player")
        const protagonistId = story.protagonist_id;

        if (!protagonistId) {
            return { status: 'error', error: 'Player Character missing (No protagonist_id linked). Please create or bind your character.' };
        }

        const { data: playerData, error: pErr } = await supabase
            .from('chimera_player_characters')
            .select('*')
            .eq('id', protagonistId)
            .single();

        if (pErr) return { status: 'error', error: 'Failed to load Character: ' + pErr.message };
        if (!playerData) return { status: 'error', error: 'Player Character record not found.' };

        const player = playerData as any;

        // 3. Check Engine Artifacts (The "State")
        // We check for the existence of the HEAD turn.
        const { count, error: tErr } = await supabase
            .from('chimera_turns')
            .select('*', { count: 'exact', head: true })
            .eq('story_id', storyId);

        if (tErr) return { status: 'error', error: tErr.message };

        const context: GameContext = {
            story: {
                id: story.id,
                title: story.title,
                world_id: story.world_id,
            },
            world: {
                id: world.id,
                name: world.name || world.title, // Handle potential schema diffs
            },
            player: {
                id: player.id,
                name: player.name,
            }
        };

        // Decision Matrix
        // If we have context but no turns, we need Genesis.
        if (count === 0) {
            return { status: 'needs_genesis', context };
        }

        // If we have turns, we are active.
        return { status: 'ready', context };

    } catch (err: any) {
        return { status: 'error', error: err.message };
    }
}
