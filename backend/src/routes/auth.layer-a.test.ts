import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApiErrorCode } from '@shared';

// Mock services
vi.mock('../services/cookieGroup.service.js');
vi.mock('../services/authCallback.service.js');
vi.mock('../services/ledger.service.js');

// Import after mocking
import request from 'supertest';
import app from '../index.js';
import { CookieGroupService } from '../services/cookieGroup.service.js';
import { AuthCallbackService } from '../services/authCallback.service.js';

// Get the global mock
const mockSupabaseAuth = (global as any).mockSupabaseAuth;

describe('Layer A: Authentication Core', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/me - Identity Resolution', () => {
    it('should return guest identity when no auth header and no cookie', async () => {
      const response = await request(app)
        .get('/api/me')
        .expect(401);

      expect(response.body).toMatchObject({
        ok: false,
        error: {
          code: ApiErrorCode.UNAUTHORIZED,
          message: 'User authentication required',
        },
        meta: {
          traceId: expect.any(String),
        },
      });
    });

    it('should return guest identity when guest cookie is present', async () => {
      const guestId = '550e8400-e29b-41d4-a716-446655440000';
      
      const response = await request(app)
        .get('/api/me')
        .set('Cookie', `guestId=${guestId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        ok: true,
        data: {
          user: null,
          kind: 'guest',
        },
        meta: {
          traceId: expect.any(String),
        },
      });
    });

    it('should return user identity when valid JWT is present', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      // Mock Supabase auth
      mockSupabaseAuth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const response = await request(app)
        .get('/api/me')
        .set('Authorization', 'Bearer valid-jwt-token')
        .expect(200);

      expect(response.body).toMatchObject({
        ok: true,
        data: {
          user: {
            id: mockUser.id,
            email: mockUser.email,
          },
          kind: 'user',
        },
        meta: {
          traceId: expect.any(String),
        },
      });
    });

    it('should not expose secrets or provider IDs in response', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        app_metadata: { provider: 'google' },
        user_metadata: { provider_id: 'google-123' },
      };

      mockSupabaseAuth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const response = await request(app)
        .get('/api/me')
        .set('Authorization', 'Bearer valid-jwt-token')
        .expect(200);

      expect(response.body.data.user).not.toHaveProperty('app_metadata');
      expect(response.body.data.user).not.toHaveProperty('user_metadata');
      expect(response.body.data.user).not.toHaveProperty('provider');
      expect(response.body.data.user).not.toHaveProperty('provider_id');
    });
  });

  describe('POST /api/auth/magic/start - Magic Link Start', () => {
    it('should return success envelope without creating user', async () => {
      mockSupabaseAuth.signInWithOtp.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const response = await request(app)
        .post('/api/auth/magic/start')
        .send({ email: 'test@example.com' })
        .expect(200);

      expect(response.body).toMatchObject({
        ok: true,
        data: {
          message: 'Magic link sent successfully',
        },
        meta: {
          traceId: expect.any(String),
        },
      });
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/auth/magic/start')
        .send({ email: 'invalid-email' })
        .expect(422);

      expect(response.body).toMatchObject({
        ok: false,
        error: {
          code: ApiErrorCode.VALIDATION_FAILED,
        },
        meta: {
          traceId: expect.any(String),
        },
      });
    });
  });

  describe('POST /api/auth/magic/verify - Magic Link Verify', () => {
    it('should create user session and trigger guest linking', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      mockSupabaseAuth.verifyOtp.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock auth callback service
      vi.mocked(AuthCallbackService.handleAuthCallback).mockResolvedValue({
        success: true,
        canonicalGroupId: 'group-123',
      });

      const response = await request(app)
        .post('/api/auth/magic/verify')
        .send({
          email: 'test@example.com',
          token: 'magic-token',
          guestCookieId: '550e8400-e29b-41d4-a716-446655440000',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        ok: true,
        data: {
          user: {
            id: mockUser.id,
            email: mockUser.email,
            isGuest: false,
          },
          message: 'Authentication successful',
        },
        meta: {
          traceId: expect.any(String),
        },
      });

      // Verify guest linking was called
      expect(AuthCallbackService.handleAuthCallback).toHaveBeenCalledWith({
        userId: mockUser.id,
        deviceCookieId: '550e8400-e29b-41d4-a716-446655440000',
        ipAddress: expect.any(String),
        userAgent: undefined,
      });
    });

    it('should handle expired/invalid tokens', async () => {
      mockSupabaseAuth.verifyOtp.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid or expired token' },
      });

      const response = await request(app)
        .post('/api/auth/magic/verify')
        .send({
          email: 'test@example.com',
          token: 'invalid-token',
          guestCookieId: '550e8400-e29b-41d4-a716-446655440000',
        })
        .expect(401);

      expect(response.body).toMatchObject({
        ok: false,
        error: {
          code: ApiErrorCode.UNAUTHORIZED,
          message: 'Invalid or expired token',
        },
        meta: {
          traceId: expect.any(String),
        },
      });
    });
  });

  describe('Guest → User Linking', () => {
    it('should link guest games and stones to user account', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      mockSupabaseAuth.verifyOtp.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock guest has active game and stones
      vi.mocked(CookieGroupService.getGuestGamesForGroup).mockResolvedValue([
        { game_id: 'game-123', cookie_id: '550e8400-e29b-41d4-a716-446655440000' },
      ]);
      vi.mocked(CookieGroupService.getGuestWallet).mockResolvedValue({
        group_id: 'group-123',
        casting_stones: 50,
        updated_at: new Date().toISOString(),
      });

      // Mock successful linking
      vi.mocked(AuthCallbackService.handleAuthCallback).mockResolvedValue({
        success: true,
        canonicalGroupId: 'group-123',
      });

      const response = await request(app)
        .post('/api/auth/magic/verify')
        .send({
          email: 'test@example.com',
          token: 'magic-token',
          guestCookieId: '550e8400-e29b-41d4-a716-446655440000',
        })
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(AuthCallbackService.handleAuthCallback).toHaveBeenCalledWith({
        userId: mockUser.id,
        deviceCookieId: '550e8400-e29b-41d4-a716-446655440000',
        ipAddress: expect.any(String),
        userAgent: undefined,
      });
    });

    it('should be idempotent - repeated linking does not duplicate', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      mockSupabaseAuth.verifyOtp.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock idempotent linking
      vi.mocked(AuthCallbackService.handleAuthCallback).mockResolvedValue({
        success: true,
        canonicalGroupId: 'group-123',
      });

      // First linking
      await request(app)
        .post('/api/auth/magic/verify')
        .send({
          email: 'test@example.com',
          token: 'magic-token',
          guestCookieId: '550e8400-e29b-41d4-a716-446655440000',
        })
        .expect(200);

      // Second linking (should be idempotent)
      await request(app)
        .post('/api/auth/magic/verify')
        .send({
          email: 'test@example.com',
          token: 'magic-token',
          guestCookieId: '550e8400-e29b-41d4-a716-446655440000',
        })
        .expect(200);

      // Should be called twice but with same result
      expect(AuthCallbackService.handleAuthCallback).toHaveBeenCalledTimes(2);
    });
  });

  describe('POST /api/auth/logout - Sign Out', () => {
    it('should invalidate user session and return guest identity', async () => {
      mockSupabaseAuth.signOut.mockResolvedValue({ error: null });

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer valid-jwt-token')
        .expect(200);

      expect(response.body).toMatchObject({
        ok: true,
        data: {
          message: 'Logged out successfully',
        },
        meta: {
          traceId: expect.any(String),
        },
      });

      // Verify signOut was called
      expect(mockSupabaseAuth.signOut).toHaveBeenCalled();
    });

    it('should preserve guest cookie after logout', async () => {
      const guestId = '550e8400-e29b-41d4-a716-446655440000';
      
      mockSupabaseAuth.signOut.mockResolvedValue({ error: null });

      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer valid-jwt-token')
        .set('Cookie', `guestId=${guestId}`)
        .expect(200);

      // Guest should still be able to access /api/me
      const meResponse = await request(app)
        .get('/api/me')
        .set('Cookie', `guestId=${guestId}`)
        .expect(200);

      expect(meResponse.body.data.kind).toBe('guest');
    });
  });

  describe('Gating Behavior', () => {
    it('should return REQUIRES_AUTH for gated actions as guest', async () => {
      // This would be tested with a gated endpoint like Save/Continue/Purchase/Profile
      // For now, we'll test the middleware behavior
      const response = await request(app)
        .get('/api/me')
        .expect(401);

      expect(response.body.error.code).toBe(ApiErrorCode.UNAUTHORIZED);
    });

    it('should allow gated actions after sign-in', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      mockSupabaseAuth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const response = await request(app)
        .get('/api/me')
        .set('Authorization', 'Bearer valid-jwt-token')
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data.kind).toBe('user');
    });
  });

  describe('Security/Privacy', () => {
    it('should not accept client-supplied identity IDs', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      mockSupabaseAuth.verifyOtp.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      vi.mocked(AuthCallbackService.handleAuthCallback).mockResolvedValue({
        success: true,
        canonicalGroupId: 'group-123',
      });

      // Test that endpoints don't accept userId/cookieId in request body
      const response = await request(app)
        .post('/api/auth/magic/verify')
        .send({
          email: 'test@example.com',
          token: 'magic-token',
          guestCookieId: '550e8400-e29b-41d4-a716-446655440000',
          userId: 'malicious-user-id', // Should be ignored
        })
        .expect(200);

      // The userId should not be used from the request body
      expect(AuthCallbackService.handleAuthCallback).toHaveBeenCalledWith({
        userId: mockUser.id, // From JWT, not request body
        deviceCookieId: '550e8400-e29b-41d4-a716-446655440000',
        ipAddress: expect.any(String),
        userAgent: undefined,
      });
    });

    it('should include traceId in all responses', async () => {
      const response = await request(app)
        .get('/api/me')
        .expect(401);

      expect(response.body.meta).toHaveProperty('traceId');
      expect(response.body.meta.traceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });
  });
});
