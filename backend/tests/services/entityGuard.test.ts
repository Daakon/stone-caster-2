/**
 * Entity Guard Service Tests
 * Phase 2c: Unit tests for publish immutability and ownership checks
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assertCanMutateEntity } from '../../src/services/entityGuard.js';
import { isAdmin } from '../../src/middleware/auth-admin.js';
import type { Request } from 'express';

// Mock dependencies
vi.mock('../../src/middleware/auth-admin.js', () => ({
  isAdmin: vi.fn(),
}));

describe('Entity Guard Service', () => {
  const mockUserId = 'user-123';
  const mockOtherUserId = 'user-456';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw error if entity is published and user is not admin', async () => {
    const mockEntity = {
      owner_user_id: mockUserId,
      publish_status: 'published',
    };

    const mockRequest = {} as Request;
    (isAdmin as any).mockResolvedValue(false);

    await expect(
      assertCanMutateEntity({
        entity: mockEntity,
        userId: mockUserId,
        req: mockRequest,
      })
    ).rejects.toThrow('Forbidden: Published entities cannot be modified by non-admins');
  });

  it('should allow admin to modify published entity', async () => {
    const mockEntity = {
      owner_user_id: mockOtherUserId,
      publish_status: 'published',
    };

    const mockRequest = {} as Request;
    (isAdmin as any).mockResolvedValue(true);

    await expect(
      assertCanMutateEntity({
        entity: mockEntity,
        userId: mockUserId,
        req: mockRequest,
      })
    ).resolves.not.toThrow();
  });

  it('should allow owner to modify draft entity', async () => {
    const mockEntity = {
      owner_user_id: mockUserId,
      publish_status: 'draft',
    };

    const mockRequest = {} as Request;
    (isAdmin as any).mockResolvedValue(false);

    await expect(
      assertCanMutateEntity({
        entity: mockEntity,
        userId: mockUserId,
        req: mockRequest,
      })
    ).resolves.not.toThrow();
  });

  it('should throw error if user does not own entity and is not admin', async () => {
    const mockEntity = {
      owner_user_id: mockOtherUserId,
      publish_status: 'draft',
    };

    const mockRequest = {} as Request;
    (isAdmin as any).mockResolvedValue(false);

    await expect(
      assertCanMutateEntity({
        entity: mockEntity,
        userId: mockUserId,
        req: mockRequest,
      })
    ).rejects.toThrow('Forbidden: You do not own this entity');
  });

  it('should allow admin to modify any entity', async () => {
    const mockEntity = {
      owner_user_id: mockOtherUserId,
      publish_status: 'draft',
    };

    const mockRequest = {} as Request;
    (isAdmin as any).mockResolvedValue(true);

    await expect(
      assertCanMutateEntity({
        entity: mockEntity,
        userId: mockUserId,
        req: mockRequest,
      })
    ).resolves.not.toThrow();
  });

  it('should handle null publish_status as draft', async () => {
    const mockEntity = {
      owner_user_id: mockUserId,
      publish_status: null,
    };

    const mockRequest = {} as Request;
    (isAdmin as any).mockResolvedValue(false);

    await expect(
      assertCanMutateEntity({
        entity: mockEntity,
        userId: mockUserId,
        req: mockRequest,
      })
    ).resolves.not.toThrow();
  });
});



