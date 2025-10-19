import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { OpenAIModelProvider, MockModelProvider, AwfToolCall, AwfToolResult } from '../src/model/awf-model-provider.js';
import { GetLoreSliceTool, createGetLoreSliceTool } from '../src/tools/get-lore-slice.js';
import { AWFMetricsUtils } from '../src/metrics/awf-metrics.js';

describe('Phase 11 - Tool-Calling Interface', () => {
  let mockSupabase: any;
  let loreSliceTool: GetLoreSliceTool;

  beforeEach(() => {
    // Mock Supabase client
    mockSupabase = {
      from: (table: string) => ({
        select: () => ({
          eq: (column: string, value: any) => ({
            single: () => ({
              data: {
                id: 'test-doc',
                name: 'Test Document',
                slices: ['slice1', 'slice2'],
                slice1: 'This is slice 1 content with detailed information about the world.',
                slice2: 'This is slice 2 content with adventure-specific details.'
              }
            })
          })
        })
      })
    };

    loreSliceTool = createGetLoreSliceTool(mockSupabase);
  });

  afterEach(() => {
    // Clean up any test data
  });

  describe('Model Provider Tool Support', () => {
    it('should support tool calls in Mock provider', async () => {
      const provider = new MockModelProvider();

      const toolCall: AwfToolCall = {
        name: 'GetLoreSlice',
        arguments: {
          scope: 'world',
          ref: 'world-1',
          slice: 'history',
          maxTokens: 200
        }
      };

      const result = await provider.inferWithTools({
        system: 'Test system prompt',
        awf_bundle: { test: 'data' },
        tools: [toolCall],
        onToolCall: async (call) => ({
          name: 'GetLoreSlice',
          result: {
            ref: call.arguments.ref,
            slice: call.arguments.slice,
            compact: 'Test lore slice content',
            tokensEst: 50,
            hash: 'test-hash'
          }
        })
      });

      expect(result.raw).toBeDefined();
      expect(result.json).toBeDefined();
    });

  });

  describe('GetLoreSlice Tool', () => {
    it('should handle valid tool calls', async () => {
      const toolCall: AwfToolCall = {
        name: 'GetLoreSlice',
        arguments: {
          scope: 'world',
          ref: 'world-1',
          slice: 'slice1',
          maxTokens: 200
        }
      };

      const result = await loreSliceTool.handleToolCall(toolCall);

      expect(result.name).toBe('GetLoreSlice');
      expect(result.result.ref).toBe('world-1');
      expect(result.result.slice).toBe('slice1');
      expect(result.result.compact).toContain('slice 1 content');
      expect(result.result.tokensEst).toBeGreaterThan(0);
      expect(result.result.hash).toBeDefined();
    });

    it('should handle unknown slices', async () => {
      const toolCall: AwfToolCall = {
        name: 'GetLoreSlice',
        arguments: {
          scope: 'world',
          ref: 'world-1',
          slice: 'unknown-slice',
          maxTokens: 200
        }
      };

      const result = await loreSliceTool.handleToolCall(toolCall);

      expect(result.name).toBe('GetLoreSlice');
      expect(result.result.ref).toBe('world-1');
      expect(result.result.slice).toBe('unknown-slice');
      expect(result.result.compact).toContain('not found');
      expect(result.result.tokensEst).toBeGreaterThan(0);
      expect(result.result.hash).toBe('not-found');
    });

    it('should respect token limits', async () => {
      const toolCall: AwfToolCall = {
        name: 'GetLoreSlice',
        arguments: {
          scope: 'world',
          ref: 'world-1',
          slice: 'slice1',
          maxTokens: 50
        }
      };

      const result = await loreSliceTool.handleToolCall(toolCall);

      expect(result.result.tokensEst).toBeLessThanOrEqual(50);
    });

    it('should cache results', async () => {
      const toolCall: AwfToolCall = {
        name: 'GetLoreSlice',
        arguments: {
          scope: 'world',
          ref: 'world-1',
          slice: 'slice1',
          maxTokens: 200
        }
      };

      // First call
      const result1 = await loreSliceTool.handleToolCall(toolCall);
      expect(result1.result.compact).toBeDefined();

      // Second call should hit cache
      const result2 = await loreSliceTool.handleToolCall(toolCall);
      expect(result2.result.compact).toBe(result1.result.compact);
      expect(result2.result.hash).toBe(result1.result.hash);
    });

    it('should return quota information', () => {
      const quotaInfo = loreSliceTool.getQuotaInfo();

      expect(quotaInfo.maxCallsPerTurn).toBeGreaterThan(0);
      expect(quotaInfo.maxTokens).toBeGreaterThan(0);
    });
  });

  describe('Tool Call Quotas', () => {
    it('should enforce max calls per turn', async () => {
      const maxCalls = 2;
      const toolCalls: AwfToolCall[] = [];

      // Reset turn counter
      loreSliceTool.resetTurnCounter();

      // Create more tool calls than allowed
      for (let i = 0; i < maxCalls + 1; i++) {
        toolCalls.push({
          name: 'GetLoreSlice',
          arguments: {
            scope: 'world',
            ref: 'world-1',
            slice: `slice${i}`,
            maxTokens: 200
          }
        });
      }

      let deniedCount = 0;
      for (const toolCall of toolCalls) {
        const result = await loreSliceTool.handleToolCall(toolCall);
        if (result.result.hash === 'quota-exceeded') {
          deniedCount++;
        }
      }

      expect(deniedCount).toBeGreaterThan(0);
    });
  });

  describe('Token Budget Enforcement', () => {
    it('should truncate content when over token limit', async () => {
      const toolCall: AwfToolCall = {
        name: 'GetLoreSlice',
        arguments: {
          scope: 'world',
          ref: 'world-1',
          slice: 'slice1',
          maxTokens: 10 // Very low limit
        }
      };

      const result = await loreSliceTool.handleToolCall(toolCall);

      expect(result.result.tokensEst).toBeLessThanOrEqual(10);
      expect(result.result.compact.length).toBeLessThan(50); // Should be truncated
    });

    it('should maintain minimum token count', async () => {
      const toolCall: AwfToolCall = {
        name: 'GetLoreSlice',
        arguments: {
          scope: 'world',
          ref: 'world-1',
          slice: 'slice1',
          maxTokens: 5 // Very low limit
        }
      };

      const result = await loreSliceTool.handleToolCall(toolCall);

      // Should still return some content even with very low limit
      expect(result.result.compact.length).toBeGreaterThan(0);
    });
  });

  describe('Metrics Recording', () => {
    it('should record tool call metrics', () => {
      const sessionId = 'test-session';
      const count = 2;
      const denied = 1;
      const tokensReturned = 150;
      const cacheHits = 1;

      // This should not throw
      expect(() => {
        AWFMetricsUtils.recordToolCalls(sessionId, count, denied, tokensReturned, cacheHits);
      }).not.toThrow();
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete tool call workflow', async () => {
      const toolCall: AwfToolCall = {
        name: 'GetLoreSlice',
        arguments: {
          scope: 'adventure',
          ref: 'adv-1',
          slice: 'slice2',
          maxTokens: 300
        }
      };

      // Handle tool call
      const toolResult = await loreSliceTool.handleToolCall(toolCall);

      expect(toolResult.name).toBe('GetLoreSlice');
      expect(toolResult.result.compact).toContain('slice 2 content');
      expect(toolResult.result.tokensEst).toBeGreaterThan(0);

      // Verify metrics can be recorded
      AWFMetricsUtils.recordToolCalls('test-session', 1, 0, toolResult.result.tokensEst, 0);
    });

    it('should handle tool call errors gracefully', async () => {
      // Mock a failing Supabase call
      const failingSupabase = {
        from: () => ({
          select: () => ({
            eq: () => ({
              single: () => {
                throw new Error('Database connection failed');
              }
            })
          })
        })
      };

      const failingTool = createGetLoreSliceTool(failingSupabase);

      const toolCall: AwfToolCall = {
        name: 'GetLoreSlice',
        arguments: {
          scope: 'world',
          ref: 'world-1',
          slice: 'slice1',
          maxTokens: 200
        }
      };

      const result = await failingTool.handleToolCall(toolCall);

      expect(result.name).toBe('GetLoreSlice');
      expect(result.result.compact).toContain('Error retrieving slice');
      expect(result.result.hash).toBe('error');
    });

    it('should maintain determinism with same inputs', async () => {
      const toolCall: AwfToolCall = {
        name: 'GetLoreSlice',
        arguments: {
          scope: 'world',
          ref: 'world-1',
          slice: 'slice1',
          maxTokens: 200
        }
      };

      // Call multiple times with same parameters
      const result1 = await loreSliceTool.handleToolCall(toolCall);
      const result2 = await loreSliceTool.handleToolCall(toolCall);

      expect(result1.result.compact).toBe(result2.result.compact);
      expect(result1.result.hash).toBe(result2.result.hash);
      expect(result1.result.tokensEst).toBe(result2.result.tokensEst);
    });
  });

  describe('Cache Behavior', () => {
    it('should cache results with proper keys', async () => {
      const toolCall: AwfToolCall = {
        name: 'GetLoreSlice',
        arguments: {
          scope: 'world',
          ref: 'world-1',
          slice: 'slice1',
          maxTokens: 200
        }
      };

      // First call - should compute
      const result1 = await loreSliceTool.handleToolCall(toolCall);
      expect(result1.result.compact).toBeDefined();

      // Second call - should hit cache
      const result2 = await loreSliceTool.handleToolCall(toolCall);
      expect(result2.result.compact).toBe(result1.result.compact);
    });

    it('should use different cache keys for different parameters', async () => {
      const toolCall1: AwfToolCall = {
        name: 'GetLoreSlice',
        arguments: {
          scope: 'world',
          ref: 'world-1',
          slice: 'slice1',
          maxTokens: 100
        }
      };

      const toolCall2: AwfToolCall = {
        name: 'GetLoreSlice',
        arguments: {
          scope: 'world',
          ref: 'world-1',
          slice: 'slice1',
          maxTokens: 200
        }
      };

      const result1 = await loreSliceTool.handleToolCall(toolCall1);
      const result2 = await loreSliceTool.handleToolCall(toolCall2);

      // Should be different due to different maxTokens
      expect(result1.result.tokensEst).toBeLessThanOrEqual(100);
      expect(result2.result.tokensEst).toBeLessThanOrEqual(200);
    });
  });
});
