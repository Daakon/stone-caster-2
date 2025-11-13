/**
 * Publishing DAL Unit Tests
 * Phase 2: Tests for recordPublishRequest and related functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recordPublishRequest, getPublicListability, countUserContent, countDailyPublishRequests } from '../../src/dal/publishing.js';
import { ApiErrorCode } from '@shared';
import { supabaseAdmin } from '../../src/services/supabase.js';

// Mock Supabase client
vi.mock('../../src/services/supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

describe('recordPublishRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw NOT_FOUND if entity does not exist', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
        }),
      }),
    });

    (supabaseAdmin.from as any).mockImplementation(mockFrom);

    await expect(
      recordPublishRequest({ type: 'world', id: 'test-id', userId: 'user-id' })
    ).rejects.toMatchObject({
      code: ApiErrorCode.NOT_FOUND,
    });
  });

  it('should throw FORBIDDEN if user does not own the entity', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'test-id',
              owner_user_id: 'different-user-id',
              visibility: 'private',
              review_state: 'draft',
              name: 'Test World',
            },
            error: null,
          }),
        }),
      }),
    });

    (supabaseAdmin.from as any).mockImplementation(mockFrom);

    await expect(
      recordPublishRequest({ type: 'world', id: 'test-id', userId: 'user-id' })
    ).rejects.toMatchObject({
      code: ApiErrorCode.FORBIDDEN,
    });
  });

  it('should throw WORLD_NOT_PUBLIC for story when parent world is not public+approved', async () => {
    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'entry_points') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'story-id',
                  owner_user_id: 'user-id',
                  world_id: 'world-id',
                  title: 'Test Story',
                  visibility: 'private',
                  review_state: 'draft',
                  dependency_invalid: false,
                },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'worlds') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'world-id',
                  visibility: 'private',
                  review_state: 'draft',
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'publishing_audit') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return {};
    });

    (supabaseAdmin.from as any).mockImplementation(mockFrom);

    await expect(
      recordPublishRequest({ type: 'story', id: 'story-id', userId: 'user-id' })
    ).rejects.toMatchObject({
      code: ApiErrorCode.WORLD_NOT_PUBLIC,
    });
  });

  it('should successfully record publish request for world', async () => {
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'worlds') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'world-id',
                  owner_user_id: 'user-id',
                  visibility: 'private',
                  review_state: 'draft',
                  name: 'Test World',
                },
                error: null,
              }),
            }),
          }),
          update: mockUpdate,
        };
      }
      if (table === 'publishing_audit') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return {};
    });

    (supabaseAdmin.from as any).mockImplementation(mockFrom);

    const result = await recordPublishRequest({
      type: 'world',
      id: 'world-id',
      userId: 'user-id',
    });

    expect(result).toMatchObject({
      id: 'world-id',
      type: 'world',
      review_state: 'pending_review',
      owner_user_id: 'user-id',
    });

    expect(mockUpdate).toHaveBeenCalledWith({ review_state: 'pending_review' });
  });
});

describe('getPublicListability', () => {
  it('should return false for non-public entity', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'test-id',
              visibility: 'private',
              review_state: 'draft',
            },
            error: null,
          }),
        }),
      }),
    });

    (supabaseAdmin.from as any).mockImplementation(mockFrom);

    const result = await getPublicListability({ type: 'world', id: 'test-id' });
    expect(result).toBe(false);
  });

  it('should return true for public+approved entity with valid dependencies', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'test-id',
              visibility: 'public',
              review_state: 'approved',
              dependency_invalid: false,
            },
            error: null,
          }),
        }),
      }),
    });

    (supabaseAdmin.from as any).mockImplementation(mockFrom);

    const result = await getPublicListability({ type: 'world', id: 'test-id' });
    expect(result).toBe(true);
  });
});

describe('countUserContent', () => {
  it('should return count of user content', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          count: 5,
          error: null,
        }),
      }),
    });

    (supabaseAdmin.from as any).mockImplementation(mockFrom);

    const result = await countUserContent({ userId: 'user-id', type: 'world' });
    expect(result).toBe(5);
  });
});

describe('countDailyPublishRequests', () => {
  it('should return count of daily requests', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              lte: vi.fn().mockResolvedValue({
                count: 3,
                error: null,
              }),
            }),
          }),
        }),
      }),
    });

    (supabaseAdmin.from as any).mockImplementation(mockFrom);

    const result = await countDailyPublishRequests({
      userId: 'user-id',
      dayUtc: '2025-11-09',
    });
    expect(result).toBe(3);
  });
});

describe('revalidateForApproval', () => {
  it('should return ok=true for valid pending submission', async () => {
    const { revalidateForApproval } = await import('../../src/dal/publishing.js');
    
    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'worlds') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'world-id',
                  visibility: 'public',
                  review_state: 'approved',
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'test-id',
                review_state: 'pending_review',
                visibility: 'private',
                dependency_invalid: false,
                world_id: 'world-id',
              },
              error: null,
            }),
          }),
        }),
      };
    });

    (supabaseAdmin.from as any).mockImplementation(mockFrom);

    const result = await revalidateForApproval({ type: 'story', id: 'test-id' });
    expect(result.ok).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it('should return blocked when parent world is not public', async () => {
    const { revalidateForApproval } = await import('../../src/dal/publishing.js');
    
    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'worlds') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'world-id',
                  visibility: 'private',
                  review_state: 'draft',
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'test-id',
                review_state: 'pending_review',
                visibility: 'private',
                dependency_invalid: false,
                world_id: 'world-id',
              },
              error: null,
            }),
          }),
        }),
      };
    });

    (supabaseAdmin.from as any).mockImplementation(mockFrom);

    const result = await revalidateForApproval({ type: 'story', id: 'test-id' });
    expect(result.ok).toBe(false);
    expect(result.reasons).toContain('parent_world_not_public');
    expect(result.reasons).toContain('parent_world_not_approved');
  });

  it('should return blocked when dependency_invalid is true', async () => {
    const { revalidateForApproval } = await import('../../src/dal/publishing.js');
    
    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'worlds') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'world-id',
                  visibility: 'public',
                  review_state: 'approved',
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'test-id',
                review_state: 'pending_review',
                visibility: 'private',
                dependency_invalid: true,
                world_id: 'world-id',
              },
              error: null,
            }),
          }),
        }),
      };
    });

    (supabaseAdmin.from as any).mockImplementation(mockFrom);

    const result = await revalidateForApproval({ type: 'story', id: 'test-id' });
    expect(result.ok).toBe(false);
    expect(result.reasons).toContain('dependency_invalid');
  });
});

describe('approveSubmission', () => {
  it('should approve valid submission', async () => {
    const { approveSubmission } = await import('../../src/dal/publishing.js');
    
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'worlds') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'world-id',
                  visibility: 'public',
                  review_state: 'approved',
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'entry_points') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'test-id',
                  review_state: 'pending_review',
                  visibility: 'private',
                  dependency_invalid: false,
                  world_id: 'world-id',
                  title: 'Test Story',
                  owner_user_id: 'user-id',
                },
                error: null,
              }),
            }),
          }),
          update: mockUpdate,
        };
      }
      if (table === 'publishing_audit') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return {};
    });

    (supabaseAdmin.from as any).mockImplementation(mockFrom);

    const result = await approveSubmission({
      type: 'story',
      id: 'test-id',
      reviewerUserId: 'reviewer-id',
    });

    expect(result.review_state).toBe('approved');
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('should throw APPROVAL_BLOCKED when validation fails', async () => {
    const { approveSubmission } = await import('../../src/dal/publishing.js');
    const { ApiErrorCode } = await import('@shared');
    
    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'worlds') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'world-id',
                  visibility: 'private',
                  review_state: 'draft',
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'test-id',
                review_state: 'pending_review',
                visibility: 'private',
                dependency_invalid: false,
                world_id: 'world-id',
              },
              error: null,
            }),
          }),
        }),
      };
    });

    (supabaseAdmin.from as any).mockImplementation(mockFrom);

    await expect(
      approveSubmission({
        type: 'story',
        id: 'test-id',
        reviewerUserId: 'reviewer-id',
      })
    ).rejects.toMatchObject({
      code: ApiErrorCode.APPROVAL_BLOCKED,
    });
  });

  it('should update cover media visibility to public when entity is approved', async () => {
    const { approveSubmission } = await import('../../src/dal/publishing.js');
    
    const mockMediaUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'worlds') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'world-id',
                  visibility: 'public',
                  review_state: 'approved',
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'entry_points') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn()
                .mockResolvedValueOnce({
                  data: {
                    id: 'test-id',
                    review_state: 'pending_review',
                    visibility: 'private',
                    dependency_invalid: false,
                    world_id: 'world-id',
                    title: 'Test Story',
                    owner_user_id: 'user-id',
                    cover_media_id: 'media-123',
                  },
                  error: null,
                })
                .mockResolvedValueOnce({
                  data: {
                    id: 'test-id',
                    review_state: 'approved',
                    visibility: 'public',
                    dependency_invalid: false,
                    world_id: 'world-id',
                    title: 'Test Story',
                    owner_user_id: 'user-id',
                    cover_media_id: 'media-123',
                  },
                  error: null,
                }),
            }),
          }),
          update: mockUpdate,
        };
      }
      if (table === 'media_assets') {
        return {
          update: mockMediaUpdate,
        };
      }
      if (table === 'publishing_audit') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return {};
    });

    // Mock feature flag
    vi.mock('../../src/config/featureFlags.js', () => ({
      isAdminMediaEnabled: vi.fn().mockReturnValue(true),
      isPublishingQualityGatesEnabled: vi.fn().mockReturnValue(false),
    }));

    (supabaseAdmin.from as any).mockImplementation(mockFrom);

    const result = await approveSubmission({
      type: 'story',
      id: 'test-id',
      reviewerUserId: 'reviewer-id',
    });

    expect(result.review_state).toBe('approved');
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockMediaUpdate).toHaveBeenCalledWith({ visibility: 'public' });
    expect(mockMediaUpdate().eq).toHaveBeenCalledWith('id', 'media-123');
  });

  it('should be idempotent when cover is already public', async () => {
    const { approveSubmission } = await import('../../src/dal/publishing.js');
    
    const mockMediaUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'worlds') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'world-id',
                  visibility: 'public',
                  review_state: 'approved',
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'entry_points') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn()
                .mockResolvedValueOnce({
                  data: {
                    id: 'test-id',
                    review_state: 'pending_review',
                    visibility: 'private',
                    dependency_invalid: false,
                    world_id: 'world-id',
                    title: 'Test Story',
                    owner_user_id: 'user-id',
                    cover_media_id: 'media-123',
                  },
                  error: null,
                })
                .mockResolvedValueOnce({
                  data: {
                    id: 'test-id',
                    review_state: 'approved',
                    visibility: 'public',
                    dependency_invalid: false,
                    world_id: 'world-id',
                    title: 'Test Story',
                    owner_user_id: 'user-id',
                    cover_media_id: 'media-123',
                  },
                  error: null,
                }),
            }),
          }),
          update: mockUpdate,
        };
      }
      if (table === 'media_assets') {
        return {
          update: mockMediaUpdate,
        };
      }
      if (table === 'publishing_audit') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return {};
    });

    (supabaseAdmin.from as any).mockImplementation(mockFrom);

    // First approval
    await approveSubmission({
      type: 'story',
      id: 'test-id',
      reviewerUserId: 'reviewer-id',
    });

    expect(mockMediaUpdate).toHaveBeenCalledTimes(1);

    // Second approval (idempotent - should still update, but visibility stays public)
    await approveSubmission({
      type: 'story',
      id: 'test-id',
      reviewerUserId: 'reviewer-id',
    });

    // Should still update (idempotent operation)
    expect(mockMediaUpdate).toHaveBeenCalledTimes(2);
  });

  it('should not update cover if entity has no cover_media_id', async () => {
    const { approveSubmission } = await import('../../src/dal/publishing.js');
    
    const mockMediaUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'worlds') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'world-id',
                  visibility: 'public',
                  review_state: 'approved',
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'entry_points') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn()
                .mockResolvedValueOnce({
                  data: {
                    id: 'test-id',
                    review_state: 'pending_review',
                    visibility: 'private',
                    dependency_invalid: false,
                    world_id: 'world-id',
                    title: 'Test Story',
                    owner_user_id: 'user-id',
                    cover_media_id: null,
                  },
                  error: null,
                })
                .mockResolvedValueOnce({
                  data: {
                    id: 'test-id',
                    review_state: 'approved',
                    visibility: 'public',
                    dependency_invalid: false,
                    world_id: 'world-id',
                    title: 'Test Story',
                    owner_user_id: 'user-id',
                    cover_media_id: null,
                  },
                  error: null,
                }),
            }),
          }),
          update: mockUpdate,
        };
      }
      if (table === 'media_assets') {
        return {
          update: mockMediaUpdate,
        };
      }
      if (table === 'publishing_audit') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return {};
    });

    (supabaseAdmin.from as any).mockImplementation(mockFrom);

    const result = await approveSubmission({
      type: 'story',
      id: 'test-id',
      reviewerUserId: 'reviewer-id',
    });

    expect(result.review_state).toBe('approved');
    expect(mockUpdate).toHaveBeenCalled();
    // Should not update media if no cover_media_id
    expect(mockMediaUpdate).not.toHaveBeenCalled();
  });
});

describe('rejectSubmission', () => {
  it('should reject pending submission with reason', async () => {
    const { rejectSubmission } = await import('../../src/dal/publishing.js');
    
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'entry_points') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn()
                .mockResolvedValueOnce({
                  data: {
                    id: 'test-id',
                    review_state: 'pending_review',
                    title: 'Test Story',
                    owner_user_id: 'user-id',
                  },
                  error: null,
                })
                .mockResolvedValueOnce({
                  data: {
                    id: 'test-id',
                    review_state: 'rejected',
                    visibility: 'private',
                    title: 'Test Story',
                    owner_user_id: 'user-id',
                  },
                  error: null,
                }),
            }),
          }),
          update: mockUpdate,
        };
      }
      if (table === 'publishing_audit') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return {};
    });

    (supabaseAdmin.from as any).mockImplementation(mockFrom);

    const result = await rejectSubmission({
      type: 'story',
      id: 'test-id',
      reviewerUserId: 'reviewer-id',
      reason: 'Content does not meet quality standards',
    });

    expect(result.review_state).toBe('rejected');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        review_state: 'rejected',
        review_reason: 'Content does not meet quality standards',
      })
    );
  });

  it('should throw REJECT_REASON_REQUIRED when reason is empty', async () => {
    const { rejectSubmission } = await import('../../src/dal/publishing.js');
    const { ApiErrorCode } = await import('@shared');

    await expect(
      rejectSubmission({
        type: 'story',
        id: 'test-id',
        reviewerUserId: 'reviewer-id',
        reason: '',
      })
    ).rejects.toMatchObject({
      code: ApiErrorCode.REJECT_REASON_REQUIRED,
    });
  });
});

describe('Phase 5: Prompt Snapshots on Publish', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create snapshot when publishing a Story', async () => {
    const { approveSubmission } = await import('../../src/dal/publishing.js');
    const { createPromptSnapshotForEntity } = await import('../../src/services/promptSnapshotService.js');

    const mockStoryId = 'story-123';
    const mockReviewerId = 'reviewer-456';
    const mockPublishRequestId = 'publish-789';
    const mockCoverMediaId = 'media-cover-123';

    // Mock story data
    const mockStory = {
      id: mockStoryId,
      owner_user_id: 'owner-123',
      world_id: 'world-abc',
      publish_visibility: 'public',
      visibility: 'public',
      review_state: 'approved',
      dependency_invalid: false,
      title: 'Test Story',
      cover_media_id: mockCoverMediaId,
    };

    // Mock snapshot creation
    vi.mock('../../src/services/promptSnapshotService.js', async () => {
      const actual = await vi.importActual('../../src/services/promptSnapshotService.js');
      return {
        ...actual,
        createPromptSnapshotForEntity: vi.fn().mockResolvedValue({
          snapshotId: 'snapshot-123',
          version: 1,
        }),
      };
    });

    const mockFrom = vi.fn((table: string) => {
      if (table === 'entry_points') {
        return {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ error: null }),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: mockStory, error: null }),
        };
      }
      if (table === 'publishing_audit') {
        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: mockPublishRequestId },
            error: null,
          }),
        };
      }
      if (table === 'media_assets') {
        return {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return {};
    });

    (supabaseAdmin.from as any).mockImplementation(mockFrom);

    const result = await approveSubmission({
      type: 'story',
      id: mockStoryId,
      reviewerUserId: mockReviewerId,
    });

    expect(result.snapshotId).toBe('snapshot-123');
    expect(result.snapshotVersion).toBe(1);
    expect(createPromptSnapshotForEntity).toHaveBeenCalledWith({
      entityType: 'story',
      entityId: mockStoryId,
      approvedByUserId: mockReviewerId,
      sourcePublishRequestId: expect.any(String),
    });
  });

  it('should create new snapshot with incremented version on re-publish', async () => {
    const { approveSubmission } = await import('../../src/dal/publishing.js');
    const { createPromptSnapshotForEntity } = await import('../../src/services/promptSnapshotService.js');

    const mockStoryId = 'story-123';
    const mockReviewerId = 'reviewer-456';

    // Mock that first snapshot exists (version 1)
    // On second publish, should create version 2
    (createPromptSnapshotForEntity as any).mockResolvedValueOnce({
      snapshotId: 'snapshot-456',
      version: 2,
    });

    const mockStory = {
      id: mockStoryId,
      owner_user_id: 'owner-123',
      world_id: 'world-abc',
      publish_visibility: 'public',
      visibility: 'public',
      review_state: 'approved',
      dependency_invalid: false,
      title: 'Test Story',
      cover_media_id: null,
    };

    const mockFrom = vi.fn((table: string) => {
      if (table === 'entry_points') {
        return {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ error: null }),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: mockStory, error: null }),
        };
      }
      if (table === 'publishing_audit') {
        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: 'publish-request-2' },
            error: null,
          }),
        };
      }
      return {};
    });

    (supabaseAdmin.from as any).mockImplementation(mockFrom);

    const result = await approveSubmission({
      type: 'story',
      id: mockStoryId,
      reviewerUserId: mockReviewerId,
    });

    expect(result.snapshotVersion).toBe(2);
  });

  it('should block approval when snapshot creation fails', async () => {
    const { approveSubmission } = await import('../../src/dal/publishing.js');
    const { createPromptSnapshotForEntity } = await import('../../src/services/promptSnapshotService.js');
    const { ApiErrorCode } = await import('@shared');

    const mockStoryId = 'story-123';
    const mockReviewerId = 'reviewer-456';

    (createPromptSnapshotForEntity as any).mockRejectedValueOnce(
      new Error('Failed to create snapshot: Database error')
    );

    const mockStory = {
      id: mockStoryId,
      owner_user_id: 'owner-123',
      world_id: 'world-abc',
      publish_visibility: 'public',
      visibility: 'public',
      review_state: 'approved',
      dependency_invalid: false,
      title: 'Test Story',
      cover_media_id: null,
    };

    const mockFrom = vi.fn((table: string) => {
      if (table === 'entry_points') {
        return {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ error: null }),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: mockStory, error: null }),
        };
      }
      if (table === 'publishing_audit') {
        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: 'publish-request-1' },
            error: null,
          }),
        };
      }
      return {};
    });

    (supabaseAdmin.from as any).mockImplementation(mockFrom);

    await expect(
      approveSubmission({
        type: 'story',
        id: mockStoryId,
        reviewerUserId: mockReviewerId,
      })
    ).rejects.toMatchObject({
      code: ApiErrorCode.INTERNAL_ERROR,
      message: expect.stringContaining('Failed to create prompt snapshot'),
    });
  });
});

