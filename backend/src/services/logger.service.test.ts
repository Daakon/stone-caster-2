import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LoggerService } from './logger.service.js';

// Mock console methods to capture log output
const mockConsoleLog = vi.fn();
const mockConsoleError = vi.fn();
const mockConsoleWarn = vi.fn();

describe('LoggerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(mockConsoleLog);
    vi.spyOn(console, 'error').mockImplementation(mockConsoleError);
    vi.spyOn(console, 'warn').mockImplementation(mockConsoleWarn);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createLogger', () => {
    it('should create a logger with traceId', () => {
      const traceId = 'test-trace-123';
      const logger = LoggerService.createLogger(traceId);

      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });

    it('should include traceId in all log messages', () => {
      const traceId = 'test-trace-456';
      const logger = LoggerService.createLogger(traceId);

      logger.info('Test info message');
      logger.error('Test error message');
      logger.warn('Test warning message');
      logger.debug('Test debug message');

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining(traceId)
      );
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining(traceId)
      );
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining(traceId)
      );
    });

    it('should include additional context in log messages', () => {
      const traceId = 'test-trace-789';
      const logger = LoggerService.createLogger(traceId);

      logger.info('Test message', { userId: 'user-123', route: '/api/test' });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('user-123')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('/api/test')
      );
    });
  });

  describe('logRequest', () => {
    it('should log request with all required fields', () => {
      const traceId = 'test-trace-request';
      const logger = LoggerService.createLogger(traceId);

      const requestInfo = {
        method: 'GET',
        route: '/api/test',
        statusCode: 200,
        latencyMs: 150,
        userId: 'user-123',
        cookieId: 'cookie-456',
      };

      logger.logRequest(requestInfo);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining(traceId)
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GET')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('/api/test')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('200')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('150')
      );
    });

    it('should log request without optional fields', () => {
      const traceId = 'test-trace-request-minimal';
      const logger = LoggerService.createLogger(traceId);

      const requestInfo = {
        method: 'POST',
        route: '/api/telemetry/event',
        statusCode: 201,
        latencyMs: 75,
      };

      logger.logRequest(requestInfo);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining(traceId)
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('POST')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('/api/telemetry/event')
      );
    });
  });

  describe('logError', () => {
    it('should log error with traceId and error details', () => {
      const traceId = 'test-trace-error';
      const logger = LoggerService.createLogger(traceId);

      const error = new Error('Test error message');
      const context = {
        route: '/api/test',
        userId: 'user-123',
        errorCode: 'VALIDATION_FAILED',
      };

      logger.logError(error, context);

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining(traceId)
      );
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Test error message')
      );
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('VALIDATION_FAILED')
      );
    });

    it('should handle errors without context', () => {
      const traceId = 'test-trace-error-no-context';
      const logger = LoggerService.createLogger(traceId);

      const error = new Error('Simple error');

      logger.logError(error);

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining(traceId)
      );
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Simple error')
      );
    });
  });

  describe('structured logging', () => {
    it('should output JSON format for structured logs', () => {
      const traceId = 'test-trace-json';
      const logger = LoggerService.createLogger(traceId);

      logger.info('Structured message', { 
        level: 'info',
        message: 'Structured message',
        traceId,
        additional: 'data'
      });

      const logCall = mockConsoleLog.mock.calls[0][0];
      expect(() => JSON.parse(logCall)).not.toThrow();
    });

    it('should include timestamp in log messages', () => {
      const traceId = 'test-trace-timestamp';
      const logger = LoggerService.createLogger(traceId);

      logger.info('Timestamp test');

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('"timestamp"')
      );
    });
  });
});
