import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import AnalyticsDashboard from '@/pages/admin/analytics/index';
import { AdminAnalyticsService } from '@/services/admin.analytics';

// Mock the admin analytics service
vi.mock('@/services/admin.analytics', () => ({
  AdminAnalyticsService: {
    getOverviewCards: vi.fn(),
    getDailySeries: vi.fn(),
    getReviewSLA: vi.fn()
  }
}));

// Mock the route guard
vi.mock('@/admin/routeGuard', () => ({
  useAppRoles: () => ({
    isModerator: true,
    isAdmin: false
  })
}));

const mockOverviewCards = {
  activePublicEntries: 42,
  pendingReviews: 8,
  avgReviewSLA: 24.5,
  gamesStarted7d: 156,
  tokensUsed7d: 12500
};

const mockDailySeries = [
  { day: '2024-01-15', value: 12 },
  { day: '2024-01-16', value: 18 },
  { day: '2024-01-17', value: 15 },
  { day: '2024-01-18', value: 22 },
  { day: '2024-01-19', value: 19 }
];

describe('Analytics Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (AdminAnalyticsService.getOverviewCards as any).mockResolvedValue(mockOverviewCards);
    (AdminAnalyticsService.getDailySeries as any).mockResolvedValue(mockDailySeries);
  });

  it('renders analytics dashboard with proper title', async () => {
    render(
      <BrowserRouter>
        <AnalyticsDashboard />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Community and gameplay health metrics')).toBeInTheDocument();
    });
  });

  it('displays overview cards with correct metrics', async () => {
    render(
      <BrowserRouter>
        <AnalyticsDashboard />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument(); // Active Public Entries
      expect(screen.getByText('8')).toBeInTheDocument(); // Pending Reviews
      expect(screen.getByText('24.5h')).toBeInTheDocument(); // Avg Review SLA
      expect(screen.getByText('156')).toBeInTheDocument(); // Games Started
      expect(screen.getByText('12.5K')).toBeInTheDocument(); // Tokens Used
    });
  });

  it('shows correct card labels and descriptions', async () => {
    render(
      <BrowserRouter>
        <AnalyticsDashboard />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Active Public Entries')).toBeInTheDocument();
      expect(screen.getByText('Pending Reviews')).toBeInTheDocument();
      expect(screen.getByText('Avg Review SLA')).toBeInTheDocument();
      expect(screen.getByText('Games Started (7d)')).toBeInTheDocument();
      expect(screen.getByText('Tokens Used (7d)')).toBeInTheDocument();
    });
  });

  it('displays daily trends chart', async () => {
    render(
      <BrowserRouter>
        <AnalyticsDashboard />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Daily Trends')).toBeInTheDocument();
      expect(screen.getByText('Submissions over the last 30 days')).toBeInTheDocument();
    });
  });

  it('allows changing metric filter', async () => {
    render(
      <BrowserRouter>
        <AnalyticsDashboard />
      </BrowserRouter>
    );

    await waitFor(() => {
      const metricSelect = screen.getByDisplayValue('Submissions');
      expect(metricSelect).toBeInTheDocument();
    });

    // Test metric change
    fireEvent.change(screen.getByDisplayValue('Submissions'), { target: { value: 'approvals' } });
    
    await waitFor(() => {
      expect(AdminAnalyticsService.getDailySeries).toHaveBeenCalledWith(
        expect.objectContaining({ metric: 'approvals' })
      );
    });
  });

  it('allows changing time period filter', async () => {
    render(
      <BrowserRouter>
        <AnalyticsDashboard />
      </BrowserRouter>
    );

    await waitFor(() => {
      const periodSelect = screen.getByDisplayValue('30d');
      expect(periodSelect).toBeInTheDocument();
    });

    // Test period change
    fireEvent.change(screen.getByDisplayValue('30d'), { target: { value: '7' } });
    
    await waitFor(() => {
      expect(AdminAnalyticsService.getDailySeries).toHaveBeenCalledWith(
        expect.objectContaining({ sinceDays: 7 })
      );
    });
  });

  it('shows refresh button and handles refresh', async () => {
    render(
      <BrowserRouter>
        <AnalyticsDashboard />
      </BrowserRouter>
    );

    await waitFor(() => {
      const refreshButton = screen.getByText('Refresh');
      expect(refreshButton).toBeInTheDocument();
    });

    // Test refresh
    fireEvent.click(screen.getByText('Refresh'));
    
    await waitFor(() => {
      expect(AdminAnalyticsService.getOverviewCards).toHaveBeenCalledTimes(2);
      expect(AdminAnalyticsService.getDailySeries).toHaveBeenCalledTimes(2);
    });
  });

  it('displays review performance metrics', async () => {
    render(
      <BrowserRouter>
        <AnalyticsDashboard />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Review Performance')).toBeInTheDocument();
      expect(screen.getByText('Average SLA')).toBeInTheDocument();
      expect(screen.getByText('24.5h')).toBeInTheDocument();
    });
  });

  it('shows content health metrics', async () => {
    render(
      <BrowserRouter>
        <AnalyticsDashboard />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Content Health')).toBeInTheDocument();
      expect(screen.getByText('Active Entries')).toBeInTheDocument();
      expect(screen.getByText('Pending Reviews')).toBeInTheDocument();
    });
  });

  it('shows community activity metrics', async () => {
    render(
      <BrowserRouter>
        <AnalyticsDashboard />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Community Activity')).toBeInTheDocument();
      expect(screen.getByText('Games Started (7d)')).toBeInTheDocument();
      expect(screen.getByText('Tokens Used (7d)')).toBeInTheDocument();
    });
  });

  it('shows system status', async () => {
    render(
      <BrowserRouter>
        <AnalyticsDashboard />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('System Status')).toBeInTheDocument();
      expect(screen.getByText('Database')).toBeInTheDocument();
      expect(screen.getByText('AI Services')).toBeInTheDocument();
    });
  });

  it('handles loading state', async () => {
    (AdminAnalyticsService.getOverviewCards as any).mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    );

    render(
      <BrowserRouter>
        <AnalyticsDashboard />
      </BrowserRouter>
    );

    expect(screen.getByText('Loading analytics...')).toBeInTheDocument();
  });

  it('shows empty state when no data available', async () => {
    (AdminAnalyticsService.getDailySeries as any).mockResolvedValue([]);

    render(
      <BrowserRouter>
        <AnalyticsDashboard />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('No data available for the selected period')).toBeInTheDocument();
    });
  });

  it('formats large numbers correctly', async () => {
    const largeNumbersCards = {
      ...mockOverviewCards,
      gamesStarted7d: 1500000,
      tokensUsed7d: 2500000
    };

    (AdminAnalyticsService.getOverviewCards as any).mockResolvedValue(largeNumbersCards);

    render(
      <BrowserRouter>
        <AnalyticsDashboard />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('1.5M')).toBeInTheDocument(); // Games Started
      expect(screen.getByText('2.5M')).toBeInTheDocument(); // Tokens Used
    });
  });
});





