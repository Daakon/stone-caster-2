/**
 * Prompt Segments CRUD Tests
 * Phase 4: Tests for segment creation, editing, and validation
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SegmentFormModal } from '@/admin/components/SegmentFormModal';
import { segmentsService } from '@/services/admin.segments';
import { refsService } from '@/services/admin.refs';

// Mock the services
vi.mock('@/services/admin.segments', () => ({
  segmentsService: {
    createSegment: vi.fn(),
    updateSegment: vi.fn(),
    findNearDuplicates: vi.fn(),
    computeContentHash: vi.fn()
  }
}));

vi.mock('@/services/admin.refs', () => ({
  refsService: {
    searchWorlds: vi.fn(),
    searchRulesets: vi.fn(),
    searchEntryPoints: vi.fn(),
    searchNPCs: vi.fn()
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

const mockSegment = {
  id: 'segment-1',
  scope: 'core',
  ref_id: '',
  content: 'System prompt for core functionality',
  version: '1.0.0',
  active: true,
  metadata: { locale: 'en', kind: 'baseline' },
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z'
};

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

describe('Segment Form Modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock successful API calls
    vi.mocked(segmentsService.createSegment).mockResolvedValue(mockSegment);
    vi.mocked(segmentsService.updateSegment).mockResolvedValue(mockSegment);
    vi.mocked(segmentsService.findNearDuplicates).mockResolvedValue([]);
    vi.mocked(segmentsService.computeContentHash).mockReturnValue('hash123');
    
    vi.mocked(refsService.searchWorlds).mockResolvedValue(mockRefs.worlds);
    vi.mocked(refsService.searchRulesets).mockResolvedValue(mockRefs.rulesets);
    vi.mocked(refsService.searchEntryPoints).mockResolvedValue(mockRefs.entryPoints);
    vi.mocked(refsService.searchNPCs).mockResolvedValue(mockRefs.npcs);
  });

  it('renders create form for new segment', () => {
    renderWithRouter(
      <SegmentFormModal
        isOpen={true}
        onClose={() => {}}
        onSave={() => {}}
      />
    );

    expect(screen.getByText('Create Segment')).toBeInTheDocument();
    expect(screen.getByText('System-wide prompts available everywhere')).toBeInTheDocument();
  });

  it('renders edit form for existing segment', () => {
    renderWithRouter(
      <SegmentFormModal
        isOpen={true}
        onClose={() => {}}
        onSave={() => {}}
        segment={mockSegment}
      />
    );

    expect(screen.getByText('Edit Segment')).toBeInTheDocument();
    expect(screen.getByDisplayValue('System prompt for core functionality')).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    renderWithRouter(
      <SegmentFormModal
        isOpen={true}
        onClose={() => {}}
        onSave={() => {}}
      />
    );

    // Try to submit without content
    const submitButton = screen.getByRole('button', { name: /create segment/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Content is required')).toBeInTheDocument();
    });
  });

  it('creates new segment successfully', async () => {
    const onSave = vi.fn();
    
    renderWithRouter(
      <SegmentFormModal
        isOpen={true}
        onClose={() => {}}
        onSave={onSave}
      />
    );

    // Fill form
    const contentInput = screen.getByPlaceholderText('Enter prompt content...');
    fireEvent.change(contentInput, { target: { value: 'New prompt content' } });

    const versionInput = screen.getByDisplayValue('1.0.0');
    fireEvent.change(versionInput, { target: { value: '1.0.0' } });

    // Submit
    const submitButton = screen.getByRole('button', { name: /create segment/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(segmentsService.createSegment).toHaveBeenCalledWith({
        scope: 'core',
        ref_id: '',
        content: 'New prompt content',
        version: '1.0.0',
        active: true,
        metadata: {}
      });
      expect(onSave).toHaveBeenCalled();
    });
  });

  it('updates existing segment successfully', async () => {
    const onSave = vi.fn();
    
    renderWithRouter(
      <SegmentFormModal
        isOpen={true}
        onClose={() => {}}
        onSave={onSave}
        segment={mockSegment}
      />
    );

    // Update content
    const contentInput = screen.getByDisplayValue('System prompt for core functionality');
    fireEvent.change(contentInput, { target: { value: 'Updated prompt content' } });

    // Submit
    const submitButton = screen.getByRole('button', { name: /update segment/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(segmentsService.updateSegment).toHaveBeenCalledWith('segment-1', {
        scope: 'core',
        ref_id: '',
        content: 'Updated prompt content',
        version: '1.0.0',
        active: true,
        metadata: { locale: 'en', kind: 'baseline' }
      });
      expect(onSave).toHaveBeenCalled();
    });
  });

  it('shows duplicate warning when content is similar', async () => {
    const mockDuplicates = [
      { id: 'segment-2', content: 'Similar content', similarity: 0.9 }
    ];
    vi.mocked(segmentsService.findNearDuplicates).mockResolvedValue(mockDuplicates);

    renderWithRouter(
      <SegmentFormModal
        isOpen={true}
        onClose={() => {}}
        onSave={() => {}}
      />
    );

    // Enter content that triggers duplicate check
    const contentInput = screen.getByPlaceholderText('Enter prompt content...');
    fireEvent.change(contentInput, { target: { value: 'This is a long content that should trigger duplicate detection' } });

    await waitFor(() => {
      expect(screen.getByText('Possible duplicate content detected:')).toBeInTheDocument();
    });
  });

  it('handles scope change and ref ID requirements', async () => {
    renderWithRouter(
      <SegmentFormModal
        isOpen={true}
        onClose={() => {}}
        onSave={() => {}}
      />
    );

    // Change scope to entry (requires ref_id)
    const scopeSelect = screen.getByDisplayValue('Core');
    fireEvent.click(scopeSelect);
    
    await waitFor(() => {
      expect(screen.getByText('Entry')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Entry'));

    await waitFor(() => {
      expect(screen.getByText('Entry point main prompts')).toBeInTheDocument();
    });
  });

  it('validates metadata JSON format', async () => {
    renderWithRouter(
      <SegmentFormModal
        isOpen={true}
        onClose={() => {}}
        onSave={() => {}}
      />
    );

    // Switch to JSON mode
    const jsonTab = screen.getByText('JSON');
    fireEvent.click(jsonTab);

    // Enter invalid JSON
    const jsonTextarea = screen.getByPlaceholderText('{"locale": "en", "kind": "baseline", "tier": 0}');
    fireEvent.change(jsonTextarea, { target: { value: '{"invalid": json}' } });

    await waitFor(() => {
      expect(screen.getByText('Invalid JSON format')).toBeInTheDocument();
    });
  });

  it('handles creator role restrictions', () => {
    // Mock creator role
    vi.mocked(require('@/admin/routeGuard').useAppRoles).mockReturnValue({
      isCreator: true,
      isModerator: false,
      isAdmin: false,
      roles: ['creator'],
      isLoading: false,
      error: null
    });

    renderWithRouter(
      <SegmentFormModal
        isOpen={true}
        onClose={() => {}}
        onSave={() => {}}
      />
    );

    // Should show restriction warning for non-entry scopes
    expect(screen.getByText(/As a creator, you can only create segments for entry and entry_start scopes/)).toBeInTheDocument();
  });

  it('handles form submission errors', async () => {
    vi.mocked(segmentsService.createSegment).mockRejectedValue(
      new Error('Failed to create segment')
    );

    renderWithRouter(
      <SegmentFormModal
        isOpen={true}
        onClose={() => {}}
        onSave={() => {}}
      />
    );

    // Fill and submit form
    const contentInput = screen.getByPlaceholderText('Enter prompt content...');
    fireEvent.change(contentInput, { target: { value: 'Test content' } });

    const submitButton = screen.getByRole('button', { name: /create segment/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to save segment')).toBeInTheDocument();
    });
  });

  it('closes modal on cancel', () => {
    const onClose = vi.fn();
    
    renderWithRouter(
      <SegmentFormModal
        isOpen={true}
        onClose={onClose}
        onSave={() => {}}
      />
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(onClose).toHaveBeenCalled();
  });

  it('shows loading state during submission', async () => {
    // Mock slow API call
    vi.mocked(segmentsService.createSegment).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(mockSegment), 100))
    );

    renderWithRouter(
      <SegmentFormModal
        isOpen={true}
        onClose={() => {}}
        onSave={() => {}}
      />
    );

    // Fill and submit form
    const contentInput = screen.getByPlaceholderText('Enter prompt content...');
    fireEvent.change(contentInput, { target: { value: 'Test content' } });

    const submitButton = screen.getByRole('button', { name: /create segment/i });
    fireEvent.click(submitButton);

    // Should show loading state
    expect(screen.getByText('Saving...')).toBeInTheDocument();
  });
});

















