import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import catalogRouter from '../../src/routes/catalog.js';

// Mock Supabase client
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOr = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockFrom = vi.fn();

vi.mock('../../src/services/supabase.js', () => ({
  supabase: {
    from: mockFrom,
  },
}));

describe('Catalog Routes - Worlds', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/catalog', catalogRouter);

    // Setup default mock chain
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ order: mockOrder, eq: mockEq, or: mockOr });
    mockOrder.mockReturnValue({ eq: mockEq, data: null, error: null });
    mockEq.mockReturnValue({ data: null, error: null });
    mockOr.mockReturnValue({ order: mockOrder });
    mockLimit.mockReturnValue({ data: null, error: null });
  });

  describe('GET /api/catalog/worlds', () => {
    it('should return all worlds when activeOnly is not specified', async () => {
      const mockWorlds = [
        {
          id: 'mystika',
          version: '1.0.0',
          name: 'Mystika',
          description: 'A magical realm',
          status: 'active',
          doc: {
            slug: 'mystika',
            tagline: 'Crystalborn Legacy',
            short_desc: 'Magic flows freely',
            hero_quote: 'In every crystal, a world remembers.',
          },
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-02T00:00:00Z',
        },
        {
          id: 'darklands',
          version: '1.0.0',
          name: 'Darklands',
          description: 'A dark and dangerous world',
          status: 'draft',
          doc: {
            slug: 'darklands',
            tagline: 'Shadow and Fear',
            short_desc: 'Darkness reigns',
            hero_quote: 'From shadows we emerge.',
          },
          created_at: '2025-01-03T00:00:00Z',
          updated_at: '2025-01-04T00:00:00Z',
        },
      ];

      mockOrder.mockReturnValue({
        eq: mockEq,
        data: mockWorlds,
        error: null,
      });

      const response = await request(app).get('/api/catalog/worlds');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0]).toMatchObject({
        id: 'mystika',
        name: 'Mystika',
        slug: 'mystika',
        tagline: 'Crystalborn Legacy',
        short_desc: 'A magical realm',
        hero_quote: 'In every crystal, a world remembers.',
        status: 'active',
      });
      expect(mockFrom).toHaveBeenCalledWith('worlds');
      expect(mockSelect).toHaveBeenCalledWith(
        'id, version, name, description, status, doc, created_at, updated_at'
      );
    });

    it('should return only active worlds when activeOnly=1', async () => {
      const mockWorlds = [
        {
          id: 'mystika',
          version: '1.0.0',
          name: 'Mystika',
          description: 'A magical realm',
          status: 'active',
          doc: {
            slug: 'mystika',
            tagline: 'Crystalborn Legacy',
          },
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-02T00:00:00Z',
        },
      ];

      mockEq.mockReturnValue({
        data: mockWorlds,
        error: null,
      });

      const response = await request(app).get('/api/catalog/worlds?activeOnly=1');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].status).toBe('active');
      expect(mockEq).toHaveBeenCalledWith('status', 'active');
    });

    it('should return only active worlds when activeOnly=true', async () => {
      const mockWorlds = [
        {
          id: 'mystika',
          version: '1.0.0',
          name: 'Mystika',
          description: 'A magical realm',
          status: 'active',
          doc: {
            slug: 'mystika',
          },
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-02T00:00:00Z',
        },
      ];

      mockEq.mockReturnValue({
        data: mockWorlds,
        error: null,
      });

      const response = await request(app).get('/api/catalog/worlds?activeOnly=true');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(mockEq).toHaveBeenCalledWith('status', 'active');
    });

    it('should return all worlds when activeOnly=0', async () => {
      const mockWorlds = [
        {
          id: 'mystika',
          version: '1.0.0',
          name: 'Mystika',
          description: 'A magical realm',
          status: 'active',
          doc: { slug: 'mystika' },
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-02T00:00:00Z',
        },
        {
          id: 'darklands',
          version: '1.0.0',
          name: 'Darklands',
          description: 'Dark world',
          status: 'draft',
          doc: { slug: 'darklands' },
          created_at: '2025-01-03T00:00:00Z',
          updated_at: '2025-01-04T00:00:00Z',
        },
      ];

      mockOrder.mockReturnValue({
        eq: mockEq,
        data: mockWorlds,
        error: null,
      });

      const response = await request(app).get('/api/catalog/worlds?activeOnly=0');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(mockEq).not.toHaveBeenCalled(); // Should not filter by status
    });

    it('should handle empty results gracefully', async () => {
      mockOrder.mockReturnValue({
        eq: mockEq,
        data: [],
        error: null,
      });

      const response = await request(app).get('/api/catalog/worlds');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data).toEqual([]);
    });

    it('should handle Supabase errors', async () => {
      mockOrder.mockReturnValue({
        eq: mockEq,
        data: null,
        error: { message: 'Database connection failed' },
      });

      const response = await request(app).get('/api/catalog/worlds');

      expect(response.status).toBe(500);
      expect(response.body.ok).toBe(false);
      expect(response.body.error.message).toBe('Failed to fetch worlds');
    });

    it('should return 400 for invalid activeOnly parameter', async () => {
      const response = await request(app).get('/api/catalog/worlds?activeOnly=invalid');

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should use fallback values when doc fields are missing', async () => {
      const mockWorlds = [
        {
          id: 'basic-world',
          version: '1.0.0',
          name: 'Basic World',
          description: 'A basic world',
          status: 'active',
          doc: {}, // Empty doc
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-02T00:00:00Z',
        },
      ];

      mockOrder.mockReturnValue({
        eq: mockEq,
        data: mockWorlds,
        error: null,
      });

      const response = await request(app).get('/api/catalog/worlds');

      expect(response.status).toBe(200);
      expect(response.body.data[0]).toMatchObject({
        id: 'basic-world',
        name: 'Basic World',
        slug: 'basic-world', // Falls back to id
        tagline: '',
        short_desc: 'A basic world', // Falls back to description
        hero_quote: '',
      });
    });
  });

  describe('GET /api/catalog/worlds/:idOrSlug', () => {
    it('should return a world by id', async () => {
      const mockWorld = {
        id: 'mystika',
        version: '1.0.0',
        name: 'Mystika',
        description: 'A magical realm',
        status: 'active',
        doc: {
          slug: 'mystika',
          tagline: 'Crystalborn Legacy',
          short_desc: 'Magic flows freely',
          hero_quote: 'In every crystal, a world remembers.',
        },
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-02T00:00:00Z',
      };

      mockLimit.mockReturnValue({
        data: [mockWorld],
        error: null,
      });
      mockOrder.mockReturnValue({ limit: mockLimit });
      mockOr.mockReturnValue({ order: mockOrder });

      const response = await request(app).get('/api/catalog/worlds/mystika');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data).toMatchObject({
        id: 'mystika',
        name: 'Mystika',
        slug: 'mystika',
        tagline: 'Crystalborn Legacy',
        status: 'active',
      });
      expect(mockOr).toHaveBeenCalledWith('id.eq.mystika,doc->>slug.eq.mystika');
    });

    it('should return a world by slug', async () => {
      const mockWorld = {
        id: 'world-123',
        version: '1.0.0',
        name: 'Mystika',
        description: 'A magical realm',
        status: 'active',
        doc: {
          slug: 'mystika',
        },
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-02T00:00:00Z',
      };

      mockLimit.mockReturnValue({
        data: [mockWorld],
        error: null,
      });
      mockOrder.mockReturnValue({ limit: mockLimit });
      mockOr.mockReturnValue({ order: mockOrder });

      const response = await request(app).get('/api/catalog/worlds/mystika');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data.slug).toBe('mystika');
    });

    it('should return 404 when world not found', async () => {
      mockLimit.mockReturnValue({
        data: [],
        error: null,
      });
      mockOrder.mockReturnValue({ limit: mockLimit });
      mockOr.mockReturnValue({ order: mockOrder });

      const response = await request(app).get('/api/catalog/worlds/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
      expect(response.body.error.message).toBe('World not found');
    });

    it('should handle Supabase errors', async () => {
      mockLimit.mockReturnValue({
        data: null,
        error: { message: 'Database error' },
      });
      mockOrder.mockReturnValue({ limit: mockLimit });
      mockOr.mockReturnValue({ order: mockOrder });

      const response = await request(app).get('/api/catalog/worlds/mystika');

      expect(response.status).toBe(500);
      expect(response.body.ok).toBe(false);
      expect(response.body.error.message).toBe('Failed to fetch world');
    });

    it('should handle null data gracefully', async () => {
      mockLimit.mockReturnValue({
        data: null,
        error: null,
      });
      mockOrder.mockReturnValue({ limit: mockLimit });
      mockOr.mockReturnValue({ order: mockOrder });

      const response = await request(app).get('/api/catalog/worlds/mystika');

      expect(response.status).toBe(404);
      expect(response.body.ok).toBe(false);
    });
  });

  describe('GET /api/catalog/stories', () => {
    it('should return all stories when activeOnly is not specified', async () => {
      const mockStories = [
        {
          id: 'mystika-awakening',
          world_ref: 'mystika',
          version: '1.0.0',
          doc: {
            slug: 'mystika-awakening',
            name: 'The Awakening',
            tagline: 'Discover your powers',
            short_desc: 'A young hero awakens',
            hero_quote: 'The journey begins.',
            status: 'active',
          },
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-02T00:00:00Z',
        },
        {
          id: 'darklands-trial',
          world_ref: 'darklands',
          version: '1.0.0',
          doc: {
            slug: 'darklands-trial',
            name: 'Trial by Fire',
            status: 'draft',
          },
          created_at: '2025-01-03T00:00:00Z',
          updated_at: '2025-01-04T00:00:00Z',
        },
      ];

      mockOrder.mockReturnValue({
        eq: mockEq,
        data: mockStories,
        error: null,
      });

      const response = await request(app).get('/api/catalog/stories');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0]).toMatchObject({
        id: 'mystika-awakening',
        name: 'The Awakening',
        slug: 'mystika-awakening',
        tagline: 'Discover your powers',
        short_desc: 'A young hero awakens',
        hero_quote: 'The journey begins.',
        world_id: 'mystika',
        status: 'active',
      });
      expect(mockFrom).toHaveBeenCalledWith('adventures');
      expect(mockSelect).toHaveBeenCalledWith(
        'id, world_ref, version, doc, created_at, updated_at'
      );
    });

    it('should return only active stories when activeOnly=1', async () => {
      const mockStories = [
        {
          id: 'mystika-awakening',
          world_ref: 'mystika',
          version: '1.0.0',
          doc: {
            slug: 'mystika-awakening',
            name: 'The Awakening',
            status: 'active',
          },
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-02T00:00:00Z',
        },
      ];

      mockEq.mockReturnValue({
        data: mockStories,
        error: null,
      });

      const response = await request(app).get('/api/catalog/stories?activeOnly=1');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].status).toBe('active');
      expect(mockEq).toHaveBeenCalledWith('doc->>status', 'active');
    });

    it('should return only active stories when activeOnly=true', async () => {
      const mockStories = [
        {
          id: 'mystika-awakening',
          world_ref: 'mystika',
          version: '1.0.0',
          doc: {
            name: 'The Awakening',
            status: 'active',
          },
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-02T00:00:00Z',
        },
      ];

      mockEq.mockReturnValue({
        data: mockStories,
        error: null,
      });

      const response = await request(app).get('/api/catalog/stories?activeOnly=true');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(mockEq).toHaveBeenCalledWith('doc->>status', 'active');
    });

    it('should return all stories when activeOnly=0', async () => {
      const mockStories = [
        {
          id: 'story-1',
          world_ref: 'world-1',
          version: '1.0.0',
          doc: { name: 'Story 1', status: 'active' },
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-02T00:00:00Z',
        },
        {
          id: 'story-2',
          world_ref: 'world-2',
          version: '1.0.0',
          doc: { name: 'Story 2', status: 'draft' },
          created_at: '2025-01-03T00:00:00Z',
          updated_at: '2025-01-04T00:00:00Z',
        },
      ];

      mockOrder.mockReturnValue({
        eq: mockEq,
        data: mockStories,
        error: null,
      });

      const response = await request(app).get('/api/catalog/stories?activeOnly=0');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(mockEq).not.toHaveBeenCalled();
    });

    it('should handle empty results gracefully', async () => {
      mockOrder.mockReturnValue({
        eq: mockEq,
        data: [],
        error: null,
      });

      const response = await request(app).get('/api/catalog/stories');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data).toEqual([]);
    });

    it('should handle Supabase errors', async () => {
      mockOrder.mockReturnValue({
        eq: mockEq,
        data: null,
        error: { message: 'Database connection failed' },
      });

      const response = await request(app).get('/api/catalog/stories');

      expect(response.status).toBe(500);
      expect(response.body.ok).toBe(false);
      expect(response.body.error.message).toBe('Failed to fetch stories');
    });

    it('should return 400 for invalid activeOnly parameter', async () => {
      const response = await request(app).get('/api/catalog/stories?activeOnly=invalid');

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('should use fallback values when doc fields are missing', async () => {
      const mockStories = [
        {
          id: 'basic-story',
          world_ref: 'basic-world',
          version: '1.0.0',
          doc: {}, // Empty doc
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-02T00:00:00Z',
        },
      ];

      mockOrder.mockReturnValue({
        eq: mockEq,
        data: mockStories,
        error: null,
      });

      const response = await request(app).get('/api/catalog/stories');

      expect(response.status).toBe(200);
      expect(response.body.data[0]).toMatchObject({
        id: 'basic-story',
        name: 'basic-story', // Falls back to id
        slug: 'basic-story', // Falls back to id
        tagline: '',
        short_desc: '',
        hero_quote: '',
        world_id: 'basic-world',
        status: 'draft', // Default status
      });
    });
  });

  describe('GET /api/catalog/stories/:idOrSlug', () => {
    it('should return a story by id', async () => {
      const mockStory = {
        id: 'mystika-awakening',
        world_ref: 'mystika',
        version: '1.0.0',
        doc: {
          slug: 'mystika-awakening',
          name: 'The Awakening',
          tagline: 'Discover your powers',
          short_desc: 'A young hero awakens',
          hero_quote: 'The journey begins.',
          status: 'active',
        },
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-02T00:00:00Z',
      };

      mockLimit.mockReturnValue({
        data: [mockStory],
        error: null,
      });
      mockOrder.mockReturnValue({ limit: mockLimit });
      mockOr.mockReturnValue({ order: mockOrder });

      const response = await request(app).get('/api/catalog/stories/mystika-awakening');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data).toMatchObject({
        id: 'mystika-awakening',
        name: 'The Awakening',
        slug: 'mystika-awakening',
        tagline: 'Discover your powers',
        world_id: 'mystika',
        status: 'active',
      });
      expect(mockOr).toHaveBeenCalledWith('id.eq.mystika-awakening,doc->>slug.eq.mystika-awakening');
    });

    it('should return a story by slug', async () => {
      const mockStory = {
        id: 'story-123',
        world_ref: 'mystika',
        version: '1.0.0',
        doc: {
          slug: 'mystika-awakening',
          name: 'The Awakening',
        },
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-02T00:00:00Z',
      };

      mockLimit.mockReturnValue({
        data: [mockStory],
        error: null,
      });
      mockOrder.mockReturnValue({ limit: mockLimit });
      mockOr.mockReturnValue({ order: mockOrder });

      const response = await request(app).get('/api/catalog/stories/mystika-awakening');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data.slug).toBe('mystika-awakening');
    });

    it('should return 404 when story not found', async () => {
      mockLimit.mockReturnValue({
        data: [],
        error: null,
      });
      mockOrder.mockReturnValue({ limit: mockLimit });
      mockOr.mockReturnValue({ order: mockOrder });

      const response = await request(app).get('/api/catalog/stories/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
      expect(response.body.error.message).toBe('Story not found');
    });

    it('should handle Supabase errors', async () => {
      mockLimit.mockReturnValue({
        data: null,
        error: { message: 'Database error' },
      });
      mockOrder.mockReturnValue({ limit: mockLimit });
      mockOr.mockReturnValue({ order: mockOrder });

      const response = await request(app).get('/api/catalog/stories/mystika-awakening');

      expect(response.status).toBe(500);
      expect(response.body.ok).toBe(false);
      expect(response.body.error.message).toBe('Failed to fetch story');
    });

    it('should handle null data gracefully', async () => {
      mockLimit.mockReturnValue({
        data: null,
        error: null,
      });
      mockOrder.mockReturnValue({ limit: mockLimit });
      mockOr.mockReturnValue({ order: mockOrder });

      const response = await request(app).get('/api/catalog/stories/mystika-awakening');

      expect(response.status).toBe(404);
      expect(response.body.ok).toBe(false);
    });
  });
});

