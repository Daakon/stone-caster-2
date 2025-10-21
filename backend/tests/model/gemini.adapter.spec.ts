import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateJsonWithGemini, ModelJsonValidationError, ModelTimeoutError } from '../../src/model/providers/gemini';

// Mock environment variables
vi.mock('../../src/config/model', () => ({
  ModelConfig: {
    provider: 'gemini',
    modelName: 'gemini-1.5-pro',
    apiKey: 'test-api-key',
    jsonStrict: true,
    timeoutMs: 30000,
    maxTokens: 800,
    temperature: 0.7,
    dailyTokensCap: 50000,
  }
}));

// Mock fetch globally
global.fetch = vi.fn();

describe('Gemini Adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Happy Path', () => {
    it('should return validated JSON when Gemini returns valid response', async () => {
      const mockResponse = {
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                version: "1",
                narrator: { text: "The ancient forest whispers secrets." },
                deltas: {
                  npcRelationships: [{ npcId: "kiera", trust: 5 }]
                }
              })
            }]
          }
        }],
        usage: {
          candidatesTokenCount: 25,
          totalTokenCount: 100
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await generateJsonWithGemini({
        prompt: "Test prompt",
        maxTokens: 100,
        temperature: 0.7
      });

      expect(result.json).toEqual({
        version: "1",
        narrator: { text: "The ancient forest whispers secrets." },
        deltas: {
          npcRelationships: [{ npcId: "kiera", trust: 5 }]
        }
      });
      expect(result.tokensOut).toBe(25);
    });

    it('should estimate tokens when usage is not provided', async () => {
      const mockResponse = {
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                version: "1",
                narrator: { text: "Short response." }
              })
            }]
          }
        }]
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await generateJsonWithGemini({
        prompt: "Test prompt"
      });

      expect(result.tokensOut).toBe(Math.ceil("Short response.".length / 4));
    });
  });

  describe('Repair Success', () => {
    it('should repair invalid JSON on first attempt', async () => {
      const invalidResponse = {
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                version: "1",
                narrator: { text: "Valid text" },
                extraKey: "should be removed"
              })
            }]
          }
        }]
      };

      const validResponse = {
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                version: "1",
                narrator: { text: "Valid text" }
              })
            }]
          }
        }],
        usage: { candidatesTokenCount: 10 }
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(invalidResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(validResponse)
        });

      const result = await generateJsonWithGemini({
        prompt: "Test prompt"
      });

      expect(result.json).toEqual({
        version: "1",
        narrator: { text: "Valid text" }
      });
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Repair Failure', () => {
    it('should throw ModelJsonValidationError when repair also fails', async () => {
      const invalidResponse = {
        candidates: [{
          content: {
            parts: [{
              text: "Invalid JSON string"
            }]
          }
        }]
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(invalidResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(invalidResponse)
        });

      await expect(generateJsonWithGemini({
        prompt: "Test prompt"
      })).rejects.toThrow(ModelJsonValidationError);
    });
  });

  describe('Timeout', () => {
    it('should throw ModelTimeoutError when request times out', async () => {
      const controller = new AbortController();
      
      (global.fetch as any).mockImplementationOnce(() => {
        return new Promise((_, reject) => {
          setTimeout(() => {
            controller.abort();
            reject(new Error('AbortError'));
          }, 100);
        });
      });

      await expect(generateJsonWithGemini({
        prompt: "Test prompt",
        timeoutMs: 50
      })).rejects.toThrow(ModelTimeoutError);
    });
  });

  describe('API Errors', () => {
    it('should throw error when API returns non-ok status', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request'
      });

      await expect(generateJsonWithGemini({
        prompt: "Test prompt"
      })).rejects.toThrow('Gemini API error: 400 Bad Request');
    });

    it('should throw error when no content is returned', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ candidates: [] })
      });

      await expect(generateJsonWithGemini({
        prompt: "Test prompt"
      })).rejects.toThrow('No content returned from Gemini');
    });
  });
});
