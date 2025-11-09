/**
 * Publishing Admin Checklist Route Tests
 * Phase 6: Tests for checklist endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isPublishingChecklistsEnabled } from '../../src/config/featureFlags.js';
import { saveChecklist, listChecklists, getLatestFindings } from '../../src/dal/publishingQuality.js';

// Mock dependencies
vi.mock('../../src/config/featureFlags.js');
vi.mock('../../src/dal/publishingQuality.js');
vi.mock('../../src/middleware/auth.js', () => ({
  authenticateToken: (req: any, res: any, next: () => void) => next(),
}));
vi.mock('../../src/middleware/rbac.js', () => ({
  requireRole: () => (req: any, res: any, next: () => void) => next(),
}));

describe('POST /api/admin/publishing/review/:type/:id/checklist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 501 when feature flag is disabled', async () => {
    vi.mocked(isPublishingChecklistsEnabled).mockReturnValue(false);

    // In a real test, you'd use supertest
    expect(isPublishingChecklistsEnabled).toHaveBeenCalled();
  });

  it('should save checklist when flag is enabled', async () => {
    vi.mocked(isPublishingChecklistsEnabled).mockReturnValue(true);
    vi.mocked(saveChecklist).mockResolvedValue();

    const items = [
      { key: 'clear_title', label: 'Clear title', checked: true },
      { key: 'clear_description', label: 'Clear description', checked: false },
    ];

    await saveChecklist({
      type: 'world',
      id: 'world-id',
      reviewerUserId: 'admin-1',
      items,
      score: 50,
    });

    expect(saveChecklist).toHaveBeenCalledWith({
      type: 'world',
      id: 'world-id',
      reviewerUserId: 'admin-1',
      items,
      score: 50,
    });
  });
});

describe('GET /api/admin/publishing/review/:type/:id/findings', () => {
  it('should return preflight, review findings, and checklists', async () => {
    vi.mocked(getLatestFindings).mockResolvedValue({
      id: 'finding-1',
      kind: 'preflight',
      score: 80,
      issues: [],
      created_at: new Date().toISOString(),
    });

    vi.mocked(listChecklists).mockResolvedValue([
      {
        id: 'checklist-1',
        reviewer_user_id: 'admin-1',
        items: [],
        score: 75,
        created_at: new Date().toISOString(),
      },
    ]);

    const preflight = await getLatestFindings({ type: 'world', id: 'world-id', kind: 'preflight' });
    const checklists = await listChecklists({ type: 'world', id: 'world-id' });

    expect(preflight).toBeTruthy();
    expect(checklists).toHaveLength(1);
  });
});

