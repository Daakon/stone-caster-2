/**
 * Entry Point Edit Tests
 * Phase 3: Tests for the entry point edit form
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import EntryPointEditPage from '@/pages/admin/entry-points/[id]';
import { entryPointsService } from '@/services/admin.entryPoints';

// Mock the services
vi.mock('@/services/admin.entryPoints', () => ({
  entryPointsService: {
    getEntryPoint: vi.fn(),
    updateEntryPoint: vi.fn(),
    createEntryPoint: vi.fn(),
    getWorlds: vi.fn(),
    getRulesets: vi.fn()
  }
}));

// Mock the admin route guard
vi.mock('@/admin/routeGuard', () => ({
  useAppRoles: () => ({
    isCreator: true,
    isModerator: false,
    isAdmin: false,
    roles: ['creator'],
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

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: 'entry-1' })
  };
});

const mockEntryPoint = {
  id: 'entry-1',
  slug: 'test-adventure',
  type: 'adventure',
  world_id: 'world-1',
  ruleset_id: 'ruleset-1',
  title: 'Test Adventure',
  description: 'A test adventure',
  tags: ['fantasy', 'adventure'],
  visibility: 'private',
  content_rating: 'general',
  lifecycle: 'draft',
  owner_user_id: 'user-1'
};

const mockWorlds = [
  { id: 'world-1', name: 'Fantasy World' },
  { id: 'world-2', name: 'Sci-Fi World' }
];

const mockRulesets = [
  { id: 'ruleset-1', name: 'Standard Rules' },
  { id: 'ruleset-2', name: 'Advanced Rules' }
];

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('Entry Point Edit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock successful API calls
    vi.mocked(entryPointsService.getEntryPoint).mockResolvedValue(mockEntryPoint);
    vi.mocked(entryPointsService.getWorlds).mockResolvedValue(mockWorlds);
    vi.mocked(entryPointsService.getRulesets).mockResolvedValue(mockRulesets);
  });

  it('renders edit form with existing data', async () => {
    renderWithRouter(<EntryPointEditPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Adventure')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test Adventure')).toBeInTheDocument();
      expect(screen.getByDisplayValue('test-adventure')).toBeInTheDocument();
    });
  });

  it('updates entry point on save', async () => {
    const mockUpdate = vi.mocked(entryPointsService.updateEntryPoint);
    mockUpdate.mockResolvedValue({ ...mockEntryPoint, title: 'Updated Adventure' });

    renderWithRouter(<EntryPointEditPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Adventure')).toBeInTheDocument();
    });

    // Update title
    const titleInput = screen.getByDisplayValue('Test Adventure');
    fireEvent.change(titleInput, { target: { value: 'Updated Adventure' } });

    // Save
    const saveButton = screen.getByRole('button', { name: /update entry point/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith('entry-1', {
        title: 'Updated Adventure'
      });
    });
  });

  it('validates required fields', async () => {
    renderWithRouter(<EntryPointEditPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Adventure')).toBeInTheDocument();
    });

    // Clear required field
    const titleInput = screen.getByDisplayValue('Test Adventure');
    fireEvent.change(titleInput, { target: { value: '' } });

    // Try to save
    const saveButton = screen.getByRole('button', { name: /update entry point/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Title is required')).toBeInTheDocument();
    });
  });

  it('validates slug format', async () => {
    renderWithRouter(<EntryPointEditPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('test-adventure')).toBeInTheDocument();
    });

    // Enter invalid slug
    const slugInput = screen.getByDisplayValue('test-adventure');
    fireEvent.change(slugInput, { target: { value: 'Invalid Slug!' } });

    // Try to save
    const saveButton = screen.getByRole('button', { name: /update entry point/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Slug must contain only lowercase letters, numbers, hyphens, and underscores')).toBeInTheDocument();
    });
  });

  it('manages tags correctly', async () => {
    renderWithRouter(<EntryPointEditPage />);

    await waitFor(() => {
      expect(screen.getByText('fantasy')).toBeInTheDocument();
      expect(screen.getByText('adventure')).toBeInTheDocument();
    });

    // Add new tag
    const tagInput = screen.getByPlaceholderText('Add a tag');
    fireEvent.change(tagInput, { target: { value: 'new-tag' } });
    fireEvent.click(screen.getByRole('button', { name: /add/i }));

    await waitFor(() => {
      expect(screen.getByText('new-tag')).toBeInTheDocument();
    });

    // Remove tag
    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    fireEvent.click(removeButtons[0]);

    await waitFor(() => {
      expect(screen.queryByText('fantasy')).not.toBeInTheDocument();
    });
  });

  it('enforces tag limit', async () => {
    renderWithRouter(<EntryPointEditPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Adventure')).toBeInTheDocument();
    });

    // Add tags up to limit
    const tagInput = screen.getByPlaceholderText('Add a tag');
    for (let i = 0; i < 8; i++) { // Already has 2, so add 8 more to reach 10
      fireEvent.change(tagInput, { target: { value: `tag-${i}` } });
      fireEvent.click(screen.getByRole('button', { name: /add/i }));
    }

    // Try to add one more
    fireEvent.change(tagInput, { target: { value: 'extra-tag' } });
    const addButton = screen.getByRole('button', { name: /add/i });
    
    expect(addButton).toBeDisabled();
  });

  it('shows lifecycle options based on role', async () => {
    // Mock moderator role
    vi.mocked(require('@/admin/routeGuard').useAppRoles).mockReturnValue({
      isCreator: false,
      isModerator: true,
      isAdmin: false,
      roles: ['moderator'],
      isLoading: false,
      error: null
    });

    renderWithRouter(<EntryPointEditPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Adventure')).toBeInTheDocument();
    });

    // Should show lifecycle dropdown for moderators
    const lifecycleSelect = screen.getByDisplayValue('Draft');
    expect(lifecycleSelect).toBeInTheDocument();
  });

  it('hides lifecycle options for creators', async () => {
    renderWithRouter(<EntryPointEditPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Adventure')).toBeInTheDocument();
    });

    // Should show note about lifecycle restrictions
    expect(screen.getByText(/As a creator, you can only set lifecycle to Draft/)).toBeInTheDocument();
  });

  it('handles create new entry point', async () => {
    // Mock new entry point route
    vi.mocked(require('react-router-dom').useParams).mockReturnValue({ id: 'new' });

    const mockCreate = vi.mocked(entryPointsService.createEntryPoint);
    mockCreate.mockResolvedValue({ ...mockEntryPoint, id: 'new-entry' });

    renderWithRouter(<EntryPointEditPage />);

    await waitFor(() => {
      expect(screen.getByText('Create Entry Point')).toBeInTheDocument();
    });

    // Fill form
    const titleInput = screen.getByPlaceholderText('Enter entry point title');
    fireEvent.change(titleInput, { target: { value: 'New Adventure' } });

    const slugInput = screen.getByPlaceholderText('url-friendly-identifier');
    fireEvent.change(slugInput, { target: { value: 'new-adventure' } });

    const descriptionInput = screen.getByPlaceholderText('Brief description of the entry point');
    fireEvent.change(descriptionInput, { target: { value: 'A new adventure' } });

    // Save
    const saveButton = screen.getByRole('button', { name: /create entry point/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith({
        title: 'New Adventure',
        slug: 'new-adventure',
        description: 'A new adventure',
        // ... other required fields
      });
    });
  });

  it('handles loading state', () => {
    // Mock loading state
    vi.mocked(entryPointsService.getEntryPoint).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    renderWithRouter(<EntryPointEditPage />);

    expect(screen.getByText('Loading entry point...')).toBeInTheDocument();
  });

  it('handles error state', async () => {
    // Mock error
    vi.mocked(entryPointsService.getEntryPoint).mockRejectedValue(
      new Error('Entry point not found')
    );

    renderWithRouter(<EntryPointEditPage />);

    await waitFor(() => {
      expect(screen.getByText('Entry point not found')).toBeInTheDocument();
    });
  });
});











