/**
 * NPC Catalog Route Tests
 * Phase A2: Integration tests for /api/catalog/npcs
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import catalogNpcsRouter from '../src/routes/catalogNpcs.js';
import { getSupabaseClient } from '../src/lib/supabaseClient.js';
import { resolveWorldId } from '../src/services/worldResolver.js';

// Mock dependencies
vi.mock('../src/lib/supabaseClient.js', () => ({
  getSupabaseClient: vi.fn(),
}));

vi.mock('../src/services/worldResolver.js', () => ({
  resolveWorldId: vi.fn(),
}));

describe('GET /api/catalog/npcs', () => {
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
    vi.mocked(resolveWorldId).mockResolvedValue(null);
  });

  it('should return 200 with data array', async () => {
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockTextSearch = vi.fn().mockReturnThis();
    const mockOrder = vi.fn().mockReturnThis();
    const mockRange = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'npc-1',
          name: 'Test NPC',
          status: 'active',
          world_id: 'world-1',
          portrait_url: 'https://example.com/portrait.png',
          doc: { short_desc: 'A test NPC', tags: ['test'] },
          created_at: '2025-01-01T00:00:00Z',
        },
      ],
      count: 1,
      error: null,
    });

    mockSupabase.from.mockReturnValue({
      select: mockSelect,
    });
    mockSelect.mockReturnValue({
      eq: mockEq,
    });
    mockEq.mockReturnValue({
      textSearch: mockTextSearch,
      order: mockOrder,
    });
    mockTextSearch.mockReturnValue({
      order: mockOrder,
    });
    mockOrder.mockReturnValue({
      range: mockRange,
    });

    const response = await request(app).get('/api/catalog/npcs?page=1&pageSize=12');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      meta: {
        page: 1,
        pageSize: 12,
        total: 1,
        hasMore: false,
        sort: 'created_at',
        order: 'desc',
      },
      data: expect.any(Array),
    });
  });

  it('should respect page and pageSize', async () => {
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockOrder = vi.fn().mockReturnThis();
    const mockRange = vi.fn().mockResolvedValue({
      data: [],
      count: 50,
      error: null,
    });

    mockSupabase.from.mockReturnValue({
      select: mockSelect,
    });
    mockSelect.mockReturnValue({
      eq: mockEq,
    });
    mockEq.mockReturnValue({
      order: mockOrder,
    });
    mockOrder.mockReturnValue({
      range: mockRange,
    });

    const response = await request(app).get('/api/catalog/npcs?page=2&pageSize=24');

    expect(response.status).toBe(200);
    expect(response.body.meta.page).toBe(2);
    expect(response.body.meta.pageSize).toBe(24);
    expect(mockRange).toHaveBeenCalledWith(24, 47); // from = (2-1)*24 = 24, to = 24+24-1 = 47
  });

  it('should filter by q parameter', async () => {
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockTextSearch = vi.fn().mockReturnThis();
    const mockOrder = vi.fn().mockReturnThis();
    const mockRange = vi.fn().mockResolvedValue({
      data: [],
      count: 0,
      error: null,
    });

    mockSupabase.from.mockReturnValue({
      select: mockSelect,
    });
    mockSelect.mockReturnValue({
      eq: mockEq,
    });
    mockEq.mockReturnValue({
      textSearch: mockTextSearch,
      order: mockOrder,
    });
    mockTextSearch.mockReturnValue({
      order: mockOrder,
    });
    mockOrder.mockReturnValue({
      range: mockRange,
    });

    await request(app).get('/api/catalog/npcs?q=ranger');

    expect(mockTextSearch).toHaveBeenCalledWith('search_vector', 'ranger', {
      type: 'plain',
      config: 'simple',
    });
  });

  it('should work with world id (UUID)', async () => {
    vi.mocked(resolveWorldId).mockResolvedValue('world-uuid-123');

    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockOrder = vi.fn().mockReturnThis();
    const mockRange = vi.fn().mockResolvedValue({
      data: [],
      count: 0,
      error: null,
    });

    mockSupabase.from.mockReturnValue({
      select: mockSelect,
    });
    mockSelect.mockReturnValue({
      eq: mockEq,
    });
    mockEq.mockReturnValue({
      order: mockOrder,
    });
    mockOrder.mockReturnValue({
      range: mockRange,
    });

    await request(app).get('/api/catalog/npcs?world=world-uuid-123');

    expect(resolveWorldId).toHaveBeenCalledWith('world-uuid-123');
    expect(mockEq).toHaveBeenCalledWith('world_id', 'world-uuid-123');
  });

  it('should work with world slug', async () => {
    vi.mocked(resolveWorldId).mockResolvedValue('resolved-world-id');

    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockOrder = vi.fn().mockReturnThis();
    const mockRange = vi.fn().mockResolvedValue({
      data: [],
      count: 0,
      error: null,
    });

    mockSupabase.from.mockReturnValue({
      select: mockSelect,
    });
    mockSelect.mockReturnValue({
      eq: mockEq,
    });
    mockEq.mockReturnValue({
      order: mockOrder,
    });
    mockOrder.mockReturnValue({
      range: mockRange,
    });

    await request(app).get('/api/catalog/npcs?world=mystika');

    expect(resolveWorldId).toHaveBeenCalledWith('mystika');
    expect(mockEq).toHaveBeenCalledWith('world_id', 'resolved-world-id');
  });

  it('should return empty array if world not found', async () => {
    vi.mocked(resolveWorldId).mockResolvedValue(null);

    const response = await request(app).get('/api/catalog/npcs?world=invalid-world');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      data: [],
      meta: {
        total: 0,
        hasMore: false,
        world: 'invalid-world',
      },
    });
  });

  it('should return 400 for invalid params', async () => {
    const response = await request(app).get('/api/catalog/npcs?page=0');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      ok: false,
      code: 'INVALID_PARAM',
    });
  });

  it('should calculate hasMore correctly', async () => {
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockOrder = vi.fn().mockReturnThis();
    const mockRange = vi.fn().mockResolvedValue({
      data: Array(24).fill(null).map((_, i) => ({
        id: `npc-${i}`,
        name: `NPC ${i}`,
        status: 'active',
        world_id: null,
        portrait_url: null,
        doc: {},
        created_at: '2025-01-01T00:00:00Z',
      })),
      count: 50, // Total is 50, page 1 with 24 items
      error: null,
    });

    mockSupabase.from.mockReturnValue({
      select: mockSelect,
    });
    mockSelect.mockReturnValue({
      eq: mockEq,
    });
    mockEq.mockReturnValue({
      order: mockOrder,
    });
    mockOrder.mockReturnValue({
      range: mockRange,
    });

    const response = await request(app).get('/api/catalog/npcs?page=1&pageSize=24');

    expect(response.status).toBe(200);
    expect(response.body.meta.hasMore).toBe(true); // 50 > 1 * 24 = true
    expect(response.body.meta.total).toBe(50);
  });

  it('should only return active NPCs with public visibility', async () => {
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockOrder = vi.fn().mockReturnThis();
    const mockRange = vi.fn().mockResolvedValue({
      data: [],
      count: 0,
      error: null,
    });

    mockSupabase.from.mockReturnValue({
      select: mockSelect,
    });
    mockSelect.mockReturnValue({
      eq: mockEq,
    });
    mockEq.mockReturnValue({
      order: mockOrder,
    });
    mockOrder.mockReturnValue({
      range: mockRange,
    });

    await request(app).get('/api/catalog/npcs');

    // Verify status filter
    expect(mockEq).toHaveBeenCalledWith('status', 'active');
    // Verify visibility filter
    expect(mockEq).toHaveBeenCalledWith('doc->>visibility', 'public');
  });
});


