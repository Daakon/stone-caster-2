import { type AppError, toAppError } from './errors';
import { supabase } from './supabase';
import { GuestCookieService } from '../services/guestCookie';
import type { GameListDTO } from '@shared';

const BASE = (import.meta.env.VITE_API_BASE_URL ?? (window.location.hostname === 'localhost' ? 'http://localhost:3000' : 'https://api.stonecaster.ai')).replace(
  /\/+$/,
  '',
);

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
export async function createCharacter(
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

export async function getContentAdventures(): Promise<{ ok: true; data: any[] } | { ok: false; error: AppError }> {
  return apiGet('/api/content/adventures');
}

// Adventures API - Layer P1
export async function getAdventures(): Promise<{ ok: true; data: any[] } | { ok: false; error: AppError }> {
  return apiGet('/api/adventures');
}

export async function getAdventureById(id: string): Promise<{ ok: true; data: any } | { ok: false; error: AppError }> {
  return apiGet(`/api/adventures/${id}`);
}

export async function getAdventureBySlug(slug: string): Promise<{ ok: true; data: any } | { ok: false; error: AppError }> {
  return apiGet(`/api/adventures/slug/${slug}`);
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

// Game Turns API
export async function getGameTurns(
  gameId: string
): Promise<{ ok: true; data: any[] } | { ok: false; error: AppError }> {
  return apiGet(`/api/games/${gameId}/turns`);
}

// Auto-initialize game API
export async function autoInitializeGame(
  gameId: string
): Promise<{ ok: true; data: any } | { ok: false; error: AppError }> {
  console.log(`[API] Calling auto-initialize for game ${gameId}`);
  const result = await apiPost(`/api/games/${gameId}/auto-initialize`, {});
  console.log(`[API] Auto-initialize result:`, result);
  return result;
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


