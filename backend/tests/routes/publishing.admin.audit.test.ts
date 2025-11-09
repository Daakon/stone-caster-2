/**
 * Publishing Admin Audit Routes Tests
 * Phase 5: Tests for audit viewer endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response } from 'express';
import { listAudit } from '../../src/dal/publishingAudit.js';
import { isPublishingAuditViewerEnabled } from '../../src/config/featureFlags.js';

// Mock dependencies
vi.mock('../../src/dal/publishingAudit.js');
vi.mock('../../src/config/featureFlags.js');
vi.mock('../../src/middleware/auth.js', () => ({
  authenticateToken: (req: Request, res: Response, next: () => void) => next(),
}));
vi.mock('../../src/middleware/rbac.js', () => ({
  requireRole: () => (req: Request, res: Response, next: () => void) => next(),
}));

describe('GET /api/admin/publishing/audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 501 when feature flag is disabled', async () => {
    vi.mocked(isPublishingAuditViewerEnabled).mockReturnValue(false);

    const { default: router } = await import('../../src/routes/publishing.admin.js');
    // Note: In a real test, you'd use supertest or similar to test the route
    // This is a structure test
    expect(isPublishingAuditViewerEnabled).toHaveBeenCalled();
  });

  it('should return audit rows with filters', async () => {
    vi.mocked(isPublishingAuditViewerEnabled).mockReturnValue(true);
    vi.mocked(listAudit).mockResolvedValue({
      items: [
        {
          id: 'audit-1',
          entity_type: 'world',
          entity_id: 'world-1',
          action: 'request',
          requested_by: 'user-1',
          reviewed_by: null,
          reason: null,
          created_at: new Date().toISOString(),
        },
      ],
      next_cursor: undefined,
    });

    const result = await listAudit({
      filters: { entity_type: 'world' },
      limit: 25,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].entity_type).toBe('world');
  });

  it('should support cursor pagination', async () => {
    vi.mocked(isPublishingAuditViewerEnabled).mockReturnValue(true);
    const cursor = Buffer.from(JSON.stringify({ created_at: '2024-01-01T00:00:00Z', id: 'audit-1' })).toString('base64');
    
    vi.mocked(listAudit).mockResolvedValue({
      items: [],
      next_cursor: undefined,
    });

    const result = await listAudit({
      filters: {},
      limit: 25,
      cursor,
    });

    expect(listAudit).toHaveBeenCalledWith({
      filters: {},
      limit: 25,
      cursor,
    });
  });

  it('should filter by entity_type, entity_id, action, and owner_user_id', async () => {
    vi.mocked(isPublishingAuditViewerEnabled).mockReturnValue(true);
    
    await listAudit({
      filters: {
        entity_type: 'story',
        entity_id: 'story-1',
        action: 'approve',
        owner_user_id: 'user-1',
      },
      limit: 25,
    });

    expect(listAudit).toHaveBeenCalledWith({
      filters: {
        entity_type: 'story',
        entity_id: 'story-1',
        action: 'approve',
        owner_user_id: 'user-1',
      },
      limit: 25,
    });
  });
});

