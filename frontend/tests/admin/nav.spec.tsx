/**
 * Admin Navigation Tests
 * Phase 2: Test navigation rendering based on user roles
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AdminNav } from '@/admin/components/AdminNav';
import { AppRolesProvider } from '@/admin/routeGuard';

// Mock the app roles context
const mockUseAppRoles = vi.fn();

vi.mock('@/admin/routeGuard', async () => {
  const actual = await vi.importActual('@/admin/routeGuard');
  return {
    ...actual,
    useAppRoles: () => mockUseAppRoles(),
  };
});

const renderWithRouter = (children: React.ReactNode) => {
  return render(
    <BrowserRouter>
      <AppRolesProvider>
        {children}
      </AppRolesProvider>
    </BrowserRouter>
  );
};

describe('AdminNav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show basic navigation for creators', () => {
    mockUseAppRoles.mockReturnValue({
      isCreator: true,
      isModerator: false,
      isAdmin: false,
      roles: [],
      loading: false,
      error: null
    });

    renderWithRouter(<AdminNav />);

    // Should show basic navigation
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Entry Points')).toBeInTheDocument();
    expect(screen.getByText('Prompt Segments')).toBeInTheDocument();
    expect(screen.getByText('NPCs')).toBeInTheDocument();

    // Should not show moderator/admin only items
    expect(screen.queryByText('Reviews')).not.toBeInTheDocument();
    expect(screen.queryByText('Reports')).not.toBeInTheDocument();
    expect(screen.queryByText('Roles')).not.toBeInTheDocument();
  });

  it('should show moderator navigation for moderators', () => {
    mockUseAppRoles.mockReturnValue({
      isCreator: true,
      isModerator: true,
      isAdmin: false,
      roles: ['moderator'],
      loading: false,
      error: null
    });

    renderWithRouter(<AdminNav />);

    // Should show basic navigation
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Entry Points')).toBeInTheDocument();
    expect(screen.getByText('Prompt Segments')).toBeInTheDocument();
    expect(screen.getByText('NPCs')).toBeInTheDocument();

    // Should show moderator items
    expect(screen.getByText('Reviews')).toBeInTheDocument();
    expect(screen.getByText('Reports')).toBeInTheDocument();

    // Should not show admin-only items
    expect(screen.queryByText('Roles')).not.toBeInTheDocument();
  });

  it('should show all navigation for admins', () => {
    mockUseAppRoles.mockReturnValue({
      isCreator: true,
      isModerator: true,
      isAdmin: true,
      roles: ['admin'],
      loading: false,
      error: null
    });

    renderWithRouter(<AdminNav />);

    // Should show all navigation items
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Entry Points')).toBeInTheDocument();
    expect(screen.getByText('Prompt Segments')).toBeInTheDocument();
    expect(screen.getByText('NPCs')).toBeInTheDocument();
    expect(screen.getByText('Reviews')).toBeInTheDocument();
    expect(screen.getByText('Reports')).toBeInTheDocument();
    expect(screen.getByText('Roles')).toBeInTheDocument();
  });

  it('should not show navigation for unauthenticated users', () => {
    mockUseAppRoles.mockReturnValue({
      isCreator: false,
      isModerator: false,
      isAdmin: false,
      roles: [],
      loading: false,
      error: null
    });

    renderWithRouter(<AdminNav />);

    // Should not show any navigation items
    expect(screen.queryByText('Home')).not.toBeInTheDocument();
    expect(screen.queryByText('Entry Points')).not.toBeInTheDocument();
    expect(screen.queryByText('Prompt Segments')).not.toBeInTheDocument();
    expect(screen.queryByText('NPCs')).not.toBeInTheDocument();
    expect(screen.queryByText('Reviews')).not.toBeInTheDocument();
    expect(screen.queryByText('Reports')).not.toBeInTheDocument();
    expect(screen.queryByText('Roles')).not.toBeInTheDocument();
  });

  it('should show loading state', () => {
    mockUseAppRoles.mockReturnValue({
      isCreator: false,
      isModerator: false,
      isAdmin: false,
      roles: [],
      loading: true,
      error: null
    });

    renderWithRouter(<AdminNav />);

    // Should not show any navigation items while loading
    expect(screen.queryByText('Home')).not.toBeInTheDocument();
    expect(screen.queryByText('Entry Points')).not.toBeInTheDocument();
  });

  it('should handle error state', () => {
    mockUseAppRoles.mockReturnValue({
      isCreator: false,
      isModerator: false,
      isAdmin: false,
      roles: [],
      loading: false,
      error: 'Failed to fetch roles'
    });

    renderWithRouter(<AdminNav />);

    // Should not show any navigation items on error
    expect(screen.queryByText('Home')).not.toBeInTheDocument();
    expect(screen.queryByText('Entry Points')).not.toBeInTheDocument();
  });
});




