/**
 * In-memory debug payload store (session only)
 * Stores debug payloads keyed by turnKey = ${gameId}:${turnNumber}
 */

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
}

// Singleton instance
export const debugStore = new DebugStore();

