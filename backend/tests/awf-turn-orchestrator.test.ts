/**
 * Unit tests for AWF Turn Orchestrator
 * Phase 5: Turn Pipeline Integration - Testing orchestrator logic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runAwfTurn, runAwfTurnDry } from '../src/orchestrators/awf-turn-orchestrator.js';
import { AwfTurnParams } from '../src/orchestrators/awf-turn-orchestrator.js';

// Mock the dependencies
vi.mock('../assemblers/awf-bundle-assembler.js', () => ({
  assembleBundle: vi.fn()
}));

vi.mock('../interpreters/apply-acts.js', () => ({
  applyActs: vi.fn()
}));

vi.mock('../model/awf-model-provider.js', () => ({
  createModelProvider: vi.fn()
}));

vi.mock('../validators/awf-output-validator.js', () => ({
  validateAwfOutput: vi.fn(),
  extractAwfFromOutput: vi.fn()
}));

vi.mock('../utils/feature-flags.js', () => ({
  isAwfBundleEnabled: vi.fn()
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
    })),
  }))
}));

describe('AWF Turn Orchestrator', () => {
  const mockParams: AwfTurnParams = {
    sessionId: 'session-123',
    inputText: 'I want to explore the forest'
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Setup environment variables
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-key';
    
    // Mock feature flag
    const { isAwfBundleEnabled } = await import('../utils/feature-flags.js');
    vi.mocked(isAwfBundleEnabled).mockReturnValue(true);
  });

  describe('runAwfTurn', () => {
    it('should run complete AWF turn flow successfully', async () => {
      // Mock assembleBundle
      const { assembleBundle } = await import('../assemblers/awf-bundle-assembler.js');
      vi.mocked(assembleBundle).mockResolvedValue({
        bundle: { awf_bundle: { meta: { turn_id: 1, is_first_turn: true } } },
        metrics: { byteSize: 1000, estimatedTokens: 250 }
      });

      // Mock model provider
      const { createModelProvider } = await import('../model/awf-model-provider.js');
      const mockModelProvider = {
        infer: vi.fn().mockResolvedValue({
          raw: '{"AWF": {"scn": "forest", "txt": "You enter the forest", "choices": []}}',
          json: { AWF: { scn: 'forest', txt: 'You enter the forest', choices: [] } }
        })
      };
      vi.mocked(createModelProvider).mockReturnValue(mockModelProvider);

      // Mock validator
      const { validateAwfOutput, extractAwfFromOutput } = await import('../validators/awf-output-validator.js');
      vi.mocked(extractAwfFromOutput).mockReturnValue({
        scn: 'forest',
        txt: 'You enter the forest',
        choices: []
      });
      vi.mocked(validateAwfOutput).mockReturnValue({
        isValid: true,
        errors: []
      });

      // Mock applyActs
      const { applyActs } = await import('../interpreters/apply-acts.js');
      vi.mocked(applyActs).mockResolvedValue({
        newState: { hot: {}, warm: { episodic: [], pins: [] }, cold: {} },
        summary: {
          relChanges: [],
          objectives: [],
          flags: [],
          resources: [],
          memory: { added: 0, pinned: 0, trimmed: 0 },
          violations: []
        }
      });

      const result = await runAwfTurn(mockParams);

      expect(result).toEqual({
        txt: 'You enter the forest',
        choices: [],
        meta: { scn: 'forest' }
      });

      expect(assembleBundle).toHaveBeenCalledWith({
        sessionId: 'session-123',
        inputText: 'I want to explore the forest'
      });
      expect(applyActs).toHaveBeenCalled();
    });

    it('should handle validation failure and retry with repair hint', async () => {
      // Mock assembleBundle
      const { assembleBundle } = await import('../assemblers/awf-bundle-assembler.js');
      vi.mocked(assembleBundle).mockResolvedValue({
        bundle: { awf_bundle: { meta: { turn_id: 1, is_first_turn: true } } },
        metrics: { byteSize: 1000, estimatedTokens: 250 }
      });

      // Mock model provider with retry
      const { createModelProvider } = await import('../model/awf-model-provider.js');
      const mockModelProvider = {
        infer: vi.fn()
          .mockResolvedValueOnce({
            raw: '{"AWF": {"scn": "forest", "txt": "You enter the forest"}}',
            json: { AWF: { scn: 'forest', txt: 'You enter the forest' } }
          })
          .mockResolvedValueOnce({
            raw: '{"AWF": {"scn": "forest", "txt": "You enter the forest", "choices": []}}',
            json: { AWF: { scn: 'forest', txt: 'You enter the forest', choices: [] } }
          })
      };
      vi.mocked(createModelProvider).mockReturnValue(mockModelProvider);

      // Mock validator with failure then success
      const { validateAwfOutput, extractAwfFromOutput } = await import('../validators/awf-output-validator.js');
      vi.mocked(extractAwfFromOutput).mockReturnValue({
        scn: 'forest',
        txt: 'You enter the forest',
        choices: []
      });
      vi.mocked(validateAwfOutput)
        .mockReturnValueOnce({
          isValid: false,
          errors: [{ field: 'AWF.choices', message: 'choices is required' }],
          repairHint: 'Include choices array'
        })
        .mockReturnValueOnce({
          isValid: true,
          errors: []
        });

      // Mock applyActs
      const { applyActs } = await import('../interpreters/apply-acts.js');
      vi.mocked(applyActs).mockResolvedValue({
        newState: { hot: {}, warm: { episodic: [], pins: [] }, cold: {} },
        summary: {
          relChanges: [],
          objectives: [],
          flags: [],
          resources: [],
          memory: { added: 0, pinned: 0, trimmed: 0 },
          violations: []
        }
      });

      const result = await runAwfTurn(mockParams);

      expect(result).toEqual({
        txt: 'You enter the forest',
        choices: [],
        meta: { scn: 'forest' }
      });

      // Should have called model twice (initial + retry)
      expect(mockModelProvider.infer).toHaveBeenCalledTimes(2);
    });

    it('should throw error when feature flag is disabled', async () => {
      const { isAwfBundleEnabled } = await import('../utils/feature-flags.js');
      vi.mocked(isAwfBundleEnabled).mockReturnValue(false);

      await expect(runAwfTurn(mockParams)).rejects.toThrow('AWF bundle not enabled for this session');
    });

    it('should throw error when validation fails after retry', async () => {
      // Mock assembleBundle
      const { assembleBundle } = await import('../assemblers/awf-bundle-assembler.js');
      vi.mocked(assembleBundle).mockResolvedValue({
        bundle: { awf_bundle: { meta: { turn_id: 1, is_first_turn: true } } },
        metrics: { byteSize: 1000, estimatedTokens: 250 }
      });

      // Mock model provider
      const { createModelProvider } = await import('../model/awf-model-provider.js');
      const mockModelProvider = {
        infer: vi.fn().mockResolvedValue({
          raw: '{"AWF": {"scn": "forest", "txt": "You enter the forest"}}',
          json: { AWF: { scn: 'forest', txt: 'You enter the forest' } }
        })
      };
      vi.mocked(createModelProvider).mockReturnValue(mockModelProvider);

      // Mock validator with persistent failure
      const { validateAwfOutput, extractAwfFromOutput } = await import('../validators/awf-output-validator.js');
      vi.mocked(extractAwfFromOutput).mockReturnValue({
        scn: 'forest',
        txt: 'You enter the forest'
      });
      vi.mocked(validateAwfOutput).mockReturnValue({
        isValid: false,
        errors: [{ field: 'AWF.choices', message: 'choices is required' }],
        repairHint: 'Include choices array'
      });

      await expect(runAwfTurn(mockParams)).rejects.toThrow('AWF validation failed after retry');
    });
  });

  describe('runAwfTurnDry', () => {
    it('should run dry mode successfully', async () => {
      // Mock assembleBundle
      const { assembleBundle } = await import('../assemblers/awf-bundle-assembler.js');
      vi.mocked(assembleBundle).mockResolvedValue({
        bundle: { awf_bundle: { meta: { turn_id: 1, is_first_turn: true } } },
        metrics: { byteSize: 1000, estimatedTokens: 250 }
      });

      // Mock model provider
      const { createModelProvider } = await import('../model/awf-model-provider.js');
      const mockModelProvider = {
        infer: vi.fn().mockResolvedValue({
          raw: '{"AWF": {"scn": "forest", "txt": "You enter the forest", "choices": []}}',
          json: { AWF: { scn: 'forest', txt: 'You enter the forest', choices: [] } }
        })
      };
      vi.mocked(createModelProvider).mockReturnValue(mockModelProvider);

      // Mock validator
      const { validateAwfOutput, extractAwfFromOutput } = await import('../validators/awf-output-validator.js');
      vi.mocked(extractAwfFromOutput).mockReturnValue({
        scn: 'forest',
        txt: 'You enter the forest',
        choices: []
      });
      vi.mocked(validateAwfOutput).mockReturnValue({
        isValid: true,
        errors: []
      });

      const result = await runAwfTurnDry(mockParams);

      expect(result).toEqual({
        bundle: { awf_bundle: { meta: { turn_id: 1, is_first_turn: true } } },
        awf: {
          scn: 'forest',
          txt: 'You enter the forest',
          choices: []
        },
        metrics: expect.objectContaining({
          bundleSize: 1000,
          estimatedTokens: 250,
          validationPassed: true,
          retryUsed: false
        })
      });

      // Should not call applyActs in dry mode
      const { applyActs } = await import('../interpreters/apply-acts.js');
      expect(applyActs).not.toHaveBeenCalled();
    });

    it('should handle validation failure in dry mode', async () => {
      // Mock assembleBundle
      const { assembleBundle } = await import('../assemblers/awf-bundle-assembler.js');
      vi.mocked(assembleBundle).mockResolvedValue({
        bundle: { awf_bundle: { meta: { turn_id: 1, is_first_turn: true } } },
        metrics: { byteSize: 1000, estimatedTokens: 250 }
      });

      // Mock model provider
      const { createModelProvider } = await import('../model/awf-model-provider.js');
      const mockModelProvider = {
        infer: vi.fn().mockResolvedValue({
          raw: '{"AWF": {"scn": "forest", "txt": "You enter the forest"}}',
          json: { AWF: { scn: 'forest', txt: 'You enter the forest' } }
        })
      };
      vi.mocked(createModelProvider).mockReturnValue(mockModelProvider);

      // Mock validator with failure
      const { validateAwfOutput, extractAwfFromOutput } = await import('../validators/awf-output-validator.js');
      vi.mocked(extractAwfFromOutput).mockReturnValue({
        scn: 'forest',
        txt: 'You enter the forest'
      });
      vi.mocked(validateAwfOutput).mockReturnValue({
        isValid: false,
        errors: [{ field: 'AWF.choices', message: 'choices is required' }],
        repairHint: 'Include choices array'
      });

      const result = await runAwfTurnDry(mockParams);

      expect(result.metrics.validationPassed).toBe(false);
      expect(result.metrics.retryUsed).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing Supabase configuration', async () => {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_KEY;

      await expect(runAwfTurn(mockParams)).rejects.toThrow('Missing Supabase configuration');
    });

    it('should handle assembleBundle failure', async () => {
      const { assembleBundle } = await import('../assemblers/awf-bundle-assembler.js');
      vi.mocked(assembleBundle).mockRejectedValue(new Error('Bundle assembly failed'));

      await expect(runAwfTurn(mockParams)).rejects.toThrow('Bundle assembly failed');
    });

    it('should handle model inference failure', async () => {
      // Mock assembleBundle
      const { assembleBundle } = await import('../assemblers/awf-bundle-assembler.js');
      vi.mocked(assembleBundle).mockResolvedValue({
        bundle: { awf_bundle: { meta: { turn_id: 1, is_first_turn: true } } },
        metrics: { byteSize: 1000, estimatedTokens: 250 }
      });

      // Mock model provider with failure
      const { createModelProvider } = await import('../model/awf-model-provider.js');
      const mockModelProvider = {
        infer: vi.fn().mockRejectedValue(new Error('Model inference failed'))
      };
      vi.mocked(createModelProvider).mockReturnValue(mockModelProvider);

      await expect(runAwfTurn(mockParams)).rejects.toThrow('Model inference failed');
    });

    it('should handle applyActs failure', async () => {
      // Mock assembleBundle
      const { assembleBundle } = await import('../assemblers/awf-bundle-assembler.js');
      vi.mocked(assembleBundle).mockResolvedValue({
        bundle: { awf_bundle: { meta: { turn_id: 1, is_first_turn: true } } },
        metrics: { byteSize: 1000, estimatedTokens: 250 }
      });

      // Mock model provider
      const { createModelProvider } = await import('../model/awf-model-provider.js');
      const mockModelProvider = {
        infer: vi.fn().mockResolvedValue({
          raw: '{"AWF": {"scn": "forest", "txt": "You enter the forest", "choices": []}}',
          json: { AWF: { scn: 'forest', txt: 'You enter the forest', choices: [] } }
        })
      };
      vi.mocked(createModelProvider).mockReturnValue(mockModelProvider);

      // Mock validator
      const { validateAwfOutput, extractAwfFromOutput } = await import('../validators/awf-output-validator.js');
      vi.mocked(extractAwfFromOutput).mockReturnValue({
        scn: 'forest',
        txt: 'You enter the forest',
        choices: []
      });
      vi.mocked(validateAwfOutput).mockReturnValue({
        isValid: true,
        errors: []
      });

      // Mock applyActs with failure
      const { applyActs } = await import('../interpreters/apply-acts.js');
      vi.mocked(applyActs).mockRejectedValue(new Error('Act application failed'));

      await expect(runAwfTurn(mockParams)).rejects.toThrow('Act application failed');
    });
  });
});
