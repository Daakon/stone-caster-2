import { type AppError, toAppError } from './errors';
import { supabase } from './supabase';
import { GuestCookieService } from '../services/guestCookie';
import type { GameListDTO } from '@shared';
import { API_BASE } from './apiBase';

// Use centralized API_BASE from apiBase.ts
const BASE = API_BASE;

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<{ ok: true; data: T } | { ok: false; error: AppError }> {
  const url = `${BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = new Headers(init.headers || {});

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Attach Supabase session token
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  } catch (error) {
    console.warn('Failed to get auth token:', error);
  }

  // Attach guest cookie for guest users
  const guestCookieId = GuestCookieService.getGuestCookieForApi();
  if (guestCookieId) {
    headers.set('X-Guest-Cookie-Id', guestCookieId);
  }

  try {
    const resp = await fetch(url, { ...init, headers });
    const text = await resp.text();

    let json: any;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (!resp.ok) {
      // Handle structured error responses
      if (json && json.error && typeof json.error === 'object') {
        const error = json.error as AppError;
        // Include traceId from response meta if available
        if (json.meta?.traceId) {
          error.traceId = json.meta.traceId;
        }
        return { ok: false, error };
      }

      // Handle legacy error responses
      if (json && json.message) {
        const error = toAppError(
          resp.status,
          json.message,
          resp.status === 404
            ? 'not_found'
            : resp.status === 403
              ? 'forbidden'
              : resp.status === 401
                ? 'unauthorized'
                : resp.status === 422
                  ? 'validation_failed'
                  : 'http_error',
        );
        return { ok: false, error };
      }

      // Handle HTML/text error responses (like 404 pages)
      const error = toAppError(
        resp.status,
        resp.statusText || 'Request failed',
        resp.status === 404
          ? 'not_found'
          : resp.status === 403
            ? 'forbidden'
            : resp.status === 401
              ? 'unauthorized'
              : resp.status === 422
                ? 'validation_failed'
                : 'http_error',
      );
      return { ok: false, error };
    }

    // Phase 5.1: Handle paginated turns responses (defensive adapter)
    // Backend returns { ok: true, data: turns[], next?: { afterTurn } }
    // Normalize to { ok: true, data: { turns, next } } for consistent frontend consumption
    if (json && typeof json === 'object' && ('next' in json)) {
      // Handle both shapes: { data: turns[], next } or { data: { turns, next } }
      const data = json.data;
      const normalizedData = Array.isArray(data) 
        ? { turns: data, next: json.next }
        : (data && 'turns' in data ? data : { turns: [], next: json.next });
      
      return { 
        ok: true, 
        data: normalizedData as T
      };
    }
    
    // For other paginated responses (have count/hasMore), return the full response object
    if (json && typeof json === 'object' && ('count' in json || 'hasMore' in json)) {
      return { ok: true, data: json as T };
    }
    return { ok: true, data: (json?.data ?? json ?? null) as T };
  } catch (e: any) {
    const error = toAppError(0, e?.message || 'Network error', 'network_error');
    return { ok: false, error };
  }
}

// Convenience methods
export async function apiGet<T = unknown>(
  path: string,
): Promise<{ ok: true; data: T } | { ok: false; error: AppError }> {
  return apiFetch<T>(path, { method: 'GET' });
}

export async function apiPost<T = unknown>(
  path: string,
  body?: unknown,
): Promise<{ ok: true; data: T } | { ok: false; error: AppError }> {
  return apiFetch<T>(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function apiPut<T = unknown>(
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
): Promise<{ ok: true; data: T } | { ok: false; error: AppError }> {
  return apiFetch<T>(path, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
    headers,
  });
}

export async function apiPatch<T = unknown>(
  path: string,
  body?: unknown,
): Promise<{ ok: true; data: T } | { ok: false; error: AppError }> {
  return apiFetch<T>(path, {
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function apiDelete<T = unknown>(
  path: string,
): Promise<{ ok: true; data: T } | { ok: false; error: AppError }> {
  return apiFetch<T>(path, { method: 'DELETE' });
}

// Game creation
export async function createGame(
  adventureSlug: string,
  characterId?: string,
): Promise<{ ok: true; data: any } | { ok: false; error: AppError }> {
  return apiPost('/api/games', {
    adventureSlug,
    characterId,
  });
}

// Get game by ID
export async function getGame(
  gameId: string,
): Promise<{ ok: true; data: any } | { ok: false; error: AppError }> {
  return apiGet(`/api/games/${gameId}`);
}


// List current user's adventures (active games)
export async function getMyAdventures(
  params?: { limit?: number; offset?: number },
): Promise<{ ok: true; data: GameListDTO[] } | { ok: false; error: AppError }> {
  const searchParams = new URLSearchParams();

  if (params?.limit !== undefined) {
    searchParams.set('limit', String(params.limit));
  }
  if (params?.offset !== undefined) {
    searchParams.set('offset', String(params.offset));
  }

  const query = searchParams.toString();
  return apiGet(`/api/games${query ? `?${query}` : ''}`);
}// Get premade characters for a world
export async function getPremadeCharacters(
  worldSlug: string,
): Promise<{ ok: true; data: any[] } | { ok: false; error: AppError }> {
  return apiGet(`/api/premades?world=${encodeURIComponent(worldSlug)}`);
}

// Get characters for a user (optionally filtered by world)
export async function getCharacters(
  worldSlug?: string,
): Promise<{ ok: true; data: any[] } | { ok: false; error: AppError }> {
  const path = worldSlug ? `/api/characters?world=${encodeURIComponent(worldSlug)}` : '/api/characters';
  return apiGet(path);
}

// Create character (supports both new and legacy formats)
export async function createCharacterLegacy(
  characterData: any,
): Promise<{ ok: true; data: any } | { ok: false; error: AppError }> {
  return apiPost('/api/characters', characterData);
}

// Create character from premade
export async function createCharacterFromPremade(
  worldSlug: string,
  archetypeKey: string,
  name?: string,
): Promise<{ ok: true; data: any } | { ok: false; error: AppError }> {
  return apiPost('/api/characters', {
    worldSlug,
    archetypeKey,
    name,
    fromPremade: true,
  });
}

// PlayerV3 API functions
export async function createPlayerV3(
  worldSlug: string,
  player: any,
): Promise<{ ok: true; data: any } | { ok: false; error: AppError }> {
  return apiPost('/api/players-v3', { worldSlug, player });
}

export async function getPlayerV3(
  playerId: string,
): Promise<{ ok: true; data: any } | { ok: false; error: AppError }> {
  return apiGet(`/api/players-v3/${playerId}`);
}

export async function updatePlayerV3(
  playerId: string,
  updates: any,
): Promise<{ ok: true; data: any } | { ok: false; error: AppError }> {
  return apiFetch(`/api/players-v3/${playerId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function getPlayersV3ByWorld(
  worldSlug: string,
): Promise<{ ok: true; data: any[] } | { ok: false; error: AppError }> {
  return apiGet(`/api/players-v3/world/${worldSlug}`);
}

// Turn submission with idempotency key
export async function submitTurn<T = unknown>(
  gameId: string,
  optionId: string,
  idempotencyKey: string,
  userInput?: string,
  userInputType?: 'choice' | 'text' | 'action',
): Promise<{ ok: true; data: T } | { ok: false; error: AppError }> {
  return apiFetch<T>(`/api/games/${gameId}/turn`, {
    method: 'POST',
    body: JSON.stringify({ 
      optionId,
      userInput,
      userInputType,
    }),
    headers: {
      'Idempotency-Key': idempotencyKey,
    },
  });
}

// Phase 8: Simple send-turn API for playable loop
export async function sendTurn(
  gameId: string,
  message: string,
  options?: {
    idempotencyKey?: string;
    model?: string;
    temperature?: number;
    debug?: boolean;
    debugDepth?: 'safe' | 'full';
  }
): Promise<{ ok: true; data: { turn: { turn_number: number; role: string; content: string; meta: any; created_at: string }; debug?: any } } | { ok: false; error: AppError }> {
  const headers: Record<string, string> = {};
  
  if (options?.idempotencyKey) {
    headers['Idempotency-Key'] = options.idempotencyKey;
  }

  // Handle debug parameter
  let url = `/api/games/${gameId}/send-turn`;
  if (options?.debug !== undefined) {
    if (options.debug) {
      url += `?debug=1&debugDepth=${options.debugDepth || 'safe'}`;
      headers['X-Debug-Response'] = '1';
    } else {
      url += `?debug=0`;
      headers['X-Debug-Response'] = '0';
    }
  }

  return apiFetch<{ turn: { turn_number: number; role: string; content: string; meta: any; created_at: string }; debug?: any }>(
    url,
    {
      method: 'POST',
      body: JSON.stringify({
        message,
        model: options?.model,
        temperature: options?.temperature,
      }),
      headers,
    }
  );
}

// World templates
export async function getWorldTemplates(): Promise<{ ok: true; data: any[] } | { ok: false; error: AppError }> {
  return apiGet('/api/worlds');
}

// Game saves (legacy compatibility)
export async function createGameSave(
  gameSaveData: any,
): Promise<{ ok: true; data: any } | { ok: false; error: AppError }> {
  return apiPost('/api/games', gameSaveData);
}

export async function getGameSave(
  gameId: string,
): Promise<{ ok: true; data: any } | { ok: false; error: AppError }> {
  return apiGet(`/api/games/${gameId}`);
}

// Character operations (legacy compatibility)
export async function getCharacter(
  characterId: string,
): Promise<{ ok: true; data: any } | { ok: false; error: AppError }> {
  return apiGet(`/api/characters/${characterId}`);
}

// Story actions
export async function processStoryAction(
  gameId: string,
  action: any,
): Promise<{ ok: true; data: any } | { ok: false; error: AppError }> {
  return apiPost('/api/story', { ...action, gameSaveId: gameId });
}

// Content API - Layer M0
export async function getContentWorlds(): Promise<{ ok: true; data: any[] } | { ok: false; error: AppError }> {
  return apiGet('/api/content/worlds');
}

export async function getContentStories(): Promise<{ ok: true; data: any[] } | { ok: false; error: AppError }> {
  return apiGet('/api/content/stories');
}

// Stories API - Layer P1
export async function getStories(): Promise<{ ok: true; data: any[] } | { ok: false; error: AppError }> {
  return apiGet('/api/stories');
}

export async function getStoryById(id: string): Promise<{ ok: true; data: any } | { ok: false; error: AppError }> {
  return apiGet(`/api/stories/${id}`);
}

export async function getStoryBySlug(slug: string): Promise<{ ok: true; data: any } | { ok: false; error: AppError }> {
  return apiGet(`/api/stories/slug/${slug}`);
}

// Worlds API - Layer P1
export async function getWorlds(): Promise<{ ok: true; data: any[] } | { ok: false; error: AppError }> {
  return apiGet('/api/worlds');
}

export async function getWorldById(id: string): Promise<{ ok: true; data: any } | { ok: false; error: AppError }> {
  return apiGet(`/api/worlds/${id}`);
}

// Wallet/Stones API
export async function getWallet(): Promise<{ ok: true; data: any } | { ok: false; error: AppError }> {
  return apiGet('/api/stones/wallet');
}

export async function getStonesHistory(): Promise<{ ok: true; data: any[] } | { ok: false; error: AppError }> {
  return apiGet('/api/stones/history');
}

// Phase 6.1: Defensive adapter for turns API normalization
// Handles both response shapes:
// - { ok: true, data: turns[], next?: { afterTurn } }
// - { ok: true, data: { turns: [], next?: { afterTurn } } }
function normalizeTurnsResponse(
  response: any
): { ok: true; data: { turns: any[]; next?: { afterTurn: number } } } | { ok: false; error: AppError } {
  if (!response.ok) {
    return response;
  }

  const data = response.data;
  
  // If data is already an array, normalize to { turns, next }
  if (Array.isArray(data)) {
    return {
      ok: true,
      data: {
        turns: data,
        next: response.next,
      },
    };
  }
  
  // If data is an object with turns, use it directly
  if (data && typeof data === 'object' && 'turns' in data) {
    return {
      ok: true,
      data: {
        turns: data.turns || [],
        next: data.next || response.next,
      },
    };
  }
  
  // Fallback: assume empty array
  return {
    ok: true,
    data: {
      turns: [],
      next: response.next,
    },
  };
}

// Game Turns API - Phase 5: Paginated turns with cursor
export async function getGameTurns(
  gameId: string,
  params?: { afterTurn?: number; limit?: number }
): Promise<{ ok: true; data: { turns: any[]; next?: { afterTurn: number } } } | { ok: false; error: AppError }> {
  const searchParams = new URLSearchParams();
  if (params?.afterTurn) {
    searchParams.set('afterTurn', String(params.afterTurn));
  }
  if (params?.limit) {
    searchParams.set('limit', String(params.limit));
  }
  const query = searchParams.toString();
  const rawResponse = await apiGet(`/api/games/${gameId}/turns${query ? `?${query}` : ''}`);
  return normalizeTurnsResponse(rawResponse);
}

// Phase 5: V3 Create Game API with idempotency and test transaction support
export async function postCreateGame(
  body: {
    entry_point_id: string;
    world_id: string;
    entry_start_slug: string;
    scenario_slug?: string | null;
    ruleset_slug?: string;
    model?: string;
    characterId?: string;
  },
  opts?: {
    idempotencyKey?: string;
    testRollback?: boolean;
    debug?: boolean;
    debugDepth?: 'safe' | 'full';
  }
): Promise<{ ok: true; data: { game_id: string; first_turn: any; debug?: any } } | { ok: false; error: AppError }> {
  const headers: Record<string, string> = {};
  
  if (opts?.idempotencyKey) {
    headers['Idempotency-Key'] = opts.idempotencyKey;
  }
  
  if (opts?.testRollback && import.meta.env.VITE_TEST_TX_HEADER_ENABLED === 'true') {
    headers['X-Test-Rollback'] = '1';
  }

  // Handle debug parameter
  let url = `/api/games`;
  if (opts?.debug !== undefined) {
    if (opts.debug) {
      url += `?debug=1&debugDepth=${opts.debugDepth || 'safe'}`;
      headers['X-Debug-Response'] = '1';
    } else {
      url += `?debug=0`;
      headers['X-Debug-Response'] = '0';
    }
  }
  
  return apiFetch(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers,
  });
}

// Auto-initialize game API (returns TurnDTO)
export async function autoInitializeGame(
  gameId: string
): Promise<{ ok: true; data: import('@shared').TurnDTO } | { ok: false; error: AppError }> {
  return apiPost<import('@shared').TurnDTO>(`/api/games/${gameId}/auto-initialize`, {});
}

// Get latest turn for a game (returns TurnDTO)
export async function getLatestTurn(
  gameId: string
): Promise<{ ok: true; data: import('@shared').TurnDTO } | { ok: false; error: AppError }> {
  return apiGet<import('@shared').TurnDTO>(`/api/games/${gameId}/turns/latest`);
}

// Submit a choice (returns TurnDTO)
export async function postChoice(
  gameId: string,
  choiceId: string,
  idempotencyKey: string
): Promise<{ ok: true; data: import('@shared').TurnDTO } | { ok: false; error: AppError }> {
  return submitTurn<import('@shared').TurnDTO>(
    gameId,
    choiceId,
    idempotencyKey,
    undefined,
    'choice'
  );
}

// Submit a turn with new format: sends choice/text directly
export async function postTurn(
  gameId: string,
  payload: { kind: 'choice' | 'text'; text: string },
  idempotencyKey: string
): Promise<{ ok: true; data: import('@shared').TurnDTO } | { ok: false; error: AppError }> {
  return apiFetch<import('@shared').TurnDTO>(`/api/games/${gameId}/turn`, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'Idempotency-Key': idempotencyKey,
    },
  });
}

