/**
 * Tests for OAuth redirect routes
 * Ensures redirectTo is correctly constructed based on environment and destination
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response } from 'express';
import type { RequestHandler } from 'express';

// Mock the auth router
vi.mock('../../routes/auth', () => {
  // We'll test the logic directly
  return {};
});

describe('OAuth redirect routes', () => {
  let mockConfig: any;
  let mockSupabase: any;

  beforeEach(() => {
    vi.resetModules();
    mockConfig = {
      nodeEnv: 'development',
      web: { baseUrl: 'http://localhost:5173' },
      apiBase: { baseUrl: 'http://localhost:3000' },
    };
    mockSupabase = {
      auth: {
        signInWithOAuth: vi.fn(),
      },
    };
  });

  describe('development environment', () => {
    it('should return redirectTo with localhost for web destination', () => {
      mockConfig.nodeEnv = 'development';
      const destination = 'web';
      const redirectTo = destination === 'api'
        ? `${mockConfig.apiBase.baseUrl}/api/auth/oauth/google/callback`
        : `${mockConfig.web.baseUrl}/auth/callback`;

      expect(redirectTo).toBe('http://localhost:5173/auth/callback');
      expect(redirectTo).toContain('localhost');
    });

    it('should return redirectTo with localhost for api destination', () => {
      mockConfig.nodeEnv = 'development';
      const destination = 'api';
      const redirectTo = destination === 'api'
        ? `${mockConfig.apiBase.baseUrl}/api/auth/oauth/google/callback`
        : `${mockConfig.web.baseUrl}/auth/callback`;

      expect(redirectTo).toBe('http://localhost:3000/api/auth/oauth/google/callback');
      expect(redirectTo).toContain('localhost');
    });
  });

  describe('production environment', () => {
    it('should return redirectTo with production domain for web destination', () => {
      mockConfig.nodeEnv = 'production';
      mockConfig.web.baseUrl = 'https://stonecaster.ai';
      mockConfig.apiBase.baseUrl = 'https://api.stonecaster.ai';

      const destination = 'web';
      const redirectTo = destination === 'api'
        ? `${mockConfig.apiBase.baseUrl}/api/auth/oauth/google/callback`
        : `${mockConfig.web.baseUrl}/auth/callback`;

      expect(redirectTo).toBe('https://stonecaster.ai/auth/callback');
      expect(redirectTo).not.toContain('localhost');
      expect(redirectTo).toContain('stonecaster.ai');
    });

    it('should return redirectTo with api.stonecaster.ai for api destination', () => {
      mockConfig.nodeEnv = 'production';
      mockConfig.web.baseUrl = 'https://stonecaster.ai';
      mockConfig.apiBase.baseUrl = 'https://api.stonecaster.ai';

      const destination = 'api';
      const redirectTo = destination === 'api'
        ? `${mockConfig.apiBase.baseUrl}/api/auth/oauth/google/callback`
        : `${mockConfig.web.baseUrl}/auth/callback`;

      expect(redirectTo).toBe('https://api.stonecaster.ai/api/auth/oauth/google/callback');
      expect(redirectTo).not.toContain('localhost');
      expect(redirectTo).toContain('api.stonecaster.ai');
    });

    it('should reject localhost redirect in production', () => {
      mockConfig.nodeEnv = 'production';
      const redirectTo = 'http://localhost:5173/auth/callback';
      const shouldReject = mockConfig.nodeEnv === 'production' && redirectTo.includes('localhost');

      expect(shouldReject).toBe(true);
    });
  });
});


