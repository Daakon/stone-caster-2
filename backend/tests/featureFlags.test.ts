/**
 * Feature Flags Tests
 * Tests for isEarlyAccessOn() helper
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isEarlyAccessOn } from '../src/config/featureFlags.js';

describe('Feature Flags', () => {
  const originalEnv = process.env.EARLY_ACCESS_MODE;

  afterEach(() => {
    // Restore original env
    if (originalEnv) {
      process.env.EARLY_ACCESS_MODE = originalEnv;
    } else {
      delete process.env.EARLY_ACCESS_MODE;
    }
  });

  it('should default to "on" when EARLY_ACCESS_MODE is not set', () => {
    delete process.env.EARLY_ACCESS_MODE;
    expect(isEarlyAccessOn()).toBe(true);
  });

  it('should return true when EARLY_ACCESS_MODE is "on"', () => {
    process.env.EARLY_ACCESS_MODE = 'on';
    expect(isEarlyAccessOn()).toBe(true);
  });

  it('should return false when EARLY_ACCESS_MODE is "off"', () => {
    process.env.EARLY_ACCESS_MODE = 'off';
    expect(isEarlyAccessOn()).toBe(false);
  });

  it('should handle case-insensitive values', () => {
    process.env.EARLY_ACCESS_MODE = 'ON';
    expect(isEarlyAccessOn()).toBe(true);

    process.env.EARLY_ACCESS_MODE = 'OFF';
    expect(isEarlyAccessOn()).toBe(false);
  });

  it('should handle whitespace', () => {
    process.env.EARLY_ACCESS_MODE = ' on ';
    expect(isEarlyAccessOn()).toBe(true);

    process.env.EARLY_ACCESS_MODE = ' off ';
    expect(isEarlyAccessOn()).toBe(false);
  });

  it('should default to "on" and warn on invalid value', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    process.env.EARLY_ACCESS_MODE = 'invalid';
    expect(isEarlyAccessOn()).toBe(true);
    expect(consoleSpy).toHaveBeenCalled();
    
    consoleSpy.mockRestore();
  });
});

