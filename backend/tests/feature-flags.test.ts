import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  isAwfBundleEnabled, 
  setAwfBundleOverride, 
  clearAwfBundleOverride, 
  clearAllSessionOverrides,
  getSessionOverrides 
} from '../src/utils/feature-flags.js';

// Mock the config service
vi.mock('../src/services/config.service.js', () => ({
  configService: {
    getAwfBundleEnabled: vi.fn()
  }
}));

import { configService } from '../src/services/config.service.js';

describe('Feature Flags', () => {
  beforeEach(() => {
    // Clear all session overrides before each test
    clearAllSessionOverrides();
    // Reset mocks
    vi.clearAllMocks();
  });

  describe('isAwfBundleEnabled', () => {
    it('should return false when global flag is false and no session override', () => {
      // Arrange
      vi.mocked(configService.getAwfBundleEnabled).mockReturnValue(false);

      // Act
      const result = isAwfBundleEnabled({ sessionId: 'test-session' });

      // Assert
      expect(result).toBe(false);
      expect(configService.getAwfBundleEnabled).toHaveBeenCalledOnce();
    });

    it('should return true when global flag is true and no session override', () => {
      // Arrange
      vi.mocked(configService.getAwfBundleEnabled).mockReturnValue(true);

      // Act
      const result = isAwfBundleEnabled({ sessionId: 'test-session' });

      // Assert
      expect(result).toBe(true);
      expect(configService.getAwfBundleEnabled).toHaveBeenCalledOnce();
    });

    it('should return true when global flag is false but session override is true', () => {
      // Arrange
      vi.mocked(configService.getAwfBundleEnabled).mockReturnValue(false);
      setAwfBundleOverride('test-session', true);

      // Act
      const result = isAwfBundleEnabled({ sessionId: 'test-session' });

      // Assert
      expect(result).toBe(true);
      // Config service should not be called when session override exists
      expect(configService.getAwfBundleEnabled).not.toHaveBeenCalled();
    });

    it('should return false when global flag is true but session override is false', () => {
      // Arrange
      vi.mocked(configService.getAwfBundleEnabled).mockReturnValue(true);
      setAwfBundleOverride('test-session', false);

      // Act
      const result = isAwfBundleEnabled({ sessionId: 'test-session' });

      // Assert
      expect(result).toBe(false);
      // Config service should not be called when session override exists
      expect(configService.getAwfBundleEnabled).not.toHaveBeenCalled();
    });

    it('should fall back to global flag when sessionId is undefined', () => {
      // Arrange
      vi.mocked(configService.getAwfBundleEnabled).mockReturnValue(true);

      // Act
      const result = isAwfBundleEnabled({ sessionId: undefined });

      // Assert
      expect(result).toBe(true);
      expect(configService.getAwfBundleEnabled).toHaveBeenCalledOnce();
    });

    it('should fall back to global flag when sessionId is not in overrides', () => {
      // Arrange
      vi.mocked(configService.getAwfBundleEnabled).mockReturnValue(false);
      setAwfBundleOverride('other-session', true);

      // Act
      const result = isAwfBundleEnabled({ sessionId: 'test-session' });

      // Assert
      expect(result).toBe(false);
      expect(configService.getAwfBundleEnabled).toHaveBeenCalledOnce();
    });
  });

  describe('setAwfBundleOverride', () => {
    it('should set session override to true', () => {
      // Act
      setAwfBundleOverride('test-session', true);

      // Assert
      const overrides = getSessionOverrides();
      expect(overrides.get('test-session')).toBe(true);
    });

    it('should set session override to false', () => {
      // Act
      setAwfBundleOverride('test-session', false);

      // Assert
      const overrides = getSessionOverrides();
      expect(overrides.get('test-session')).toBe(false);
    });

    it('should allow multiple session overrides', () => {
      // Act
      setAwfBundleOverride('session-1', true);
      setAwfBundleOverride('session-2', false);

      // Assert
      const overrides = getSessionOverrides();
      expect(overrides.get('session-1')).toBe(true);
      expect(overrides.get('session-2')).toBe(false);
    });
  });

  describe('clearAwfBundleOverride', () => {
    it('should clear specific session override', () => {
      // Arrange
      setAwfBundleOverride('test-session', true);
      setAwfBundleOverride('other-session', false);

      // Act
      clearAwfBundleOverride('test-session');

      // Assert
      const overrides = getSessionOverrides();
      expect(overrides.has('test-session')).toBe(false);
      expect(overrides.get('other-session')).toBe(false);
    });

    it('should not affect other session overrides', () => {
      // Arrange
      setAwfBundleOverride('session-1', true);
      setAwfBundleOverride('session-2', false);

      // Act
      clearAwfBundleOverride('session-1');

      // Assert
      const overrides = getSessionOverrides();
      expect(overrides.has('session-1')).toBe(false);
      expect(overrides.get('session-2')).toBe(false);
    });
  });

  describe('clearAllSessionOverrides', () => {
    it('should clear all session overrides', () => {
      // Arrange
      setAwfBundleOverride('session-1', true);
      setAwfBundleOverride('session-2', false);
      setAwfBundleOverride('session-3', true);

      // Act
      clearAllSessionOverrides();

      // Assert
      const overrides = getSessionOverrides();
      expect(overrides.size).toBe(0);
    });
  });

  describe('getSessionOverrides', () => {
    it('should return empty map when no overrides set', () => {
      // Act
      const overrides = getSessionOverrides();

      // Assert
      expect(overrides.size).toBe(0);
    });

    it('should return copy of overrides map', () => {
      // Arrange
      setAwfBundleOverride('test-session', true);

      // Act
      const overrides1 = getSessionOverrides();
      const overrides2 = getSessionOverrides();

      // Assert
      expect(overrides1).not.toBe(overrides2); // Different objects
      expect(overrides1.get('test-session')).toBe(true);
      expect(overrides2.get('test-session')).toBe(true);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complex override scenarios', () => {
      // Arrange
      vi.mocked(configService.getAwfBundleEnabled).mockReturnValue(false);
      
      // Set up multiple overrides
      setAwfBundleOverride('session-1', true);
      setAwfBundleOverride('session-2', false);
      setAwfBundleOverride('session-3', true);

      // Act & Assert
      expect(isAwfBundleEnabled({ sessionId: 'session-1' })).toBe(true);
      expect(isAwfBundleEnabled({ sessionId: 'session-2' })).toBe(false);
      expect(isAwfBundleEnabled({ sessionId: 'session-3' })).toBe(true);
      expect(isAwfBundleEnabled({ sessionId: 'session-4' })).toBe(false); // Falls back to global
      expect(isAwfBundleEnabled({ sessionId: undefined })).toBe(false); // Falls back to global
    });

    it('should handle override changes during runtime', () => {
      // Arrange
      vi.mocked(configService.getAwfBundleEnabled).mockReturnValue(false);
      const sessionId = 'test-session';

      // Act & Assert - Initial state
      expect(isAwfBundleEnabled({ sessionId })).toBe(false);

      // Set override to true
      setAwfBundleOverride(sessionId, true);
      expect(isAwfBundleEnabled({ sessionId })).toBe(true);

      // Change override to false
      setAwfBundleOverride(sessionId, false);
      expect(isAwfBundleEnabled({ sessionId })).toBe(false);

      // Clear override
      clearAwfBundleOverride(sessionId);
      expect(isAwfBundleEnabled({ sessionId })).toBe(false); // Falls back to global
    });
  });
});
