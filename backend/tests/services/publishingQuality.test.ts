/**
 * Publishing Quality Service Tests
 * Phase 6: Tests for quality evaluation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { evaluateEntity } from '../../src/services/publishingQuality.js';
import { supabaseAdmin } from '../../src/services/supabase.js';

// Mock Supabase
vi.mock('../../src/services/supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

describe('evaluateEntity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return score 0 and issues when entity not found', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
        }),
      }),
    });

    (supabaseAdmin.from as any).mockReturnValue(mockFrom());

    const result = await evaluateEntity({ type: 'world', id: 'test-id' });

    expect(result.score).toBe(0);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].code).toBe('ENTITY_NOT_FOUND');
  });

  it('should deduct points for missing name', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'test-id', name: '', description: 'Test description', owner_user_id: 'user-1' },
            error: null,
          }),
        }),
      }),
    });

    (supabaseAdmin.from as any).mockReturnValue(mockFrom());

    const result = await evaluateEntity({ type: 'world', id: 'test-id' });

    expect(result.score).toBeLessThan(100);
    expect(result.issues.some((i) => i.code === 'MISSING_NAME')).toBe(true);
  });

  it('should deduct points for missing description', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'test-id', name: 'Test Name', description: '', owner_user_id: 'user-1' },
            error: null,
          }),
        }),
      }),
    });

    (supabaseAdmin.from as any).mockReturnValue(mockFrom());

    const result = await evaluateEntity({ type: 'world', id: 'test-id' });

    expect(result.score).toBeLessThan(100);
    expect(result.issues.some((i) => i.code === 'MISSING_DESCRIPTION')).toBe(true);
  });

  it('should check parent world for story/npc', async () => {
    // Mock story fetch
    const mockStoryFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'story-id',
              title: 'Test Story',
              description: 'Test description',
              world_id: 'world-id',
              dependency_invalid: false,
              owner_user_id: 'user-1',
            },
            error: null,
          }),
        }),
      }),
    });

    // Mock world fetch
    const mockWorldFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'world-id',
              name: 'Test World',
              visibility: 'private',
              review_state: 'draft',
            },
            error: null,
          }),
        }),
      }),
    });

    (supabaseAdmin.from as any)
      .mockReturnValueOnce(mockStoryFrom()) // First call for story
      .mockReturnValueOnce(mockWorldFrom()); // Second call for world

    const result = await evaluateEntity({ type: 'story', id: 'story-id' });

    expect(result.issues.some((i) => i.code === 'PARENT_WORLD_NOT_PUBLIC')).toBe(true);
    expect(result.issues.some((i) => i.code === 'PARENT_WORLD_NOT_APPROVED')).toBe(true);
  });

  it('should check dependency_invalid flag', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'story-id',
              title: 'Test Story',
              description: 'Test description',
              world_id: 'world-id',
              dependency_invalid: true,
              owner_user_id: 'user-1',
            },
            error: null,
          }),
        }),
      }),
    });

    // Mock world fetch (public and approved)
    const mockWorldFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'world-id',
              name: 'Test World',
              visibility: 'public',
              review_state: 'approved',
            },
            error: null,
          }),
        }),
      }),
    });

    (supabaseAdmin.from as any)
      .mockReturnValueOnce(mockFrom()) // Story
      .mockReturnValueOnce(mockWorldFrom()); // World

    const result = await evaluateEntity({ type: 'story', id: 'story-id' });

    expect(result.issues.some((i) => i.code === 'DEPENDENCY_INVALID')).toBe(true);
  });
});

