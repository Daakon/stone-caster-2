/**
 * NPC Catalog Cache Tests
 * Phase A4: HTTP caching (ETag, Last-Modified, Cache-Control)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import catalogNpcsRouter from '../src/routes/catalogNpcs.js';
import { getSupabaseClient } from '../src/lib/supabaseClient.js';

// Mock dependencies
vi.mock('../src/lib/supabaseClient.js', () => ({
  getSupabaseClient: vi.fn(),
}));

describe('GET /api/catalog/npcs - Caching', () => {
  let app: express.Application;
  let mockSupabase: any;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/catalog', catalogNpcsRouter);

    // Setup mock Supabase client
    mockSupabase = {
      from: vi.fn(),
    };

    vi.mocked(getSupabaseClient).mockReturnValue(mockSupabase as any);
  });

  it('should return 200 with ETag, Last-Modified, and Cache-Control on first request', async () => {
    const mockNpcs = [
      {
        id: 'npc-1',
        name: 'Test NPC 1',
        status: 'active',
        world_id: 'world-1',
        portrait_url: null,
        doc: { visibility: 'public', short_desc: 'Test NPC' },
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-02T00:00:00Z',
      },
    ];

    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockOrder = vi.fn().mockReturnThis();
    const mockRange = vi.fn().mockResolvedValue({
      data: mockNpcs,
      error: null,
      count: 1,
    });

    // Mock version query (for max updated_at)
    const mockVersionSelect = vi.fn().mockReturnThis();
    const mockVersionEq = vi.fn().mockReturnThis();
    const mockVersionResolve = vi.fn().mockResolvedValue({
      data: [{ updated_at: '2025-01-02T00:00:00Z', created_at: '2025-01-01T00:00:00Z' }],
      error: null,
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'worlds') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [{ id: 'world-1', slug: 'mystika', name: 'Mystika' }],
          }),
        };
      }
      return {
        select: mockSelect,
      };
    });

    mockSelect.mockReturnValue({
      eq: mockEq,
    });
    mockEq.mockReturnValue({
      order: mockOrder,
      eq: mockEq, // Chainable
    });
    mockOrder.mockReturnValue({
      range: mockRange,
    });

    // First call is for version query
    mockVersionSelect.mockReturnValue({
      eq: mockVersionEq,
    });
    mockVersionEq.mockReturnValue({
      eq: mockVersionEq, // Chainable
      ilike: mockVersionEq, // Chainable
      textSearch: mockVersionEq, // Chainable
    });

    // Setup version query to be called first
    let callCount = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      if (callCount === 0 && table === 'npcs') {
        callCount++;
        return {
          select: mockVersionSelect,
        };
      }
      if (table === 'worlds') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [{ id: 'world-1', slug: 'mystika', name: 'Mystika' }],
          }),
        };
      }
      return {
        select: mockSelect,
      };
    });

    // Fix: Return the version query result
    mockVersionEq.mockResolvedValue({
      data: [{ updated_at: '2025-01-02T00:00:00Z', created_at: '2025-01-01T00:00:00Z' }],
      error: null,
    });

    const response = await request(app).get('/api/catalog/npcs?page=1&pageSize=24');

    expect(response.status).toBe(200);
    expect(response.headers.etag).toBeDefined();
    expect(response.headers['last-modified']).toBeDefined();
    expect(response.headers['cache-control']).toContain('public, max-age=60');
    expect(response.headers['cache-control']).toContain('stale-while-revalidate=300');
    expect(response.headers['cache-control']).toContain('stale-if-error=600');
    expect(response.headers.vary).toContain('Authorization');
    expect(response.headers.vary).toContain('Accept-Encoding');
  });

  it('should return 304 when If-None-Match matches ETag', async () => {
    // Mock first request
    const mockNpcs = [
      {
        id: 'npc-1',
        name: 'Test NPC',
        status: 'active',
        world_id: null,
        portrait_url: null,
        doc: { visibility: 'public' },
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-02T00:00:00Z',
      },
    ];

    let requestCount = 0;
    mockSupabase.from.mockImplementation(() => {
      requestCount++;
      if (requestCount === 1) {
        // Version query
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          range: vi.fn().mockResolvedValue({
            data: [{ updated_at: '2025-01-02T00:00:00Z', created_at: '2025-01-01T00:00:00Z' }],
            error: null,
          }),
        };
      }
      // Main query
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: mockNpcs,
          error: null,
          count: 1,
        }),
      };
    });

    // First request
    const firstResponse = await request(app).get('/api/catalog/npcs?page=1&pageSize=24');
    expect(firstResponse.status).toBe(200);
    const etag = firstResponse.headers.etag;
    expect(etag).toBeDefined();

    // Reset mock for second request
    requestCount = 0;
    mockSupabase.from.mockImplementation(() => {
      requestCount++;
      if (requestCount === 1) {
        // Version query
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          range: vi.fn().mockResolvedValue({
            data: [{ updated_at: '2025-01-02T00:00:00Z', created_at: '2025-01-01T00:00:00Z' }],
            error: null,
          }),
        };
      }
      // Main query should not be called on 304
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: mockNpcs,
          error: null,
          count: 1,
        }),
      };
    });

    // Second request with If-None-Match
    const secondResponse = await request(app)
      .get('/api/catalog/npcs?page=1&pageSize=24')
      .set('If-None-Match', etag!);

    expect(secondResponse.status).toBe(304);
    expect(secondResponse.body).toEqual({});
  });

  it('should produce different ETags for anon vs auth for same query', async () => {
    const mockNpcs = [
      {
        id: 'npc-1',
        name: 'Test NPC',
        status: 'active',
        world_id: null,
        portrait_url: null,
        doc: { visibility: 'public' },
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-02T00:00:00Z',
      },
    ];

    let callNum = 0;
    mockSupabase.from.mockImplementation(() => {
      callNum++;
      if (callNum % 2 === 1) {
        // Version query (odd calls)
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          range: vi.fn().mockResolvedValue({
            data: [{ updated_at: '2025-01-02T00:00:00Z', created_at: '2025-01-01T00:00:00Z' }],
            error: null,
          }),
        };
      }
      // Main query (even calls)
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: mockNpcs,
          error: null,
          count: 1,
        }),
      };
    });

    // Anon request
    const anonResponse = await request(app).get('/api/catalog/npcs?page=1&pageSize=24');
    expect(anonResponse.status).toBe(200);
    const anonETag = anonResponse.headers.etag;

    // Reset for auth request
    callNum = 0;

    // Auth request
    const authResponse = await request(app)
      .get('/api/catalog/npcs?page=1&pageSize=24')
      .set('Authorization', 'Bearer fake-token');
    expect(authResponse.status).toBe(200);
    const authETag = authResponse.headers.etag;

    // ETags should differ due to audience in signature
    expect(anonETag).toBeDefined();
    expect(authETag).toBeDefined();
    expect(anonETag).not.toBe(authETag);
  });
});

describe('GET /api/catalog/npcs/:idOrSlug - Caching', () => {
  let app: express.Application;
  let mockSupabase: any;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/catalog', catalogNpcsRouter);

    mockSupabase = {
      from: vi.fn(),
    };

    vi.mocked(getSupabaseClient).mockReturnValue(mockSupabase as any);
  });

  it('should return ETag and Last-Modified on detail request', async () => {
    const mockNpc = {
      id: 'npc-123',
      name: 'Test NPC',
      status: 'active',
      world_id: null,
      portrait_url: null,
      doc: { visibility: 'public' },
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-02T00:00:00Z',
      slug: null,
    };

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: mockNpc,
        error: null,
      }),
    });

    const response = await request(app).get('/api/catalog/npcs/npc-123');

    expect(response.status).toBe(200);
    expect(response.headers.etag).toBeDefined();
    expect(response.headers['last-modified']).toBeDefined();
    expect(response.headers['cache-control']).toContain('public, max-age=60');
    expect(response.headers.vary).toContain('Authorization');
  });

  it('should return 304 when If-Modified-Since matches Last-Modified', async () => {
    const mockNpc = {
      id: 'npc-123',
      name: 'Test NPC',
      status: 'active',
      world_id: null,
      portrait_url: null,
      doc: { visibility: 'public' },
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-02T00:00:00Z',
      slug: null,
    };

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: mockNpc,
        error: null,
      }),
    });

    // First request to get Last-Modified
    const firstResponse = await request(app).get('/api/catalog/npcs/npc-123');
    expect(firstResponse.status).toBe(200);
    const lastModified = firstResponse.headers['last-modified'];

    // Second request with If-Modified-Since
    const secondResponse = await request(app)
      .get('/api/catalog/npcs/npc-123')
      .set('If-Modified-Since', lastModified!);

    expect(secondResponse.status).toBe(304);
    expect(secondResponse.body).toEqual({});
  });

  it('should update ETag when NPC updated_at changes', async () => {
    const mockNpc1 = {
      id: 'npc-123',
      name: 'Test NPC',
      status: 'active',
      world_id: null,
      portrait_url: null,
      doc: { visibility: 'public' },
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-02T00:00:00Z',
      slug: null,
    };

    const mockNpc2 = {
      ...mockNpc1,
      updated_at: '2025-01-03T00:00:00Z', // Changed
    };

    let callCount = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'worlds') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ data: [] }),
        };
      }
      callCount++;
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: callCount === 1 ? mockNpc1 : mockNpc2,
          error: null,
        }),
      };
    });

    // First request
    const firstResponse = await request(app).get('/api/catalog/npcs/npc-123');
    expect(firstResponse.status).toBe(200);
    const firstETag = firstResponse.headers.etag;

    // Second request (simulating updated NPC)
    const secondResponse = await request(app).get('/api/catalog/npcs/npc-123');
    expect(secondResponse.status).toBe(200);
    const secondETag = secondResponse.headers.etag;

    // ETags should differ due to different updated_at
    expect(firstETag).not.toBe(secondETag);
  });
});


