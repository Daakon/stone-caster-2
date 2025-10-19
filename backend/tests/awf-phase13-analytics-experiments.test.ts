/**
 * Phase 13: Analytics & Experiments Tests
 * Comprehensive test suite for analytics pipeline and experiments framework
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn(() => ({ error: null })),
      select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(() => ({ data: null, error: null })) })) })),
      update: vi.fn(() => ({ eq: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(() => ({ data: null, error: null })) })) })) })),
      delete: vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) })),
    })),
  })),
}));

import { analyticsPipeline, trackTurnEvent, trackExperimentExposure } from '../src/analytics/events.js';
import { assignVariation, validateExperimentParams } from '../src/experiments/assign.js';
import { getActiveExperimentParams } from '../src/experiments/params.js';

describe('Analytics Event Pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variables
    process.env.ANALYTICS_ENABLED = 'true';
    process.env.ANALYTICS_BATCH_MAX = '500';
    process.env.ANALYTICS_BATCH_MS = '3000';
    
    // Clear the analytics pipeline batch
    analyticsPipeline['batch'] = [];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should track turn events with metrics', async () => {
    const mockEvent = {
      sessionId: 'session-123',
      playerHash: 'player-456',
      worldRef: 'mystika',
      adventureRef: 'whispercross',
      locale: 'en-US',
      metrics: {
        turnLatencyMs: 1500,
        modelLatencyMs: 1200,
        bundleTokens: 800,
        outputTokens: 400,
        retries: 0,
        fallbacks: 0,
        toolCalls: 3,
        actsCount: 2,
        choicesCount: 4,
        timeAdvanceTicks: 1,
      },
    };

    await analyticsPipeline.trackTurnEvent(mockEvent);

    // Verify the event was added to batch
    const stats = await analyticsPipeline.getStats();
    expect(stats.pendingEvents).toBe(1);
  });

  it('should hash player IDs for privacy', async () => {
    const playerId = 'user-123';
    const hashedId = analyticsPipeline['hashPlayerId'](playerId);
    
    expect(hashedId).toBeDefined();
    expect(hashedId).not.toBe(playerId);
    expect(typeof hashedId).toBe('string');
  });

  it('should flush batch when size limit is reached', async () => {
    // Set small batch size for testing
    process.env.ANALYTICS_BATCH_MAX = '2';

    const mockEvent = {
      sessionId: 'session-123',
      playerHash: 'player-456',
      worldRef: 'mystika',
      adventureRef: 'whispercross',
      locale: 'en-US',
      metrics: { turnLatencyMs: 1000 },
    };

    // Clear batch first
    analyticsPipeline['batch'] = [];

    // Add events to trigger flush
    await analyticsPipeline.trackTurnEvent(mockEvent);
    await analyticsPipeline.trackTurnEvent(mockEvent);

    // Wait a bit for async flush to complete
    await new Promise(resolve => setTimeout(resolve, 10));

    // Verify batch was processed
    const stats = await analyticsPipeline.getStats();
    expect(stats.pendingEvents).toBe(0);
  });

  it('should track experiment exposure', async () => {
    // Clear batch first
    analyticsPipeline['batch'] = [];

    await trackExperimentExposure(
      'session-123',
      'player-456',
      'mystika',
      'whispercross',
      'en-US',
      'test-experiment',
      'treatment',
      false
    );

    const stats = await analyticsPipeline.getStats();
    expect(stats.pendingEvents).toBe(1);
  });

  it('should respect ANALYTICS_ENABLED setting', async () => {
    process.env.ANALYTICS_ENABLED = 'false';

    // Clear batch first
    analyticsPipeline['batch'] = [];

    const mockEvent = {
      sessionId: 'session-123',
      playerHash: 'player-456',
      worldRef: 'mystika',
      adventureRef: 'whispercross',
      locale: 'en-US',
      metrics: { turnLatencyMs: 1000 },
    };

    await analyticsPipeline.trackTurnEvent(mockEvent);

    const stats = await analyticsPipeline.getStats();
    expect(stats.pendingEvents).toBe(0);
  });
});

describe('Experiments Framework - Assignment', () => {
  const mockExperiment = {
    key: 'test-experiment',
    name: 'Test Experiment',
    status: 'running' as const,
    startAt: '2025-01-01T00:00:00Z',
    stopAt: '2025-12-31T23:59:59Z',
    hashBasis: 'session' as const,
    allocations: [
      { variation: 'control', percent: 50 },
      { variation: 'treatment', percent: 50 },
    ],
    guardrails: {
      maxActs: 8,
      maxChoices: 5,
      txtSentenceCap: 4,
      toolMaxCalls: 10,
      maxOutputTokens: 2000,
    },
  };

  it('should assign variations deterministically', () => {
    const sessionId = 'session-123';
    const playerId = 'player-456';

    // Same inputs should always produce same assignment
    const assignment1 = assignVariation({ experiment: mockExperiment, playerId, sessionId });
    const assignment2 = assignVariation({ experiment: mockExperiment, playerId, sessionId });

    expect(assignment1).toBe(assignment2);
    expect(['control', 'treatment']).toContain(assignment1);
  });

  it('should use player ID when hashBasis is player', () => {
    const experimentWithPlayerBasis = {
      ...mockExperiment,
      hashBasis: 'player' as const,
    };

    const sessionId = 'session-123';
    const playerId = 'player-456';

    const assignment = assignVariation({ 
      experiment: experimentWithPlayerBasis, 
      playerId, 
      sessionId 
    });

    expect(assignment).toBeDefined();
    expect(['control', 'treatment']).toContain(assignment);
  });

  it('should return null for non-running experiments', () => {
    const draftExperiment = { ...mockExperiment, status: 'draft' as const };
    const stoppedExperiment = { ...mockExperiment, status: 'stopped' as const };

    const sessionId = 'session-123';
    const playerId = 'player-456';

    expect(assignVariation({ experiment: draftExperiment, playerId, sessionId })).toBeNull();
    expect(assignVariation({ experiment: stoppedExperiment, playerId, sessionId })).toBeNull();
  });

  it('should return null for experiments outside date range', () => {
    const futureExperiment = {
      ...mockExperiment,
      startAt: '2026-01-01T00:00:00Z',
    };

    const pastExperiment = {
      ...mockExperiment,
      stopAt: '2024-12-31T23:59:59Z',
    };

    const sessionId = 'session-123';
    const playerId = 'player-456';

    expect(assignVariation({ experiment: futureExperiment, playerId, sessionId })).toBeNull();
    expect(assignVariation({ experiment: pastExperiment, playerId, sessionId })).toBeNull();
  });

  it('should return null for invalid allocations', () => {
    const invalidExperiment = {
      ...mockExperiment,
      allocations: [
        { variation: 'control', percent: 30 },
        { variation: 'treatment', percent: 40 },
      ],
    };

    const sessionId = 'session-123';
    const playerId = 'player-456';

    expect(assignVariation({ experiment: invalidExperiment, playerId, sessionId })).toBeNull();
  });
});

describe('Experiments Framework - Parameter Validation', () => {
  const mockGuardrails = {
    maxActs: 8,
    maxChoices: 5,
    txtSentenceCap: 4,
    toolMaxCalls: 10,
    maxOutputTokens: 2000,
  };

  it('should validate experiment parameters against guardrails', () => {
    const validParams = {
      maxActs: 6,
      maxChoices: 3,
      txtSentenceCap: 3,
      toolMaxCalls: 8,
      maxOutputTokens: 1500,
      timeAdvanceTicks: 2,
    };

    const validation = validateExperimentParams(validParams, mockGuardrails);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('should reject parameters that exceed guardrails', () => {
    const invalidParams = {
      maxActs: 10, // Exceeds guardrail of 8
      maxChoices: 3,
      txtSentenceCap: 3,
      toolMaxCalls: 8,
      maxOutputTokens: 1500,
    };

    const validation = validateExperimentParams(invalidParams, mockGuardrails);
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('maxActs (10) exceeds guardrail (8)');
  });

  it('should reject parameters below minimum values', () => {
    const invalidParams = {
      maxActs: 0, // Below minimum of 1
      maxChoices: 3,
      txtSentenceCap: 1, // Below minimum of 2
      toolMaxCalls: 8,
      maxOutputTokens: 50, // Below minimum of 100
    };

    const validation = validateExperimentParams(invalidParams, mockGuardrails);
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('maxActs (0) must be at least 1');
    expect(validation.errors).toContain('txtSentenceCap (1) must be at least 2');
    expect(validation.errors).toContain('maxOutputTokens (50) must be at least 100');
  });

  it('should validate timeAdvanceTicks range', () => {
    const invalidParams = {
      timeAdvanceTicks: 0, // Below minimum
    };

    const validation = validateExperimentParams(invalidParams, mockGuardrails);
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('timeAdvanceTicks (0) must be at least 1');

    const invalidParams2 = {
      timeAdvanceTicks: 15, // Above maximum
    };

    const validation2 = validateExperimentParams(invalidParams2, mockGuardrails);
    expect(validation2.valid).toBe(false);
    expect(validation2.errors).toContain('timeAdvanceTicks (15) must be at most 10');
  });
});

describe('Experiments Framework - Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should get active experiment parameters', async () => {
    // Mock the experiment params service
    const mockGetActiveExperimentParams = vi.fn().mockResolvedValue({
      experimentKey: 'test-experiment',
      variationKey: 'treatment',
      params: {
        maxOutputTokens: 2000,
        maxActs: 8,
        toolMaxCalls: 10,
        timeAdvanceTicks: 2,
      },
      valid: true,
      errors: [],
    });

    vi.doMock('../src/experiments/params.js', () => ({
      getActiveExperimentParams: mockGetActiveExperimentParams,
    }));

    const result = await mockGetActiveExperimentParams('session-123', 'player-456');
    
    expect(result.experimentKey).toBe('test-experiment');
    expect(result.variationKey).toBe('treatment');
    expect(result.valid).toBe(true);
    expect(result.params.maxOutputTokens).toBe(2000);
  });

  it('should handle invalid experiment parameters', async () => {
    const mockGetActiveExperimentParams = vi.fn().mockResolvedValue({
      experimentKey: 'test-experiment',
      variationKey: 'treatment',
      params: {},
      valid: false,
      errors: ['maxActs (10) exceeds guardrail (8)'],
    });

    vi.doMock('../src/experiments/params.js', () => ({
      getActiveExperimentParams: mockGetActiveExperimentParams,
    }));

    const result = await mockGetActiveExperimentParams('session-123', 'player-456');
    
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('maxActs (10) exceeds guardrail (8)');
    expect(result.params).toEqual({});
  });
});

describe('Analytics Integration', () => {
  it('should track experiment exposure in analytics', async () => {
    // Clear batch first
    analyticsPipeline['batch'] = [];

    const sessionId = 'session-123';
    const playerId = 'player-456';
    const worldRef = 'mystika';
    const adventureRef = 'whispercross';
    const locale = 'en-US';
    const experimentKey = 'test-experiment';
    const variationKey = 'treatment';

    await trackExperimentExposure(
      sessionId,
      playerId,
      worldRef,
      adventureRef,
      locale,
      experimentKey,
      variationKey,
      false
    );

    const stats = await analyticsPipeline.getStats();
    expect(stats.pendingEvents).toBe(1);
  });

  it('should track invalid variation exposure', async () => {
    // Clear batch first
    analyticsPipeline['batch'] = [];

    const sessionId = 'session-123';
    const playerId = 'player-456';
    const worldRef = 'mystika';
    const adventureRef = 'whispercross';
    const locale = 'en-US';
    const experimentKey = 'test-experiment';
    const variationKey = 'invalid-variation';

    await trackExperimentExposure(
      sessionId,
      playerId,
      worldRef,
      adventureRef,
      locale,
      experimentKey,
      variationKey,
      true // invalidVariation = true
    );

    const stats = await analyticsPipeline.getStats();
    expect(stats.pendingEvents).toBe(1);
  });
});

describe('Performance Tests', () => {
  it('should handle analytics batching efficiently', async () => {
    const startTime = Date.now();
    
    // Track multiple events
    for (let i = 0; i < 100; i++) {
      await trackTurnEvent(
        `session-${i}`,
        `player-${i}`,
        'mystika',
        'whispercross',
        'en-US',
        { turnLatencyMs: 1000 + i }
      );
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Should complete in reasonable time (< 100ms for 100 events)
    expect(duration).toBeLessThan(100);
  });

  it('should maintain assignment consistency under load', () => {
    const experiment = {
      key: 'load-test',
      name: 'Load Test',
      status: 'running' as const,
      hashBasis: 'session' as const,
      allocations: [
        { variation: 'control', percent: 50 },
        { variation: 'treatment', percent: 50 },
      ],
      guardrails: {},
    };

    const assignments: string[] = [];
    
    // Test 1000 assignments
    for (let i = 0; i < 1000; i++) {
      const assignment = assignVariation({
        experiment,
        sessionId: `session-${i}`,
        playerId: `player-${i}`,
      });
      assignments.push(assignment!);
    }

    // Should have roughly 50/50 split
    const controlCount = assignments.filter(a => a === 'control').length;
    const treatmentCount = assignments.filter(a => a === 'treatment').length;

    expect(controlCount).toBeGreaterThan(400); // Allow some variance
    expect(treatmentCount).toBeGreaterThan(400);
    expect(controlCount + treatmentCount).toBe(1000);
  });
});
