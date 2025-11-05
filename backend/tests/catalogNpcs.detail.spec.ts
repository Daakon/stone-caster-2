/**
 * NPC Catalog Detail Route Tests
 * Phase A3: Tests for GET /api/catalog/npcs/:idOrSlug
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

describe('GET /api/catalog/npcs/:idOrSlug', () => {
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

  it('should return 200 with detail payload for UUID', async () => {
    const mockNpc = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Test NPC',
      status: 'active',
      world_id: 'world-1',
      portrait_url: 'https://example.com/portrait.png',
      doc: {
        short_desc: 'A test NPC',
        long_desc: 'A longer description',
        tags: ['test', 'npc'],
        visibility: 'public',
      },
      created_at: '2025-01-01T00:00:00Z',
      slug: null,
    };

    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: mockNpc,
      error: null,
    });

    mockSupabase.from.mockReturnValue({
      select: mockSelect,
    });
    mockSelect.mockReturnValue({
      eq: mockEq,
    });
    mockEq.mockReturnValue({
      single: mockSingle,
    });

    // Mock world fetch
    const mockWorldSelect = vi.fn().mockReturnThis();
    const mockWorldIn = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'world-1',
          slug: 'mystika',
          name: 'Mystika',
        },
      ],
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'worlds') {
        return {
          select: mockWorldSelect,
        };
      }
      return {
        select: mockSelect,
      };
    });
    mockWorldSelect.mockReturnValue({
      in: mockWorldIn,
    });

    const response = await request(app).get('/api/catalog/npcs/123e4567-e89b-12d3-a456-426614174000');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      data: {
        id: mockNpc.id,
        name: mockNpc.name,
        status: 'active',
        world: {
          id: 'world-1',
          slug: 'mystika',
          name: 'Mystika',
        },
        portrait_url: mockNpc.portrait_url,
        short_desc: 'A test NPC',
        description: 'A longer description',
        tags: ['test', 'npc'],
        created_at: mockNpc.created_at,
      },
    });
  });

  it('should return 200 with detail payload for slug', async () => {
    const mockNpc = {
      id: 'npc-123',
      name: 'Test NPC',
      status: 'active',
      world_id: null,
      portrait_url: null,
      doc: {
        short_desc: 'A test NPC',
        visibility: 'public',
      },
      created_at: '2025-01-01T00:00:00Z',
      slug: 'test-npc',
    };

    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockOr = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: mockNpc,
      error: null,
    });

    mockSupabase.from.mockReturnValue({
      select: mockSelect,
    });
    mockSelect.mockReturnValue({
      eq: mockEq,
    });
    mockEq.mockReturnValue({
      or: mockOr,
    });
    mockOr.mockReturnValue({
      single: mockSingle,
    });

    const response = await request(app).get('/api/catalog/npcs/test-npc');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      data: {
        id: mockNpc.id,
        name: mockNpc.name,
        world: null,
        portrait_url: '/assets/portrait/npc-123.svg', // Placeholder applied
      },
    });
  });

  it('should return 404 for non-existent id', async () => {
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'Not found' },
    });

    mockSupabase.from.mockReturnValue({
      select: mockSelect,
    });
    mockSelect.mockReturnValue({
      eq: mockEq,
    });
    mockEq.mockReturnValue({
      single: mockSingle,
    });

    const response = await request(app).get('/api/catalog/npcs/123e4567-e89b-12d3-a456-426614174000');

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      ok: false,
      code: 'NPC_NOT_FOUND',
    });
  });

  it('should return 404 for non-public NPC (RLS hides)', async () => {
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'Not found' },
    });

    mockSupabase.from.mockReturnValue({
      select: mockSelect,
    });
    mockSelect.mockReturnValue({
      eq: mockEq,
    });
    mockEq.mockReturnValue({
      single: mockSingle,
    });

    const response = await request(app).get('/api/catalog/npcs/private-npc-slug');

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      ok: false,
      code: 'NPC_NOT_FOUND',
    });
  });

  it('should apply portrait placeholder when missing', async () => {
    const mockNpc = {
      id: 'npc-without-portrait',
      name: 'NPC Without Portrait',
      status: 'active',
      world_id: null,
      portrait_url: null,
      doc: { visibility: 'public' },
      created_at: '2025-01-01T00:00:00Z',
      slug: null,
    };

    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: mockNpc,
      error: null,
    });

    mockSupabase.from.mockReturnValue({
      select: mockSelect,
    });
    mockSelect.mockReturnValue({
      eq: mockEq,
    });
    mockEq.mockReturnValue({
      single: mockSingle,
    });

    const response = await request(app).get('/api/catalog/npcs/npc-without-portrait');

    expect(response.status).toBe(200);
    expect(response.body.data.portrait_url).toBe('/assets/portrait/npc-without-portrait.svg');
  });

  it('should embed world mini when world_id is present', async () => {
    const mockNpc = {
      id: 'npc-with-world',
      name: 'NPC With World',
      status: 'active',
      world_id: 'world-123',
      portrait_url: null,
      doc: { visibility: 'public' },
      created_at: '2025-01-01T00:00:00Z',
      slug: null,
    };

    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: mockNpc,
      error: null,
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'worlds') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'world-123',
                slug: 'mystika',
                name: 'Mystika',
              },
            ],
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
      single: mockSingle,
    });

    const response = await request(app).get('/api/catalog/npcs/npc-with-world');

    expect(response.status).toBe(200);
    expect(response.body.data.world).toMatchObject({
      id: 'world-123',
      slug: 'mystika',
      name: 'Mystika',
    });
  });
});

