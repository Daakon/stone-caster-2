// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * LLM Service Tests
 * Phase 6-B: Real LLM Integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LlmService } from './llm.service';
import { MockLlmProvider } from '../runtime/llm.provider';
import { Mas1ResponseDtoSchema } from '@shared/types/chimera-runtime';
import { z } from 'zod';

describe('LlmService', () => {
  let mockProvider: MockLlmProvider;
  let llmService: LlmService;

  beforeEach(() => {
    mockProvider = new MockLlmProvider();
    llmService = new LlmService(mockProvider);
  });

  describe('generateJSON', () => {
    it('should generate JSON response with schema validation', async () => {
      const systemPrompt = 'You are a test assistant.';
      const userPrompt = 'Return a test response.';
      const schema = z.object({
        action_slug: z.string(),
        parameters: z.record(z.unknown()),
        sentiment: z.string(),
      });

      const result = await llmService.generateJSON(
        systemPrompt,
        userPrompt,
        schema
      );

      expect(result).toBeDefined();
      expect(result).toHaveProperty('action_slug');
      expect(result).toHaveProperty('parameters');
      expect(result).toHaveProperty('sentiment');
    });

    it('should validate response against Mas1ResponseDtoSchema', async () => {
      const systemPrompt = 'You are the Game Referee.';
      const userPrompt = 'User input: "attack the enemy"';

      const result = await llmService.generateJSON(
        systemPrompt,
        userPrompt,
        Mas1ResponseDtoSchema
      );

      expect(result).toBeDefined();
      expect(result.action_slug).toBeDefined();
      expect(typeof result.action_slug).toBe('string');
      expect(result.parameters).toBeDefined();
      expect(typeof result.parameters).toBe('object');
      expect(result.sentiment).toBeDefined();
      expect(typeof result.sentiment).toBe('string');
    });

    it('should throw ServiceError on malformed JSON response', async () => {
      // Create a mock provider that returns invalid JSON
      const badProvider = {
        generateJson: vi.fn().mockResolvedValue({ invalid: 'response' }),
      };

      const service = new LlmService(badProvider as any);
      const schema = z.object({
        required_field: z.string(),
      });

      await expect(
        service.generateJSON('system', 'user', schema)
      ).rejects.toThrow();
    });

    it('should handle API errors gracefully', async () => {
      // Create a mock provider that throws an error
      const errorProvider = {
        generateJson: vi.fn().mockRejectedValue(new Error('API key not configured')),
      };

      const service = new LlmService(errorProvider as any);

      await expect(
        service.generateJSON('system', 'user')
      ).rejects.toThrow();
    });
  });

  describe('generateText', () => {
    it('should generate text response', async () => {
      // Mock fetch for text generation
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'This is a test narrative response.',
            },
          }],
        }),
      });

      global.fetch = mockFetch as any;

      // Set environment variable for API key
      process.env.OPENAI_API_KEY = 'test-key';

      const result = await llmService.generateText(
        'You are a narrator.',
        'Describe what happened.'
      );

      expect(result).toBe('This is a test narrative response.');
      expect(mockFetch).toHaveBeenCalled();

      // Cleanup
      delete process.env.OPENAI_API_KEY;
    });

    it('should throw ServiceError when API key is missing', async () => {
      delete process.env.OPENAI_API_KEY;

      await expect(
        llmService.generateText('system', 'user')
      ).rejects.toThrow();
    });

    it('should handle rate limit errors', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded',
      });

      global.fetch = mockFetch as any;
      process.env.OPENAI_API_KEY = 'test-key';

      await expect(
        llmService.generateText('system', 'user')
      ).rejects.toThrow();

      delete process.env.OPENAI_API_KEY;
    });
  });
});