// Initial Prompt API
export async function createInitialPrompt(
  gameId: string
): Promise<{ ok: true; data: any } | { ok: false; error: AppError }> {
  return apiPost(`/api/games/${gameId}/initial-prompt`, {});
}

export async function approvePrompt(
  gameId: string,
  promptId: string,
  approved: boolean
): Promise<{ ok: true; data: any } | { ok: false; error: AppError }> {
  return apiPost(`/api/games/${gameId}/approve-prompt`, {
    promptId,
    approved,
  });
}

// ============================================================================
// CATALOG API - New Product Model (Stories, Worlds, NPCs, Rulesets)
// ============================================================================

import { httpGet } from './http';
import type { World, NPC, Ruleset, Story, StoryWithJoins, ID, StoryKind } from '@/types/domain';

export interface ListParamsBase { q?: string; limit?: number }
export interface ListStoriesParams extends ListParamsBase { world?: ID; kind?: StoryKind; ruleset?: ID; tags?: string[] }
export interface ListNPCsParams extends ListParamsBase { world?: ID }

// Worlds
export const listWorlds = (p?: ListParamsBase) => httpGet<World[]>('/api/catalog/worlds', p);

// NPCs
export const listNPCs = (p?: ListNPCsParams) => httpGet<NPC[]>('/api/catalog/npcs', p);

