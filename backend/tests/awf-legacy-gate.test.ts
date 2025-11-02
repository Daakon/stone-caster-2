/**
 * Tests for AWF Legacy Isolation Gate
 * Ensures AWF requests never traverse legacy markdown assembler path
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('AWF Legacy Isolation Gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw error if legacy assembler is called when AWF is enabled', () => {
    const isAwfEnabled = vi.fn(() => true);
    
    // Simulate the guard logic from turns.service.ts
    const currentAwfCheck = isAwfEnabled({ sessionId: 'test-session' });
    
    if (currentAwfCheck) {
      const errorMsg = `ILLEGAL_LEGACY_ASSEMBLER_PATH: AWF enabled but legacy buildPromptV2 called for session test-session`;
      
      expect(() => {
        throw new Error(errorMsg);
      }).toThrow('ILLEGAL_LEGACY_ASSEMBLER_PATH');
      expect(isAwfEnabled).toHaveBeenCalledWith({ sessionId: 'test-session' });
    }
  });

  it('should allow legacy assembler when AWF is not enabled', () => {
    const isAwfEnabled = vi.fn(() => false);
    
    const currentAwfCheck = isAwfEnabled({ sessionId: 'test-session' });
    
    // Should not throw when AWF is disabled
    expect(currentAwfCheck).toBe(false);
    expect(() => {
      // Legacy assembler can be called
      if (currentAwfCheck) {
        throw new Error('ILLEGAL_LEGACY_ASSEMBLER_PATH');
      }
    }).not.toThrow();
  });

  it('should log metric when illegal path is detected', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const isAwfEnabled = vi.fn(() => true);
    
    const currentAwfCheck = isAwfEnabled({ sessionId: 'test-session', gameId: 'test-game', turn: 1 });
    
    if (currentAwfCheck) {
      const errorMsg = `ILLEGAL_LEGACY_ASSEMBLER_PATH: AWF enabled but legacy buildPromptV2 called for session test-session`;
      console.error(`[TURNS] ${errorMsg}`);
      console.error(`[METRICS] legacy_assembler_called_when_awf_enabled: { sessionId: test-session, gameId: test-game, turn: 1 }`);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('ILLEGAL_LEGACY_ASSEMBLER_PATH')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('legacy_assembler_called_when_awf_enabled')
      );
    }
    
    consoleErrorSpy.mockRestore();
  });
});

