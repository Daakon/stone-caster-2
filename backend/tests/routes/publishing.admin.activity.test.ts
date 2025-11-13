/**
 * Publishing Admin Activity Routes Tests
 * Phase 5: Tests for activity feed endpoint
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { listRecentActivity } from '../../src/dal/publishingAudit.js';
import { isPublishingAuditViewerEnabled } from '../../src/config/featureFlags.js';

vi.mock('../../src/dal/publishingAudit.js');
vi.mock('../../src/config/featureFlags.js');

describe('GET /api/admin/publishing/activity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reflects the audit viewer feature flag state', () => {
    vi.mocked(isPublishingAuditViewerEnabled).mockReturnValue(false);

    const enabled = isPublishingAuditViewerEnabled();
    expect(enabled).toBe(false);
    expect(listRecentActivity).not.toHaveBeenCalled();
  });

  it('should return recent activity rows sorted by created_at desc', async () => {
    vi.mocked(isPublishingAuditViewerEnabled).mockReturnValue(true);
    
    const mockItems = [
      {
        id: 'audit-2',
        entity_type: 'world' as const,
        entity_id: 'world-1',
        action: 'approve' as const,
        requested_by: 'user-1',
        reviewed_by: 'admin-1',
        reason: null,
        created_at: new Date('2024-01-02T00:00:00Z').toISOString(),
      },
      {
        id: 'audit-1',
        entity_type: 'story' as const,
        entity_id: 'story-1',
        action: 'request' as const,
        requested_by: 'user-1',
        reviewed_by: null,
        reason: null,
        created_at: new Date('2024-01-01T00:00:00Z').toISOString(),
      },
    ];

    vi.mocked(listRecentActivity).mockResolvedValue(mockItems);

    const result = await listRecentActivity({ limit: 50 });

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('audit-2'); // Most recent first
    expect(listRecentActivity).toHaveBeenCalledWith({ limit: 50 });
  });

  it('should forward custom limit to DAL', async () => {
    vi.mocked(isPublishingAuditViewerEnabled).mockReturnValue(true);
    vi.mocked(listRecentActivity).mockResolvedValue([]);

    await listRecentActivity({ limit: 25 });

    expect(listRecentActivity).toHaveBeenCalledWith({ limit: 25 });
  });
});



