/**
 * API Routes Integration Tests
 * Phase 2: Tests for Chimera API routes using repositories
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import chimeraWorldsRouter from '../routes/chimera-worlds-repo.js';
import chimeraRulesetsRouter from '../routes/chimera-rulesets-repo.js';
import chimeraAssetsRouter from '../routes/chimera-assets-repo.js';
import { getChimeraSupabaseClient } from '../db/supabase-client.js';
import { WorldsRepository } from '../db/repos/worlds.repo.js';
import { RulesetsRepository } from '../db/repos/rulesets.repo.js';
import { AssetService } from '../services/assets/asset.service.js';

// Mock the Supabase client and repositories
vi.mock('../db/supabase-client.js', () => ({
  getChimeraSupabaseClient: vi.fn(),
}));

vi.mock('../db/repos/worlds.repo.js', () => ({
  WorldsRepository: vi.fn(),
}));

vi.mock('../db/repos/rulesets.repo.js', () => ({
  RulesetsRepository: vi.fn(),
}));

vi.mock('../services/assets/asset.service.js', () => ({
  AssetService: vi.fn(),
}));

describe('Chimera API Routes', () => {
  let app: express.Application;
  let mockWorldsRepo: any;
  let mockRulesetsRepo: any;
  let mockAssetService: any;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/chimera/worlds', chimeraWorldsRouter);
    app.use('/api/chimera/rulesets', chimeraRulesetsRouter);
    app.use('/api/chimera/assets', chimeraAssetsRouter);

    // Setup mock repositories
    mockWorldsRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      update: vi.fn(),
      listAll: vi.fn(),
    };

    mockRulesetsRepo = {
      create: vi.fn(),
      findByKey: vi.fn(),
      findByCategory: vi.fn(),
    };

    mockAssetService = {
      generateUploadUrl: vi.fn(),
    };

    (WorldsRepository as any).mockImplementation(() => mockWorldsRepo);
    (RulesetsRepository as any).mockImplementation(() => mockRulesetsRepo);
    (AssetService as any).mockImplementation(() => mockAssetService);
    (getChimeraSupabaseClient as any).mockReturnValue({});

    vi.clearAllMocks();
  });

  describe('POST /api/chimera/worlds', () => {
    it('should create a world with valid payload and return 201', async () => {
      const validWorld = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test World',
        description: 'A test world',
        images: [],
        character_schema_extensions: {},
        lore_fragments: [],
      };

      mockWorldsRepo.create.mockResolvedValue('new-world-id');

      const response = await request(app)
        .post('/api/chimera/worlds')
        .send(validWorld)
        .expect(201);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(mockWorldsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test World',
        }),
        undefined,
        undefined
      );
    });

    it('should return 400 for invalid payload', async () => {
      const invalidWorld = {
        // Missing required fields
        name: 'Test World',
      };

      const response = await request(app)
        .post('/api/chimera/worlds')
        .send(invalidWorld)
        .expect(400);

      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
      expect(mockWorldsRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/chimera/worlds/:id', () => {
    it('should fetch the created world and return correct data', async () => {
      const worldId = '123e4567-e89b-12d3-a456-426614174000';
      const mockWorld = {
        id: worldId,
        name: 'Test World',
        description: 'A test world',
        images: [],
        character_schema_extensions: {},
        lore_fragments: [],
      };

      mockWorldsRepo.findById.mockResolvedValue(mockWorld);

      const response = await request(app)
        .get(`/api/chimera/worlds/${worldId}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toEqual(mockWorld);
      expect(mockWorldsRepo.findById).toHaveBeenCalledWith(worldId);
    });

    it('should return 404 for non-existent world', async () => {
      const worldId = '123e4567-e89b-12d3-a456-426614174000';

      mockWorldsRepo.findById.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/chimera/worlds/${worldId}`)
        .expect(404);

      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('GET /api/chimera/rulesets', () => {
    it('should fetch rulesets by category and return a list', async () => {
      const mockRulesets = [
        {
          id: 'rs_d100_core',
          name: 'D100 Core System',
          ui_category: 'foundation',
          exclusion_group: 'skill_engine',
          dependencies: [],
          provides_tags: ['d100'],
          state_contributions: {},
          actions: {},
          ai_instructions: {},
        },
        {
          id: 'rs_another',
          name: 'Another Foundation',
          ui_category: 'foundation',
          exclusion_group: null,
          dependencies: [],
          provides_tags: [],
          state_contributions: {},
          actions: {},
          ai_instructions: {},
        },
      ];

      mockRulesetsRepo.findByCategory.mockResolvedValue(mockRulesets);

      const response = await request(app)
        .get('/api/chimera/rulesets?category=foundation')
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toEqual(mockRulesets);
      expect(mockRulesetsRepo.findByCategory).toHaveBeenCalledWith('foundation');
    });

    it('should return empty array when no category specified', async () => {
      const response = await request(app)
        .get('/api/chimera/rulesets')
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toEqual([]);
    });
  });

  describe('Error handling', () => {
    it('should handle repository errors gracefully', async () => {
      const validWorld = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test World',
        description: 'A test world',
        images: [],
        character_schema_extensions: {},
        lore_fragments: [],
      };

      mockWorldsRepo.create.mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .post('/api/chimera/worlds')
        .send(validWorld)
        .expect(500);

      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('POST /api/chimera/assets/upload-url', () => {
    it('should return upload URL and public URL', async () => {
      const mockResult = {
        uploadUrl: 'https://upload.imagedelivery.net/...',
        publicUrl: 'https://imagedelivery.net/accountHash/imageId/public',
        path: 'worlds/imageId',
      };

      mockAssetService.generateUploadUrl.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/chimera/assets/upload-url')
        .send({
          contentType: 'image/png',
          folder: 'worlds',
        })
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(response.body.data.uploadUrl).toBeDefined();
      expect(response.body.data.publicUrl).toBeDefined();
      expect(mockAssetService.generateUploadUrl).toHaveBeenCalledWith(
        'image/png',
        'worlds',
        expect.any(Object)
      );
    });

    it('should return 400 for invalid payload', async () => {
      const response = await request(app)
        .post('/api/chimera/assets/upload-url')
        .send({
          // Missing required fields
          contentType: 'image/png',
        })
        .expect(400);

      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
      expect(mockAssetService.generateUploadUrl).not.toHaveBeenCalled();
    });
  });
});

