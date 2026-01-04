import { create } from 'zustand';
import { createStoryDraft, fetchDraft, updateStoryDraft } from '@/services/chimera-api';

interface StoryDraftState {
    storyId: string | null;
    draft: any | null; // Placeholder for full draft type
    isLoading: boolean;
    fetchingId: string | null; // Deduplication track
    error: string | null;

    // Actions
    initializeDraft: () => Promise<string>;
    hydrateDraft: (storyId: string) => Promise<void>;
    setWorld: (worldId: string) => Promise<void>;
    setDraftData: (data: Partial<any>) => void;
    saveToBackend: () => Promise<void>;
}

export const useStoryDraftStore = create<StoryDraftState>((set, get) => ({
    storyId: null,
    draft: null,
    isLoading: false,
    fetchingId: null,
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
        const { fetchingId, storyId: currentStoryId } = get();

        // 1. Dedup: If already fetching this request, ignore
        if (fetchingId === storyId) return;

        // 2. Dedup: If already loaded, ignore (unless we want to support force-refetch param later)
        if (currentStoryId === storyId) return;

        set({ isLoading: true, error: null, fetchingId: storyId });
        try {
            const story = await fetchDraft(storyId);
            set({ storyId: story.id, draft: story, isLoading: false, fetchingId: null });
        } catch (error) {
            console.error('Failed to hydrate draft:', error);
            set({ isLoading: false, error: 'Failed to load story draft', fetchingId: null });
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
                active_ruleset_ids: [], // Clear locally for optimistic UI visual
                // Also update configuration if needed by frontend
                configuration: { ...draft.configuration, worldId }
            }
        });

        try {
            // Frontend: Send ONLY world_id. Backend will auto-set rulesets.
            await updateStoryDraft(storyId, {
                world_id: worldId,
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
    },

    saveToBackend: async () => {
        const { storyId, draft } = get();
        if (!storyId || !draft) return;

        set({ isLoading: true }); // Optional: could have a specific isSaving flag
        try {
            // Construct payload with explicit entity_ids mapping if needed, 
            // though setDraftData should keep draft in sync.
            // We ensure entity_ids is sent if present.
            const payload = {
                display_name: draft.title || draft.display_name,
                description: draft.description,
                description_short: draft.description_short,
                opening_text: draft.opening_text,
                world_id: draft.world_id,
                active_ruleset_ids: draft.active_ruleset_ids,
                entity_ids: draft.entity_ids || [], // Ensure this is sent
                genesis_config: draft.genesis_config || {},
                status: draft.status
            };

            await updateStoryDraft(storyId, payload);
            set({ isLoading: false });
        } catch (error) {
            console.error('Failed to save draft:', error);
            set({ isLoading: false, error: 'Failed to save draft' });
            throw error;
        }
    }
}));
