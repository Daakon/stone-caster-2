/**
 * Prompt Segments List Tests
 * Phase 4: Tests for the global prompt segments list view
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import PromptSegmentsAdmin from '@/pages/admin/prompt-segments/index';
import { segmentsService } from '@/services/admin.segments';
import { refsService } from '@/services/admin.refs';

// Mock the services
vi.mock('@/services/admin.segments', () => ({
  segmentsService: {
    listSegments: vi.fn(),
    getAvailableLocales: vi.fn(),
    bulkToggleActive: vi.fn(),
    exportSegments: vi.fn(),
    cloneToLocale: vi.fn(),
    toggleSegmentActive: vi.fn(),
    deleteSegment: vi.fn()
  }
}));

vi.mock('@/services/admin.refs', () => ({
  refsService: {
    getWorldsForFilter: vi.fn(),
    getRulesetsForFilter: vi.fn(),
    getEntryPointsForFilter: vi.fn(),
    getNPCsForFilter: vi.fn()
  }
}));

// Mock the admin route guard
vi.mock('@/admin/routeGuard', () => ({
  useAppRoles: () => ({
    isCreator: false,
    isModerator: true,
    isAdmin: false,
    roles: ['moderator'],
    isLoading: false,
    error: null
  })
}));

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

const mockSegments = [
  {
    id: 'segment-1',
    scope: 'core',
    ref_id: '',
    content: 'System prompt for core functionality',
    version: '1.0.0',
    active: true,
    metadata: { locale: 'en', kind: 'baseline' },
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'segment-2',
    scope: 'entry',
    ref_id: 'entry-1',
    content: 'Entry point prompt',
    version: '1.0.0',
    active: false,
    metadata: { locale: 'es', kind: 'main' },
    updated_at: '2024-01-02T00:00:00Z'
  }
];

const mockRefs = {
  worlds: [{ id: 'world-1', name: 'Fantasy World', type: 'world' }],
  rulesets: [{ id: 'ruleset-1', name: 'Standard Rules', type: 'ruleset' }],
  entryPoints: [{ id: 'entry-1', name: 'Test Adventure (adventure)', type: 'adventure' }],
  npcs: [{ id: 'npc-1', name: 'Test NPC', type: 'npc' }]
};

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('Prompt Segments List', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock successful API calls
    vi.mocked(segmentsService.listSegments).mockResolvedValue({
      data: mockSegments,
      hasMore: false,
      nextCursor: undefined
    });
    
    vi.mocked(segmentsService.getAvailableLocales).mockResolvedValue(['en', 'es', 'fr']);
    
    vi.mocked(refsService.getWorldsForFilter).mockResolvedValue(mockRefs.worlds);
    vi.mocked(refsService.getRulesetsForFilter).mockResolvedValue(mockRefs.rulesets);
    vi.mocked(refsService.getEntryPointsForFilter).mockResolvedValue(mockRefs.entryPoints);
    vi.mocked(refsService.getNPCsForFilter).mockResolvedValue(mockRefs.npcs);
  });

  it('renders segments list with data', async () => {
    renderWithRouter(<PromptSegmentsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('Prompt Segments')).toBeInTheDocument();
      expect(screen.getByText('segment-1')).toBeInTheDocument();
      expect(screen.getByText('segment-2')).toBeInTheDocument();
    });
  });

  it('shows create button for moderators', async () => {
    renderWithRouter(<PromptSegmentsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('Create Segment')).toBeInTheDocument();
    });
  });

  it('filters segments by scope', async () => {
    renderWithRouter(<PromptSegmentsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('Prompt Segments')).toBeInTheDocument();
    });

    // Test scope filter
    const scopeSelect = screen.getByDisplayValue('All scopes');
    fireEvent.click(scopeSelect);
    
    await waitFor(() => {
      expect(screen.getByText('Core')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Core'));

    expect(segmentsService.listSegments).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: ['core']
      })
    );
  });

  it('filters segments by status', async () => {
    renderWithRouter(<PromptSegmentsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('Prompt Segments')).toBeInTheDocument();
    });

    // Test status filter
    const statusSelect = screen.getByDisplayValue('All status');
    fireEvent.click(statusSelect);
    
    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Active'));

    expect(segmentsService.listSegments).toHaveBeenCalledWith(
      expect.objectContaining({
        active: true
      })
    );
  });

  it('filters segments by locale', async () => {
    renderWithRouter(<PromptSegmentsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('Prompt Segments')).toBeInTheDocument();
    });

    // Test locale filter
    const localeSelect = screen.getByDisplayValue('All locales');
    fireEvent.click(localeSelect);
    
    await waitFor(() => {
      expect(screen.getByText('en')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('en'));

    expect(segmentsService.listSegments).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: 'en'
      })
    );
  });

  it('searches segments by content', async () => {
    renderWithRouter(<PromptSegmentsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('Prompt Segments')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search segments...');
    fireEvent.change(searchInput, { target: { value: 'system' } });

    // Wait for debounced search
    await waitFor(() => {
      expect(segmentsService.listSegments).toHaveBeenCalledWith(
        expect.objectContaining({
          q: 'system'
        })
      );
    });
  });

  it('handles segment selection for bulk operations', async () => {
    renderWithRouter(<PromptSegmentsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('segment-1')).toBeInTheDocument();
    });

    // Select first segment
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]); // First data row checkbox

    await waitFor(() => {
      expect(screen.getByText('1 segment selected')).toBeInTheDocument();
    });
  });

  it('handles bulk activate operation', async () => {
    renderWithRouter(<PromptSegmentsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('segment-1')).toBeInTheDocument();
    });

    // Select segment and show bulk bar
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);

    await waitFor(() => {
      expect(screen.getByText('Activate')).toBeInTheDocument();
    });

    // Click bulk activate
    fireEvent.click(screen.getByText('Activate'));

    expect(segmentsService.bulkToggleActive).toHaveBeenCalledWith(
      expect.any(Array),
      true
    );
  });

  it('handles bulk export operation', async () => {
    const mockExportData = [{ id: 'segment-1', content: 'test' }];
    vi.mocked(segmentsService.exportSegments).mockResolvedValue(mockExportData);

    renderWithRouter(<PromptSegmentsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('segment-1')).toBeInTheDocument();
    });

    // Select segment and show bulk bar
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);

    await waitFor(() => {
      expect(screen.getByText('Export')).toBeInTheDocument();
    });

    // Click bulk export
    fireEvent.click(screen.getByText('Export'));

    expect(segmentsService.exportSegments).toHaveBeenCalledWith(
      expect.any(Array)
    );
  });

  it('handles toggle active for individual segment', async () => {
    renderWithRouter(<PromptSegmentsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('segment-1')).toBeInTheDocument();
    });

    // Find and click toggle button
    const toggleButtons = screen.getAllByText('Deactivate');
    fireEvent.click(toggleButtons[0]);

    expect(segmentsService.toggleSegmentActive).toHaveBeenCalledWith('segment-1');
  });

  it('handles clone to locale', async () => {
    renderWithRouter(<PromptSegmentsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('segment-1')).toBeInTheDocument();
    });

    // Find and click clone button
    const cloneButtons = screen.getAllByRole('button', { name: /clone/i });
    fireEvent.click(cloneButtons[0]);

    expect(segmentsService.cloneToLocale).toHaveBeenCalledWith('segment-1', 'en');
  });

  it('handles delete segment', async () => {
    // Mock confirm dialog
    global.confirm = vi.fn(() => true);

    renderWithRouter(<PromptSegmentsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('segment-1')).toBeInTheDocument();
    });

    // Find and click delete button
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    fireEvent.click(deleteButtons[0]);

    expect(segmentsService.deleteSegment).toHaveBeenCalledWith('segment-1');
  });

  it('shows scope badges correctly', async () => {
    renderWithRouter(<PromptSegmentsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('core')).toBeInTheDocument();
      expect(screen.getByText('entry')).toBeInTheDocument();
    });
  });

  it('shows locale badges correctly', async () => {
    renderWithRouter(<PromptSegmentsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('en')).toBeInTheDocument();
      expect(screen.getByText('es')).toBeInTheDocument();
    });
  });

  it('handles loading state', () => {
    // Mock loading state
    vi.mocked(segmentsService.listSegments).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    renderWithRouter(<PromptSegmentsAdmin />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('handles error state', async () => {
    // Mock error
    vi.mocked(segmentsService.listSegments).mockRejectedValue(
      new Error('Failed to load')
    );

    renderWithRouter(<PromptSegmentsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load segments')).toBeInTheDocument();
    });
  });
});


