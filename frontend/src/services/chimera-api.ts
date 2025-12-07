// [CHIMERA V3] Architecture: Greenfield | Layer: Frontend
/**
 * Chimera API Client
 * Phase 3: Frontend service for Phase 2 API routes (/api/chimera/*)
 */

import { apiFetch, apiPost, apiPut, apiDelete } from '@/lib/api';
import type {
  WorldDefinition,
  RulesetDefinition,
  EntityTemplate,
  LoreFragment,
} from '@shared/types/chimera-authoring';
import type { StoryDraft } from '@/types/chimera-domain';
import type { CompiledStory } from '@shared/types/chimera-compiled';

// API Response types
export interface CreateWorldResponse {
  id: string;
}

export interface CreateRulesetResponse {
  id: string;
}

export interface CreateEntityResponse {
  id: string;
}

export interface CreateLoreResponse {
  id: string;
}

export interface UploadUrlResponse {
  uploadUrl: string;
  publicUrl: string;
  path: string;
}

/**
 * Get all worlds
 */
export async function getWorlds(): Promise<WorldDefinition[]> {
  const result = await apiFetch<WorldDefinition[]>('/api/chimera/worlds');
  if (!result.ok) {
    throw new Error(result.error.message || 'Failed to fetch worlds');
  }
  return result.data || [];
}

/**
 * Get a single world by ID
 */
export async function getWorld(id: string): Promise<WorldDefinition> {
  const result = await apiFetch<WorldDefinition>(`/api/chimera/worlds/${id}`);
  if (!result.ok) {
    throw new Error(result.error.message || 'Failed to fetch world');
  }
  return result.data!;
}

/**
 * Create a new world
 */
export async function createWorld(data: WorldDefinition): Promise<string> {
  const result = await apiPost<CreateWorldResponse>('/api/chimera/worlds', data);
  if (!result.ok) {
    throw new Error(result.error.message || 'Failed to create world');
  }
  return result.data!.id;
}

/**
 * Update an existing world
 */
export async function updateWorld(id: string, data: Partial<WorldDefinition>): Promise<WorldDefinition> {
  const result = await apiPut<WorldDefinition>(`/api/chimera/worlds/${id}`, data);
  if (!result.ok) {
    throw new Error(result.error.message || 'Failed to update world');
  }
  return result.data!;
}

/**
 * Get all rulesets, optionally filtered by category
 */
export async function getRulesets(category?: 'foundation' | 'expansion' | 'flavor'): Promise<RulesetDefinition[]> {
  const query = category ? `?category=${category}` : '';
  const result = await apiFetch<RulesetDefinition[]>(`/api/chimera/rulesets${query}`);
  if (!result.ok) {
    throw new Error(result.error.message || 'Failed to fetch rulesets');
  }
  return result.data || [];
}

/**
 * Get a single ruleset by ID or key
 */
export async function getRuleset(id: string): Promise<RulesetDefinition> {
  const result = await apiFetch<RulesetDefinition>(`/api/chimera/rulesets/${id}`);
  if (!result.ok) {
    throw new Error(result.error.message || 'Failed to fetch ruleset');
  }
  return result.data!;
}

/**
 * Create a new ruleset
 */
export async function createRuleset(data: RulesetDefinition): Promise<string> {
  const result = await apiPost<CreateRulesetResponse>('/api/chimera/rulesets', data);
  if (!result.ok) {
    throw new Error(result.error.message || 'Failed to create ruleset');
  }
  return result.data!.id;
}

/**
 * Update an existing ruleset
 */
export async function updateRuleset(id: string, data: Partial<RulesetDefinition>): Promise<RulesetDefinition> {
  const result = await apiPut<RulesetDefinition>(`/api/chimera/rulesets/${id}`, data);
  if (!result.ok) {
    throw new Error(result.error.message || 'Failed to update ruleset');
  }
  return result.data!;
}

/**
 * Get all entities
 */
export async function getEntities(): Promise<EntityTemplate[]> {
  const result = await apiFetch<EntityTemplate[]>('/api/chimera/entities');
  if (!result.ok) {
    throw new Error(result.error.message || 'Failed to fetch entities');
  }
  return result.data || [];
}

/**
 * Get a single entity by ID
 */
