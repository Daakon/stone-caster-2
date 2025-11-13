/**
 * Media Guard Service Tests
 * Phase 2c: Unit tests for media ownership checks
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assertMediaOwnershipOrAdmin } from '../../src/services/mediaGuard.js';
import { isAdmin } from '../../src/middleware/auth-admin.js';
import type { Request } from 'express';

// Mock dependencies
vi.mock('../../src/middleware/auth-admin.js', () => ({
  isAdmin: vi.fn(),
}));

describe('Media Guard Service', () => {
  const mockUserId = 'user-123';
  const mockOtherUserId = 'user-456';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw error if user does not own media and is not admin', async () => {
    const mockMedia = {
      owner_user_id: mockOtherUserId,
    };

    const mockRequest = {} as Request;
    (isAdmin as any).mockResolvedValue(false);

    await expect(
      assertMediaOwnershipOrAdmin({
        media: mockMedia,
        userId: mockUserId,
        req: mockRequest,
      })
    ).rejects.toThrow('Forbidden: You do not own this media asset');
  });

  it('should allow owner to access media', async () => {
    const mockMedia = {
      owner_user_id: mockUserId,
    };

    const mockRequest = {} as Request;
    (isAdmin as any).mockResolvedValue(false);

    await expect(
      assertMediaOwnershipOrAdmin({
        media: mockMedia,
        userId: mockUserId,
        req: mockRequest,
      })
    ).resolves.not.toThrow();
  });

  it('should allow admin to access any media', async () => {
    const mockMedia = {
      owner_user_id: mockOtherUserId,
    };

    const mockRequest = {} as Request;
    (isAdmin as any).mockResolvedValue(true);

    await expect(
      assertMediaOwnershipOrAdmin({
        media: mockMedia,
        userId: mockUserId,
        req: mockRequest,
      })
    ).resolves.not.toThrow();
  });
});



