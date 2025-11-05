/**
 * NPC Catalog Header Contract Tests
 * Phase A5: Verify HTTP caching headers are correctly set
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

describe('GET /api/catalog/npcs - Header Contract', () => {
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

  it('should include ETag (quoted) in response', async () => {
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

    let callCount = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'worlds') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ data: [] }),
        };
      }
      callCount++;
      if (callCount === 1) {
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

    const response = await request(app).get('/api/catalog/npcs?page=1&pageSize=24');

    expect(response.status).toBe(200);
    expect(response.headers.etag).toBeDefined();
    // ETag should be quoted (strong ETag)
    expect(response.headers.etag).toMatch(/^".+"$/);
  });

  it('should include Last-Modified in valid HTTP-date format', async () => {
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

    let callCount = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'worlds') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ data: [] }),
        };
      }
      callCount++;
      if (callCount === 1) {
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

    const response = await request(app).get('/api/catalog/npcs?page=1&pageSize=24');

    expect(response.status).toBe(200);
    expect(response.headers['last-modified']).toBeDefined();
    // Should be valid HTTP-date (RFC 7231)
    const lastModified = response.headers['last-modified'];
    expect(Date.parse(lastModified)).not.toBeNaN();
  });

  it('should include Cache-Control with stale-while-revalidate', async () => {
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

    let callCount = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'worlds') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ data: [] }),
        };
      }
      callCount++;
      if (callCount === 1) {
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

    const response = await request(app).get('/api/catalog/npcs?page=1&pageSize=24');

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBeDefined();
    expect(response.headers['cache-control']).toContain('stale-while-revalidate');
  });

  it('should include Vary header with Authorization', async () => {
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

    let callCount = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'worlds') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ data: [] }),
        };
      }
      callCount++;
      if (callCount === 1) {
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

    const response = await request(app).get('/api/catalog/npcs?page=1&pageSize=24');

    expect(response.status).toBe(200);
    expect(response.headers.vary).toBeDefined();
    expect(response.headers.vary).toContain('Authorization');
    expect(response.headers.vary).toContain('Accept-Encoding');
  });

  it('should return 304 with no body when If-None-Match matches', async () => {
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

    let requestNum = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'worlds') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ data: [] }),
        };
      }
      requestNum++;
      if (requestNum === 1) {
        // First request: version query
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
      if (requestNum === 2) {
        // First request: main query
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
      }
      // Second request: version query only (304 should short-circuit)
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: [{ updated_at: '2025-01-02T00:00:00Z', created_at: '2025-01-01T00:00:00Z' }],
          error: null,
        }),
      };
    });

    // First request
    const firstResponse = await request(app).get('/api/catalog/npcs?page=1&pageSize=24');
    expect(firstResponse.status).toBe(200);
    const etag = firstResponse.headers.etag;
    expect(etag).toBeDefined();

    // Reset for second request
    requestNum = 0;

    // Second request with If-None-Match
    const secondResponse = await request(app)
      .get('/api/catalog/npcs?page=1&pageSize=24')
      .set('If-None-Match', etag!);

    expect(secondResponse.status).toBe(304);
    expect(secondResponse.body).toEqual({});
    expect(secondResponse.headers['content-type']).toBeUndefined();
    // ETag should still be present in 304
    expect(secondResponse.headers.etag).toBe(etag);
  });
});

describe('GET /api/catalog/npcs/:idOrSlug - Header Contract', () => {
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

  it('should include ETag (quoted) and Last-Modified in detail response', async () => {
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

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'worlds') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ data: [] }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockNpc,
          error: null,
        }),
      };
    });

    const response = await request(app).get('/api/catalog/npcs/npc-123');

    expect(response.status).toBe(200);
    expect(response.headers.etag).toBeDefined();
    expect(response.headers.etag).toMatch(/^".+"$/);
    expect(response.headers['last-modified']).toBeDefined();
    expect(response.headers['cache-control']).toContain('stale-while-revalidate');
    expect(response.headers.vary).toContain('Authorization');
  });

  it('should return 304 with If-Modified-Since matching Last-Modified', async () => {
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
          data: callCount === 1 ? mockNpc : null,
          error: null,
        }),
      };
    });

    // First request
    const firstResponse = await request(app).get('/api/catalog/npcs/npc-123');
    expect(firstResponse.status).toBe(200);
    const lastModified = firstResponse.headers['last-modified'];
    expect(lastModified).toBeDefined();

    // Second request with If-Modified-Since
    const secondResponse = await request(app)
      .get('/api/catalog/npcs/npc-123')
      .set('If-Modified-Since', lastModified!);

    expect(secondResponse.status).toBe(304);
    expect(secondResponse.body).toEqual({});
  });
});