export async function getEntity(id: string): Promise<EntityTemplate> {
  const result = await apiFetch<EntityTemplate>(`/api/chimera/entities/${id}`);
  if (!result.ok) {
    throw new Error(result.error.message || 'Failed to fetch entity');
  }
  return result.data!;
}

/**
 * Create a new entity
 */
export async function createEntity(data: EntityTemplate): Promise<string> {
  const result = await apiPost<CreateEntityResponse>('/api/chimera/entities', data);
  if (!result.ok) {
    throw new Error(result.error.message || 'Failed to create entity');
  }
  return result.data!.id;
}

/**
 * Update an existing entity
 */
export async function updateEntity(id: string, data: Partial<EntityTemplate>): Promise<EntityTemplate> {
  const result = await apiPut<EntityTemplate>(`/api/chimera/entities/${id}`, data);
  if (!result.ok) {
    throw new Error(result.error.message || 'Failed to update entity');
  }
  return result.data!;
}

/**
 * Delete an entity
 */
export async function deleteEntity(id: string): Promise<void> {
  const result = await apiDelete(`/api/chimera/entities/${id}`);
  if (!result.ok) {
    throw new Error(result.error.message || 'Failed to delete entity');
  }
}

/**
 * Get all lore fragments
 */
export async function getLore(): Promise<LoreFragment[]> {
  const result = await apiFetch<LoreFragment[]>('/api/chimera/lore');
  if (!result.ok) {
    throw new Error(result.error.message || 'Failed to fetch lore');
  }
  return result.data || [];
}

/**
 * Get a single lore fragment by ID
 */
export async function getLoreFragment(id: string): Promise<LoreFragment> {
  const result = await apiFetch<LoreFragment>(`/api/chimera/lore/${id}`);
  if (!result.ok) {
    throw new Error(result.error.message || 'Failed to fetch lore fragment');
  }
  return result.data!;
}

/**
 * Create a new lore fragment
 */
export async function createLore(data: LoreFragment): Promise<string> {
  const result = await apiPost<CreateLoreResponse>('/api/chimera/lore', data);
  if (!result.ok) {
    throw new Error(result.error.message || 'Failed to create lore fragment');
  }
  return result.data!.id;
}

/**
 * Update an existing lore fragment
 */
export async function updateLore(id: string, data: Partial<LoreFragment>): Promise<LoreFragment> {
  const result = await apiPut<LoreFragment>(`/api/chimera/lore/${id}`, data);
  if (!result.ok) {
    throw new Error(result.error.message || 'Failed to update lore fragment');
  }
  return result.data!;
}

/**
 * Delete a lore fragment
 */
export async function deleteLore(id: string): Promise<void> {
  const result = await apiDelete(`/api/chimera/lore/${id}`);
  if (!result.ok) {
    throw new Error(result.error.message || 'Failed to delete lore fragment');
  }
}

/**
 * Generate an upload URL for assets
 */
export async function generateUploadUrl(
  contentType: string,
  folder: string
): Promise<UploadUrlResponse> {
  const result = await apiPost<UploadUrlResponse>('/api/chimera/assets/upload-url', {
    contentType,
    folder,
  });
  if (!result.ok) {
    throw new Error(result.error.message || 'Failed to generate upload URL');
  }
  return result.data!;
}

/**
 * Compile a story from world, rulesets, and entities
 */
export interface CompileStoryRequest {
  worldId: string;
  rulesetIds: string[];
  entityIds: string[];
}

export interface CompileStoryResponse {
  compiledStoryId: string;
}

export async function compileStory(
  data: CompileStoryRequest
): Promise<CompileStoryResponse> {
  const result = await apiPost<{ id: string }>('/api/chimera/compile', data);
  if (!result.ok) {
    throw new Error(result.error.message || 'Failed to compile story');
  }
  // The backend returns { id: string } where id is the compiledStoryId
  return { compiledStoryId: result.data!.id };
}

/**
 * Get a compiled story by ID
 */
export async function getCompiledStory(id: string): Promise<import('@shared/types/chimera-compiled').CompiledStory> {
  const result = await apiFetch<import('@shared/types/chimera-compiled').CompiledStory>(`/api/chimera/stories/${id}`);
  if (!result.ok) {
    throw new Error(result.error.message || 'Failed to fetch compiled story');
  }
  return result.data!;
}

/**
 * Initialize a game from a compiled story
 */
