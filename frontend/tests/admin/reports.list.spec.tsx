import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import ReportsQueue from '@/pages/admin/reports/index';
import { AdminReportsService } from '../../../services/admin.reports';

// Mock the admin reports service
vi.mock('../../../services/admin.reports', () => ({
  AdminReportsService: {
    listReports: vi.fn(),
    getReportStats: vi.fn()
  }
}));

// Mock the route guard
vi.mock('@/admin/routeGuard', () => ({
  useAppRoles: () => ({
    isModerator: true,
    isAdmin: false
  })
}));

const mockReports = [
  {
    id: '1',
    target_type: 'entry_point',
    target_id: 'ep-123',
    reason: 'Inappropriate content',
    reporter_id: 'user-456',
    created_at: '2024-01-15T10:00:00Z',
    resolved: false,
    notes: []
  },
  {
    id: '2',
    target_type: 'npc',
    target_id: 'npc-789',
    reason: 'Offensive language',
    reporter_id: 'user-789',
    created_at: '2024-01-14T15:30:00Z',
    resolved: true,
    resolved_by: 'mod-123',
    resolved_at: '2024-01-14T16:00:00Z',
    notes: []
  }
];

describe('Reports Queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (AdminReportsService.listReports as any).mockResolvedValue({
      reports: mockReports,
      hasMore: false,
      nextCursor: undefined
    });
  });

  it('renders reports queue with proper title', async () => {
    render(
      <BrowserRouter>
        <ReportsQueue />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Reports Queue')).toBeInTheDocument();
      expect(screen.getByText('Review and resolve content reports')).toBeInTheDocument();
    });
  });

  it('displays reports in table format', async () => {
    render(
      <BrowserRouter>
        <ReportsQueue />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('ep-123')).toBeInTheDocument();
      expect(screen.getByText('npc-789')).toBeInTheDocument();
      expect(screen.getByText('Inappropriate content')).toBeInTheDocument();
      expect(screen.getByText('Offensive language')).toBeInTheDocument();
    });
  });

  it('shows correct status badges', async () => {
    render(
      <BrowserRouter>
        <ReportsQueue />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Open')).toBeInTheDocument();
      expect(screen.getByText('Resolved')).toBeInTheDocument();
    });
  });

  it('filters reports by state', async () => {
    render(
      <BrowserRouter>
        <ReportsQueue />
      </BrowserRouter>
    );

    await waitFor(() => {
      const stateFilter = screen.getByDisplayValue('Open');
      expect(stateFilter).toBeInTheDocument();
    });

    // Test state filter change
    fireEvent.change(screen.getByDisplayValue('Open'), { target: { value: 'resolved' } });
    
    await waitFor(() => {
      expect(AdminReportsService.listReports).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'resolved' })
      );
    });
  });

  it('filters reports by target type', async () => {
    render(
      <BrowserRouter>
        <ReportsQueue />
      </BrowserRouter>
    );

    await waitFor(() => {
      const targetTypeFilter = screen.getByDisplayValue('All Types');
      expect(targetTypeFilter).toBeInTheDocument();
    });

    // Test target type filter change
    fireEvent.change(screen.getByDisplayValue('All Types'), { target: { value: 'entry_point' } });
    
    await waitFor(() => {
      expect(AdminReportsService.listReports).toHaveBeenCalledWith(
        expect.objectContaining({ targetType: 'entry_point' })
      );
    });
  });

  it('searches reports by query', async () => {
    render(
      <BrowserRouter>
        <ReportsQueue />
      </BrowserRouter>
    );

    await waitFor(() => {
      const searchInput = screen.getByPlaceholderText('Search reports...');
      expect(searchInput).toBeInTheDocument();
    });

    // Test search
    fireEvent.change(screen.getByPlaceholderText('Search reports...'), { 
      target: { value: 'inappropriate' } 
    });
    
    await waitFor(() => {
      expect(AdminReportsService.listReports).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'inappropriate' })
      );
    });
  });

  it('handles bulk selection', async () => {
    render(
      <BrowserRouter>
        <ReportsQueue />
      </BrowserRouter>
    );

    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(3); // Select all + 2 reports
    });

    // Select first report
    const firstCheckbox = screen.getAllByRole('checkbox')[1];
    fireEvent.click(firstCheckbox);

    await waitFor(() => {
      expect(screen.getByText('Resolve Selected (1)')).toBeInTheDocument();
    });
  });

  it('shows bulk resolve dialog when reports are selected', async () => {
    render(
      <BrowserRouter>
        <ReportsQueue />
      </BrowserRouter>
    );

    await waitFor(() => {
      const firstCheckbox = screen.getAllByRole('checkbox')[1];
      fireEvent.click(firstCheckbox);
    });

    await waitFor(() => {
      const bulkResolveButton = screen.getByText('Resolve Selected (1)');
      fireEvent.click(bulkResolveButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Bulk Resolve Reports')).toBeInTheDocument();
      expect(screen.getByText('Resolve 1 selected reports')).toBeInTheDocument();
    });
  });

  it('displays empty state when no reports found', async () => {
    (AdminReportsService.listReports as any).mockResolvedValue({
      reports: [],
      hasMore: false,
      nextCursor: undefined
    });

    render(
      <BrowserRouter>
        <ReportsQueue />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('No reports found matching your criteria.')).toBeInTheDocument();
    });
  });

  it('shows loading state', async () => {
    (AdminReportsService.listReports as any).mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    );

    render(
      <BrowserRouter>
        <ReportsQueue />
      </BrowserRouter>
    );

    expect(screen.getByText('Loading reports...')).toBeInTheDocument();
  });
});

















