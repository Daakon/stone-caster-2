import { useCallback } from 'react';
import { apiPost } from '../lib/api';

interface AdventureTelemetryEvent {
  event: 'character_selection_started' | 'character_selected' | 'adventure_started' | 'adventure_resumed' | 'error_shown' | 'time_to_first_turn';
  characterType?: 'premade' | 'existing' | 'new';
  characterId?: string;
  adventureSlug?: string;
  errorCode?: string;
  duration?: number; // in milliseconds
  metadata?: Record<string, any>;
}

export function useAdventureTelemetry() {
  const trackEvent = useCallback(async (event: AdventureTelemetryEvent) => {
    // Disable telemetry during testing
    if (process.env.NODE_ENV === 'development' || process.env.DISABLE_TELEMETRY === 'true') {
      return;
    }

    try {
      // Don't block the UI if telemetry fails
      await apiPost('/api/telemetry/event', {
        name: `adventure_${event.event}`,
        props: {
          characterType: event.characterType,
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

  const trackCharacterSelectionStarted = useCallback((adventureSlug: string) => {
    return trackEvent({
      event: 'character_selection_started',
      adventureSlug,
    });
  }, [trackEvent]);

  const trackCharacterSelected = useCallback((
    characterType: 'premade' | 'existing' | 'new',
    characterId?: string,
    adventureSlug?: string
  ) => {
    return trackEvent({
      event: 'character_selected',
      characterType,
      characterId,
      adventureSlug,
    });
  }, [trackEvent]);

  const trackAdventureStarted = useCallback((
    characterType: 'premade' | 'existing' | 'new',
    characterId: string,
    adventureSlug: string,
    duration?: number
  ) => {
    return trackEvent({
      event: 'adventure_started',
      characterType,
      characterId,
      adventureSlug,
      duration,
    });
  }, [trackEvent]);

  const trackAdventureResumed = useCallback((
    characterId: string,
    adventureSlug: string,
    gameId: string
  ) => {
    return trackEvent({
      event: 'adventure_resumed',
      characterId,
      adventureSlug,
      metadata: { gameId },
    });
  }, [trackEvent]);

  const trackErrorShown = useCallback((
    errorCode: string,
    characterType?: 'premade' | 'existing' | 'new',
    adventureSlug?: string
  ) => {
    return trackEvent({
      event: 'error_shown',
      errorCode,
      characterType,
      adventureSlug,
    });
  }, [trackEvent]);

  const trackTimeToFirstTurn = useCallback((
    characterType: 'premade' | 'existing' | 'new',
    characterId: string,
    adventureSlug: string,
    duration: number
  ) => {
    return trackEvent({
      event: 'time_to_first_turn',
      characterType,
      characterId,
      adventureSlug,
      duration,
    });
  }, [trackEvent]);

  return {
    trackCharacterSelectionStarted,
    trackCharacterSelected,
    trackAdventureStarted,
    trackAdventureResumed,
    trackErrorShown,
    trackTimeToFirstTurn,
  };
}
