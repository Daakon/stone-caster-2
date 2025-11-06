import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminReportsService } from '../../../services/admin.reports';

// Mock Supabase
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn(() => ({
          gte: vi.fn(() => ({
            or: vi.fn(() => ({
              lt: vi.fn(() => ({
                limit: vi.fn(() => ({
                  data: [],
                  error: null
                }))
              }))
            }))
          }))
        }))
      }))
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            data: { id: '1', resolved: true },
            error: null
          }))
        }))
      }))
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        data: [],
        error: null
      }))
    }))
  }))
};

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase
}));

describe('AdminReportsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listReports', () => {
    it('should call supabase with correct parameters for basic listing', async () => {
      const mockData = [
        { id: '1', target_type: 'entry_point', target_id: 'ep-123', reason: 'Test', reporter_id: 'user-1', created_at: '2024-01-15T10:00:00Z', resolved: false }
      ];

      mockSupabase.from().select().order().gte().or().lt().limit.mockReturnValue({
        data: mockData,
        error: null
      });

      const result = await AdminReportsService.listReports();

      expect(result).toEqual({
        reports: mockData,
        hasMore: false,
        nextCursor: undefined
      });
    });

    it('should apply filters correctly', async () => {
      const filters = {
        state: 'open' as const,
        targetType: 'entry_point',
        since: 7,
        q: 'test',
        limit: 10
      };

      await AdminReportsService.listReports(filters);

      expect(mockSupabase.from).toHaveBeenCalledWith('content_reports');
    });

    it('should handle pagination with cursor', async () => {
      const filters = {
        cursor: '2024-01-15T10:00:00Z',
        limit: 5
      };

      await AdminReportsService.listReports(filters);

      expect(mockSupabase.from).toHaveBeenCalledWith('content_reports');
    });

    it('should throw error when supabase returns error', async () => {
      mockSupabase.from().select().order().gte().or().lt().limit.mockReturnValue({
        data: null,
        error: { message: 'Database error' }
      });

      await expect(AdminReportsService.listReports()).rejects.toThrow('Failed to fetch reports: Database error');
    });
  });

  describe('getReport', () => {
    it('should fetch single report by id', async () => {
      const mockReport = {
        id: '1',
        target_type: 'entry_point',
        target_id: 'ep-123',
        reason: 'Test',
        reporter_id: 'user-1',
        created_at: '2024-01-15T10:00:00Z',
        resolved: false
      };

      mockSupabase.from().select().eq().single.mockReturnValue({
        data: mockReport,
        error: null
      });

      const result = await AdminReportsService.getReport('1');

      expect(result).toEqual(mockReport);
      expect(mockSupabase.from).toHaveBeenCalledWith('content_reports');
    });

    it('should throw error when report not found', async () => {
      mockSupabase.from().select().eq().single.mockReturnValue({
        data: null,
        error: { message: 'Report not found' }
      });

      await expect(AdminReportsService.getReport('1')).rejects.toThrow('Failed to fetch report: Report not found');
    });
  });

  describe('resolveReport', () => {
    it('should resolve report with basic data', async () => {
      const mockResolvedReport = {
        id: '1',
        resolved: true,
        resolved_by: 'user-123',
        resolved_at: '2024-01-15T11:00:00Z'
      };

      mockSupabase.from().update().eq().select().single.mockReturnValue({
        data: mockResolvedReport,
        error: null
      });

      const result = await AdminReportsService.resolveReport('1', {
        resolvedBy: 'user-123',
        note: 'Resolved by moderator'
      });

      expect(result).toEqual(mockResolvedReport);
    });

    it('should handle resolution without note', async () => {
      const mockResolvedReport = {
        id: '1',
        resolved: true,
        resolved_by: 'user-123',
        resolved_at: '2024-01-15T11:00:00Z'
      };

      mockSupabase.from().update().eq().select().single.mockReturnValue({
        data: mockResolvedReport,
        error: null
      });

      const result = await AdminReportsService.resolveReport('1', {
        resolvedBy: 'user-123'
      });

      expect(result).toEqual(mockResolvedReport);
    });

    it('should throw error when resolution fails', async () => {
      mockSupabase.from().update().eq().select().single.mockReturnValue({
        data: null,
        error: { message: 'Update failed' }
      });

      await expect(AdminReportsService.resolveReport('1', {
        resolvedBy: 'user-123'
      })).rejects.toThrow('Failed to resolve report: Update failed');
    });
  });

  describe('bulkResolve', () => {
    it('should resolve multiple reports', async () => {
      const mockResolvedReports = [
        { id: '1', resolved: true },
        { id: '2', resolved: true }
      ];

      mockSupabase.from().update().in().select.mockReturnValue({
        data: mockResolvedReports,
        error: null
      });

      const result = await AdminReportsService.bulkResolve({
        ids: ['1', '2'],
        resolvedBy: 'user-123',
        note: 'Bulk resolution'
      });

      expect(result).toEqual(mockResolvedReports);
    });

    it('should handle bulk resolve without note', async () => {
      const mockResolvedReports = [
        { id: '1', resolved: true },
        { id: '2', resolved: true }
      ];

      mockSupabase.from().update().in().select.mockReturnValue({
        data: mockResolvedReports,
        error: null
      });

      const result = await AdminReportsService.bulkResolve({
        ids: ['1', '2'],
        resolvedBy: 'user-123'
      });

      expect(result).toEqual(mockResolvedReports);
    });

    it('should throw error when bulk resolve fails', async () => {
      mockSupabase.from().update().in().select.mockReturnValue({
        data: null,
        error: { message: 'Bulk update failed' }
      });

      await expect(AdminReportsService.bulkResolve({
        ids: ['1', '2'],
        resolvedBy: 'user-123'
      })).rejects.toThrow('Failed to bulk resolve reports: Bulk update failed');
    });
  });

  describe('getReportStats', () => {
    it('should return report statistics', async () => {
      // Mock multiple supabase calls for stats
      mockSupabase.from().select().mockReturnValueOnce({
        data: [{ id: '1' }, { id: '2' }, { id: '3' }],
        error: null
      });

      mockSupabase.from().select().eq().mockReturnValueOnce({
        data: [{ id: '1' }, { id: '2' }],
        error: null
      });

      mockSupabase.from().select().eq().mockReturnValueOnce({
        data: [
          { target_type: 'entry_point' },
          { target_type: 'npc' },
          { target_type: 'entry_point' }
        ],
        error: null
      });

      const result = await AdminReportsService.getReportStats();

      expect(result).toEqual({
        total: 3,
        open: 2,
        resolved: 1,
        byType: {
          entry_point: 2,
          npc: 1
        }
      });
    });

    it('should handle empty results', async () => {
      mockSupabase.from().select().mockReturnValue({
        data: [],
        error: null
      });

      const result = await AdminReportsService.getReportStats();

      expect(result).toEqual({
        total: 0,
        open: 0,
        resolved: 0,
        byType: {}
      });
    });
  });
});
















