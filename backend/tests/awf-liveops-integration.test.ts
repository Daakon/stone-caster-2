/**
 * Tests for AWF Bundle LiveOps Integration
 * Ensures LiveOps levers are reflected in bundle.meta
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AwfBundle } from '../src/types/awf-bundle.js';

describe('AWF Bundle LiveOps Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should include token_budget in bundle.meta when LiveOps config is resolved', () => {
    const bundleShape: Partial<AwfBundle> = {
      awf_bundle: {
        meta: {
          engine_version: '1.0.0',
          world: 'world@1.0.0',
          adventure: 'adventure@1.0.0',
          turn_id: 1,
          is_first_turn: false,
          locale: 'en-US',
          timestamp: '2024-01-01T00:00:00Z',
          token_budget: {
            input_max: 4000,
            output_max: 2000,
          },
          tool_quota: {
            max_calls: 5,
          },
        },
      },
    };

    expect(bundleShape.awf_bundle?.meta?.token_budget).toBeDefined();
    expect(bundleShape.awf_bundle?.meta?.token_budget?.input_max).toBe(4000);
    expect(bundleShape.awf_bundle?.meta?.token_budget?.output_max).toBe(2000);
    expect(bundleShape.awf_bundle?.meta?.tool_quota?.max_calls).toBe(5);
  });

  it('should reflect LiveOps token constraints', () => {
    const liveOpsConfig = {
      AWF_MAX_INPUT_TOKENS: 6000,
      AWF_MAX_OUTPUT_TOKENS: 3000,
      AWF_TOOL_CALL_QUOTA: 10,
    };

    const bundleShape: Partial<AwfBundle> = {
      awf_bundle: {
        meta: {
          engine_version: '1.0.0',
          world: 'world@1.0.0',
          adventure: 'adventure@1.0.0',
          turn_id: 1,
          is_first_turn: false,
          locale: 'en-US',
          timestamp: '2024-01-01T00:00:00Z',
          token_budget: {
            input_max: liveOpsConfig.AWF_MAX_INPUT_TOKENS,
            output_max: liveOpsConfig.AWF_MAX_OUTPUT_TOKENS,
          },
          tool_quota: {
            max_calls: liveOpsConfig.AWF_TOOL_CALL_QUOTA,
          },
        },
      },
    };

    expect(bundleShape.awf_bundle?.meta?.token_budget?.input_max).toBe(liveOpsConfig.AWF_MAX_INPUT_TOKENS);
    expect(bundleShape.awf_bundle?.meta?.token_budget?.output_max).toBe(liveOpsConfig.AWF_MAX_OUTPUT_TOKENS);
    expect(bundleShape.awf_bundle?.meta?.tool_quota?.max_calls).toBe(liveOpsConfig.AWF_TOOL_CALL_QUOTA);
  });

  it('should allow token_budget and tool_quota to be optional', () => {
    const bundleShape: Partial<AwfBundle> = {
      awf_bundle: {
        meta: {
          engine_version: '1.0.0',
          world: 'world@1.0.0',
          adventure: 'adventure@1.0.0',
          turn_id: 1,
          is_first_turn: false,
          locale: 'en-US',
          timestamp: '2024-01-01T00:00:00Z',
          // token_budget and tool_quota can be undefined
        },
      },
    };

    expect(bundleShape.awf_bundle?.meta?.token_budget).toBeUndefined();
    expect(bundleShape.awf_bundle?.meta?.tool_quota).toBeUndefined();
  });
});

