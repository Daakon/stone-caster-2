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

