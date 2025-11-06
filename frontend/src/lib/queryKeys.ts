/**
 * Canonical query key builders
 * PR11-C: All query keys must be generated via these helpers
 * Ensures stable serialization and prevents undefined in keys
 */

export const queryKeys = {
  profile: () => ['profile'] as const,
  
  adminUserRoles: (userId: string | null) => ['admin-user-roles', userId] as const,
  
  accessRequestStatus: () => ['access-request-status'] as const,
  
  wallet: () => ['wallet'] as const,
  
  worlds: (params: { q?: string | null } = {}) => 
    ['worlds', { q: params.q ?? '' }] as const,
  
  world: (idOrSlug: string) => ['world', idOrSlug] as const,
  
  stories: (params: {
    worldId?: string | null;
    page?: number;
    filter?: string | null;
    kind?: 'scenario' | 'adventure' | null;
    ruleset?: string | null;
    tags?: string[] | null;
  } = {}) => 
    ['stories', {
      worldId: params.worldId ?? null,
      page: params.page ?? 1,
      filter: params.filter ?? '',
      kind: params.kind ?? null,
      ruleset: params.ruleset ?? null,
      tags: params.tags ?? null,
    }] as const,
  
  story: (idOrSlug: string) => ['story', idOrSlug] as const,
  
  characters: (params: { worldId?: string | null } = {}) =>
    ['characters', { worldId: params.worldId ?? null }] as const,
  
  myAdventures: () => ['my-stories'] as const,
  
  game: (gameId: string) => ['game', gameId] as const,
  
  latestTurn: (gameId: string) => ['turns.latest', gameId] as const,
  
  conversationHistory: (gameId: string) => ['conversation.history', gameId] as const,
} as const;

