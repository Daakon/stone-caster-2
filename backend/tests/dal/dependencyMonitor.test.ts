/**
 * Dependency Monitor DAL Tests
 * Phase 4: Tests for dependency monitoring functions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  markDependenciesForWorld,
  recomputeDependenciesForWorld,
  recomputeDependenciesForAllWorlds,
} from '../../src/dal/dependencyMonitor.js';
import { supabaseAdmin } from '../../src/services/supabase.js';

// Mock Supabase
vi.mock('../../src/services/supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

describe('markDependenciesForWorld', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update stories and NPCs when dependency_invalid differs', async () => {
    const worldId = 'test-world-id';
    const dependencyInvalid = true;

    // Mock stories query
    const storiesMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: [
          { id: 'story-1', dependency_invalid: false },
          { id: 'story-2', dependency_invalid: false },
        ],
        error: null,
      }),
    };

    // Mock NPCs query
    const npcsMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: [
          { id: 'npc-1', dependency_invalid: false },
        ],
        error: null,
      }),
    };

    // Mock update operations
    const updateMock = {
      update: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ error: null }),
    };

    // Mock audit insert
    const auditMock = {
      insert: vi.fn().mockResolvedValue({ error: null }),
    };

    (supabaseAdmin.from as any)
      .mockReturnValueOnce(storiesMock)
      .mockReturnValueOnce(updateMock)
      .mockReturnValueOnce(auditMock)
      .mockReturnValueOnce(auditMock)
      .mockReturnValueOnce(npcsMock)
      .mockReturnValueOnce(updateMock)
      .mockReturnValueOnce(auditMock);

    const result = await markDependenciesForWorld({
      worldId,
      dependencyInvalid,
    });

    expect(result.storiesUpdated).toBe(2);
    expect(result.npcsUpdated).toBe(1);
  });

  it('should return zero updates when no rows need updating', async () => {
    const worldId = 'test-world-id';
    const dependencyInvalid = true;

    // Mock empty results
    const storiesMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    };

    const npcsMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    };

    (supabaseAdmin.from as any)
      .mockReturnValueOnce(storiesMock)
      .mockReturnValueOnce(npcsMock);

    const result = await markDependenciesForWorld({
      worldId,
      dependencyInvalid,
    });

    expect(result.storiesUpdated).toBe(0);
    expect(result.npcsUpdated).toBe(0);
  });
});

describe('recomputeDependenciesForWorld', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should set dependency_invalid=true when world is not public+approved', async () => {
    const worldId = 'test-world-id';

    // Mock world query (not public)
    const worldMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: worldId,
          visibility: 'private',
          review_state: 'draft',
        },
        error: null,
      }),
    };

    // Mock markDependenciesForWorld (will be called with dependencyInvalid=true)
    const storiesMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: [{ id: 'story-1', dependency_invalid: false }],
        error: null,
      }),
    };

    const updateMock = {
      update: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ error: null }),
    };

    const auditMock = {
      insert: vi.fn().mockResolvedValue({ error: null }),
    };

    const npcsMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    };

    (supabaseAdmin.from as any)
      .mockReturnValueOnce(worldMock)
      .mockReturnValueOnce(storiesMock)
      .mockReturnValueOnce(updateMock)
      .mockReturnValueOnce(auditMock)
      .mockReturnValueOnce(npcsMock);

    const result = await recomputeDependenciesForWorld({ worldId });

    expect(result.storiesUpdated).toBe(1);
    expect(result.npcsUpdated).toBe(0);
  });

  it('should set dependency_invalid=false when world is public+approved', async () => {
    const worldId = 'test-world-id';

    // Mock world query (public and approved)
    const worldMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: worldId,
          visibility: 'public',
          review_state: 'approved',
        },
        error: null,
      }),
    };

    // Mock markDependenciesForWorld (will be called with dependencyInvalid=false)
    const storiesMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: [{ id: 'story-1', dependency_invalid: true }],
        error: null,
      }),
    };

    const updateMock = {
      update: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ error: null }),
    };

    const auditMock = {
      insert: vi.fn().mockResolvedValue({ error: null }),
    };

    const npcsMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    };

    (supabaseAdmin.from as any)
      .mockReturnValueOnce(worldMock)
      .mockReturnValueOnce(storiesMock)
      .mockReturnValueOnce(updateMock)
      .mockReturnValueOnce(auditMock)
      .mockReturnValueOnce(npcsMock);

    const result = await recomputeDependenciesForWorld({ worldId });

    expect(result.storiesUpdated).toBe(1);
    expect(result.npcsUpdated).toBe(0);
  });

  it('should throw error when world not found', async () => {
    const worldId = 'non-existent-world';

    // Mock world query (not found)
    const worldMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      }),
    };

    (supabaseAdmin.from as any).mockReturnValueOnce(worldMock);

    await expect(recomputeDependenciesForWorld({ worldId })).rejects.toMatchObject({
      code: 'WORLD_NOT_FOUND',
    });
  });
});

describe('recomputeDependenciesForAllWorlds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should process all worlds and return aggregate counts', async () => {
    // Mock worlds query
    const worldsMock = {
      select: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: [
          { id: 'world-1', visibility: 'public', review_state: 'approved' },
          { id: 'world-2', visibility: 'private', review_state: 'draft' },
        ],
        error: null,
      }),
    };

    // Mock world queries for recompute
    const world1Mock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'world-1', visibility: 'public', review_state: 'approved' },
        error: null,
      }),
    };

    const world2Mock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'world-2', visibility: 'private', review_state: 'draft' },
        error: null,
      }),
    };

    // Mock stories/NPCs queries (empty for simplicity)
    const emptyStoriesMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    };

    const emptyNpcsMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    };

    (supabaseAdmin.from as any)
      .mockReturnValueOnce(worldsMock)
      .mockReturnValueOnce(world1Mock)
      .mockReturnValueOnce(emptyStoriesMock)
      .mockReturnValueOnce(emptyNpcsMock)
      .mockReturnValueOnce(world2Mock)
      .mockReturnValueOnce(emptyStoriesMock)
      .mockReturnValueOnce(emptyNpcsMock);

    const result = await recomputeDependenciesForAllWorlds({
      concurrency: 2,
      batch: 1000,
    });

    expect(result.worldsProcessed).toBe(2);
    expect(result.storiesUpdated).toBe(0);
    expect(result.npcsUpdated).toBe(0);
  });
});

