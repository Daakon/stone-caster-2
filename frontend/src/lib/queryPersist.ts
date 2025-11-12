/**
 * Persisted cache for safe reads
 * PR11-B: Persist only whitelisted public keys to sessionStorage
 */

import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

/**
 * Whitelist of keys to persist (public, read-mostly data)
 * Do NOT persist: profile, roles, wallet, game, turns.latest (sensitive/volatile)
 */
const PERSIST_WHITELIST = [
  'worlds',
  'world',
  'stories',
  'story',
  'characters',
] as const;

/**
 * Check if a query key should be persisted
 */
export function shouldPersistQuery(queryKey: readonly unknown[]): boolean {
  if (!Array.isArray(queryKey) || queryKey.length === 0) {
    return false;
  }
  
  const firstKey = queryKey[0];
  if (typeof firstKey !== 'string') {
    return false;
  }
  
  // Check if key starts with any whitelisted prefix
  return PERSIST_WHITELIST.some(prefix => firstKey.startsWith(prefix));
}

/**
 * Create sessionStorage persister
 */
export const queryPersister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.sessionStorage : {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  } as Storage,
  serialize: JSON.stringify,
  deserialize: JSON.parse,
  key: 'stonecaster-query-cache',
});

