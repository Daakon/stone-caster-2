/**
 * Story Draft Store
 * Zustand store for managing Story Creation (Draft Workspace) state
 * 
 * Features:
 * - Immediate localStorage persistence
 * - Debounced backend sync
 * - Multi-step wizard state management
 * - Staged entity and lore tracking
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { StoryDraft, WorldDefinition } from '@/types/chimera-domain';
import { fetchDraft, saveDraft, compileStoryFromDraft } from '@/services/chimera-api';
import type { CompiledStory } from '@shared/types/chimera-compiled';

/**
 * Storage key for localStorage
 */
const STORAGE_KEY = 'stone-caster-story-draft';

/**
 * Debounce delay for backend sync (ms)
 */
const BACKEND_SYNC_DELAY = 2000;

/**
 * Story Draft Store State
 */
interface StoryDraftState {
  /**
   * Current draft state
   */
  draft: StoryDraft | null;

  /**
   * Debounce timer for backend sync
   */
  _saveTimer: NodeJS.Timeout | null;

  /**
   * Loading state for async operations
   */
  isLoading: boolean;

  /**
   * Error message from async operations
   */
  error: string | null;

  // Actions
  /**
   * Initialize or load a draft
   */
  initializeDraft: (draftId: string, metadata?: Partial<WorldDefinition>) => void;

  /**
   * Update draft metadata (WorldDefinition)
   */
  updateMetadata: (updates: Partial<WorldDefinition>) => void;

  /**
   * Set current wizard step (0-4)
   */
  setStep: (step: number) => void;

  /**
   * Stage an entity (add to staged_entity_ids)
   */
  stageEntity: (entityId: string) => void;

  /**
   * Unstage an entity (remove from staged_entity_ids)
   */
  unstageEntity: (entityId: string) => void;

  /**
   * Stage a lore fragment (add to staged_lore_ids)
   */
  stageLore: (loreId: string) => void;

  /**
   * Unstage a lore fragment (remove from staged_lore_ids)
   */
  unstageLore: (loreId: string) => void;

  /**
   * Mark draft as dirty (has unsaved changes)
   */
  markDirty: () => void;

  /**
   * Save draft to backend (immediate, bypasses debounce)
   */
  saveToBackend: () => Promise<void>;

  /**
   * Trigger debounced backend save
   */
  debouncedSave: () => void;

  /**
   * Clear draft (reset to initial state)
   */
  clearDraft: () => void;

  /**
   * Load draft from backend
   */
  loadFromBackend: (draftId: string) => Promise<void>;

  /**
   * Load draft by ID (async, sets loading state)
   */
  loadDraft: (draftId: string) => Promise<void>;

  /**
   * Compile the current draft into a CompiledStory
   */
  compile: () => Promise<CompiledStory>;
}

/**
 * Create initial draft state
 */
function createInitialDraft(draftId: string, metadata?: Partial<WorldDefinition>): StoryDraft {
  return {
    draft_id: draftId,
    current_step: 0,
    last_modified: Date.now(),
    metadata: {
      title: metadata?.title || '',
      summary: metadata?.summary || '',
      genre_tags: metadata?.genre_tags || [],
      safety_filters: metadata?.safety_filters || ['pg'],
      ruleset_keys: metadata?.ruleset_keys || [],
      world_preset_id: metadata?.world_preset_id,
    },
    staged_entity_ids: [],
    staged_lore_ids: [],
    is_saving: false,
    is_dirty: false,
  };
}

/**
 * Story Draft Store
 * Uses Zustand with localStorage persistence
 */
