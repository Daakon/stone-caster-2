/**
 * In-memory debug payload store (session only)
 * Stores debug payloads keyed by turnKey = ${gameId}:${turnNumber}
 */

import { apiUrl } from './apiBase';

export interface DebugPayload {
  debugId: string;
  phase: 'start' | 'turn';
  assembler: {
    prompt: string;
    pieces: Array<{ scope: string; slug: string; version?: string; tokens?: number }>;
    meta: {
      included?: string[];
      dropped?: string[];
      policy?: string[];
      model?: string;
      worldId?: string;
      rulesetSlug?: string;
      scenarioSlug?: string | null;
      entryStartSlug?: string;
      tokenEst?: { input: number; budget: number; pct: number };
      [key: string]: any;
    };
  };
  ai?: {
    request?: any;
    rawResponse?: any;
    transformed?: any;
  };
  timings?: {
    assembleMs?: number;
    aiMs?: number;
    totalMs?: number;
  };
}

export interface TurnSummary {
  turnNumber: number;
  role: string; // 'narrator' | 'player'
  summary: string; // First 80 chars of prompt or narrator content
  turnKey: string; // ${gameId}:${turnNumber}
}

class DebugStore {
  private store: Map<string, DebugPayload> = new Map();

  /**
   * Add debug payload for a turn
   */
  addDebug(turnKey: string, payload: DebugPayload): void {
    this.store.set(turnKey, payload);
  }

  /**
   * Get debug payload for a turn
   */
  getDebug(turnKey: string): DebugPayload | undefined {
    return this.store.get(turnKey);
  }

  /**
   * Get all debug payloads for a game, sorted by turn number
   */
  getAll(gameId: string): TurnSummary[] {
    const summaries: TurnSummary[] = [];
    
    for (const [turnKey, payload] of this.store.entries()) {
      if (turnKey.startsWith(`${gameId}:`)) {
        const turnNumber = parseInt(turnKey.split(':')[1] || '0', 10);
        
        // Generate summary from prompt (first 80 chars)
        const promptPreview = payload.assembler.prompt.substring(0, 80);
        const summary = promptPreview.length === 80 ? `${promptPreview}...` : promptPreview;
        
        summaries.push({
          turnNumber,
          role: payload.phase === 'start' ? 'narrator' : 'narrator', // Both phases are narrator turns
          summary,
          turnKey,
        });
      }
    }

    // Sort by turn number ascending
    summaries.sort((a, b) => a.turnNumber - b.turnNumber);

    return summaries;
  }

  /**
   * Clear all debug payloads for a game
   */
  clear(gameId: string): void {
    const keysToDelete: string[] = [];
    
    for (const turnKey of this.store.keys()) {
      if (turnKey.startsWith(`${gameId}:`)) {
        keysToDelete.push(turnKey);
      }
    }

    keysToDelete.forEach(key => this.store.delete(key));
  }

  /**
   * Clear all debug payloads (for testing or cleanup)
   */
  clearAll(): void {
    this.store.clear();
  }

  /**
   * Fetch traces from API and merge with in-memory payloads
   */
  async hydrateTraces(gameId: string): Promise<void> {
    try {
      const debugToken = import.meta.env.VITE_DEBUG_ROUTES_TOKEN;
      
      if (!debugToken) {
        return;
      }

      const response = await fetch(apiUrl(`/api/dev/debug/traces/${gameId}?limit=50`), {
        headers: {
          'X-Debug-Token': debugToken,
        },
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      if (data.ok && data.data?.traces) {
        // Merge traces with in-memory payloads
        for (const trace of data.data.traces) {
          const turnKey = `${gameId}:${trace.turnNumber}`;
          
          // Only add if not already in store (live payloads take precedence)
          if (!this.store.has(turnKey)) {
            this.store.set(turnKey, {
              debugId: `${gameId}:${trace.turnNumber}`,
              phase: trace.phase,
              assembler: {
                prompt: trace.promptSnippet || '',
                pieces: trace.pieces || [],
                meta: {
                  tokenEst: { input: 0, budget: 0, pct: trace.tokenPct },
                  policy: trace.policy || [],
                  npcTrimmedCount: trace.npcTrimmedCount || 0,
                },
              },
              timings: trace.timings,
            });
          }
        }
      }
    } catch (error) {
    }
  }
}

// Singleton instance
export const debugStore = new DebugStore();

