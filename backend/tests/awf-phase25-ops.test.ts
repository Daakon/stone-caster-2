// Phase 25: Operations System Tests
// Comprehensive tests for rate limits, quotas, backpressure, circuit breakers, and budget guardrails

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        order: vi.fn(() => Promise.resolve({ data: [], error: null }))
      })),
      gte: vi.fn(() => ({
        lte: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      })),
      order: vi.fn(() => Promise.resolve({ data: [], error: null }))
    })),
    insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
    update: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ data: null, error: null }))
    })),
    delete: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ data: null, error: null }))
    }))
  }))
};

// Mock Redis client
const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
  del: vi.fn(),
  pipeline: vi.fn(() => ({
    incr: vi.fn(),
    expire: vi.fn(),
    exec: vi.fn(() => Promise.resolve([]))
  }))
};

// Mock the modules
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase)
}));

vi.mock('redis', () => ({
  createClient: vi.fn(() => mockRedis)
}));

// Mock the ops modules
vi.mock('../src/ops/rate-limit', () => ({
  RateLimitService: vi.fn().mockImplementation(() => ({
    checkRateLimit: vi.fn(),
    checkSlidingWindow: vi.fn(),
    createRateLimit: vi.fn(),
    getRateLimitStatus: vi.fn()
  }))
}));

vi.mock('../src/ops/quotas', () => ({
  QuotaService: vi.fn().mockImplementation(() => ({
    checkQuota: vi.fn(),
    createQuota: vi.fn(),
    getQuotaStatus: vi.fn(),
    refreshQuota: vi.fn()
  }))
}));

vi.mock('../src/ops/backpressure', () => ({
  BackpressureService: vi.fn().mockImplementation(() => ({
    monitorMetrics: vi.fn(),
    createIncident: vi.fn(),
    getBackpressureStatus: vi.fn()
  }))
}));

vi.mock('../src/ops/circuit', () => ({
  CircuitBreakerService: vi.fn().mockImplementation(() => ({
    execute: vi.fn(),
    getCircuitStatus: vi.fn()
  }))
}));

vi.mock('../src/ops/idempotency', () => ({
  IdempotencyService: vi.fn().mockImplementation(() => ({
    generateKey: vi.fn(),
    checkIdempotency: vi.fn(),
    executeWithRetry: vi.fn()
  }))
}));

vi.mock('../src/ops/budget-guard', () => ({
  BudgetGuardService: vi.fn().mockImplementation(() => ({
    checkBudgetStatus: vi.fn(),
    planModelDowngrade: vi.fn(),
    getBudgetStatus: vi.fn()
  }))
}));

// Import the modules after mocking
import { RateLimitService } from '../src/ops/rate-limit';
import { QuotaService } from '../src/ops/quotas';
import { BackpressureService } from '../src/ops/backpressure';
import { CircuitBreakerService } from '../src/ops/circuit';
import { IdempotencyService } from '../src/ops/idempotency';
import { BudgetGuardService } from '../src/ops/budget-guard';

