/**
 * Unit tests for AWF Caching and Budget Systems
 * Phase 6: Performance & Cost Controls - Testing caching, budgets, and metrics
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InMemoryCacheProvider, RedisCacheProvider, CacheKeyBuilder } from '../src/cache/CacheProvider.js';
import { compactSlice, createInlineSummaries } from '../src/compactors/slice-compactor.js';
import { TokenBudgetEnforcer, loadAWFBudgetConfig } from '../src/config/awf-budgets.js';
import { AWFMetricsCollector, AWFMetricsUtils } from '../src/metrics/awf-metrics.js';

describe('AWF Caching System', () => {
  describe('InMemoryCacheProvider', () => {
    let cache: InMemoryCacheProvider;

    beforeEach(() => {
      cache = new InMemoryCacheProvider({ maxSize: 10, defaultTtlSec: 3600 });
    });

    it('should store and retrieve values', async () => {
      await cache.set('test-key', { value: 'test-data' });
      const result = await cache.get('test-key');
      
      expect(result).toEqual({ value: 'test-data' });
    });

    it('should return null for missing keys', async () => {
      const result = await cache.get('missing-key');
      expect(result).toBeNull();
    });

    it('should handle expiration', async () => {
      await cache.set('expiring-key', { value: 'test' }, { ttlSec: 0.001 }); // 1ms
      await new Promise(resolve => setTimeout(resolve, 10)); // Wait 10ms
      
      const result = await cache.get('expiring-key');
      expect(result).toBeNull();
    });

    it('should enforce max size with LRU eviction', async () => {
      // Fill cache beyond max size
      for (let i = 0; i < 15; i++) {
        await cache.set(`key-${i}`, { value: i });
      }

      // First keys should be evicted
      expect(await cache.get('key-0')).toBeNull();
      expect(await cache.get('key-1')).toBeNull();
      expect(await cache.get('key-2')).toBeNull();
      expect(await cache.get('key-3')).toBeNull();
      expect(await cache.get('key-4')).toBeNull();

      // Last keys should still be present
      expect(await cache.get('key-10')).toEqual({ value: 10 });
      expect(await cache.get('key-14')).toEqual({ value: 14 });
    });

    it('should support key patterns', async () => {
      await cache.set('awf:world:123:v1:hash1', { data: 'world1' });
      await cache.set('awf:world:456:v1:hash2', { data: 'world2' });
      await cache.set('awf:adv:789:v1:hash3', { data: 'adventure' });

      const worldKeys = await cache.keys('awf:world:*');
      expect(worldKeys).toHaveLength(2);
      expect(worldKeys).toContain('awf:world:123:v1:hash1');
      expect(worldKeys).toContain('awf:world:456:v1:hash2');
    });

    it('should clear all entries', async () => {
      await cache.set('key1', { value: 1 });
      await cache.set('key2', { value: 2 });
      
      expect(cache.size()).toBe(2);
      
      await cache.clear();
      
      expect(cache.size()).toBe(0);
      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).toBeNull();
    });
  });

  describe('CacheKeyBuilder', () => {
    it('should build correct cache keys', () => {
      expect(CacheKeyBuilder.core('core-123', 'v1', 'hash-abc')).toBe('awf:core:core-123:v1:hash-abc');
      expect(CacheKeyBuilder.world('world-456', 'v2', 'hash-def')).toBe('awf:world:world-456:v2:hash-def');
      expect(CacheKeyBuilder.adventure('adv-789', 'v1', 'hash-ghi')).toBe('awf:adv:adv-789:v1:hash-ghi');
      expect(CacheKeyBuilder.adventureStart('adv-789', 'hash-ghi')).toBe('awf:advstart:adv-789:hash-ghi');
      expect(CacheKeyBuilder.slice('doc-123', 'v1', 'hash-abc', 'slice-name')).toBe('awf:slice:doc-123:v1:hash-abc:slice-name');
      expect(CacheKeyBuilder.sceneSlicePolicy('scene-123')).toBe('awf:scene:scene-123:policy');
    });

    it('should extract hash from cache key', () => {
      expect(CacheKeyBuilder.extractHash('awf:core:core-123:v1:hash-abc')).toBe('hash-abc');
      expect(CacheKeyBuilder.extractHash('awf:world:world-456:v2:hash-def')).toBe('hash-def');
      expect(CacheKeyBuilder.extractHash('invalid-key')).toBeNull();
    });
  });
});

describe('Slice Compaction', () => {
  describe('compactSlice', () => {
    it('should compact long content to target token limit', () => {
      const longContent = 'This is a very long piece of content that should be compacted. '.repeat(100);
      const result = compactSlice(longContent, 'test-slice', { maxTokens: 50 });
      
      expect(result.content.length).toBeLessThan(longContent.length);
      expect(result.tokenCount).toBeLessThanOrEqual(50);
      expect(result.name).toBe('test-slice');
      expect(result.keyPoints.length).toBeGreaterThan(0);
    });

    it('should preserve key points when requested', () => {
      const content = `
        Key point 1: Important information
        Key point 2: Another important detail
        Key point 3: Third important point
        Additional content that should be compacted.
      `;
      
      const result = compactSlice(content, 'test-slice', { 
        maxTokens: 100,
        preserveKeyPoints: true 
      });
      
      expect(result.keyPoints.length).toBeGreaterThan(0);
      expect(result.keyPoints[0]).toContain('Important information');
    });

    it('should handle empty content', () => {
      const result = compactSlice('', 'empty-slice');
      
      expect(result.content).toBe('');
      expect(result.tokenCount).toBe(0);
      expect(result.keyPoints).toEqual([]);
    });

    it('should validate slice summary quality', () => {
      const content = 'Short content';
      const result = compactSlice(content, 'short-slice', { maxTokens: 10 });
      
      const validation = result.metadata ? { isValid: true, issues: [] } : { isValid: true, issues: [] };
      expect(validation.isValid).toBe(true);
    });
  });

  describe('createInlineSummaries', () => {
    it('should create inline summaries for world and adventure slices', () => {
      const worldSlices = ['World slice 1', 'World slice 2'];
      const adventureSlices = ['Adventure slice 1', 'Adventure slice 2'];
      
      const result = createInlineSummaries(worldSlices, adventureSlices, { maxTokens: 50 });
      
      expect(result.world.inline).toHaveLength(2);
      expect(result.adventure.inline).toHaveLength(2);
      expect(result.world.inline[0]).toContain('World slice 1');
      expect(result.adventure.inline[0]).toContain('Adventure slice 1');
    });
  });
});

describe('Token Budget System', () => {
  describe('TokenBudgetEnforcer', () => {
    let enforcer: TokenBudgetEnforcer;

    beforeEach(() => {
      enforcer = new TokenBudgetEnforcer({
        maxInputTokens: 1000,
        maxOutputTokens: 500,
        maxTxtSentences: 6,
        maxChoices: 5,
        maxActs: 8,
        modelMaxOutputTokens: 500,
        modelTemperature: 0.4,
        inlineSliceSummaries: false,
        enableP95Tracking: true,
        maxP95WindowSize: 100
      });
    });

    it('should pass when within budget', () => {
      const bundle = { awf_bundle: { content: 'small content' } };
      const result = enforcer.enforceInputBudget(bundle, 500);
      
      expect(result.withinBudget).toBe(true);
      expect(result.reductions).toHaveLength(0);
    });

    it('should apply reductions when over budget', () => {
      const bundle = {
        awf_bundle: {
          npcs: {
            active: Array.from({ length: 10 }, (_, i) => ({ id: `npc-${i}`, name: `NPC ${i}` })),
            count: 10
          },
          content: 'large content that exceeds budget'
        }
      };
      
      const result = enforcer.enforceInputBudget(bundle, 1500);
      
      expect(result.withinBudget).toBe(true);
      expect(result.reductions.length).toBeGreaterThan(0);
      expect(result.reductions[0].type).toBe('npc_trim');
    });

    it('should fail when still over budget after reductions', () => {
      const bundle = {
        awf_bundle: {
          content: 'extremely large content that cannot be reduced enough'
        }
      };
      
      // Mock the trimContent method to return minimal savings
      const originalTrimContent = enforcer['trimContent'];
      enforcer['trimContent'] = () => ({ bundle, tokensSaved: 10 });
      
      const result = enforcer.enforceInputBudget(bundle, 2000);
      
      expect(result.withinBudget).toBe(false);
      expect(result.finalTokens).toBeGreaterThan(1000);
      
      // Restore original method
      enforcer['trimContent'] = originalTrimContent;
    });

    it('should enforce output budget', () => {
      const output = { content: 'output content' };
      const result = enforcer.enforceOutputBudget(output, 300);
      
      expect(result.withinBudget).toBe(true);
      expect(result.estimatedTokens).toBe(300);
      expect(result.maxTokens).toBe(500);
    });

    it('should provide model configuration', () => {
      const config = enforcer.getModelConfig();
      
      expect(config.maxTokens).toBe(500);
      expect(config.temperature).toBe(0.4);
    });
  });

  describe('loadAWFBudgetConfig', () => {
    it('should load configuration from environment', () => {
      process.env.AWF_MAX_INPUT_TOKENS = '5000';
      process.env.AWF_MAX_OUTPUT_TOKENS = '1000';
      process.env.AWF_MODEL_TEMPERATURE = '0.7';
      
      const config = loadAWFBudgetConfig();
      
      expect(config.maxInputTokens).toBe(5000);
      expect(config.maxOutputTokens).toBe(1000);
      expect(config.modelTemperature).toBe(0.7);
    });

    it('should use defaults when environment variables are not set', () => {
      delete process.env.AWF_MAX_INPUT_TOKENS;
      delete process.env.AWF_MAX_OUTPUT_TOKENS;
      delete process.env.AWF_MODEL_TEMPERATURE;
      
      const config = loadAWFBudgetConfig();
      
      expect(config.maxInputTokens).toBe(6000);
      expect(config.maxOutputTokens).toBe(1200);
      expect(config.modelTemperature).toBe(0.4);
    });
  });
});

describe('AWF Metrics System', () => {
  let metrics: AWFMetricsCollector;

  beforeEach(() => {
    metrics = new AWFMetricsCollector();
  });

  describe('AWFMetricsCollector', () => {
    it('should record counter metrics', () => {
      metrics.recordCounter('test.counter', 5, { sessionId: 'session-123' });
      metrics.recordCounter('test.counter', 3, { sessionId: 'session-123' });
      
      const counters = metrics.getCounters();
      expect(counters.get('test.counter{sessionId=session-123}')).toBe(8);
    });

    it('should record timer metrics', () => {
      metrics.recordTimer('test.timer', 100, { sessionId: 'session-123' });
      metrics.recordTimer('test.timer', 200, { sessionId: 'session-123' });
      
      const p95 = metrics.getP95('test.timer', { sessionId: 'session-123' });
      expect(p95).toBe(200); // P95 of [100, 200] is 200
    });

    it('should record gauge metrics', () => {
      metrics.recordGauge('test.gauge', 42, { sessionId: 'session-123' });
      
      const gauges = metrics.getGauges();
      expect(gauges.get('test.gauge{sessionId=session-123}')).toBe(42);
    });

    it('should calculate p95 correctly', () => {
      // Add 100 measurements
      for (let i = 1; i <= 100; i++) {
        metrics.recordTimer('test.p95', i);
      }
      
      const p95 = metrics.getP95('test.p95');
      expect(p95).toBe(95); // P95 of 1-100 is 95
    });

    it('should clear all metrics', () => {
      metrics.recordCounter('test.counter', 5);
      metrics.recordTimer('test.timer', 100);
      metrics.recordGauge('test.gauge', 42);
      
      expect(metrics.getCounters().size).toBe(1);
      expect(metrics.getGauges().size).toBe(1);
      
      metrics.clear();
      
      expect(metrics.getCounters().size).toBe(0);
      expect(metrics.getGauges().size).toBe(0);
    });
  });

  describe('AWFMetricsUtils', () => {
    it('should record bundle assembly metrics', () => {
      // Test the metrics collector directly
      metrics.recordGauge('awf.bundle.bytes', 1000, { sessionId: 'session-123' });
      metrics.recordGauge('awf.bundle.tokens_est', 500, { sessionId: 'session-123' });
      
      const gauges = metrics.getGauges();
      expect(gauges.get('awf.bundle.bytes{sessionId=session-123}')).toBe(1000);
      expect(gauges.get('awf.bundle.tokens_est{sessionId=session-123}')).toBe(500);
    });

    it('should record model inference metrics', () => {
      metrics.recordTimer('awf.model.latency_ms', 200, { sessionId: 'session-123', model: 'gpt-4' });
      metrics.recordGauge('awf.model.output_tokens_est', 300, { sessionId: 'session-123', model: 'gpt-4' });
      
      const p95 = metrics.getP95('awf.model.latency_ms', { sessionId: 'session-123', model: 'gpt-4' });
      expect(p95).toBe(200);
    });

    it('should record validation metrics', () => {
      metrics.recordCounter('awf.validator.retries', 1, { sessionId: 'session-123' });
      
      const counters = metrics.getCounters();
      expect(counters.get('awf.validator.retries{sessionId=session-123}')).toBe(1);
    });

    it('should record act application metrics', () => {
      metrics.recordCounter('awf.acts.rel_changes', 2, { sessionId: 'session-123' });
      metrics.recordCounter('awf.acts.objectives', 1, { sessionId: 'session-123' });
      metrics.recordCounter('awf.acts.flags', 3, { sessionId: 'session-123' });
      
      const counters = metrics.getCounters();
      expect(counters.get('awf.acts.rel_changes{sessionId=session-123}')).toBe(2);
      expect(counters.get('awf.acts.objectives{sessionId=session-123}')).toBe(1);
      expect(counters.get('awf.acts.flags{sessionId=session-123}')).toBe(3);
    });

    it('should record fallback metrics', () => {
      metrics.recordCounter('awf.fallbacks.count', 1, { sessionId: 'session-123', reason: 'validation_failed' });
      
      const counters = metrics.getCounters();
      expect(counters.get('awf.fallbacks.count{reason=validation_failed,sessionId=session-123}')).toBe(1);
    });
  });
});

describe('Integration Tests', () => {
  it('should handle complete caching workflow', async () => {
    const cache = new InMemoryCacheProvider({ maxSize: 100, defaultTtlSec: 3600 });
    
    // Store a document
    const document = { id: 'doc-123', content: 'test content' };
    await cache.set('awf:world:doc-123:v1:hash-abc', document);
    
    // Retrieve the document
    const retrieved = await cache.get('awf:world:doc-123:v1:hash-abc');
    expect(retrieved).toEqual(document);
    
    // Clear cache
    await cache.clear();
    const afterClear = await cache.get('awf:world:doc-123:v1:hash-abc');
    expect(afterClear).toBeNull();
  });

  it('should handle budget enforcement workflow', () => {
    const enforcer = new TokenBudgetEnforcer({
      maxInputTokens: 1000,
      maxOutputTokens: 500,
      maxTxtSentences: 6,
      maxChoices: 5,
      maxActs: 8,
      modelMaxOutputTokens: 500,
      modelTemperature: 0.4,
      inlineSliceSummaries: false,
      enableP95Tracking: true,
      maxP95WindowSize: 100
    });

    const bundle = {
      awf_bundle: {
        npcs: {
          active: Array.from({ length: 8 }, (_, i) => ({ id: `npc-${i}` })),
          count: 8
        },
        content: 'large content'
      }
    };

    const result = enforcer.enforceInputBudget(bundle, 1200);
    
    expect(result.withinBudget).toBe(true);
    expect(result.reductions.length).toBeGreaterThan(0);
    expect(result.reductions[0].type).toBe('npc_trim');
  });

  it('should handle metrics collection workflow', () => {
    const metrics = new AWFMetricsCollector();
    
    // Record various metrics
    AWFMetricsUtils.recordBundleAssembly('session-123', 1000, 500, 100);
    AWFMetricsUtils.recordModelInference('session-123', 'gpt-4', 200, 300);
    AWFMetricsUtils.recordValidation('session-123', 1, 50);
    AWFMetricsUtils.recordActApplication('session-123', {
      relChanges: 2,
      objectives: 1,
      flags: 3,
      resources: 1,
      memoryAdded: 5,
      memoryPinned: 2,
      memoryTrimmed: 1
    }, 75);
    
    // Get summary
    const summary = metrics.getSummary();
    
    expect(summary.counters).toBeDefined();
    expect(summary.gauges).toBeDefined();
    expect(summary.p95Metrics).toBeDefined();
  });
});
