/**
 * Event-driven invalidation adapter
 * PR7: Provides real-time updates via SSE/WebSocket when available
 * Falls back to no-op when EVENTS_ON is false or backend doesn't support events
 */

import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';
import { apiUrl } from './apiBase';

export interface GameEvent {
  type: 'turn.created' | 'turn.updated' | 'game.updated';
  gameId: string;
  data?: unknown;
}

export interface EventAdapter {
  subscribe(gameId: string, onEvent: (event: GameEvent) => void): () => void;
  isAvailable(): boolean;
}

/**
 * No-op adapter - used when events are not available
 * Provides same interface but does nothing
 */
class NoOpEventAdapter implements EventAdapter {
  subscribe(_gameId: string, _onEvent: (event: GameEvent) => void): () => void {
    // No-op: return unsubscribe function that does nothing
    return () => {};
  }
  
  isAvailable(): boolean {
    return false;
  }
}

/**
 * SSE (Server-Sent Events) adapter
 * Connects to /api/games/:id/events endpoint
 */
class SSEEventAdapter implements EventAdapter {
  private connections = new Map<string, EventSource>();
  
  subscribe(gameId: string, onEvent: (event: GameEvent) => void): () => void {
    // Close existing connection if any
    const existing = this.connections.get(gameId);
    if (existing) {
      existing.close();
    }
    
    const eventSource = new EventSource(apiUrl(`/api/games/${gameId}/events`));
    
    eventSource.onmessage = (e) => {
      try {
        const event: GameEvent = JSON.parse(e.data);
        onEvent(event);
      } catch (error) {
        console.error('[SSEEventAdapter] Failed to parse event:', error);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('[SSEEventAdapter] Connection error:', error);
      // EventSource will auto-reconnect
    };
    
    this.connections.set(gameId, eventSource);
    
    // Return unsubscribe function
    return () => {
      eventSource.close();
      this.connections.delete(gameId);
    };
  }
  
  isAvailable(): boolean {
    return typeof EventSource !== 'undefined';
  }
}

/**
 * Get event adapter based on feature flag
 */
export function getEventAdapter(): EventAdapter {
  const eventsOn = import.meta.env.VITE_EVENTS_ON === 'true';
  
  if (!eventsOn) {
    return new NoOpEventAdapter();
  }
  
  // Try SSE first
  if (typeof EventSource !== 'undefined') {
    return new SSEEventAdapter();
  }
  
  // Fallback to no-op
  return new NoOpEventAdapter();
}

/**
 * Subscribe to game events and invalidate queries on updates
 */
export function subscribeToGameEvents(
  queryClient: QueryClient,
  gameId: string
): () => void {
  const adapter = getEventAdapter();
  
  if (!adapter.isAvailable()) {
    // No-op adapter - return empty unsubscribe
    return () => {};
  }
  
  return adapter.subscribe(gameId, (event) => {
    // Precise invalidations based on event type
    switch (event.type) {
      case 'turn.created':
      case 'turn.updated':
        queryClient.invalidateQueries({ queryKey: queryKeys.latestTurn(gameId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.conversationHistory(gameId) });
        break;
      case 'game.updated':
        queryClient.invalidateQueries({ queryKey: queryKeys.game(gameId) });
        // If wallet balance changed, invalidate wallet
        if ((event.data as any)?.walletChanged) {
          queryClient.invalidateQueries({ queryKey: queryKeys.wallet() });
        }
        break;
    }
  });
}