describe('Phase 25: Operations System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rate Limit Service', () => {
    it('should create rate limit service', () => {
      const rateLimitService = new RateLimitService(mockSupabase, mockRedis);
      expect(rateLimitService).toBeDefined();
    });

    it('should check rate limit for user', async () => {
      const rateLimitService = new RateLimitService(mockSupabase, mockRedis);
      
      // Mock Redis response
      mockRedis.get.mockResolvedValue('5');
      mockRedis.incr.mockResolvedValue(6);
      mockRedis.expire.mockResolvedValue('OK');

      const result = await rateLimitService.checkRateLimit('user', 'user123', 10, 60);
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
      expect(mockRedis.get).toHaveBeenCalledWith('rate_limit:user:user123');
    });

    it('should block when rate limit exceeded', async () => {
      const rateLimitService = new RateLimitService(mockSupabase, mockRedis);
      
      // Mock Redis response - already at limit
      mockRedis.get.mockResolvedValue('10');
      mockRedis.incr.mockResolvedValue(11);

      const result = await rateLimitService.checkRateLimit('user', 'user123', 10, 60);
      
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should handle sliding window rate limiting', async () => {
      const rateLimitService = new RateLimitService(mockSupabase, mockRedis);
      
      // Mock Redis pipeline response
      mockRedis.pipeline.mockReturnValue({
        incr: vi.fn(),
        expire: vi.fn(),
        exec: vi.fn(() => Promise.resolve([
          [null, 6], // incr result
          [null, 'OK'] // expire result
        ]))
      });

      const result = await rateLimitService.checkSlidingWindow('user', 'user123', 10, 60);
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it('should create rate limit configuration', async () => {
      const rateLimitService = new RateLimitService(mockSupabase, mockRedis);
      
      mockSupabase.from().insert.mockResolvedValue({ data: { id: 'test-id' }, error: null });

      const config = {
        scope: 'user',
        key: 'test-key',
        window_seconds: 60,
        max_requests: 100,
        burst_allowance: 20
      };

      const result = await rateLimitService.createRateLimit(config);
      
      expect(result.success).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('awf_rate_limits');
    });

    it('should get rate limit status', async () => {
      const rateLimitService = new RateLimitService(mockSupabase, mockRedis);
      
      const mockData = [
        { scope: 'user', key: 'user1', current_count: 5, max_requests: 10 },
        { scope: 'session', key: 'session1', current_count: 8, max_requests: 15 }
      ];
      
      mockSupabase.from().select().order.mockResolvedValue({ data: mockData, error: null });

      const result = await rateLimitService.getRateLimitStatus();
      
      expect(result.success).toBe(true);
      expect(result.data.total_limits).toBe(2);
      expect(result.data.by_scope.user).toBe(1);
      expect(result.data.by_scope.session).toBe(1);
    });
  });

  describe('Quota Service', () => {
    it('should create quota service', () => {
      const quotaService = new QuotaService(mockSupabase, mockRedis);
      expect(quotaService).toBeDefined();
    });

    it('should check quota for user', async () => {
      const quotaService = new QuotaService(mockSupabase, mockRedis);
      
      // Mock Redis response
      mockRedis.get.mockResolvedValue('5');
      mockRedis.incr.mockResolvedValue(6);
      mockRedis.expire.mockResolvedValue('OK');

      const result = await quotaService.checkQuota('user123', 'turns', 10);
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
      expect(mockRedis.get).toHaveBeenCalledWith('quota:user123:turns');
    });

    it('should block when quota exceeded', async () => {
      const quotaService = new QuotaService(mockSupabase, mockRedis);
      
      // Mock Redis response - already at limit
      mockRedis.get.mockResolvedValue('10');
      mockRedis.incr.mockResolvedValue(11);

      const result = await quotaService.checkQuota('user123', 'turns', 10);
      
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should create quota configuration', async () => {
      const quotaService = new QuotaService(mockSupabase, mockRedis);
      
      mockSupabase.from().insert.mockResolvedValue({ data: { id: 'test-id' }, error: null });

      const config = {
        user_hash: 'user123',
        daily_turn_cap: 100,
        tool_cap: 50,
        bytes_cap: 1000000
      };

      const result = await quotaService.createQuota(config);
      
      expect(result.success).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('awf_quotas');
    });

    it('should get quota status', async () => {
      const quotaService = new QuotaService(mockSupabase, mockRedis);
      
      const mockData = [
        { user_hash: 'user1', daily_turn_cap: 100, tool_cap: 50, bytes_cap: 1000000 },
        { user_hash: 'user2', daily_turn_cap: 200, tool_cap: 100, bytes_cap: 2000000 }
      ];
      
      mockSupabase.from().select().order.mockResolvedValue({ data: mockData, error: null });

      const result = await quotaService.getQuotaStatus();
      
      expect(result.success).toBe(true);
      expect(result.data.total_quotas).toBe(2);
      expect(result.data.by_type.turns.total_cap).toBe(300);
    });

    it('should handle quota refresh', async () => {
      const quotaService = new QuotaService(mockSupabase, mockRedis);
      
      mockRedis.del.mockResolvedValue(1);
      mockSupabase.from().update().eq.mockResolvedValue({ data: null, error: null });

      const result = await quotaService.refreshQuota('user123');
      
      expect(result.success).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith('quota:user123:turns');
      expect(mockRedis.del).toHaveBeenCalledWith('quota:user123:tools');
      expect(mockRedis.del).toHaveBeenCalledWith('quota:user123:bytes');
    });
  });

  describe('Backpressure Service', () => {
    it('should create backpressure service', () => {
      const backpressureService = new BackpressureService(mockSupabase, mockRedis);
      expect(backpressureService).toBeDefined();
    });

    it('should monitor system metrics', async () => {
      const backpressureService = new BackpressureService(mockSupabase, mockRedis);
      
      // Mock metrics data
      const mockMetrics = {
        model_latency_p95: 800,
        token_queue_depth: 100,
        error_rate: 0.05,
        throughput: 150
      };

      const result = await backpressureService.monitorMetrics(mockMetrics);
      
      expect(result.success).toBe(true);
      expect(result.data.metrics).toEqual(mockMetrics);
    });

    it('should trigger backpressure when thresholds exceeded', async () => {
      const backpressureService = new BackpressureService(mockSupabase, mockRedis);
      
      // Mock high latency scenario
      const mockMetrics = {
        model_latency_p95: 2000, // Exceeds threshold
        token_queue_depth: 500,  // Exceeds threshold
        error_rate: 0.1,
        throughput: 50
      };

      mockSupabase.from().insert.mockResolvedValue({ data: { id: 'incident-id' }, error: null });

      const result = await backpressureService.monitorMetrics(mockMetrics);
      
      expect(result.success).toBe(true);
      expect(result.data.actions_taken).toContain('reduce_input_tokens');
      expect(result.data.actions_taken).toContain('disable_tool_calls');
    });

    it('should create incident when backpressure triggered', async () => {
      const backpressureService = new BackpressureService(mockSupabase, mockRedis);
      
      mockSupabase.from().insert.mockResolvedValue({ data: { id: 'incident-id' }, error: null });

      const incident = {
        severity: 'high' as const,
        scope: 'model',
        metric: 'latency_p95',
        observed_value: 2000,
        threshold_value: 1000,
        suggested_actions: ['reduce_input_tokens', 'disable_tool_calls']
      };

      const result = await backpressureService.createIncident(incident);
      
      expect(result.success).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('awf_incidents');
    });

    it('should get backpressure status', async () => {
      const backpressureService = new BackpressureService(mockSupabase, mockRedis);
      
      const mockData = {
        active_metrics: 5,
        total_actions: 10
      };
      
      mockSupabase.from().select().order.mockResolvedValue({ data: [mockData], error: null });

      const result = await backpressureService.getBackpressureStatus();
      
      expect(result.success).toBe(true);
      expect(result.data.active_metrics).toBe(5);
      expect(result.data.total_actions).toBe(10);
    });
  });

  describe('Circuit Breaker Service', () => {
    it('should create circuit breaker service', () => {
      const circuitService = new CircuitBreakerService(mockSupabase, mockRedis);
      expect(circuitService).toBeDefined();
    });

    it('should execute with circuit breaker protection', async () => {
      const circuitService = new CircuitBreakerService(mockSupabase, mockRedis);
      
      const mockOperation = vi.fn().mockResolvedValue('success');
      
      const result = await circuitService.execute('test-service', mockOperation);
      
      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
      expect(mockOperation).toHaveBeenCalled();
    });

    it('should open circuit on repeated failures', async () => {
      const circuitService = new CircuitBreakerService(mockSupabase, mockRedis);
      
      const mockOperation = vi.fn().mockRejectedValue(new Error('Service unavailable'));
      
      // Execute multiple times to trigger circuit opening
      for (let i = 0; i < 5; i++) {
        try {
          await circuitService.execute('test-service', mockOperation);
        } catch (error) {
          // Expected to fail
        }
      }

      // Circuit should now be open
      const result = await circuitService.execute('test-service', mockOperation);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Circuit breaker is open');
    });

    it('should handle half-open state', async () => {
      const circuitService = new CircuitBreakerService(mockSupabase, mockRedis);
      
      // Mock circuit in half-open state
      mockRedis.get.mockResolvedValue('half-open');
      
      const mockOperation = vi.fn().mockResolvedValue('success');
      
      const result = await circuitService.execute('test-service', mockOperation);
      
      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
    });

    it('should get circuit breaker status', async () => {
      const circuitService = new CircuitBreakerService(mockSupabase, mockRedis);
      
      const mockData = [
        { service_name: 'model', state: 'closed', failure_count: 0 },
        { service_name: 'redis', state: 'open', failure_count: 5 },
        { service_name: 'database', state: 'half-open', failure_count: 2 }
      ];
      
      mockSupabase.from().select().order.mockResolvedValue({ data: mockData, error: null });

      const result = await circuitService.getCircuitStatus();
      
      expect(result.success).toBe(true);
      expect(result.data.total_circuits).toBe(3);
      expect(result.data.by_state.open).toBe(1);
      expect(result.data.by_state.closed).toBe(1);
      expect(result.data.by_state.half_open).toBe(1);
    });
  });

  describe('Idempotency Service', () => {
    it('should create idempotency service', () => {
      const idempotencyService = new IdempotencyService(mockSupabase, mockRedis);
      expect(idempotencyService).toBeDefined();
    });

    it('should generate idempotency key', () => {
      const idempotencyService = new IdempotencyService(mockSupabase, mockRedis);
      
      const key = idempotencyService.generateKey('user123', 'turn-456');
      
      expect(key).toBeDefined();
      expect(key).toContain('user123');
      expect(key).toContain('turn-456');
    });

    it('should check idempotency', async () => {
      const idempotencyService = new IdempotencyService(mockSupabase, mockRedis);
      
      // Mock Redis response - key doesn't exist
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.expire.mockResolvedValue('OK');

      const result = await idempotencyService.checkIdempotency('test-key', 300);
      
      expect(result.success).toBe(true);
      expect(result.data.is_duplicate).toBe(false);
      expect(mockRedis.set).toHaveBeenCalledWith('idempotency:test-key', expect.any(String));
    });

    it('should detect duplicate request', async () => {
      const idempotencyService = new IdempotencyService(mockSupabase, mockRedis);
      
      // Mock Redis response - key exists
      mockRedis.get.mockResolvedValue('existing-value');

      const result = await idempotencyService.checkIdempotency('test-key', 300);
      
      expect(result.success).toBe(true);
      expect(result.data.is_duplicate).toBe(true);
      expect(result.data.cached_result).toBe('existing-value');
    });

    it('should execute with retry logic', async () => {
      const idempotencyService = new IdempotencyService(mockSupabase, mockRedis);
      
      const mockOperation = vi.fn()
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValue('success');

      const result = await idempotencyService.executeWithRetry(
        'test-key',
        mockOperation,
        { max_attempts: 3, base_delay_ms: 100 }
      );
      
      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });

    it('should handle retry exhaustion', async () => {
      const idempotencyService = new IdempotencyService(mockSupabase, mockRedis);
      
      const mockOperation = vi.fn().mockRejectedValue(new Error('Persistent failure'));

      const result = await idempotencyService.executeWithRetry(
        'test-key',
        mockOperation,
        { max_attempts: 2, base_delay_ms: 10 }
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Max retry attempts exceeded');
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });
  });

  describe('Budget Guard Service', () => {
    it('should create budget guard service', () => {
      const budgetService = new BudgetGuardService(mockSupabase, mockRedis);
      expect(budgetService).toBeDefined();
    });

    it('should check budget status', async () => {
      const budgetService = new BudgetGuardService(mockSupabase, mockRedis);
      
      const mockBudgetData = {
        current_month: '2025-01',
        budget_usd: 10000,
        spent_usd: 5000,
        remaining_usd: 5000,
        spend_ratio: 0.5,
        status: 'healthy' as const
      };

      const result = await budgetService.checkBudgetStatus(mockBudgetData);
      
      expect(result.success).toBe(true);
      expect(result.data.status).toBe('healthy');
      expect(result.data.spend_ratio).toBe(0.5);
    });

    it('should trigger budget alert when threshold exceeded', async () => {
      const budgetService = new BudgetGuardService(mockSupabase, mockRedis);
      
      const mockBudgetData = {
        current_month: '2025-01',
        budget_usd: 10000,
        spent_usd: 8500, // 85% used
        remaining_usd: 1500,
        spend_ratio: 0.85,
        status: 'warning' as const
      };

      mockSupabase.from().insert.mockResolvedValue({ data: { id: 'alert-id' }, error: null });

      const result = await budgetService.checkBudgetStatus(mockBudgetData);
      
      expect(result.success).toBe(true);
      expect(result.data.status).toBe('warning');
      expect(result.data.alerts_triggered).toContain('budget_warning');
    });

    it('should trigger hard stop when budget exceeded', async () => {
      const budgetService = new BudgetGuardService(mockSupabase, mockRedis);
      
      const mockBudgetData = {
        current_month: '2025-01',
        budget_usd: 10000,
        spent_usd: 10100, // Exceeded budget
        remaining_usd: -100,
        spend_ratio: 1.01,
        status: 'critical' as const
      };

      mockSupabase.from().insert.mockResolvedValue({ data: { id: 'alert-id' }, error: null });

      const result = await budgetService.checkBudgetStatus(mockBudgetData);
      
      expect(result.success).toBe(true);
      expect(result.data.status).toBe('critical');
      expect(result.data.alerts_triggered).toContain('budget_exceeded');
      expect(result.data.hard_stop).toBe(true);
    });

    it('should plan model downgrade', async () => {
      const budgetService = new BudgetGuardService(mockSupabase, mockRedis);
      
      const mockBudgetData = {
        current_month: '2025-01',
        budget_usd: 10000,
        spent_usd: 8000, // 80% used
        remaining_usd: 2000,
        spend_ratio: 0.8,
        status: 'warning' as const
      };

      const result = await budgetService.planModelDowngrade(mockBudgetData);
      
      expect(result.success).toBe(true);
      expect(result.data.downgrade_planned).toBe(true);
      expect(result.data.target_model).toBe('gpt-4o-mini');
      expect(result.data.estimated_savings).toBeGreaterThan(0);
    });

    it('should get budget status', async () => {
      const budgetService = new BudgetGuardService(mockSupabase, mockRedis);
      
      const mockData = {
        current_month: '2025-01',
        budget_usd: 10000,
        spent_usd: 5000,
        remaining_usd: 5000,
        spend_ratio: 0.5,
        status: 'healthy'
      };
      
      mockSupabase.from().select().order.mockResolvedValue({ data: [mockData], error: null });

      const result = await budgetService.getBudgetStatus();
      
      expect(result.success).toBe(true);
      expect(result.data.current_month).toBe('2025-01');
      expect(result.data.budget_usd).toBe(10000);
      expect(result.data.spent_usd).toBe(5000);
    });
  });

  describe('Integration Tests', () => {
    it('should handle rate limit with quota integration', async () => {
      const rateLimitService = new RateLimitService(mockSupabase, mockRedis);
      const quotaService = new QuotaService(mockSupabase, mockRedis);
      
      // Mock successful rate limit check
      mockRedis.get.mockResolvedValue('5');
      mockRedis.incr.mockResolvedValue(6);
      mockRedis.expire.mockResolvedValue('OK');

      const rateLimitResult = await rateLimitService.checkRateLimit('user', 'user123', 10, 60);
      expect(rateLimitResult.allowed).toBe(true);

      // Mock successful quota check
      const quotaResult = await quotaService.checkQuota('user123', 'turns', 10);
      expect(quotaResult.allowed).toBe(true);
    });

    it('should handle backpressure with circuit breaker integration', async () => {
      const backpressureService = new BackpressureService(mockSupabase, mockRedis);
      const circuitService = new CircuitBreakerService(mockSupabase, mockRedis);
      
      // Mock high latency scenario
      const mockMetrics = {
        model_latency_p95: 2000,
        token_queue_depth: 500,
        error_rate: 0.1,
        throughput: 50
      };

      mockSupabase.from().insert.mockResolvedValue({ data: { id: 'incident-id' }, error: null });

      const backpressureResult = await backpressureService.monitorMetrics(mockMetrics);
      expect(backpressureResult.success).toBe(true);
      expect(backpressureResult.data.actions_taken).toContain('reduce_input_tokens');

      // Mock circuit breaker opening due to failures
      const mockOperation = vi.fn().mockRejectedValue(new Error('Service unavailable'));
      
      const circuitResult = await circuitService.execute('model', mockOperation);
      expect(circuitResult.success).toBe(false);
    });

    it('should handle budget guard with model downgrade', async () => {
      const budgetService = new BudgetGuardService(mockSupabase, mockRedis);
      
      const mockBudgetData = {
        current_month: '2025-01',
        budget_usd: 10000,
        spent_usd: 8000, // 80% used
        remaining_usd: 2000,
        spend_ratio: 0.8,
        status: 'warning' as const
      };

      const budgetResult = await budgetService.checkBudgetStatus(mockBudgetData);
      expect(budgetResult.success).toBe(true);
      expect(budgetResult.data.status).toBe('warning');

      const downgradeResult = await budgetService.planModelDowngrade(mockBudgetData);
      expect(downgradeResult.success).toBe(true);
      expect(downgradeResult.data.downgrade_planned).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle Redis connection errors', async () => {
      const rateLimitService = new RateLimitService(mockSupabase, mockRedis);
      
      // Mock Redis connection error
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));

      const result = await rateLimitService.checkRateLimit('user', 'user123', 10, 60);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Redis connection failed');
    });

    it('should handle database connection errors', async () => {
      const quotaService = new QuotaService(mockSupabase, mockRedis);
      
      // Mock database error
      mockSupabase.from().insert.mockResolvedValue({ data: null, error: { message: 'Database connection failed' } });

      const config = {
        user_hash: 'user123',
        daily_turn_cap: 100,
        tool_cap: 50,
        bytes_cap: 1000000
      };

      const result = await quotaService.createQuota(config);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Database connection failed');
    });

    it('should handle invalid configuration', async () => {
      const rateLimitService = new RateLimitService(mockSupabase, mockRedis);
      
      const invalidConfig = {
        scope: '', // Invalid empty scope
        key: 'test-key',
        window_seconds: -1, // Invalid negative window
        max_requests: 0, // Invalid zero requests
        burst_allowance: -1 // Invalid negative burst
      };

      const result = await rateLimitService.createRateLimit(invalidConfig);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid configuration');
    });
  });

  describe('Performance Tests', () => {
    it('should handle high concurrent rate limit checks', async () => {
      const rateLimitService = new RateLimitService(mockSupabase, mockRedis);
      
      // Mock Redis responses for concurrent requests
      mockRedis.get.mockResolvedValue('5');
      mockRedis.incr.mockResolvedValue(6);
      mockRedis.expire.mockResolvedValue('OK');

      const promises = Array.from({ length: 100 }, (_, i) => 
        rateLimitService.checkRateLimit('user', `user${i}`, 10, 60)
      );

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(100);
      expect(results.every(result => result.success)).toBe(true);
    });

    it('should handle high concurrent quota checks', async () => {
      const quotaService = new QuotaService(mockSupabase, mockRedis);
      
      // Mock Redis responses for concurrent requests
      mockRedis.get.mockResolvedValue('5');
      mockRedis.incr.mockResolvedValue(6);
      mockRedis.expire.mockResolvedValue('OK');

      const promises = Array.from({ length: 100 }, (_, i) => 
        quotaService.checkQuota(`user${i}`, 'turns', 10)
      );

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(100);
      expect(results.every(result => result.success)).toBe(true);
    });
  });
});