// Rulesets
export const listRulesets = (p?: ListParamsBase) => httpGet<Ruleset[]>('/api/catalog/rulesets', p);

// Stories (entries under the hood)
export const listStories = (p?: ListStoriesParams) => httpGet<Story[]>('/api/catalog/stories', p);
export const getStory = (idOrSlug: ID | string) => httpGet<StoryWithJoins>(`/api/catalog/stories/${idOrSlug}`);

// Individual detail endpoints
export const getWorld = (idOrSlug: ID | string) => httpGet<World>(`/api/catalog/worlds/${idOrSlug}`);
export const getNPC = (id: ID) => httpGet<NPC>(`/api/catalog/npcs/${id}`);
export const getRuleset = (id: ID) => httpGet<Ruleset>(`/api/catalog/rulesets/${id}`);

// Entry aliases removed in Phase 1

// ============================================================================
// CHARACTERS & SESSIONS API - Start Story Flow
// ============================================================================

import type { Character, Session } from '@/types/domain';

// Characters
export const listCharacters = () => httpGet<Character[]>('/api/characters');

export const createCharacter = (body: { name: string; portrait_seed?: string }) =>
  httpPost<Character>('/api/characters', body);

// Sessions
export const findExistingSession = (storyId: ID, characterId: ID) =>
	httpGet<{ id: ID } | null>(`/api/sessions`, { params: { story_id: storyId, character_id: characterId } as any });

export const getSession = (sessionId: ID) => httpGet<Session>(`/api/sessions/${sessionId}`);

export const getSessionMessages = (sessionId: ID, limit: number = 20) =>
	httpGet<{ id: string; content: string; role: 'user'|'assistant'; created_at: string }[]>(`/api/sessions/${sessionId}/messages`, { params: { limit } as any });

export const createSession = (
	body: { story_id: ID; character_id: ID },
	opts?: { headers?: Record<string, string> }
) => httpPost<Session>('/api/sessions', body, opts);

// Guest authentication
export const createGuestToken = () =>
  httpPost<{ token: string }>('/auth/guest', {});


