import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import { ContentService } from '../services/content.service.js';

// Mock the ContentService
vi.mock('../services/content.service.js', () => ({
  ContentService: {
    getAdventures: vi.fn(),
  },
}));

const mockContentService = vi.mocked(ContentService);

describe('Layer P1 - Adventures API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/adventures', () => {
    it('should return list of adventures', async () => {
      const mockAdventures = [
        {
          id: 'adventure-1',
          slug: 'tavern-mystery',
          title: 'The Tavern Mystery',
          title: 'The Tavern Mystery',
          name: 'The Tavern Mystery',
          description: 'A mysterious adventure that begins in a tavern',
          worldId: 'world-1',
          isPublic: true,
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
        },
        {
          id: 'adventure-2',
          slug: 'forest-quest',
          title: 'The Forest Quest',
          name: 'The Forest Quest',
          description: 'An adventure through the enchanted forest',
          worldId: 'world-1',
          isPublic: true,
          createdAt: '2023-01-02T00:00:00Z',
          updatedAt: '2023-01-02T00:00:00Z',
        },
      ];

      mockContentService.getAdventures.mockResolvedValue(mockAdventures);

      const response = await request(app)
        .get('/api/adventures')
        .expect(200);

      expect(response.body).toMatchObject({
        ok: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            id: 'adventure-1',
            title: 'The Tavern Mystery',
          name: 'The Tavern Mystery',
            description: 'A mysterious adventure that begins in a tavern',
          }),
          expect.objectContaining({
            id: 'adventure-2',
            name: 'The Forest Quest',
            description: 'An adventure through the enchanted forest',
          }),
        ]),
      });

      expect(mockContentService.getAdventures).toHaveBeenCalledOnce();
    });

    it('should return 404 when no adventures are available', async () => {
      mockContentService.getAdventures.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/adventures')
        .expect(404);

      expect(response.body).toMatchObject({
        ok: false,
        error: 'NOT_FOUND',
        message: 'No adventures available',
      });
    });

    it('should handle ContentService errors', async () => {
      mockContentService.getAdventures.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/adventures')
        .expect(500);

      expect(response.body).toMatchObject({
        ok: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to fetch adventures',
      });
    });
  });

  describe('GET /api/adventures/:id', () => {
    it('should return a specific adventure by ID', async () => {
      const mockAdventures = [
        {
          id: 'adventure-1',
          slug: 'tavern-mystery',
          title: 'The Tavern Mystery',
          name: 'The Tavern Mystery',
          description: 'A mysterious adventure that begins in a tavern',
          worldId: 'world-1',
          isPublic: true,
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
        },
      ];

      mockContentService.getAdventures.mockResolvedValue(mockAdventures);

      const response = await request(app)
        .get('/api/adventures/adventure-1')
        .expect(200);

      expect(response.body).toMatchObject({
        ok: true,
        data: expect.objectContaining({
          id: 'adventure-1',
          title: 'The Tavern Mystery',
          name: 'The Tavern Mystery',
          description: 'A mysterious adventure that begins in a tavern',
        }),
      });
    });

    it('should return 404 when adventure is not found', async () => {
      mockContentService.getAdventures.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/adventures/nonexistent-id')
        .expect(404);

      expect(response.body).toMatchObject({
        ok: false,
        error: 'NOT_FOUND',
        message: 'Adventure not found',
      });
    });

    it('should validate adventure ID parameter', async () => {
      const response = await request(app)
        .get('/api/adventures/invalid-id-format')
        .expect(400);

      expect(response.body).toMatchObject({
        ok: false,
        error: 'VALIDATION_FAILED',
      });
    });
  });

  describe('GET /api/adventures/slug/:slug', () => {
    it('should return a specific adventure by slug', async () => {
      const mockAdventures = [
        {
          id: 'adventure-1',
          slug: 'tavern-mystery',
          title: 'The Tavern Mystery',
          name: 'The Tavern Mystery',
          description: 'A mysterious adventure that begins in a tavern',
          worldId: 'world-1',
          isPublic: true,
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
        },
      ];

      mockContentService.getAdventures.mockResolvedValue(mockAdventures);

      const response = await request(app)
        .get('/api/adventures/slug/tavern-mystery')
        .expect(200);

      expect(response.body).toMatchObject({
        ok: true,
        data: expect.objectContaining({
          id: 'adventure-1',
          slug: 'tavern-mystery',
          title: 'The Tavern Mystery',
          name: 'The Tavern Mystery',
        }),
      });
    });

    it('should return 404 when adventure slug is not found', async () => {
      mockContentService.getAdventures.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/adventures/slug/nonexistent-slug')
        .expect(404);

      expect(response.body).toMatchObject({
        ok: false,
        error: 'NOT_FOUND',
        message: 'Adventure not found',
      });
    });
  });
});


