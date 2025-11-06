import { useCallback, useRef } from 'react';
import { apiPost } from '../lib/api';

interface GameTelemetryEvent {
  event: 'turn_started' | 'turn_completed' | 'turn_failed' | 'game_loaded' | 'error_shown' | 'retry_attempted';
  gameId?: string;
  characterId?: string;
  adventureSlug?: string;
  errorCode?: string;
  duration?: number; // in milliseconds
  metadata?: Record<string, any>;
}

export function useGameTelemetry() {
  // Track sent events to prevent duplicates
  const sentEvents = useRef<Set<string>>(new Set());

  const trackEvent = useCallback(async (event: GameTelemetryEvent) => {
    // Disable telemetry during testing
    if (process.env.NODE_ENV === 'development' || process.env.DISABLE_TELEMETRY === 'true') {
      return;
    }

    try {
      // Create a unique key for this event to prevent duplicates
      const eventKey = `${event.event}-${event.gameId}-${Date.now()}`;
      
      // Check if we've already sent this event recently (within 1 second)
      const recentEvents = Array.from(sentEvents.current).filter(key => 
        key.startsWith(`${event.event}-${event.gameId}`) && 
        Date.now() - parseInt(key.split('-').pop() || '0') < 1000
      );
      
      if (recentEvents.length > 0) {
        return;
      }

      // Add to sent events
      sentEvents.current.add(eventKey);
      
      // Clean up old events (older than 5 minutes)
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      sentEvents.current.forEach(key => {
        const timestamp = parseInt(key.split('-').pop() || '0');
        if (timestamp < fiveMinutesAgo) {
          sentEvents.current.delete(key);
        }
      });

      // Don't block the UI if telemetry fails
      await apiPost('/api/telemetry/event', {
        name: `game_${event.event}`,
        props: {
          gameId: event.gameId,
          characterId: event.characterId,
          adventureSlug: event.adventureSlug,
          errorCode: event.errorCode,
          duration: event.duration,
          ...event.metadata,
        },
      });
    } catch (error) {
      // Silently fail - telemetry should never break the user experience
    }
  }, []);

  const trackTurnStarted = useCallback((
    gameId: string,
    characterId: string,
    adventureSlug: string,
    action: string
  ) => {
    return trackEvent({
      event: 'turn_started',
      gameId,
      characterId,
      adventureSlug,
      metadata: { action }
    });
  }, [trackEvent]);

  const trackTurnCompleted = useCallback((
    gameId: string,
    characterId: string,
    adventureSlug: string,
    duration: number,
    turnCount: number
  ) => {
    return trackEvent({
      event: 'turn_completed',
      gameId,
      characterId,
      adventureSlug,
      duration,
      metadata: { turnCount }
    });
  }, [trackEvent]);

  const trackTurnFailed = useCallback((
    gameId: string,
    characterId: string,
    adventureSlug: string,
    errorCode: string,
    action: string
  ) => {
    return trackEvent({
      event: 'turn_failed',
      gameId,
      characterId,
      adventureSlug,
      errorCode,
      metadata: { action }
    });
  }, [trackEvent]);

  const trackGameLoaded = useCallback((
    gameId: string,
    characterId: string,
    adventureSlug: string,
    loadTime: number
  ) => {
    return trackEvent({
      event: 'game_loaded',
      gameId,
      characterId,
      adventureSlug,
      duration: loadTime,
      metadata: { loadTime }
    });
  }, [trackEvent]);

  const trackErrorShown = useCallback((
    gameId: string,
    errorCode: string,
    characterId?: string,
    adventureSlug?: string
  ) => {
    return trackEvent({
      event: 'error_shown',
      gameId,
      characterId,
      adventureSlug,
      errorCode
    });
  }, [trackEvent]);

  const trackRetryAttempted = useCallback((
    gameId: string,
    characterId: string,
    adventureSlug: string,
    errorCode: string
  ) => {
    return trackEvent({
      event: 'retry_attempted',
      gameId,
      characterId,
      adventureSlug,
      errorCode
    });
  }, [trackEvent]);

  return {
    trackTurnStarted,
    trackTurnCompleted,
    trackTurnFailed,
    trackGameLoaded,
    trackErrorShown,
    trackRetryAttempted,
  };
}
