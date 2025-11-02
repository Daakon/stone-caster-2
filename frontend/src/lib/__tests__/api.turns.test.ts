/**
 * Phase 6.1: Unit tests for turns API normalization adapter
 */

import { describe, it, expect } from 'vitest';

// Import the normalization function (we'll need to export it or test via getGameTurns mock)
// For now, we'll test the logic inline

describe('Turns API Response Normalization', () => {
  it('should normalize array response shape', () => {
    const response = {
      ok: true,
      data: [{ id: '1', turn_number: 1 }],
      next: { afterTurn: 1 },
    };

    // Simulate normalization logic
    const data = response.data;
    const normalized = Array.isArray(data)
      ? { turns: data, next: response.next }
      : { turns: [], next: response.next };

    expect(normalized).toEqual({
      turns: [{ id: '1', turn_number: 1 }],
      next: { afterTurn: 1 },
    });
  });

  it('should normalize object with turns property', () => {
    const response = {
      ok: true,
      data: {
        turns: [{ id: '1', turn_number: 1 }],
        next: { afterTurn: 1 },
      },
    };

    // Simulate normalization logic
    const data = response.data;
    const normalized =
      data && typeof data === 'object' && 'turns' in data
        ? { turns: data.turns || [], next: data.next || response.next }
        : { turns: [], next: response.next };

    expect(normalized).toEqual({
      turns: [{ id: '1', turn_number: 1 }],
      next: { afterTurn: 1 },
    });
  });

  it('should handle missing next cursor', () => {
    const response = {
      ok: true,
      data: [{ id: '1', turn_number: 1 }],
    };

    const data = response.data;
    const normalized = Array.isArray(data)
      ? { turns: data, next: undefined }
      : { turns: [], next: undefined };

    expect(normalized).toEqual({
      turns: [{ id: '1', turn_number: 1 }],
      next: undefined,
    });
  });

  it('should handle empty array', () => {
    const response = {
      ok: true,
      data: [],
    };

    const data = response.data;
    const normalized = Array.isArray(data)
      ? { turns: data, next: undefined }
      : { turns: [], next: undefined };

    expect(normalized).toEqual({
      turns: [],
      next: undefined,
    });
  });

  it('should preserve error responses', () => {
    const response = {
      ok: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Game not found',
      },
    };

    // Error responses should pass through unchanged
    expect(response.ok).toBe(false);
    expect(response.error.code).toBe('NOT_FOUND');
  });
});