export interface InitializeGameRequest {
  storyId: string;
  playerInput: {
    identity: {
      name: string;
      pronouns?: string;
      role?: string;
      age?: number;
    };
    appearance?: Record<string, unknown>;
    backstory?: string;
    personality_traits?: string[];
    drive?: string;
    flaw?: string;
    [key: string]: unknown;
  };
}

export interface InitializeGameResponse {
  gameStateId: string;
}

export async function initializeGame(
  data: InitializeGameRequest
): Promise<InitializeGameResponse> {
  const result = await apiPost<{ id: string }>('/api/chimera/game/init', data);
  if (!result.ok) {
    throw new Error(result.error.message || 'Failed to initialize game');
  }
  return { gameStateId: result.data!.id };
}

// ============================================================================
// DRAFT WORKSPACE API
// ============================================================================

/**
 * Fetch a draft by ID
 * Mock implementation: Returns predefined draft data or empty draft
 */
export async function fetchDraft(draftId: string): Promise<StoryDraft> {
  // TODO: Replace with actual API call
  // const result = await apiFetch<StoryDraft>(`/api/chimera/drafts/${draftId}`);
  // if (!result.ok) {
  //   throw new Error(result.error.message || 'Failed to fetch draft');
  // }
  // return result.data!;

  // Mock implementation: Check mock data for matching draft
  const { MOCK_USER_STORIES } = await import('@/features/create-story/data/mock-library');
  const mockStory = MOCK_USER_STORIES.find((s) => s.id === draftId && s.status === 'draft');

  if (mockStory) {
    // Return a mock draft based on the story data
    return {
      draft_id: mockStory.id,
      current_step: mockStory.step ?? 0,
      last_modified: mockStory.lastEdited ? new Date(mockStory.lastEdited).getTime() : Date.now(),
      metadata: {
        title: mockStory.title,
        summary: `A story about ${mockStory.title}`,
        genre_tags: ['fantasy'],
        safety_filters: ['pg13'],
        ruleset_keys: ['foundation-d100-5-pillars'],
      },
      staged_entity_ids: [],
      staged_lore_ids: [],
      is_saving: false,
      is_dirty: false,
    };
  }

  // Return empty draft if not found
  return {
    draft_id: draftId,
    current_step: 0,
    last_modified: Date.now(),
    metadata: {
      title: '',
      summary: '',
      genre_tags: [],
      safety_filters: ['pg'],
      ruleset_keys: [],
    },
    staged_entity_ids: [],
    staged_lore_ids: [],
    is_saving: false,
    is_dirty: false,
  };
}

/**
 * Save a draft to the backend
 * Mock implementation: Logs and simulates success
 */
export async function saveDraft(draft: StoryDraft): Promise<void> {
  // TODO: Replace with actual API call
  // const result = await apiPut<StoryDraft>(`/api/chimera/drafts/${draft.draft_id}`, draft);
  // if (!result.ok) {
  //   throw new Error(result.error.message || 'Failed to save draft');
  // }

  // Mock implementation: Simulate API delay
  console.log('[chimera-api] Saving draft to DB:', draft.draft_id);
  await new Promise((resolve) => setTimeout(resolve, 300));
}

/**
 * Compile a story from a draft
 * Mock implementation: Returns mock CompiledStory after delay, with 10% error rate
 */
export async function compileStoryFromDraft(draftId: string): Promise<CompiledStory> {
  // TODO: Replace with actual API call
  // const result = await apiPost<CompiledStory>(`/api/chimera/drafts/${draftId}/compile`, {});
  // if (!result.ok) {
  //   throw new Error(result.error.message || 'Failed to compile story');
  // }
  // return result.data!;

  // Mock implementation: Simulate compilation delay
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // 10% chance of error for testing
  if (Math.random() < 0.1) {
    throw new Error('Compilation failed: Ruleset dependency conflict detected');
  }

  // Return mock CompiledStory
  return {
    meta: {
      source_ids: [draftId],
    },
    master_schema: {
      tier1_allowlist: ['root_force', 'root_finesse', 'root_awareness', 'root_insight', 'root_influence'],
      tier0_allowlist: ['narrative_state', 'world_state'],
      actions_map: {
        'move': 'Move to a new location',
        'interact': 'Interact with an object or entity',
        'attack': 'Attack a target',
      },
    },
    narrative_index: [],
    initial_state: {
      turn: 0,
      location: 'starting_area',
    },
  };
}

