import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MetricsService } from './metrics.service.js';

describe('MetricsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset metrics state before each test
    MetricsService.reset();
  });

  describe('recordRequest', () => {
    it('should record request metrics', () => {
      MetricsService.recordRequest({
        route: '/api/test',
        method: 'GET',
        statusCode: 200,
        latencyMs: 150,
      });

      const snapshot = MetricsService.getSnapshot();
      expect(snapshot.requestCounts['GET /api/test']).toBe(1);
      expect(snapshot.averageLatencies['GET /api/test']).toBe(150);
      expect(snapshot.totalRequests).toBe(1);
      expect(snapshot.totalErrors).toBe(0);
    });

    it('should record multiple requests and calculate average latency', () => {
      MetricsService.recordRequest({
        route: '/api/test',
        method: 'GET',
        statusCode: 200,
        latencyMs: 100,
      });

      MetricsService.recordRequest({
        route: '/api/test',
        method: 'GET',
        statusCode: 200,
        latencyMs: 200,
      });

      const snapshot = MetricsService.getSnapshot();
      expect(snapshot.requestCounts['GET /api/test']).toBe(2);
      expect(snapshot.averageLatencies['GET /api/test']).toBe(150); // (100 + 200) / 2
      expect(snapshot.totalRequests).toBe(2);
    });

    it('should record error requests', () => {
      MetricsService.recordRequest({
        route: '/api/test',
        method: 'POST',
        statusCode: 400,
        latencyMs: 50,
        errorCode: 'VALIDATION_FAILED',
      });

      const snapshot = MetricsService.getSnapshot();
      expect(snapshot.requestCounts['POST /api/test']).toBe(1);
      expect(snapshot.errorCounts['VALIDATION_FAILED']).toBe(1);
      expect(snapshot.totalRequests).toBe(1);
      expect(snapshot.totalErrors).toBe(1);
    });

    it('should handle different routes separately', () => {
      MetricsService.recordRequest({
        route: '/api/test1',
        method: 'GET',
        statusCode: 200,
        latencyMs: 100,
      });

      MetricsService.recordRequest({
        route: '/api/test2',
        method: 'POST',
        statusCode: 201,
        latencyMs: 200,
      });

      const snapshot = MetricsService.getSnapshot();
      expect(snapshot.requestCounts['GET /api/test1']).toBe(1);
      expect(snapshot.requestCounts['POST /api/test2']).toBe(1);
      expect(snapshot.averageLatencies['GET /api/test1']).toBe(100);
      expect(snapshot.averageLatencies['POST /api/test2']).toBe(200);
      expect(snapshot.totalRequests).toBe(2);
    });

    it('should handle different HTTP methods for same route', () => {
      MetricsService.recordRequest({
        route: '/api/users',
        method: 'GET',
        statusCode: 200,
        latencyMs: 100,
      });

      MetricsService.recordRequest({
        route: '/api/users',
        method: 'POST',
        statusCode: 201,
        latencyMs: 200,
      });

      const snapshot = MetricsService.getSnapshot();
      expect(snapshot.requestCounts['GET /api/users']).toBe(1);
      expect(snapshot.requestCounts['POST /api/users']).toBe(1);
      expect(snapshot.totalRequests).toBe(2);
    });
  });

  describe('recordError', () => {
    it('should record error metrics', () => {
      MetricsService.recordError({
        route: '/api/test',
        method: 'POST',
        errorCode: 'VALIDATION_FAILED',
        errorMessage: 'Invalid input',
      });

      const snapshot = MetricsService.getSnapshot();
      expect(snapshot.errorCounts['VALIDATION_FAILED']).toBe(1);
      expect(snapshot.totalErrors).toBe(1);
    });

    it('should record multiple errors of same type', () => {
      MetricsService.recordError({
        route: '/api/test',
        method: 'POST',
        errorCode: 'VALIDATION_FAILED',
        errorMessage: 'Invalid input 1',
      });

      MetricsService.recordError({
        route: '/api/test',
        method: 'POST',
        errorCode: 'VALIDATION_FAILED',
        errorMessage: 'Invalid input 2',
      });

      const snapshot = MetricsService.getSnapshot();
      expect(snapshot.errorCounts['VALIDATION_FAILED']).toBe(2);
      expect(snapshot.totalErrors).toBe(2);
    });

    it('should record different error types separately', () => {
      MetricsService.recordError({
        route: '/api/test',
        method: 'GET',
        errorCode: 'NOT_FOUND',
        errorMessage: 'Resource not found',
      });

      MetricsService.recordError({
        route: '/api/test',
        method: 'POST',
        errorCode: 'RATE_LIMITED',
        errorMessage: 'Too many requests',
      });

      const snapshot = MetricsService.getSnapshot();
      expect(snapshot.errorCounts['NOT_FOUND']).toBe(1);
      expect(snapshot.errorCounts['RATE_LIMITED']).toBe(1);
      expect(snapshot.totalErrors).toBe(2);
    });
  });

  describe('getSnapshot', () => {
    it('should return current metrics snapshot', () => {
      MetricsService.recordRequest({
        route: '/api/test',
        method: 'GET',
        statusCode: 200,
        latencyMs: 100,
      });

      MetricsService.recordError({
        route: '/api/test',
        method: 'POST',
        errorCode: 'VALIDATION_FAILED',
        errorMessage: 'Invalid input',
      });

      const snapshot = MetricsService.getSnapshot();

      expect(snapshot).toHaveProperty('requestCounts');
      expect(snapshot).toHaveProperty('averageLatencies');
      expect(snapshot).toHaveProperty('errorCounts');
      expect(snapshot).toHaveProperty('totalRequests');
      expect(snapshot).toHaveProperty('totalErrors');
      expect(snapshot).toHaveProperty('uptime');

      expect(typeof snapshot.uptime).toBe('number');
      expect(snapshot.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should return empty metrics when no data recorded', () => {
      const snapshot = MetricsService.getSnapshot();

      expect(snapshot.requestCounts).toEqual({});
      expect(snapshot.averageLatencies).toEqual({});
      expect(snapshot.errorCounts).toEqual({});
      expect(snapshot.totalRequests).toBe(0);
      expect(snapshot.totalErrors).toBe(0);
      expect(snapshot.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('reset', () => {
    it('should reset all metrics to initial state', () => {
      // Record some metrics
      MetricsService.recordRequest({
        route: '/api/test',
        method: 'GET',
        statusCode: 200,
        latencyMs: 100,
      });

      MetricsService.recordError({
        route: '/api/test',
        method: 'POST',
        errorCode: 'VALIDATION_FAILED',
        errorMessage: 'Invalid input',
      });

      // Verify metrics exist
      let snapshot = MetricsService.getSnapshot();
      expect(snapshot.totalRequests).toBe(1);
      expect(snapshot.totalErrors).toBe(1);

      // Reset metrics
      MetricsService.reset();

      // Verify metrics are reset
      snapshot = MetricsService.getSnapshot();
      expect(snapshot.requestCounts).toEqual({});
      expect(snapshot.averageLatencies).toEqual({});
      expect(snapshot.errorCounts).toEqual({});
      expect(snapshot.totalRequests).toBe(0);
      expect(snapshot.totalErrors).toBe(0);
    });
  });

  describe('uptime tracking', () => {
    it('should track uptime from service initialization', () => {
      const snapshot1 = MetricsService.getSnapshot();
      
      // Wait a small amount of time
      const startTime = Date.now();
      while (Date.now() - startTime < 10) {
        // Busy wait
      }
      
      const snapshot2 = MetricsService.getSnapshot();
      
      expect(snapshot2.uptime).toBeGreaterThan(snapshot1.uptime);
    });
  });
});
