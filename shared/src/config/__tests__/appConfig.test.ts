/**
 * Unit tests for appConfig
 * Tests validation rules for production vs development
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('appConfig', () => {
  const originalEnv = process.env;
  const originalImportMeta = (globalThis as any).import?.meta;

  beforeEach(() => {
    // Reset env
    process.env = { ...originalEnv };
    delete (globalThis as any).import;
  });

  afterEach(() => {
    process.env = originalEnv;
    if (originalImportMeta) {
      (globalThis as any).import = { meta: originalImportMeta };
    }
  });

  describe('production validation', () => {
    it('should reject localhost in WEB_BASE_URL in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.WEB_BASE_URL = 'http://localhost:5173';
      process.env.API_BASE_URL = 'https://api.stonecaster.ai';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-key';

      const { loadAppConfig } = require('../appConfig');
      expect(() => loadAppConfig()).toThrow(/must not be localhost in production/);
    });

    it('should reject localhost in API_BASE_URL in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.WEB_BASE_URL = 'https://stonecaster.ai';
      process.env.API_BASE_URL = 'http://localhost:3000';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-key';

      const { loadAppConfig } = require('../appConfig');
      expect(() => loadAppConfig()).toThrow(/must not be localhost in production/);
    });

    it('should reject http:// in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.WEB_BASE_URL = 'http://stonecaster.ai';
      process.env.API_BASE_URL = 'https://api.stonecaster.ai';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-key';

      const { loadAppConfig } = require('../appConfig');
      expect(() => loadAppConfig()).toThrow(/must use https:\/\/ in production/);
    });

    it('should accept valid production URLs', () => {
      process.env.NODE_ENV = 'production';
      process.env.WEB_BASE_URL = 'https://stonecaster.ai';
      process.env.API_BASE_URL = 'https://api.stonecaster.ai';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-key';

      const { loadAppConfig } = require('../appConfig');
      const config = loadAppConfig();
      expect(config.webBaseUrl).toBe('https://stonecaster.ai');
      expect(config.apiBaseUrl).toBe('https://api.stonecaster.ai');
      expect(config.isProduction).toBe(true);
    });
  });

  describe('development validation', () => {
    it('should accept localhost in development', () => {
      process.env.NODE_ENV = 'development';
      process.env.WEB_BASE_URL = 'http://localhost:5173';
      process.env.API_BASE_URL = 'http://localhost:3000';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-key';

      const { loadAppConfig } = require('../appConfig');
      const config = loadAppConfig();
      expect(config.webBaseUrl).toBe('http://localhost:5173');
      expect(config.apiBaseUrl).toBe('http://localhost:3000');
      expect(config.isProduction).toBe(false);
    });

    it('should accept http:// in development', () => {
      process.env.NODE_ENV = 'development';
      process.env.WEB_BASE_URL = 'http://localhost:5173';
      process.env.API_BASE_URL = 'http://localhost:3000';
      process.env.SUPABASE_URL = 'http://localhost:54321';
      process.env.SUPABASE_ANON_KEY = 'test-key';

      const { loadAppConfig } = require('../appConfig');
      const config = loadAppConfig();
      expect(config.webBaseUrl).toBe('http://localhost:5173');
    });
  });

  describe('missing variables', () => {
    it('should throw clear error when WEB_BASE_URL is missing', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.WEB_BASE_URL;
      process.env.API_BASE_URL = 'http://localhost:3000';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-key';

      const { loadAppConfig } = require('../appConfig');
      expect(() => loadAppConfig()).toThrow(/Missing required environment variables.*WEB_BASE_URL/);
    });

    it('should throw clear error when multiple variables are missing', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.WEB_BASE_URL;
      delete process.env.API_BASE_URL;

      const { loadAppConfig } = require('../appConfig');
      expect(() => loadAppConfig()).toThrow(/Missing required environment variables/);
    });
  });

  describe('helpers', () => {
    it('getWebBaseUrl should return webBaseUrl', () => {
      process.env.NODE_ENV = 'development';
      process.env.WEB_BASE_URL = 'http://localhost:5173';
      process.env.API_BASE_URL = 'http://localhost:3000';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-key';

      const { getWebBaseUrl, getApiBaseUrl } = require('../appConfig');
      expect(getWebBaseUrl()).toBe('http://localhost:5173');
      expect(getApiBaseUrl()).toBe('http://localhost:3000');
    });
  });
});




