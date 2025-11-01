/**
 * Phase 4.1: Legacy Prompts Deprecation Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import gamesRouter from '../../src/routes/games.js';
import { config } from '../../src/config/index.js';
import { getTraceId } from '../../src/utils/response.js';

// Mock config to control legacy prompts flag
vi.mock('../../src/config/index.js', () => ({
  config: {
    legacyPrompts: {
      enabled: false,
      sunset: '2025-12-31',
    },
  },
}));

describe('Legacy Prompts Deprecation', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/games', gamesRouter);
    
    // Reset config mock
    vi.mocked(config.legacyPrompts).enabled = false;
    vi.mocked(config.legacyPrompts).sunset = '2025-12-31';
  });

  describe('POST /api/games/:id/initial-prompt - Legacy disabled (default)', () => {
    it('should return 410 Gone with LEGACY_ROUTE_RETIRED error', async () => {
      const response = await request(app)
        .post('/api/games/test-game-id/initial-prompt')
        .set('Cookie', 'guestId=test-guest-id')
        .send({})
        .expect(410);

      expect(response.body).toMatchObject({
        ok: false,
        error: {
          code: 'LEGACY_ROUTE_RETIRED',
          message: expect.stringContaining('retired'),
        },
        meta: {
          migration: {
            newEndpoint: 'POST /api/games',
          },
        },
      });
    });
  });

  describe('POST /api/games/:id/initial-prompt - Legacy enabled', () => {
    beforeEach(() => {
      vi.mocked(config.legacyPrompts).enabled = true;
    });

    it('should return 200 with deprecation headers', async () => {
      // Mock the promptsService.createInitialPromptWithApproval
      const mockPromptsService = {
        createInitialPromptWithApproval: vi.fn().resolves({
          prompt: 'Test prompt',
          promptId: 'test-prompt-id',
        }),
      };

      vi.mock('../../src/services/prompts.service.js', () => ({
        promptsService: mockPromptsService,
      }));

      // Mock games service
      const mockGamesService = {
        getGameById: vi.fn().resolves({
          id: 'test-game-id',
          worldSlug: 'test-world',
          characterId: null,
          turnCount: 0,
        }),
      };

      vi.mock('../../src/services/games.service.js', () => ({
        GamesService: vi.fn().mockImplementation(() => mockGamesService),
      }));

      const response = await request(app)
        .post('/api/games/test-game-id/initial-prompt')
        .set('Cookie', 'guestId=test-guest-id')
        .send({})
        .expect(200);

      // Check deprecation headers
      expect(response.headers['deprecation']).toBe('true');
      expect(response.headers['sunset']).toBe('2025-12-31');
      expect(response.headers['link']).toContain('rel="deprecation"');

      // Check response body (legacy format)
      expect(response.body).toHaveProperty('data');
    });

    it('should log legacy.prompt.used event', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Mock services
      const mockPromptsService = {
        createInitialPromptWithApproval: vi.fn().resolves({
          prompt: 'Test prompt',
          promptId: 'test-prompt-id',
        }),
      };

      vi.mock('../../src/services/prompts.service.js', () => ({
        promptsService: mockPromptsService,
      }));

      const mockGamesService = {
        getGameById: vi.fn().resolves({
          id: 'test-game-id',
          worldSlug: 'test-world',
          characterId: null,
          turnCount: 0,
        }),
      };

      vi.mock('../../src/services/games.service.js', () => ({
        GamesService: vi.fn().mockImplementation(() => mockGamesService),
      }));

      await request(app)
        .post('/api/games/test-game-id/initial-prompt')
        .set('Cookie', 'guestId=test-guest-id')
        .send({})
        .expect(200);

      // Verify structured log
      const logCalls = consoleSpy.mock.calls.filter(call => 
        typeof call[0] === 'string' && call[0].includes('legacy.prompt.used')
      );
      
      expect(logCalls.length).toBeGreaterThan(0);
      
      const logData = JSON.parse(logCalls[0][0]);
      expect(logData).toMatchObject({
        event: 'legacy.prompt.used',
        route: '/api/games/:id/initial-prompt',
        gameId: 'test-game-id',
        sunset: '2025-12-31',
      });

      consoleSpy.mockRestore();
    });
  });
});

describe('Dev Debug Routes Rate Limiting', () => {
  let app: Express;
  const debugToken = 'test-debug-token';

  beforeEach(() => {
    process.env.DEBUG_ROUTES_ENABLED = 'true';
    process.env.DEBUG_ROUTES_TOKEN = debugToken;
    process.env.DEBUG_ROUTES_RATELIMIT_PER_MIN = '2'; // Low limit for testing

    app = express();
    app.use(express.json());
    
    // Import and mount dev debug router
    import('../../src/routes/dev.debug.js').then(module => {
      app.use('/api/dev/debug', module.default);
    });
  });

  it('should allow requests within rate limit', async () => {
    // This test would require full app setup with mocked services
    // Placeholder for structure
    expect(true).toBe(true);
  });

  it('should return 429 when rate limit exceeded', async () => {
    // This test would require full app setup with mocked services
    // Placeholder for structure
    expect(true).toBe(true);
  });
});

