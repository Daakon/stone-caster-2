import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';
import { getTemplatesForWorld, PromptTemplateMissingError } from '../src/prompting/templateRegistry.js';

// Mock the template registry
vi.mock('../src/prompting/templateRegistry.js', () => ({
  getTemplatesForWorld: vi.fn(),
  PromptTemplateMissingError: class extends Error {
    constructor(public world: string) {
      super(`No templates found for world: ${world}`);
      this.name = 'PromptTemplateMissingError';
    }
  },
}));

// Mock other services
vi.mock('../src/services/ai.js', () => ({
  aiWrapper: {
    generateResponse: vi.fn(() => Promise.resolve({
      content: JSON.stringify({
        narrative: 'Test narrative response',
        emotion: 'neutral',
        choices: [
          { id: 'choice-1', label: 'Continue' }
        ]
      })
    })),
  },
}));

vi.mock('../src/services/games.service.js', () => ({
  gamesService: {
    loadGame: vi.fn(() => Promise.resolve({
      id: 'game-123',
      world_slug: 'mystika',
      character_id: null,
      turn_count: 0,
      state_snapshot: { current_scene: 'opening' },
    })),
  },
}));

vi.mock('../src/services/wallet.service.js', () => ({
  WalletService: {
    getWallet: vi.fn(() => Promise.resolve({
      castingStones: 100,
    })),
  },
}));

vi.mock('../src/services/idempotency.service.js', () => ({
  IdempotencyService: {
    checkIdempotency: vi.fn(() => Promise.resolve({
      error: null,
      isDuplicate: false,
    })),
  },
}));

vi.mock('../src/services/game-state.service.js', () => ({
  gameStateService: {
    ensureInitialGameState: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock('../src/services/debug.service.js', () => ({
  debugService: {
    logAiResponse: vi.fn(),
  },
}));

describe('Turn API Integration', () => {
  const mockGetTemplatesForWorld = vi.mocked(getTemplatesForWorld);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('POST /:adventureId/turn', () => {
    const mockTemplateBundle = {
      core: {
        system: 'System prompt content',
        tools: 'Tools prompt content',
        formatting: 'Formatting prompt content',
        safety: 'Safety prompt content',
      },
      world: {
        lore: 'World lore content',
        logic: 'World logic content',
        style: 'World style content',
      },
      adventures: {
        falebridge: 'Adventure content',
      },
    };

    it('should return 200 when templates exist for mystika world', async () => {
      mockGetTemplatesForWorld.mockResolvedValue(mockTemplateBundle);

      const response = await request(app)
        .post('/api/adventures/falebridge/turn')
        .set('x-guest-user-id', 'guest-123')
        .set('x-idempotency-key', 'test-key-123')
        .send({
          optionId: 'option-123',
        });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(mockGetTemplatesForWorld).toHaveBeenCalledWith('mystika');
    });

    it('should return 422 when world templates are missing', async () => {
      mockGetTemplatesForWorld.mockRejectedValue(new PromptTemplateMissingError('mystika'));

      const response = await request(app)
        .post('/api/adventures/falebridge/turn')
        .set('x-guest-user-id', 'guest-123')
        .set('x-idempotency-key', 'test-key-123')
        .send({
          optionId: 'option-123',
        });

      expect(response.status).toBe(422);
      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('PROMPT_TEMPLATE_MISSING');
      expect(response.body.error.message).toContain('No templates available for world');
      expect(response.body.error.details.world).toBe('mystika');
    });

    it('should work with guest headers', async () => {
      mockGetTemplatesForWorld.mockResolvedValue(mockTemplateBundle);

      const response = await request(app)
        .post('/api/adventures/falebridge/turn')
        .set('x-guest-user-id', 'guest-456')
        .set('x-idempotency-key', 'test-key-456')
        .send({
          optionId: 'option-456',
        });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
    });

    it('should handle different world slugs', async () => {
      // Mock a different world
      const { gamesService } = await import('../src/services/games.service.js');
      vi.mocked(gamesService.loadGame).mockResolvedValue({
        id: 'game-456',
        world_slug: 'verya',
        character_id: undefined,
        turn_count: 0,
        state_snapshot: { current_scene: 'opening' },
      });

      mockGetTemplatesForWorld.mockResolvedValue(mockTemplateBundle);

      const response = await request(app)
        .post('/api/adventures/veywood/turn')
        .set('x-guest-user-id', 'guest-789')
        .set('x-idempotency-key', 'test-key-789')
        .send({
          optionId: 'option-789',
        });

      expect(response.status).toBe(200);
      expect(mockGetTemplatesForWorld).toHaveBeenCalledWith('verya');
    });

    it('should return 500 for unexpected errors', async () => {
      mockGetTemplatesForWorld.mockRejectedValue(new Error('Unexpected system error'));

      const response = await request(app)
        .post('/api/adventures/falebridge/turn')
        .set('x-guest-user-id', 'guest-123')
        .set('x-idempotency-key', 'test-key-123')
        .send({
          optionId: 'option-123',
        });

      expect(response.status).toBe(500);
      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    });

    it('should validate required headers', async () => {
      const response = await request(app)
        .post('/api/adventures/falebridge/turn')
        .send({
          optionId: 'option-123',
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
    });

    it('should validate request body', async () => {
      const response = await request(app)
        .post('/api/adventures/falebridge/turn')
        .set('x-guest-user-id', 'guest-123')
        .set('x-idempotency-key', 'test-key-123')
        .send({
          // Missing optionId
        });

      expect(response.status).toBe(422);
      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
    });
  });
});
