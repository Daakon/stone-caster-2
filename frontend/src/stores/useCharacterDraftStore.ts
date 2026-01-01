import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface CharacterDraft {
    stepId: string;
    formData: Record<string, any>;
    lastUpdated: number;
}

interface CharacterDraftState {
    // Keyed by storyId to support multiple drafts
    drafts: Record<string, CharacterDraft>;

    // Actions
    saveDraft: (storyId: string, stepId: string, data: any) => void;
    getDraft: (storyId: string) => CharacterDraft | undefined;
    clearDraft: (storyId: string) => void;
}

export const useCharacterDraftStore = create<CharacterDraftState>()(
    persist(
        (set, get) => ({
            drafts: {},

            saveDraft: (storyId, stepId, data) => {
                set((state) => ({
                    drafts: {
                        ...state.drafts,
                        [storyId]: {
                            stepId,
                            formData: data,
                            lastUpdated: Date.now(),
                        },
                    },
                }));
            },

            getDraft: (storyId) => {
                return get().drafts[storyId];
            },

            clearDraft: (storyId) => {
                set((state) => {
                    const newDrafts = { ...state.drafts };
                    delete newDrafts[storyId];
                    return { drafts: newDrafts };
                });
            },
        }),
        {
            name: 'stone-caster-character-drafts',
            storage: createJSONStorage(() => localStorage),
        }
    )
);
