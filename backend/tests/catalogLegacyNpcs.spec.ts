import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import catalogRouter from '../src/routes/catalog.js';
import { supabaseAdmin } from '../src/services/supabase.js';

vi.mock('../src/services/supabase.js', () => ({
  supabase: {},
  supabaseAdmin: { from: vi.fn() },
}));

describe('legacy catalog NPC compatibility', () => {
  const app = express().use('/api/catalog', catalogRouter);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads NPC slugs from chimera_entities instead of the removed key column', async () => {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      range: vi.fn(),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.order.mockReturnValue(query);
    query.range.mockResolvedValue({
      data: [{
        id: 'npc-1',
        slug: 'cael',
        entity_type: 'NPC',
        owner_user_id: null,
        visibility: 'public',
        world_id: 'world-1',
        display_name: 'Cael',
        primary_image_url: null,
        raw_data: { description_short: 'A loyal guide.' },
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      }],
      error: null,
      count: 1,
    });
    vi.mocked(supabaseAdmin.from).mockReturnValue(query as any);

    const response = await request(app).get('/api/catalog/npcs');

    expect(response.status).toBe(200);
    expect(response.body.data.items).toMatchObject([
      { id: 'npc-1', slug: 'cael', name: 'Cael', worldId: 'world-1' },
    ]);
    expect(query.select).toHaveBeenCalledWith(
      expect.stringContaining('slug'),
      { count: 'exact' },
    );
  });
});
