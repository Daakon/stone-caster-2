import { create } from 'zustand';
import { createStoryDraft, fetchDraft, updateStoryDraft } from '@/services/chimera-api';

interface StoryDraftState {
    storyId: string | null;
    draft: any | null; // Placeholder for full draft type
    isLoading: boolean;
    error: string | null;

    // Actions
    initializeDraft: () => Promise<string>;
    hydrateDraft: (storyId: string) => Promise<void>;
    setWorld: (worldId: string) => Promise<void>;
    setDraftData: (data: Partial<any>) => void;
}

export const useStoryDraftStore = create<StoryDraftState>((set, get) => ({
    storyId: null,
    draft: null,
    isLoading: false,
    error: null,

    initializeDraft: async () => {
        set({ isLoading: true, error: null });
        try {
            // Create blank draft
            const newStory = await createStoryDraft();
            set({ storyId: newStory.id, draft: newStory, isLoading: false });
            return newStory.id;
        } catch (error) {
            console.error('Failed to initialize draft:', error);
            set({ isLoading: false, error: 'Failed to create new story draft' });
            throw error;
        }
    },

    hydrateDraft: async (storyId: string) => {
        set({ isLoading: true, error: null });
        try {
            const story = await fetchDraft(storyId);
            set({ storyId: story.id, draft: story, isLoading: false });
        } catch (error) {
            console.error('Failed to hydrate draft:', error);
            set({ isLoading: false, error: 'Failed to load story draft' });
            throw error; // Rethrow to let caller handle redirect if 404
        }
    },

    setWorld: async (worldId: string) => {
        const { storyId, draft } = get();
        if (!storyId) return;

        if (draft?.world_id === worldId) return;

        // Optimistic update - Reset rulesets when world changes
        set({
            draft: {
                ...draft,
                world_id: worldId,
                active_ruleset_ids: [], // Clear rulesets to prevent zombies
                // Also update configuration if needed by frontend
                configuration: { ...draft.configuration, worldId }
            }
        });

        try {
            // Send empty active_ruleset_ids to backend
            await updateStoryDraft(storyId, {
                world_id: worldId,
                active_ruleset_ids: []
            });
        } catch (error) {
            console.error('Failed to set world:', error);
            // Revert on failure (could implement previous state tracking)
            set({ error: 'Failed to save world selection' });
        }
    },

    setDraftData: (data: Partial<any>) => {
        set(state => ({
            draft: state.draft ? { ...state.draft, ...data } : null
        }));
    }
}));
