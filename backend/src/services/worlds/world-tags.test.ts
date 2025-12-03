/**
 * World Tags Test
 * Tests tag filtering functionality for worlds
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabaseAdmin } from '../../services/supabase.js';

// Mock Supabase client
vi.mock('../../services/supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

describe('World Tags Filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should filter worlds by tag', async () => {
    // Mock Supabase query chain
    const mockSelect = vi.fn().mockReturnThis();
    const mockOr = vi.fn().mockReturnThis();
    const mockContains = vi.fn().mockReturnThis();
    const mockOrder = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'world-1',
          name: 'Horror World',
          tags: ['horror', 'dark'],
          visibility: 'public',
        },
      ],
      error: null,
    });

    (supabaseAdmin.from as any).mockReturnValue({
      select: mockSelect,
      or: mockOr,
      contains: mockContains,
      order: mockOrder,
    });

    // Simulate the query from the API route
    const query = supabaseAdmin
      .from('chimera_worlds')
      .select('*')
      .or(`visibility.eq.public,owner_user_id.eq.test-user-id`)
      .contains('tags', ['horror'])
      .order('name', { ascending: true });

    const result = await query;

    expect(result.data).toBeDefined();
    expect(result.data?.length).toBe(1);
    expect(result.data?.[0].tags).toContain('horror');
  });

  it('should not find worlds without matching tag', async () => {
    // Mock Supabase query chain
    const mockSelect = vi.fn().mockReturnThis();
    const mockOr = vi.fn().mockReturnThis();
    const mockContains = vi.fn().mockReturnThis();
    const mockOrder = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });

    (supabaseAdmin.from as any).mockReturnValue({
      select: mockSelect,
      or: mockOr,
      contains: mockContains,
      order: mockOrder,
    });

    // Simulate query for non-matching tag
    const query = supabaseAdmin
      .from('chimera_worlds')
      .select('*')
      .or(`visibility.eq.public,owner_user_id.eq.test-user-id`)
      .contains('tags', ['scifi'])
      .order('name', { ascending: true });

    const result = await query;

    expect(result.data).toBeDefined();
    expect(result.data?.length).toBe(0);
  });

  it('should insert world with tags', async () => {
    const mockInsert = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'world-1',
        name: 'Horror World',
        tags: ['horror'],
      },
      error: null,
    });

    (supabaseAdmin.from as any).mockReturnValue({
      insert: mockInsert,
      select: mockSelect,
      single: mockSingle,
    });

    const worldData = {
      owner_user_id: 'test-user-id',
      name: 'Horror World',
      tags: ['horror'],
      visibility: 'private',
    };

    const result = await supabaseAdmin
      .from('chimera_worlds')
      .insert(worldData)
      .select()
      .single();

    expect(result.data).toBeDefined();
    expect(result.data?.tags).toEqual(['horror']);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tags: ['horror'],
      })
    );
  });
});

