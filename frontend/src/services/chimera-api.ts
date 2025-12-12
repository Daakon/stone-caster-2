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
import type { ChimeraWorldV2, ChimeraEntityV2, ChimeraStoryV2, ChimeraAssetRef, ChimeraLoreFragment } from '@/types/chimera-v2';
import { useQuery } from '@tanstack/react-query';

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
export async function getWorlds(genre?: string): Promise<WorldDefinition[]> {
  const query = genre ? `?genre=${encodeURIComponent(genre)}` : '';
  const result = await apiFetch<WorldDefinition[]>(`/api/chimera/worlds${query}`);
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
// ... existing generateUploadUrl ...
export async function generateUploadUrl(
  contentType: string,
  folder: string
): Promise<UploadUrlResponse> {
  const result = await apiPost<UploadUrlResponse>('/api/v2/chimera/assets/upload-url', {
    contentType,
    folder,
  });
  if (!result.ok) {
    throw new Error(result.error.message || 'Failed to generate upload URL');
  }
  return result.data!;
}

export interface SignUploadResponse {
  uploadUrl: string;
  accessUrl: string; // Legacy
  publicUrl?: string; // New V2
  path: string;
  id?: string; // ID returned by backend registration
}

/**
 * Sign an asset upload (flexible inputs)
 */
export async function signAssetUpload(
  data: { filename?: string; fileType?: string; contentType?: string; folder?: string }
): Promise<SignUploadResponse> {
  const result = await apiPost<SignUploadResponse>('/api/v2/chimera/assets/sign-upload', data);
  if (!result.ok) {
    throw new Error(result.error.message || 'Failed to sign upload');
  }
  return result.data!;
}

/**
 * Helper to confirm asset details after upload
 */
async function confirmAssetUpdate(id: string, url: string, meta?: any): Promise<void> {
  await apiFetch(`/api/v2/chimera/assets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ url, meta })
  });
}

/**
 * Upload a single image asset
 * 1. Signs the upload
 * 2. Uploads to Cloudflare
 * 3. Returns the AssetRef
 */
export async function uploadImage(file: File, folder: string = 'worlds'): Promise<ChimeraAssetRef> {
  // 1. Sign
  const signRes = await signAssetUpload({
    filename: file.name,
    fileType: file.type,
    folder
  });

  // 2. Upload
  const formData = new FormData();
  formData.append('file', file);

  const uploadUrl = signRes.uploadUrl;
  const upRes = await fetch(uploadUrl, { method: 'POST', body: formData });
  const upData = await upRes.json();

  if (!upRes.ok || !upData.success) {
    throw new Error("Upload failed: " + (upData.errors?.[0]?.message || "Unknown error"));
  }

  // 3. Resolve URL
  let url: string | undefined;

  // Prefer Cloudflare's actual response (This works for Entity Card/Editor)
  if (upData.result?.variants?.[0]) {
    url = upData.result.variants[0];
  } else if (upData.result?.id) {
    const deliveryUrl = import.meta.env.VITE_CF_IMAGES_DELIVERY_URL || 'https://imagedelivery.net/H1wcHgsbpczAJHyB61JpRw';
    url = `${deliveryUrl.replace(/\/$/, '')}/${upData.result.id}/public`;
  }

  // Fallback to backend signed ID only if CF response didn't give one
  if (!url) {
    url = signRes.publicUrl || signRes.accessUrl;
  }

  // 4. Confirm with Backend (Sync DB with real URL)
  // We use the ID returned by the backend in step 1 `signRes.id`
  if (signRes.id && url) {
    try {
      await confirmAssetUpdate(signRes.id, url, {
        cloudflareId: upData.result?.id,
        originalName: file.name
      });
    } catch (err) {
      console.warn("Failed to confirm asset update with backend:", err);
      // Don't block the UI flow, just warn
    }
  }

  return {
    id: signRes.id || crypto.randomUUID(), // Use backend ID if available
    url: url || '', // Ensure it's always a string
    role: 'gallery'
  };
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


// ============================================================================
// MY CREATIONS API (V2)
// ============================================================================

/**
 * Fetch worlds owned by the current user
 * Route: GET /api/v2/chimera/worlds/my-creations
 */
export async function fetchMyWorlds(): Promise<ChimeraWorldV2[]> {
  // Using apiGet for convenience as it handles the GET method and types
  // Note: apiGet returns { ok, data } or { ok, error }
  // We need to unwrap it to match typical fetcher pattern or handle error here.
  // The existing pattern in this file uses apiFetch and throws.
  const result = await apiFetch<ChimeraWorldV2[]>('/api/v2/chimera/worlds/my-creations');
  if (!result.ok) {
    throw new Error(result.error.message || 'Failed to fetch my worlds');
  }
  return result.data || [];
}

// Helper to map backend entity to frontend V2 interface
function mapToEntityV2(item: any): ChimeraEntityV2 {
  return {
    id: item.id,
    display_name: item.display_name || item.name || 'Untitled Entity',
    entity_type: item.entity_type || item.type || 'NPC',
    slug: item.slug || item.key || '', // Fallback to key or empty
    world_id: item.world_id,
    archetype_handle: item.archetype_handle,
    primary_image_url: item.primary_image_url,
    icon_image_url: item.icon_image_url,
    images: item.images || [],
    tags: item.tags || [],
    status: item.status || 'draft',
    updated_at: item.updated_at || new Date().toISOString()
  };
}

/**
 * Fetch entities owned by the current user
 * Route: GET /api/v2/chimera/entities/my-creations
 */
export async function fetchMyEntities(): Promise<ChimeraEntityV2[]> {
  const result = await apiFetch<any[]>('/api/v2/chimera/entities/my-creations');
  if (!result.ok) {
    throw new Error(result.error.message || 'Failed to fetch my entities');
  }
  return (result.data || []).map(mapToEntityV2);
}

/**
 * Fetch stories owned by the current user
 * Route: GET /api/v2/chimera/stories/my-creations
 */
export async function fetchMyStories(): Promise<ChimeraStoryV2[]> {
  const result = await apiFetch<ChimeraStoryV2[]>('/api/v2/chimera/stories/my-creations');
  if (!result.ok) {
    throw new Error(result.error.message || 'Failed to fetch my stories');
  }
  return result.data || [];
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

export function useMyWorlds(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['my-worlds'],
    queryFn: fetchMyWorlds,
    enabled: options?.enabled,
    retry: (failureCount, error: any) => {
      // Don't retry on 401/403
      if (error?.status === 401 || error?.status === 403) return false;
      return failureCount < 3;
    }
  });
}

export function useMyEntities(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['my-entities'],
    queryFn: fetchMyEntities,
    enabled: options?.enabled,
    retry: (failureCount, error: any) => {
      if (error?.status === 401 || error?.status === 403) return false;
      return failureCount < 3;
    }
  });
}

export function useMyStories(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['my-stories'],
    queryFn: fetchMyStories,
    enabled: options?.enabled,
    retry: (failureCount, error: any) => {
      if (error?.status === 401 || error?.status === 403) return false;
      return failureCount < 3;
    }
  });
}

/**
 * Fetch all available worlds for selection (My Worlds + Public Worlds)
 */
export function useAvailableWorlds() {
  const { data: myWorlds } = useMyWorlds();

  // Also fetch public worlds
  const { data: publicWorlds } = useQuery({
    queryKey: ['public-worlds'],
    queryFn: () => getWorlds(), // No genre filter = all public
    staleTime: 1000 * 60 * 5
  });

  // Combine and deduplicate by ID
  const allWorlds = [
    ...(myWorlds || []),
    ...(publicWorlds || [])
  ];

  // Deduplicate
  const uniqueWorlds = Array.from(new Map(allWorlds.map(w => [w.id, w])).values());

  return { data: uniqueWorlds };
}

// ============================================================================
// V2 MUTATIONS
// ============================================================================

import { useMutation, useQueryClient } from '@tanstack/react-query';

// --- API Functions ---

/**
 * Create a new world (V2)
 */
export async function createWorldV2(data: Partial<ChimeraWorldV2>): Promise<ChimeraWorldV2> {
  const result = await apiPost<ChimeraWorldV2>('/api/v2/chimera/worlds', data);
  if (!result.ok) {
    throw new Error(result.error.message || 'Failed to create world');
  }
  return result.data!;
}

/**
 * Update an existing world (V2)
 */
export async function updateWorldV2(id: string, data: Partial<ChimeraWorldV2>): Promise<ChimeraWorldV2> {
  const result = await apiPut<ChimeraWorldV2>(`/api/v2/chimera/worlds/${id}`, data);
  if (!result.ok) {
    throw new Error(result.error.message || 'Failed to update world');
  }
  return result.data!;
}

/**
 * Create a new entity (V2)
 */
export async function createEntityV2(data: Partial<ChimeraEntityV2>): Promise<ChimeraEntityV2> {
  const result = await apiPost<ChimeraEntityV2>('/api/v2/chimera/entities', data);
  if (!result.ok) {
    throw new Error(result.error.message || 'Failed to create entity');
  }
  return result.data!; // Assuming backend returns the created object
}

/**
 * Update an existing entity (V2)
 */
export async function updateEntityV2(id: string, data: Partial<ChimeraEntityV2>): Promise<ChimeraEntityV2> {
  const result = await apiPut<ChimeraEntityV2>(`/api/v2/chimera/entities/${id}`, data);
  if (!result.ok) {
    throw new Error(result.error.message || 'Failed to update entity');
  }
  return result.data!;
}

// --- Hooks ---

export function useCreateWorld() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createWorldV2,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['my-worlds'] });
      queryClient.invalidateQueries({ queryKey: ['world-detail', data.id] });
    },
  });
}

export function useUpdateWorld() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ChimeraWorldV2> }) => updateWorldV2(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['my-worlds'] });
      queryClient.invalidateQueries({ queryKey: ['world-detail', data.id] });
    },
  });
}

export function useCreateEntity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createEntityV2,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-entities'] });
    },
  });
}

export function useUpdateEntity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ChimeraEntityV2> }) => updateEntityV2(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-entities'] });
    },
  });
}

/**
 * Delete an entity (V2)
 */
export async function deleteEntityV2(id: string): Promise<void> {
  const result = await apiDelete(`/api/v2/chimera/entities/${id}`);
  if (!result.ok) {
    throw new Error(result.error.message || 'Failed to delete entity');
  }
}

/**
 * Hook to delete an entity (V2)
 */
export function useDeleteEntity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteEntityV2,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-entities'] });
    },
  });
}

// --- Detail Hooks ---

/**
 * Fetch a single world by ID (V2)
 */
export async function getWorldDetail(id: string): Promise<ChimeraWorldV2> {
  const result = await apiFetch<ChimeraWorldV2>(`/api/v2/chimera/worlds/${id}`);
  if (!result.ok) {
    throw new Error(result.error.message || 'Failed to fetch world details');
  }
  return result.data!;
}

/**
 * Fetch a single entity by ID (V2)
 */
export async function getEntityDetail(id: string): Promise<ChimeraEntityV2> {
  const result = await apiFetch<ChimeraEntityV2>(`/api/v2/chimera/entities/${id}`);
  if (!result.ok) {
    throw new Error(result.error.message || 'Failed to fetch entity details');
  }
  return result.data!;
}

export function useWorldDetail(id: string | null) {
  return useQuery({
    queryKey: ['world-detail', id],
    queryFn: () => getWorldDetail(id!),
    enabled: !!id,
    retry: false, // Don't retry if not found
  });
}

export function useEntityDetail(id: string | null) {
  return useQuery({
    queryKey: ['entity-detail', id],
    queryFn: () => getEntityDetail(id!),
    enabled: !!id,
    retry: false,
  });
}// ... existing exports ...

export function useRulesets(category?: 'foundation' | 'expansion' | 'flavor') {
  return useQuery({
    queryKey: ['rulesets', category],
    queryFn: () => getRulesets(category),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// ============================================================================
// ASSETS API
// ============================================================================

export interface ChimeraAsset {
  id: string;
  url: string;
  type: string;
  category?: string;
  meta?: any;
  created_at: string;
}

/**
 * Fetch My Assets
 * Route: GET /api/chimera/assets/my-assets
 */
export async function fetchMyAssets(): Promise<ChimeraAsset[]> {
  const result = await apiFetch<ChimeraAsset[]>('/api/v2/chimera/assets/my-assets');
  if (!result.ok) {
    throw new Error(result.error.message || 'Failed to fetch assets');
  }
  return (result.data || []).map(asset => {
    // Fix for legacy or local assets that are just filenames
    let url = asset.url;
    if (url && !url.startsWith('http') && !url.startsWith('blob:') && !url.startsWith('data:') && !url.startsWith('/')) {
      url = `/${url}`;
    }
    return { ...asset, url };
  });
}

export function useMyAssets() {
  return useQuery({
    queryKey: ['my-assets'],
    queryFn: fetchMyAssets
  });
}

export function useRulesetDetail(id: string | null) {
  return useQuery({
    queryKey: ['ruleset-detail', id],
    queryFn: () => getRuleset(id!),
  });
}

// ============================================================================
// TAGS API
// ============================================================================

export interface Tag {
  id: string;
  tag_name: string;
  is_approved: boolean;
}

export async function getTags(): Promise<Tag[]> {
  const result = await apiFetch<Tag[]>('/api/v2/chimera/lore/tags');
  if (!result.ok) {
    throw new Error(result.error.message || 'Failed to fetch tags');
  }
  return result.data || [];
}

export function useTags() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: getTags,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// ============================================================================
// LORE API (V2)
// ============================================================================

// Helper to map backend response to frontend fragment
function mapToFragment(item: any): ChimeraLoreFragment {
  return {
    id: item.id,
    world_id: item.world_id,
    title: item.display_name || 'Untitled',
    type: item.type || (item.fragment?.type) || 'general',
    content: item.entry_text || '',
    keywords: item.keywords || item.tags?.map((t: any) => t.tag_name) || [],
    updated_at: item.updated_at
  };
}

/**
 * Get lore fragments for a specific world
 * Route: GET /api/v2/chimera/lore?world_id={id}
 */
export async function getLoreByWorld(worldId: string): Promise<ChimeraLoreFragment[]> {
  const result = await apiFetch<any[]>(`/api/v2/chimera/lore?world_id=${worldId}`);
  if (!result.ok) {
    throw new Error(result.error.message || 'Failed to fetch lore');
  }
  return (result.data || []).map(mapToFragment);
}

/**
 * Create a new lore fragment (V2)
 */
export async function createLoreV2(data: Partial<ChimeraLoreFragment>): Promise<ChimeraLoreFragment> {
  const payload = {
    world_id: data.world_id,
    display_name: data.title,
    entry_text: data.content,
    keywords: data.keywords,
    type: data.type
  };

  const result = await apiPost<any>('/api/v2/chimera/lore', payload);
  if (!result.ok) {
    throw new Error(result.error.message || 'Failed to create lore fragment');
  }
  return mapToFragment(result.data);
}

/**
 * Update an existing lore fragment (V2)
 */
export async function updateLoreV2(id: string, data: Partial<ChimeraLoreFragment>): Promise<ChimeraLoreFragment> {
  const payload: any = {};
  if (data.title !== undefined) payload.display_name = data.title;
  if (data.content !== undefined) payload.entry_text = data.content;
  if (data.keywords !== undefined) payload.keywords = data.keywords;
  if (data.type !== undefined) payload.type = data.type;

  const result = await apiPut<any>(`/api/v2/chimera/lore/${id}`, payload);
  if (!result.ok) {
    throw new Error(result.error.message || 'Failed to update lore fragment');
  }
  return mapToFragment(result.data);
}

/**
 * Delete a lore fragment (V2)
 */
export async function deleteLoreV2(id: string): Promise<void> {
  const result = await apiDelete(`/api/v2/chimera/lore/${id}`);
  if (!result.ok) {
    throw new Error(result.error.message || 'Failed to delete lore fragment');
  }
}

// --- Lore Hooks ---

export function useLoreByWorld(worldId?: string | null) {
  return useQuery({
    queryKey: ['lore', worldId],
    queryFn: () => {
      if (!worldId) return Promise.resolve([]);
      return getLoreByWorld(worldId);
    },
    enabled: !!worldId,
  });
}

export function useCreateLore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createLoreV2,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['lore', data.world_id] });
    },
  });
}

export function useUpdateLore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ChimeraLoreFragment> }) => updateLoreV2(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['lore', data.world_id] });
    },
  });
}

export function useDeleteLore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteLoreV2,
    onSuccess: () => {
      // Invalidate all 'lore' queries as we don't have specific world_id context easily available
      queryClient.invalidateQueries({ queryKey: ['lore'] });
    },
  });
}
