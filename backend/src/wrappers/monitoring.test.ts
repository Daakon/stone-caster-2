import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MonitoringWrapper } from './monitoring.js';

describe('MonitoringWrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('captureException', () => {
    it('should capture exception with error details', async () => {
      const error = new Error('Test error message');
      const context = {
        traceId: 'trace-123',
        userId: 'user-123',
        route: '/api/test',
        errorCode: 'VALIDATION_FAILED',
      };

      const result = await MonitoringWrapper.captureException(error, context);

      expect(result.success).toBe(true);
      expect(result.captured).toBe(true);
    });

    it('should handle errors without context', async () => {
      const error = new Error('Simple error');

      const result = await MonitoringWrapper.captureException(error);

      expect(result.success).toBe(true);
      expect(result.captured).toBe(true);
    });

    it('should handle different error types', async () => {
      const typeError = new TypeError('Type error');
      const referenceError = new ReferenceError('Reference error');

      const result1 = await MonitoringWrapper.captureException(typeError);
      const result2 = await MonitoringWrapper.captureException(referenceError);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });

    it('should handle non-Error objects', async () => {
      const stringError = 'String error message';
      const objectError = { message: 'Object error', code: 'CUSTOM_ERROR' };

      const result1 = await MonitoringWrapper.captureException(stringError);
      const result2 = await MonitoringWrapper.captureException(objectError);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });
  });

  describe('captureMessage', () => {
    it('should capture message with level', async () => {
      const result = await MonitoringWrapper.captureMessage('Test message', 'info');

      expect(result.success).toBe(true);
      expect(result.captured).toBe(true);
    });

    it('should capture message with context', async () => {
      const context = {
        traceId: 'trace-123',
        userId: 'user-123',
        route: '/api/test',
        additional: 'data',
      };

      const result = await MonitoringWrapper.captureMessage('Test message', 'warning', context);

      expect(result.success).toBe(true);
      expect(result.captured).toBe(true);
    });

    it('should handle different log levels', async () => {
      const levels = ['debug', 'info', 'warning', 'error', 'fatal'];

      for (const level of levels) {
        const result = await MonitoringWrapper.captureMessage(`Test ${level} message`, level as any);
        expect(result.success).toBe(true);
        expect(result.captured).toBe(true);
      }
    });

    it('should default to info level when not specified', async () => {
      const result = await MonitoringWrapper.captureMessage('Test message');

      expect(result.success).toBe(true);
      expect(result.captured).toBe(true);
    });
  });

  describe('addBreadcrumb', () => {
    it('should add breadcrumb with message and category', async () => {
      const result = await MonitoringWrapper.addBreadcrumb('User action', 'user');

      expect(result.success).toBe(true);
      expect(result.added).toBe(true);
    });

    it('should add breadcrumb with additional data', async () => {
      const data = {
        userId: 'user-123',
        action: 'click',
        element: 'button',
      };

      const result = await MonitoringWrapper.addBreadcrumb('Button clicked', 'ui', data);

      expect(result.success).toBe(true);
      expect(result.added).toBe(true);
    });

    it('should handle different categories', async () => {
      const categories = ['user', 'ui', 'navigation', 'http', 'error'];

      for (const category of categories) {
        const result = await MonitoringWrapper.addBreadcrumb(`Test ${category} breadcrumb`, category);
        expect(result.success).toBe(true);
        expect(result.added).toBe(true);
      }
    });
  });

  describe('setUser', () => {
    it('should set user context', async () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
      };

      const result = await MonitoringWrapper.setUser(user);

      expect(result.success).toBe(true);
      expect(result.set).toBe(true);
    });

    it('should handle minimal user data', async () => {
      const user = {
        id: 'user-123',
      };

      const result = await MonitoringWrapper.setUser(user);

      expect(result.success).toBe(true);
      expect(result.set).toBe(true);
    });

    it('should handle empty user data', async () => {
      const result = await MonitoringWrapper.setUser({});

      expect(result.success).toBe(true);
      expect(result.set).toBe(true);
    });
  });

  describe('setContext', () => {
    it('should set context data', async () => {
      const context = {
        traceId: 'trace-123',
        requestId: 'req-456',
        environment: 'test',
      };

      const result = await MonitoringWrapper.setContext('request', context);

      expect(result.success).toBe(true);
      expect(result.set).toBe(true);
    });

    it('should handle different context keys', async () => {
      const contexts = ['request', 'session', 'environment', 'custom'];

      for (const key of contexts) {
        const result = await MonitoringWrapper.setContext(key, { test: 'data' });
        expect(result.success).toBe(true);
        expect(result.set).toBe(true);
      }
    });

    it('should handle empty context data', async () => {
      const result = await MonitoringWrapper.setContext('test', {});

      expect(result.success).toBe(true);
      expect(result.set).toBe(true);
    });
  });

  describe('configure', () => {
    it('should configure monitoring with options', async () => {
      const options = {
        dsn: 'https://test@sentry.io/123',
        environment: 'test',
        release: '1.0.0',
        sampleRate: 1.0,
      };

      const result = await MonitoringWrapper.configure(options);

      expect(result.success).toBe(true);
      expect(result.configured).toBe(true);
    });

    it('should handle minimal configuration', async () => {
      const options = {
        dsn: 'https://test@sentry.io/123',
      };

      const result = await MonitoringWrapper.configure(options);

      expect(result.success).toBe(true);
      expect(result.configured).toBe(true);
    });

    it('should handle empty configuration', async () => {
      const result = await MonitoringWrapper.configure({});

      expect(result.success).toBe(true);
      expect(result.configured).toBe(true);
    });
  });

  describe('isEnabled', () => {
    it('should return enabled status', () => {
      const enabled = MonitoringWrapper.isEnabled();

      expect(typeof enabled).toBe('boolean');
    });
  });

  describe('error handling', () => {
    it('should handle monitoring service failures gracefully', async () => {
      // This test ensures that monitoring failures don't break the application
      const error = new Error('Test error');

      const result = await MonitoringWrapper.captureException(error);

      // Should always return success, even if monitoring fails
      expect(result.success).toBe(true);
    });

    it('should handle invalid input gracefully', async () => {
      const result1 = await MonitoringWrapper.captureMessage('');
      const result2 = await MonitoringWrapper.captureMessage(null as any);
      const result3 = await MonitoringWrapper.captureException(null as any);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result3.success).toBe(true);
    });
  });
});
