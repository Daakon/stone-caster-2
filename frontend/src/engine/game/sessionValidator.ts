

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
import { apiFetch } from '@/lib/api';

/**
 * Rigorously checks if the game is ready to play via backend validation.
 * Returns 'ready' only if all data artifacts exist.
 * Returns 'needs_genesis' if valid context exists but game hasn't started.
 */
export async function validateSessionIntegrity(
    storyId: string
): Promise<{ status: SessionStatus; context?: GameContext; error?: string }> {
    try {
        const response = await apiFetch<any>(`/api/chimera/game/validate?storyId=${storyId}`);

        if (!response.ok) {
            return { status: 'error', error: response.error?.message || 'Verification request failed' };
        }

        const data = response.data;
        if (!data) return { status: 'error', error: 'No data returned from validation' };

        // Handle error status returned in success envelope
        if (data.status === 'error') {
            return { status: 'error', error: data.error };
        }

        return data as { status: SessionStatus; context?: GameContext };

    } catch (err: any) {
        return { status: 'error', error: err.message };
    }
}
