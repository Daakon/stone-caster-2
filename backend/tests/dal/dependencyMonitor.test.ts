/**
 * Dependency Monitor DAL Tests
 * Phase 4: Tests for dependency monitoring functions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  markDependenciesForWorld,
  recomputeDependenciesForWorld,
  recomputeDependenciesForAllWorlds,
} from '../../src/dal/dependencyMonitor.js';
import type { createSupabaseAdminMock } from '../../src/test-utils/supabase-mock.js';

const mockSupabaseAdmin = (globalThis as any).mockSupabaseAdmin as ReturnType<
  typeof createSupabaseAdminMock
>['mockSupabaseAdmin'];

const createDependencyTable = (rows: Array<{ id: string; dependency_invalid: boolean }>) => {
  const chain: any = {};
  chain.eq = vi.fn(() => chain);
  chain.neq = vi.fn(() => chain);
  chain.range = vi.fn().mockResolvedValue({ data: rows, error: null });

  return {
    select: vi.fn(() => chain),
    update: vi.fn(() => ({
      in: vi.fn().mockResolvedValue({ error: null }),
    })),
  };
};

const createAuditTable = () => ({
  insert: vi.fn().mockResolvedValue({ error: null }),
});

const createWorldsTable = (options: {
  list?: Array<{ id: string; visibility: string; review_state: string }>;
  singles?: Record<string, { data: any; error: any }>;
}) => {
  const select = vi.fn(() => ({
    range: vi.fn().mockResolvedValue({
      data: options.list ?? [],
      error: null,
    }),
    eq: vi.fn((_: string, worldId: string) => ({
      single: vi.fn().mockResolvedValue(
        options.singles?.[worldId] ?? { data: null, error: { message: 'Not found' } }
      ),
    })),
    single: vi.fn().mockResolvedValue({
      data: options.list?.[0] ?? null,
      error: null,
    }),
  }));

  return { select };
};

const noopTable = {
  select: vi.fn(() => ({
    eq: vi.fn(() => ({
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    range: vi.fn().mockResolvedValue({ data: [], error: null }),
  })),
  update: vi.fn(() => ({
    in: vi.fn().mockResolvedValue({ error: null }),
  })),
  insert: vi.fn().mockResolvedValue({ error: null }),
};

describe('markDependenciesForWorld', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseAdmin.from.mockReset();
  });

  it('should update stories and NPCs when dependency_invalid differs', async () => {
    const storiesTable = createDependencyTable([
      { id: 'story-1', dependency_invalid: false },
      { id: 'story-2', dependency_invalid: false },
    ]);
    const npcsTable = createDependencyTable([{ id: 'npc-1', dependency_invalid: false }]);
    const auditTable = createAuditTable();

    mockSupabaseAdmin.from.mockImplementation((table: string) => {
      switch (table) {
        case 'entry_points':
          return storiesTable;
        case 'npcs':
          return npcsTable;
        case 'publishing_audit':
          return auditTable;
        default:
          return noopTable;
      }
    });

    const result = await markDependenciesForWorld({
      worldId: 'test-world-id',
      dependencyInvalid: true,
    });

    expect(result.storiesUpdated).toBe(2);
    expect(result.npcsUpdated).toBe(1);
  });

  it('should return zero updates when no rows need updating', async () => {
    const storiesTable = createDependencyTable([]);
    const npcsTable = createDependencyTable([]);

    mockSupabaseAdmin.from.mockImplementation((table: string) => {
      switch (table) {
        case 'entry_points':
          return storiesTable;
        case 'npcs':
          return npcsTable;
        default:
          return noopTable;
      }
    });

    const result = await markDependenciesForWorld({
      worldId: 'test-world-id',
      dependencyInvalid: true,
    });

    expect(result.storiesUpdated).toBe(0);
    expect(result.npcsUpdated).toBe(0);
  });
});

describe('recomputeDependenciesForWorld', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseAdmin.from.mockReset();
  });

  it('should set dependency_invalid=true when world is not public+approved', async () => {
    const worldId = 'world-private';
    const worldsTable = createWorldsTable({
      singles: {
        [worldId]: {
          data: { id: worldId, visibility: 'private', review_state: 'draft' },
          error: null,
        },
      },
    });
    const storiesTable = createDependencyTable([{ id: 'story-1', dependency_invalid: false }]);
    const npcsTable = createDependencyTable([]);

    mockSupabaseAdmin.from.mockImplementation((table: string) => {
      switch (table) {
        case 'worlds':
          return worldsTable;
        case 'entry_points':
          return storiesTable;
        case 'npcs':
          return npcsTable;
        case 'publishing_audit':
          return createAuditTable();
        default:
          return noopTable;
      }
    });

    const result = await recomputeDependenciesForWorld({ worldId });
    expect(result.storiesUpdated).toBe(1);
    expect(result.npcsUpdated).toBe(0);
  });

  it('should set dependency_invalid=false when world is public+approved', async () => {
    const worldId = 'world-public';
    const worldsTable = createWorldsTable({
      singles: {
        [worldId]: {
          data: { id: worldId, visibility: 'public', review_state: 'approved' },
          error: null,
        },
      },
    });
    const storiesTable = createDependencyTable([{ id: 'story-1', dependency_invalid: true }]);
    const npcsTable = createDependencyTable([{ id: 'npc-1', dependency_invalid: true }]);
    const auditTable = createAuditTable();

    mockSupabaseAdmin.from.mockImplementation((table: string) => {
      switch (table) {
        case 'worlds':
          return worldsTable;
        case 'entry_points':
          return storiesTable;
        case 'npcs':
          return npcsTable;
        case 'publishing_audit':
          return auditTable;
        default:
          return noopTable;
      }
    });

    const result = await recomputeDependenciesForWorld({ worldId });
    expect(result.storiesUpdated).toBe(1);
    expect(result.npcsUpdated).toBe(1);
  });

  it('should throw error when world not found', async () => {
    const worldId = 'missing-world';
    const worldsTable = createWorldsTable({
      singles: {
        [worldId]: {
          data: null,
          error: { message: 'Not found' },
        },
      },
    });

    mockSupabaseAdmin.from.mockImplementation((table: string) => {
      if (table === 'worlds') {
        return worldsTable;
      }
      return noopTable;
    });

    await expect(recomputeDependenciesForWorld({ worldId })).rejects.toMatchObject({
      code: 'WORLD_NOT_FOUND',
    });
  });
});

describe('recomputeDependenciesForAllWorlds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseAdmin.from.mockReset();
  });

  it('should process all worlds and return aggregate counts', async () => {
    const worlds = [
      { id: 'world-1', visibility: 'public', review_state: 'approved' },
      { id: 'world-2', visibility: 'private', review_state: 'draft' },
    ];
    const worldsTable = createWorldsTable({
      list: worlds,
      singles: {
        'world-1': { data: worlds[0], error: null },
        'world-2': { data: worlds[1], error: null },
      },
    });
    const storiesTable = createDependencyTable([]);
    const npcsTable = createDependencyTable([]);

    mockSupabaseAdmin.from.mockImplementation((table: string) => {
      switch (table) {
        case 'worlds':
          return worldsTable;
        case 'entry_points':
          return storiesTable;
        case 'npcs':
          return npcsTable;
        case 'publishing_audit':
          return createAuditTable();
        default:
          return noopTable;
      }
    });

    const result = await recomputeDependenciesForAllWorlds({
      concurrency: 2,
      batch: 1000,
    });

    expect(result.worldsProcessed).toBe(2);
    expect(result.storiesUpdated).toBe(0);
    expect(result.npcsUpdated).toBe(0);
  });
});