export const useStoryDraftStore = create<StoryDraftState>()(
  persist(
    (set, get) => ({
      draft: null,
      _saveTimer: null,
      isLoading: false,
      error: null,

      /**
       * Initialize or load a draft
       */
      initializeDraft: (draftId, metadata) => {
        const existingDraft = get().draft;

        // If draft already exists with same ID, don't reset
        if (existingDraft?.draft_id === draftId) {
          return;
        }

        const newDraft = createInitialDraft(draftId, metadata);
        set({ draft: newDraft });
      },

      /**
       * Update draft metadata
       */
      updateMetadata: (updates) => {
        const draft = get().draft;
        if (!draft) return;

        set({
          draft: {
            ...draft,
            metadata: {
              ...draft.metadata,
              ...updates,
            },
            last_modified: Date.now(),
            is_dirty: true,
          },
        });

        // Trigger debounced save
        get().debouncedSave();
      },

      /**
       * Set current wizard step
       */
      setStep: (step) => {
        const draft = get().draft;
        if (!draft) return;

        // Validate step range (0-4)
        const validStep = Math.max(0, Math.min(4, step));

        set({
          draft: {
            ...draft,
            current_step: validStep,
            last_modified: Date.now(),
          },
        });

        // Save step changes immediately (no debounce for navigation)
        get().saveToBackend();
      },

      /**
       * Stage an entity
       */
      stageEntity: (entityId) => {
        const draft = get().draft;
        if (!draft) return;

        const stagedIds = draft.staged_entity_ids.includes(entityId)
          ? draft.staged_entity_ids
          : [...draft.staged_entity_ids, entityId];

        set({
          draft: {
            ...draft,
            staged_entity_ids: stagedIds,
            last_modified: Date.now(),
            is_dirty: true,
          },
        });

        get().debouncedSave();
      },

      /**
       * Unstage an entity
       */
      unstageEntity: (entityId) => {
        const draft = get().draft;
        if (!draft) return;

        set({
          draft: {
            ...draft,
            staged_entity_ids: draft.staged_entity_ids.filter((id) => id !== entityId),
            last_modified: Date.now(),
            is_dirty: true,
          },
        });

        get().debouncedSave();
      },

      /**
       * Stage a lore fragment
       */
      stageLore: (loreId) => {
        const draft = get().draft;
        if (!draft) return;

        const stagedIds = draft.staged_lore_ids.includes(loreId)
          ? draft.staged_lore_ids
          : [...draft.staged_lore_ids, loreId];

        set({
          draft: {
            ...draft,
            staged_lore_ids: stagedIds,
            last_modified: Date.now(),
            is_dirty: true,
          },
        });

        get().debouncedSave();
      },

      /**
       * Unstage a lore fragment
       */
      unstageLore: (loreId) => {
        const draft = get().draft;
        if (!draft) return;

        set({
          draft: {
            ...draft,
            staged_lore_ids: draft.staged_lore_ids.filter((id) => id !== loreId),
            last_modified: Date.now(),
            is_dirty: true,
          },
        });

        get().debouncedSave();
      },

      /**
       * Mark draft as dirty
       */
      markDirty: () => {
        const draft = get().draft;
        if (!draft) return;

        set({
          draft: {
            ...draft,
            is_dirty: true,
            last_modified: Date.now(),
          },
        });
      },

      /**
       * Save draft to backend (immediate)
       */
      saveToBackend: async () => {
        const draft = get().draft;
        if (!draft) return;

        // Set saving state
        set({
          draft: {
            ...draft,
            is_saving: true,
          },
        });

        try {
          const { staged_entity_ids } = draft;

          // DEBUG LOGGING
          console.log('[StoryDraftStore] Saving to backend:', {
            draftId: draft.draft_id,
            stagedCount: staged_entity_ids.length,
            stagedIds: staged_entity_ids
          });

          // Construct payload
          const payload: any = {
            ...draft,
            // Explicitly map staged_entity_ids to entity_ids for backend
            entity_ids: [...(staged_entity_ids || [])],

            // Clean up internal flags
            is_saving: undefined,
            is_dirty: undefined,
            staged_entity_ids: undefined, // cleanup redundant key
            _saveTimer: undefined
          };

          // Use API service
          await saveDraft(payload);

          // Clear dirty flag and update timestamp
          set({
            draft: {
              ...draft,
              is_saving: false,
              is_dirty: false,
              last_modified: Date.now(),
            },
          });
        } catch (error) {
          console.error('[StoryDraftStore] Failed to save to backend:', error);

          // Keep dirty flag on error
          set({
            draft: {
              ...draft,
              is_saving: false,
            },
            error: error instanceof Error ? error.message : 'Failed to save draft',
          });
        }
      },

      /**
       * Trigger debounced backend save
       */
      debouncedSave: () => {
        const state = get();

        // Clear existing timer
        if (state._saveTimer) {
          clearTimeout(state._saveTimer);
        }

        // Set new timer
        const timer = setTimeout(() => {
          get().saveToBackend();
          set({ _saveTimer: null });
        }, BACKEND_SYNC_DELAY);

        set({ _saveTimer: timer });
      },

      /**
       * Clear draft (reset to initial state)
       */
      clearDraft: () => {
        // Clear debounce timer
        const timer = get()._saveTimer;
        if (timer) {
          clearTimeout(timer);
        }

        set({
          draft: null,
          _saveTimer: null,
        });
      },

      /**
       * Load draft from backend (legacy method, kept for compatibility)
       */
      loadFromBackend: async (draftId: string) => {
        // Delegate to loadDraft
        await get().loadDraft(draftId);
      },

      /**
       * Load draft by ID (async, sets loading state)
       */
      loadDraft: async (draftId: string) => {
        set({ isLoading: true, error: null });

        try {
          const loadedDraft = await fetchDraft(draftId);

          // Map backend configuration to frontend state
          // Prioritize first-class entity_ids column > configuration > empty
          const config = loadedDraft.configuration as any;
          const entityIds = loadedDraft.entity_ids || config?.entityIds || [];

          // Merge backend data into StoryDraft structure
          const mappedDraft: StoryDraft = {
            draft_id: loadedDraft.id,
            current_step: 0, // Default to 0, or infer from status?
            last_modified: new Date(loadedDraft.updated_at).getTime(),
            metadata: {
              title: loadedDraft.display_name || '',
              summary: (loadedDraft as any).description || '',
              // Parse genre_tags if they exist on the story level, otherwise default
              genre_tags: [],
              safety_filters: ['pg'],
              ruleset_keys: [],
              world_preset_id: undefined,
              ...loadedDraft.configuration // Spread existing config into metadata just in case
            },
            staged_entity_ids: entityIds,
            staged_lore_ids: [], // TODO: Map lore IDs if backend supports it
            is_saving: false,
            is_dirty: false,
          };

          // Update store with loaded draft
          set({
            draft: mappedDraft,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          console.error('[StoryDraftStore] Failed to load draft:', error);

          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to load draft',
          });
        }
      },

      /**
       * Compile the current draft into a CompiledStory
       */
      compile: async () => {
        const draft = get().draft;
        if (!draft) {
          throw new Error('No draft to compile');
        }

        set({
          isLoading: true,
          error: null,
          draft: {
            ...draft,
            is_saving: true,
          },
        });

        try {
          const compiledStory = await compileStoryFromDraft(draft.draft_id);

          // Clear saving state
          set({
            draft: {
              ...draft,
              is_saving: false,
            },
            isLoading: false,
            error: null,
          });

          return compiledStory;
        } catch (error) {
          console.error('[StoryDraftStore] Failed to compile story:', error);

          set({
            draft: {
              ...draft,
              is_saving: false,
            },
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to compile story',
          });

          throw error;
        }
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Only persist draft state (exclude internal timers)
      partialize: (state) => ({
        draft: state.draft,
      }),
    }
  )
);
