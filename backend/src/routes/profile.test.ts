import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import profileRouter from './profile.js';
import { ProfileService } from '../services/profile.service.js';
import { ApiErrorCode } from 'shared';

// Mock the ProfileService
vi.mock('../services/profile.service.js', () => ({
  ProfileService: {
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
    revokeOtherSessions: vi.fn(),
    validateCSRFToken: vi.fn(),
    generateCSRFToken: vi.fn(),
  },
}));

// Mock auth middleware
vi.mock('../middleware/auth.js', () => ({
  jwtAuth: (req: any, res: any, next: any) => {
    req.ctx = {
      userId: 'user-123',
      isGuest: false,
      user: {
        id: 'user-123',
        email: 'test@example.com',
        isGuest: false,
      },
    };
    next();
  },
}));

// Mock validation middleware
vi.mock('../middleware/validation.js', () => ({
  validateRequest: () => (req: any, res: any, next: any) => next(),
  rateLimit: () => (req: any, res: any, next: any) => next(),
}));

describe('Profile Routes', () => {
  let app: express.Application;
  let mockProfileService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/profile', profileRouter);
    
    mockProfileService = vi.mocked(ProfileService);
    
    // Reset all mocks to default behavior
    mockProfileService.getProfile.mockClear();
    mockProfileService.updateProfile.mockClear();
    mockProfileService.revokeOtherSessions.mockClear();
    mockProfileService.validateCSRFToken.mockClear();
    mockProfileService.generateCSRFToken.mockClear();
  });

  describe('GET /profile', () => {
    it('should return profile data for authenticated user', async () => {
      const mockProfile = {
        id: 'user-123',
        displayName: 'Test User',
        avatarUrl: 'https://example.com/avatar.jpg',
        email: 'test@example.com',
        preferences: {
          showTips: true,
          theme: 'dark',
          notifications: {
            email: true,
            push: false,
          },
        },
        createdAt: '2023-01-01T00:00:00Z',
        lastSeen: '2023-01-02T00:00:00Z',
      };

      mockProfileService.getProfile.mockResolvedValue(mockProfile);

      const response = await request(app)
        .get('/profile')
        .expect(200);

      expect(response.body).toEqual({
        ok: true,
        data: mockProfile,
        meta: {
          traceId: expect.any(String),
        },
      });

      expect(mockProfileService.getProfile).toHaveBeenCalledWith('user-123');
    });

    it('should return 404 when profile not found', async () => {
      mockProfileService.getProfile.mockRejectedValue(new Error('Profile not found'));

      const response = await request(app)
        .get('/profile')
        .expect(404);

      expect(response.body).toEqual({
        ok: false,
        error: {
          code: ApiErrorCode.NOT_FOUND,
          message: 'Profile not found',
        },
        meta: {
          traceId: expect.any(String),
        },
      });
    });

    it('should return 500 on internal error', async () => {
      mockProfileService.getProfile.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/profile')
        .expect(500);

      expect(response.body).toEqual({
        ok: false,
        error: {
          code: ApiErrorCode.INTERNAL_ERROR,
          message: 'Failed to fetch profile',
        },
        meta: {
          traceId: expect.any(String),
        },
      });
    });
  });

  describe('PUT /profile', () => {
    it('should update profile with valid data', async () => {
      const updateData = {
        displayName: 'Updated Name',
        avatarUrl: 'https://example.com/new-avatar.jpg',
        preferences: {
          showTips: false,
          theme: 'light',
          notifications: {
            email: false,
            push: true,
          },
        },
      };

      const mockUpdatedProfile = {
        id: 'user-123',
        displayName: 'Updated Name',
        avatarUrl: 'https://example.com/new-avatar.jpg',
        email: 'test@example.com',
        preferences: {
          showTips: false,
          theme: 'light',
          notifications: {
            email: false,
            push: true,
          },
        },
        createdAt: '2023-01-01T00:00:00Z',
        lastSeen: '2023-01-02T00:00:00Z',
      };

      mockProfileService.updateProfile.mockResolvedValue(mockUpdatedProfile);

      const response = await request(app)
        .put('/profile')
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual({
        ok: true,
        data: mockUpdatedProfile,
        meta: {
          traceId: expect.any(String),
        },
      });

      expect(mockProfileService.updateProfile).toHaveBeenCalledWith('user-123', updateData);
    });

    it('should return 400 for validation errors', async () => {
      const invalidData = {
        displayName: 'a'.repeat(101), // Too long
      };

      mockProfileService.updateProfile.mockRejectedValue(
        new Error('Display name must be between 1 and 100 characters')
      );

      const response = await request(app)
        .put('/profile')
        .send(invalidData)
        .expect(422);

      expect(response.body).toEqual({
        ok: false,
        error: {
          code: ApiErrorCode.VALIDATION_FAILED,
          message: 'Display name must be between 1 and 100 characters',
        },
        meta: {
          traceId: expect.any(String),
        },
      });
    });

    it('should return 404 when profile not found during update', async () => {
      const updateData = { displayName: 'New Name' };

      mockProfileService.updateProfile.mockRejectedValue(new Error('Profile not found'));

      const response = await request(app)
        .put('/profile')
        .send(updateData)
        .expect(404);

      expect(response.body).toEqual({
        ok: false,
        error: {
          code: ApiErrorCode.NOT_FOUND,
          message: 'Profile not found',
        },
        meta: {
          traceId: expect.any(String),
        },
      });
    });
  });

  describe('POST /profile/revoke-sessions', () => {
    it('should revoke other sessions with valid CSRF token', async () => {
      const requestData = {
        csrfToken: 'valid-csrf-token',
      };

      mockProfileService.validateCSRFToken.mockResolvedValue(true);
      mockProfileService.revokeOtherSessions.mockResolvedValue({
        revokedCount: 2,
        currentSessionPreserved: true,
      });

      const response = await request(app)
        .post('/profile/revoke-sessions')
        .send(requestData)
        .expect(200);

      expect(response.body).toEqual({
        ok: true,
        data: {
          revokedCount: 2,
          currentSessionPreserved: true,
        },
        meta: {
          traceId: expect.any(String),
        },
      });

      expect(mockProfileService.validateCSRFToken).toHaveBeenCalledWith('user-123', 'valid-csrf-token');
      expect(mockProfileService.revokeOtherSessions).toHaveBeenCalledWith('user-123', 'current-session');
    });

    it('should return 400 for invalid CSRF token', async () => {
      const requestData = {
        csrfToken: 'invalid-csrf-token',
      };

      mockProfileService.validateCSRFToken.mockResolvedValue(false);

      const response = await request(app)
        .post('/profile/revoke-sessions')
        .send(requestData)
        .expect(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: ApiErrorCode.CSRF_TOKEN_INVALID,
          message: 'Invalid or expired CSRF token',
        },
        meta: {
          traceId: expect.any(String),
        },
      });

      expect(mockProfileService.revokeOtherSessions).not.toHaveBeenCalled();
    });

    it('should return 500 on session revocation error', async () => {
      const requestData = {
        csrfToken: 'valid-csrf-token',
      };

      mockProfileService.validateCSRFToken.mockResolvedValue(true);
      mockProfileService.revokeOtherSessions.mockRejectedValue(new Error('Session revocation failed'));

      const response = await request(app)
        .post('/profile/revoke-sessions')
        .send(requestData)
        .expect(500);

      expect(response.body).toEqual({
        ok: false,
        error: {
          code: ApiErrorCode.INTERNAL_ERROR,
          message: 'Failed to revoke sessions',
        },
        meta: {
          traceId: expect.any(String),
        },
      });
    });
  });

  describe('POST /profile/csrf-token', () => {
    it('should generate CSRF token for authenticated user', async () => {
      const mockToken = 'generated-csrf-token-123';

      mockProfileService.generateCSRFToken.mockResolvedValue(mockToken);

      const response = await request(app)
        .post('/profile/csrf-token')
        .expect(200);

      expect(response.body).toEqual({
        ok: true,
        data: {
          csrfToken: mockToken,
        },
        meta: {
          traceId: expect.any(String),
        },
      });

      expect(mockProfileService.generateCSRFToken).toHaveBeenCalledWith('user-123');
    });

    it('should return 500 on CSRF token generation error', async () => {
      mockProfileService.generateCSRFToken.mockRejectedValue(new Error('Failed to generate token'));

      const response = await request(app)
        .post('/profile/csrf-token')
        .expect(500);

      expect(response.body).toEqual({
        ok: false,
        error: {
          code: ApiErrorCode.INTERNAL_ERROR,
          message: 'Failed to generate CSRF token',
        },
        meta: {
          traceId: expect.any(String),
        },
      });
    });
  });
});
