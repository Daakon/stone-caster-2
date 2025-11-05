/**
 * NPCs List Tests
 * Phase 6: Tests for the NPCs catalog and management
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import NPCsAdmin from '@/pages/admin/npcs/index';
import { npcsService } from '@/services/admin.npcs';

// Mock the services
vi.mock('@/services/admin.npcs', () => ({
  npcsService: {
    listNPCs: vi.fn(),
    getNPCBindingsCount: vi.fn(),
    getWorlds: vi.fn(),
    getRoleTags: vi.fn(),
    deleteNPC: vi.fn()
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

const mockNPCs = [
  {
    id: 'npc-1',
    world_id: 'world-1',
    name: 'Gandalf',
    archetype: 'Mentor',
    role_tags: ['wise', 'powerful'],
    portrait_url: 'https://example.com/gandalf.jpg',
    doc: { personality: 'wise and mysterious' },
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    world_name: 'Middle Earth'
  },
  {
    id: 'npc-2',
    world_id: 'world-1',
    name: 'Aragorn',
    archetype: 'Hero',
    role_tags: ['brave', 'noble'],
    portrait_url: null,
    doc: { personality: 'brave and determined' },
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    world_name: 'Middle Earth'
  }
];

const mockWorlds = [
  { id: 'world-1', name: 'Middle Earth' },
  { id: 'world-2', name: 'Narnia' }
];

const mockRoleTags = ['wise', 'powerful', 'brave', 'noble', 'mysterious'];

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('NPCs List', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock successful API calls
    vi.mocked(npcsService.listNPCs).mockResolvedValue({
      data: mockNPCs,
      hasMore: false,
      nextCursor: undefined
    });
    
    vi.mocked(npcsService.getWorlds).mockResolvedValue(mockWorlds);
    vi.mocked(npcsService.getRoleTags).mockResolvedValue(mockRoleTags);
    vi.mocked(npcsService.getNPCBindingsCount).mockResolvedValue(2);
  });

  it('renders NPCs list with data', async () => {
    renderWithRouter(<NPCsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('NPCs')).toBeInTheDocument();
      expect(screen.getByText('Gandalf')).toBeInTheDocument();
      expect(screen.getByText('Aragorn')).toBeInTheDocument();
    });
  });

  it('shows NPC details correctly', async () => {
    renderWithRouter(<NPCsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('Gandalf')).toBeInTheDocument();
      expect(screen.getByText('Mentor')).toBeInTheDocument();
      expect(screen.getByText('wise')).toBeInTheDocument();
      expect(screen.getByText('powerful')).toBeInTheDocument();
    });
  });

  it('filters NPCs by world', async () => {
    renderWithRouter(<NPCsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('NPCs')).toBeInTheDocument();
    });

    // Test world filter
    const worldSelect = screen.getByDisplayValue('All worlds');
    fireEvent.click(worldSelect);
    
    await waitFor(() => {
      expect(screen.getByText('Middle Earth')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Middle Earth'));

    expect(npcsService.listNPCs).toHaveBeenCalledWith(
      expect.objectContaining({
        worldId: 'world-1'
      })
    );
  });

  it('filters NPCs by role tags', async () => {
    renderWithRouter(<NPCsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('NPCs')).toBeInTheDocument();
    });

    // Test role tag filter
    const tagSelect = screen.getByDisplayValue('Add tag filter');
    fireEvent.click(tagSelect);
    
    await waitFor(() => {
      expect(screen.getByText('wise')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('wise'));

    expect(npcsService.listNPCs).toHaveBeenCalledWith(
      expect.objectContaining({
        tags: ['wise']
      })
    );
  });

  it('searches NPCs by name', async () => {
    renderWithRouter(<NPCsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('NPCs')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search NPCs...');
    fireEvent.change(searchInput, { target: { value: 'Gandalf' } });

    // Wait for debounced search
    await waitFor(() => {
      expect(npcsService.listNPCs).toHaveBeenCalledWith(
        expect.objectContaining({
          q: 'Gandalf'
        })
      );
    });
  });

  it('handles delete NPC action', async () => {
    // Mock confirm dialog
    global.confirm = vi.fn(() => true);

    renderWithRouter(<NPCsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('Gandalf')).toBeInTheDocument();
    });

    // Find and click delete button
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    fireEvent.click(deleteButtons[0]);

    expect(npcsService.deleteNPC).toHaveBeenCalledWith('npc-1', false);
  });

  it('handles force delete when bindings exist', async () => {
    // Mock confirm dialog
    global.confirm = vi.fn(() => true);
    
    // Mock delete error due to bindings
    vi.mocked(npcsService.deleteNPC).mockRejectedValue(
      new Error('Cannot delete NPC with existing bindings')
    );

    renderWithRouter(<NPCsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('Gandalf')).toBeInTheDocument();
    });

    // Find and click delete button
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    fireEvent.click(deleteButtons[0]);

    // Should show error about bindings
    await waitFor(() => {
      expect(screen.getByText(/Cannot delete NPC with existing bindings/)).toBeInTheDocument();
    });
  });

  it('shows role tag badges correctly', async () => {
    renderWithRouter(<NPCsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('wise')).toBeInTheDocument();
      expect(screen.getByText('powerful')).toBeInTheDocument();
      expect(screen.getByText('brave')).toBeInTheDocument();
      expect(screen.getByText('noble')).toBeInTheDocument();
    });
  });

  it('shows bindings count', async () => {
    renderWithRouter(<NPCsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('2 bindings')).toBeInTheDocument();
    });
  });

  it('handles loading state', () => {
    // Mock loading state
    vi.mocked(npcsService.listNPCs).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    renderWithRouter(<NPCsAdmin />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('handles error state', async () => {
    // Mock error
    vi.mocked(npcsService.listNPCs).mockRejectedValue(
      new Error('Failed to load')
    );

    renderWithRouter(<NPCsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load NPCs')).toBeInTheDocument();
    });
  });

  it('shows add button for moderators/admins', () => {
    // Mock moderator role
    vi.mocked(require('@/admin/routeGuard').useAppRoles).mockReturnValue({
      isCreator: false,
      isModerator: true,
      isAdmin: false,
      roles: ['moderator'],
      isLoading: false,
      error: null
    });

    renderWithRouter(<NPCsAdmin />);

    expect(screen.getByText('Add NPC')).toBeInTheDocument();
  });

  it('hides add button for creators', () => {
    // Mock creator role
    vi.mocked(require('@/admin/routeGuard').useAppRoles).mockReturnValue({
      isCreator: true,
      isModerator: false,
      isAdmin: false,
      roles: ['creator'],
      isLoading: false,
      error: null
    });

    renderWithRouter(<NPCsAdmin />);

    expect(screen.queryByText('Add NPC')).not.toBeInTheDocument();
  });

  it('shows world information', async () => {
    renderWithRouter(<NPCsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('Middle Earth')).toBeInTheDocument();
    });
  });

  it('shows archetype badges', async () => {
    renderWithRouter(<NPCsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('Mentor')).toBeInTheDocument();
      expect(screen.getByText('Hero')).toBeInTheDocument();
    });
  });

  it('handles NPCs without archetypes', async () => {
    const npcsWithoutArchetype = [
      {
        ...mockNPCs[0],
        archetype: null
      }
    ];

    vi.mocked(npcsService.listNPCs).mockResolvedValue({
      data: npcsWithoutArchetype,
      hasMore: false,
      nextCursor: undefined
    });

    renderWithRouter(<NPCsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('None')).toBeInTheDocument();
    });
  });

  it('handles NPCs without role tags', async () => {
    const npcsWithoutTags = [
      {
        ...mockNPCs[0],
        role_tags: []
      }
    ];

    vi.mocked(npcsService.listNPCs).mockResolvedValue({
      data: npcsWithoutTags,
      hasMore: false,
      nextCursor: undefined
    });

    renderWithRouter(<NPCsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('No tags')).toBeInTheDocument();
    });
  });
});















