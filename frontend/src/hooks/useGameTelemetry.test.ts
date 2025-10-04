import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGameTelemetry } from './useGameTelemetry';
import { apiPost } from '../lib/api';

// Mock the API module
vi.mock('../lib/api', () => ({
  apiPost: vi.fn()
}));

describe('useGameTelemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('trackTurnStarted', () => {
    it('should track turn started event', async () => {
      const mockApiPost = vi.mocked(apiPost);
      mockApiPost.mockResolvedValue({ ok: true, data: {} });

      const { result } = renderHook(() => useGameTelemetry());

      await act(async () => {
        await result.current.trackTurnStarted(
          'game-123',
          'character-123',
          'mystika-tutorial',
          'I cast a spell'
        );
      });

      expect(mockApiPost).toHaveBeenCalledWith('/api/telemetry/event', {
        name: 'game_turn_started',
        props: {
          gameId: 'game-123',
          characterId: 'character-123',
          adventureSlug: 'mystika-tutorial',
          action: 'I cast a spell'
        }
      });
    });

    it('should prevent duplicate events within 1 second', async () => {
      const mockApiPost = vi.mocked(apiPost);
      mockApiPost.mockResolvedValue({ ok: true, data: {} });

      const { result } = renderHook(() => useGameTelemetry());

      // Track the same event twice quickly
      await act(async () => {
        await Promise.all([
          result.current.trackTurnStarted('game-123', 'character-123', 'mystika-tutorial', 'action'),
          result.current.trackTurnStarted('game-123', 'character-123', 'mystika-tutorial', 'action')
        ]);
      });

      // Should only be called once due to deduplication
      expect(mockApiPost).toHaveBeenCalledTimes(1);
    });
  });

  describe('trackTurnCompleted', () => {
    it('should track turn completed event', async () => {
      const mockApiPost = vi.mocked(apiPost);
      mockApiPost.mockResolvedValue({ ok: true, data: {} });

      const { result } = renderHook(() => useGameTelemetry());

      await act(async () => {
        await result.current.trackTurnCompleted(
          'game-123',
          'character-123',
          'mystika-tutorial',
          1500,
          5
        );
      });

      expect(mockApiPost).toHaveBeenCalledWith('/api/telemetry/event', {
        name: 'game_turn_completed',
        props: {
          gameId: 'game-123',
          characterId: 'character-123',
          adventureSlug: 'mystika-tutorial',
          duration: 1500,
          turnCount: 5
        }
      });
    });
  });

  describe('trackTurnFailed', () => {
    it('should track turn failed event', async () => {
      const mockApiPost = vi.mocked(apiPost);
      mockApiPost.mockResolvedValue({ ok: true, data: {} });

      const { result } = renderHook(() => useGameTelemetry());

      await act(async () => {
        await result.current.trackTurnFailed(
          'game-123',
          'character-123',
          'mystika-tutorial',
          'insufficient_stones',
          'I cast a spell'
        );
      });

      expect(mockApiPost).toHaveBeenCalledWith('/api/telemetry/event', {
        name: 'game_turn_failed',
        props: {
          gameId: 'game-123',
          characterId: 'character-123',
          adventureSlug: 'mystika-tutorial',
          errorCode: 'insufficient_stones',
          action: 'I cast a spell'
        }
      });
    });
  });

  describe('trackGameLoaded', () => {
    it('should track game loaded event', async () => {
      const mockApiPost = vi.mocked(apiPost);
      mockApiPost.mockResolvedValue({ ok: true, data: {} });

      const { result } = renderHook(() => useGameTelemetry());

      await act(async () => {
        await result.current.trackGameLoaded(
          'game-123',
          'character-123',
          'mystika-tutorial',
          2000
        );
      });

      expect(mockApiPost).toHaveBeenCalledWith('/api/telemetry/event', {
        name: 'game_game_loaded',
        props: {
          gameId: 'game-123',
          characterId: 'character-123',
          adventureSlug: 'mystika-tutorial',
          duration: 2000,
          loadTime: 2000
        }
      });
    });
  });

  describe('trackErrorShown', () => {
    it('should track error shown event', async () => {
      const mockApiPost = vi.mocked(apiPost);
      mockApiPost.mockResolvedValue({ ok: true, data: {} });

      const { result } = renderHook(() => useGameTelemetry());

      await act(async () => {
        await result.current.trackErrorShown(
          'game-123',
          'insufficient_stones',
          'character-123',
          'mystika-tutorial'
        );
      });

      expect(mockApiPost).toHaveBeenCalledWith('/api/telemetry/event', {
        name: 'game_error_shown',
        props: {
          gameId: 'game-123',
          characterId: 'character-123',
          adventureSlug: 'mystika-tutorial',
          errorCode: 'insufficient_stones'
        }
      });
    });
  });

  describe('trackRetryAttempted', () => {
    it('should track retry attempted event', async () => {
      const mockApiPost = vi.mocked(apiPost);
      mockApiPost.mockResolvedValue({ ok: true, data: {} });

      const { result } = renderHook(() => useGameTelemetry());

      await act(async () => {
        await result.current.trackRetryAttempted(
          'game-123',
          'character-123',
          'mystika-tutorial',
          'insufficient_stones'
        );
      });

      expect(mockApiPost).toHaveBeenCalledWith('/api/telemetry/event', {
        name: 'game_retry_attempted',
        props: {
          gameId: 'game-123',
          characterId: 'character-123',
          adventureSlug: 'mystika-tutorial',
          errorCode: 'insufficient_stones'
        }
      });
    });
  });

  describe('error handling', () => {
    it('should handle API errors gracefully', async () => {
      const mockApiPost = vi.mocked(apiPost);
      mockApiPost.mockRejectedValue(new Error('Network error'));

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() => useGameTelemetry());

      await act(async () => {
        await result.current.trackTurnStarted(
          'game-123',
          'character-123',
          'mystika-tutorial',
          'action'
        );
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Game telemetry tracking failed:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('deduplication', () => {
    it('should clean up old events after 5 minutes', async () => {
      const mockApiPost = vi.mocked(apiPost);
      mockApiPost.mockResolvedValue({ ok: true, data: {} });

      const { result } = renderHook(() => useGameTelemetry());

      // Track an event
      await act(async () => {
        await result.current.trackTurnStarted(
          'game-123',
          'character-123',
          'mystika-tutorial',
          'action'
        );
      });

      // Mock time passing (5 minutes + 1 second)
      vi.advanceTimersByTime(5 * 60 * 1000 + 1000);

      // Track another event - should not be deduplicated
      await act(async () => {
        await result.current.trackTurnStarted(
          'game-123',
          'character-123',
          'mystika-tutorial',
          'action'
        );
      });

      // Should be called twice now
      expect(mockApiPost).toHaveBeenCalledTimes(2);
    });
  });
});
