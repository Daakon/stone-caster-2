/**
 * Unit tests for the OpenAI service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OpenAIService } from './openai.service.js';

// Mock the config service
vi.mock('../config/index.js', () => ({
  configService: {
    getEnv: () => ({
      openaiApiKey: 'test-api-key',
    }),
  },
}));

// Mock OpenAI
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  })),
}));

describe('OpenAIService', () => {
  let service: OpenAIService;
  let mockOpenAI: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock OpenAI client
    const { default: OpenAI } = await import('openai');
    mockOpenAI = new OpenAI();
    service = new OpenAIService();
  });

  describe('Configuration', () => {
    it('should throw error if API key is not configured', () => {
      vi.mocked(require('../config/index.js').configService.getEnv).mockReturnValue({
        openaiApiKey: 'your_ope',
      });

      expect(() => new OpenAIService()).toThrow('OPENAI_API_KEY environment variable is required');
    });

    it('should initialize with valid API key', () => {
      expect(service).toBeDefined();
      expect(service.isConfigured()).toBe(true);
    });

    it('should return model information', () => {
      const modelInfo = service.getModelInfo();
      
      expect(modelInfo.model).toBe('gpt-4o-mini');
      expect(modelInfo.maxTokens).toBe(2000);
      expect(modelInfo.temperature).toBe(0.8);
    });
  });

  describe('JSON Response Parsing', () => {
    it('should parse valid JSON response', () => {
      const validJson = '{"scn": {"id": "test"}, "txt": "Hello world"}';
      const parsed = service.parseAIResponse(validJson);
      
      expect(parsed).toEqual({
        scn: { id: 'test' },
        txt: 'Hello world'
      });
    });

    it('should throw error for invalid JSON', () => {
      const invalidJson = '{"scn": {"id": "test", "txt": "Hello world"'; // Missing closing brace
      
      expect(() => service.parseAIResponse(invalidJson)).toThrow('Invalid JSON response from AI');
    });
  });

  describe('Retry Logic', () => {
    it('should retry on transient failures', async () => {
      const mockCreate = vi.fn()
        .mockRejectedValueOnce(new Error('Rate limit'))
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce({
          choices: [{ message: { content: '{"scn": {"id": "test"}, "txt": "Success"}' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
        });

      mockOpenAI.chat.completions.create = mockCreate;

      const result = await service.generateBufferedResponse('test prompt');
      
      expect(mockCreate).toHaveBeenCalledTimes(3);
      expect(result.content).toBe('{"scn": {"id": "test"}, "txt": "Success"}');
    });

    it('should fail after max retries', async () => {
      const mockCreate = vi.fn().mockRejectedValue(new Error('Persistent error'));
      mockOpenAI.chat.completions.create = mockCreate;

      await expect(service.generateBufferedResponse('test prompt'))
        .rejects.toThrow('OpenAI request failed after 3 attempts');
    });
  });

  describe('Exponential Backoff', () => {
    it('should implement exponential backoff delays', async () => {
      const mockCreate = vi.fn()
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockResolvedValueOnce({
          choices: [{ message: { content: '{"scn": {"id": "test"}, "txt": "Success"}' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
        });

      mockOpenAI.chat.completions.create = mockCreate;

      const startTime = Date.now();
      await service.generateBufferedResponse('test prompt');
      const endTime = Date.now();

      // Should have waited at least 1s + 2s = 3s total
      expect(endTime - startTime).toBeGreaterThanOrEqual(2900); // Allow some tolerance
    });
  });

  describe('JSON Repair', () => {
    it('should attempt to repair malformed JSON', async () => {
      const malformedJson = '{"scn": {"id": "test", "txt": "Hello world"'; // Missing closing brace
      
      const mockCreate = vi.fn()
        .mockResolvedValueOnce({
          choices: [{ message: { content: '{"scn": {"id": "test"}, "txt": "Hello world"}' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
        });

      mockOpenAI.chat.completions.create = mockCreate;

      const repaired = await service.repairJSONResponse(malformedJson, 'original prompt');
      
      expect(repaired).toEqual({
        scn: { id: 'test' },
        txt: 'Hello world'
      });
    });

    it('should throw error if repair fails', async () => {
      const malformedJson = 'invalid json';
      
      const mockCreate = vi.fn().mockRejectedValue(new Error('Repair failed'));
      mockOpenAI.chat.completions.create = mockCreate;

      await expect(service.repairJSONResponse(malformedJson, 'original prompt'))
        .rejects.toThrow('Failed to repair malformed JSON response');
    });
  });

  describe('Streaming Response', () => {
    it('should create token stream', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { choices: [{ delta: { content: 'Hello' } }] };
          yield { choices: [{ delta: { content: ' world' } }] };
          yield { choices: [{ delta: { content: '!' } }] };
        }
      };

      const mockCreate = vi.fn().mockResolvedValue(mockStream);
      mockOpenAI.chat.completions.create = mockCreate;

      const tokens: string[] = [];
      const result = await service.generateStreamingResponse('test prompt', (token) => {
        tokens.push(token);
      });

      // Collect all tokens from stream
      for await (const token of result.stream) {
        // Tokens are already collected in the callback
      }

      expect(tokens).toEqual(['Hello', ' world', '!']);
    });
  });

  describe('Request Configuration', () => {
    it('should use correct model and parameters', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        choices: [{ message: { content: '{"scn": {"id": "test"}, "txt": "Success"}' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
      });

      mockOpenAI.chat.completions.create = mockCreate;

      await service.generateBufferedResponse('test prompt');

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'test prompt' }],
        temperature: 0.8,
        max_tokens: 2000,
      });
    });

    it('should use streaming configuration for streaming requests', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { choices: [{ delta: { content: 'test' } }] };
        }
      };

      const mockCreate = vi.fn().mockResolvedValue(mockStream);
      mockOpenAI.chat.completions.create = mockCreate;

      await service.generateStreamingResponse('test prompt');

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'test prompt' }],
        temperature: 0.8,
        max_tokens: 2000,
        stream: true,
      });
    });
  });
});
