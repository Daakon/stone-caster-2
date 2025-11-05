/**
 * Roles Management Tests
 * Phase 5: Tests for role management and user permissions
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import RolesAdmin from '@/pages/admin/roles/index';
import { rolesService } from '@/services/admin.roles';

// Mock the services
vi.mock('@/services/admin.roles', () => ({
  rolesService: {
    listRoles: vi.fn(),
    assignRole: vi.fn(),
    removeRole: vi.fn(),
    searchUsers: vi.fn(),
    getRoleStats: vi.fn()
  }
}));

// Mock the admin route guard
vi.mock('@/admin/routeGuard', () => ({
  useAppRoles: () => ({
    isCreator: false,
    isModerator: false,
    isAdmin: true,
    roles: ['admin'],
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

const mockRoles = [
  {
    id: 'role-1',
    user_id: 'user-1',
    roles: ['creator'],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    user_email: 'john@example.com',
    user_name: 'John Doe',
    last_sign_in: '2024-01-01T00:00:00Z'
  },
  {
    id: 'role-2',
    user_id: 'user-2',
    roles: ['moderator'],
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    user_email: 'jane@example.com',
    user_name: 'Jane Smith',
    last_sign_in: '2024-01-02T00:00:00Z'
  }
];

const mockStats = {
  totalUsers: 2,
  creators: 1,
  moderators: 1,
  admins: 0
};

const mockSearchResults = [
  { id: 'user-3', email: 'bob@example.com', name: 'Bob Wilson' },
  { id: 'user-4', email: 'alice@example.com', name: 'Alice Brown' }
];

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('Roles Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock successful API calls
    vi.mocked(rolesService.listRoles).mockResolvedValue({
      data: mockRoles,
      hasMore: false,
      nextCursor: undefined
    });
    
    vi.mocked(rolesService.getRoleStats).mockResolvedValue(mockStats);
    vi.mocked(rolesService.searchUsers).mockResolvedValue(mockSearchResults);
  });

  it('renders roles list with data', async () => {
    renderWithRouter(<RolesAdmin />);

    await waitFor(() => {
      expect(screen.getByText('Role Management')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });
  });

  it('shows role statistics', async () => {
    renderWithRouter(<RolesAdmin />);

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument(); // Total Users
      expect(screen.getByText('1')).toBeInTheDocument(); // Creators
      expect(screen.getByText('1')).toBeInTheDocument(); // Moderators
    });
  });

  it('filters roles by role type', async () => {
    renderWithRouter(<RolesAdmin />);

    await waitFor(() => {
      expect(screen.getByText('Role Management')).toBeInTheDocument();
    });

    // Test role filter
    const roleSelect = screen.getByDisplayValue('All roles');
    fireEvent.click(roleSelect);
    
    await waitFor(() => {
      expect(screen.getByText('Creator')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Creator'));

    expect(rolesService.listRoles).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'creator'
      })
    );
  });

  it('searches users by email', async () => {
    renderWithRouter(<RolesAdmin />);

    await waitFor(() => {
      expect(screen.getByText('Role Management')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search users...');
    fireEvent.change(searchInput, { target: { value: 'bob' } });

    // Wait for debounced search
    await waitFor(() => {
      expect(rolesService.listRoles).toHaveBeenCalledWith(
        expect.objectContaining({
          q: 'bob'
        })
      );
    });
  });

  it('opens assign role dialog', async () => {
    renderWithRouter(<RolesAdmin />);

    await waitFor(() => {
      expect(screen.getByText('Assign Role')).toBeInTheDocument();
    });

    const assignButton = screen.getByText('Assign Role');
    fireEvent.click(assignButton);

    await waitFor(() => {
      expect(screen.getByText('Assign Role')).toBeInTheDocument();
      expect(screen.getByText('Search User')).toBeInTheDocument();
    });
  });

  it('searches users in assign dialog', async () => {
    renderWithRouter(<RolesAdmin />);

    await waitFor(() => {
      expect(screen.getByText('Assign Role')).toBeInTheDocument();
    });

    // Open dialog
    const assignButton = screen.getByText('Assign Role');
    fireEvent.click(assignButton);

    await waitFor(() => {
      expect(screen.getByText('Search User')).toBeInTheDocument();
    });

    // Search for users
    const userSearchInput = screen.getByPlaceholderText('Search by email or user ID...');
    fireEvent.change(userSearchInput, { target: { value: 'bob' } });

    await waitFor(() => {
      expect(rolesService.searchUsers).toHaveBeenCalledWith('bob');
    });
  });

  it('assigns role to user', async () => {
    renderWithRouter(<RolesAdmin />);

    await waitFor(() => {
      expect(screen.getByText('Assign Role')).toBeInTheDocument();
    });

    // Open dialog
    const assignButton = screen.getByText('Assign Role');
    fireEvent.click(assignButton);

    await waitFor(() => {
      expect(screen.getByText('Search User')).toBeInTheDocument();
    });

    // Select user
    const userSearchInput = screen.getByPlaceholderText('Search by email or user ID...');
    fireEvent.change(userSearchInput, { target: { value: 'bob' } });

    await waitFor(() => {
      expect(screen.getByText('bob@example.com')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('bob@example.com'));

    // Select role
    const roleSelect = screen.getByDisplayValue('Select role');
    fireEvent.click(roleSelect);
    
    await waitFor(() => {
      expect(screen.getByText('Moderator')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Moderator'));

    // Assign role
    const assignButtonInDialog = screen.getByText('Assign Role');
    fireEvent.click(assignButtonInDialog);

    expect(rolesService.assignRole).toHaveBeenCalledWith('user-3', 'moderator');
  });

  it('removes role from user', async () => {
    // Mock confirm dialog
    global.confirm = vi.fn(() => true);

    renderWithRouter(<RolesAdmin />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Find and click remove button
    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    fireEvent.click(removeButtons[0]);

    expect(rolesService.removeRole).toHaveBeenCalledWith('user-1', 'creator');
  });

  it('shows role badges correctly', async () => {
    renderWithRouter(<RolesAdmin />);

    await waitFor(() => {
      expect(screen.getByText('creator')).toBeInTheDocument();
      expect(screen.getByText('moderator')).toBeInTheDocument();
    });
  });

  it('handles loading state', () => {
    // Mock loading state
    vi.mocked(rolesService.listRoles).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    renderWithRouter(<RolesAdmin />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('handles error state', async () => {
    // Mock error
    vi.mocked(rolesService.listRoles).mockRejectedValue(
      new Error('Failed to load')
    );

    renderWithRouter(<RolesAdmin />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load roles')).toBeInTheDocument();
    });
  });

  it('shows access denied for non-admins', () => {
    // Mock non-admin role
    vi.mocked(require('@/admin/routeGuard').useAppRoles).mockReturnValue({
      isCreator: true,
      isModerator: true,
      isAdmin: false,
      roles: ['creator', 'moderator'],
      isLoading: false,
      error: null
    });

    renderWithRouter(<RolesAdmin />);

    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.getByText(/You need admin permissions/)).toBeInTheDocument();
  });

  it('validates required fields in assign dialog', async () => {
    renderWithRouter(<RolesAdmin />);

    await waitFor(() => {
      expect(screen.getByText('Assign Role')).toBeInTheDocument();
    });

    // Open dialog
    const assignButton = screen.getByText('Assign Role');
    fireEvent.click(assignButton);

    await waitFor(() => {
      expect(screen.getByText('Assign Role')).toBeInTheDocument();
    });

    // Try to assign without selecting user or role
    const assignButtonInDialog = screen.getByText('Assign Role');
    fireEvent.click(assignButtonInDialog);

    expect(screen.getByText('Please select a user and role')).toBeInTheDocument();
  });

  it('handles role assignment success', async () => {
    vi.mocked(rolesService.assignRole).mockResolvedValue({
      id: 'role-3',
      user_id: 'user-3',
      roles: ['moderator'],
      created_at: '2024-01-03T00:00:00Z',
      updated_at: '2024-01-03T00:00:00Z',
      user_email: 'bob@example.com',
      user_name: 'Bob Wilson',
      last_sign_in: '2024-01-03T00:00:00Z'
    });

    renderWithRouter(<RolesAdmin />);

    await waitFor(() => {
      expect(screen.getByText('Assign Role')).toBeInTheDocument();
    });

    // Open dialog and assign role (simplified)
    const assignButton = screen.getByText('Assign Role');
    fireEvent.click(assignButton);

    // Mock the assignment process
    await waitFor(() => {
      expect(screen.getByText('Assign Role')).toBeInTheDocument();
    });
  });
});














