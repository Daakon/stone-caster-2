/**
 * Admin Route Guards Tests
 * Phase 2: Test route protection and access control
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Guarded } from '@/admin/routeGuard';
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

const TestComponent = () => <div>Protected Content</div>;
const AccessDeniedComponent = () => <div>Access Denied</div>;

const renderWithRouter = (children: React.ReactNode) => {
  return render(
    <BrowserRouter>
      <AppRolesProvider>
        <Routes>
          <Route path="/test" element={children} />
        </Routes>
      </AppRolesProvider>
    </BrowserRouter>
  );
};

describe('Guarded Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should allow access for creator role', () => {
    mockUseAppRoles.mockReturnValue({
      isCreator: true,
      isModerator: false,
      isAdmin: false,
      roles: [],
      loading: false,
      error: null
    });

    renderWithRouter(
      <Guarded allow="creator">
        <TestComponent />
      </Guarded>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('should allow access for moderator role', () => {
    mockUseAppRoles.mockReturnValue({
      isCreator: true,
      isModerator: true,
      isAdmin: false,
      roles: ['moderator'],
      loading: false,
      error: null
    });

    renderWithRouter(
      <Guarded allow="moderator">
        <TestComponent />
      </Guarded>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('should allow access for admin role', () => {
    mockUseAppRoles.mockReturnValue({
      isCreator: true,
      isModerator: true,
      isAdmin: true,
      roles: ['admin'],
      loading: false,
      error: null
    });

    renderWithRouter(
      <Guarded allow="admin">
        <TestComponent />
      </Guarded>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('should deny access for insufficient permissions', () => {
    mockUseAppRoles.mockReturnValue({
      isCreator: true,
      isModerator: false,
      isAdmin: false,
      roles: [],
      loading: false,
      error: null
    });

    renderWithRouter(
      <Guarded allow="admin">
        <TestComponent />
      </Guarded>
    );

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
  });

  it('should allow access for multiple roles (OR logic)', () => {
    mockUseAppRoles.mockReturnValue({
      isCreator: true,
      isModerator: true,
      isAdmin: false,
      roles: ['moderator'],
      loading: false,
      error: null
    });

    renderWithRouter(
      <Guarded allow={['moderator', 'admin']}>
        <TestComponent />
      </Guarded>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('should show custom fallback when access denied', () => {
    mockUseAppRoles.mockReturnValue({
      isCreator: true,
      isModerator: false,
      isAdmin: false,
      roles: [],
      loading: false,
      error: null
    });

    renderWithRouter(
      <Guarded allow="admin" fallback={<AccessDeniedComponent />}>
        <TestComponent />
      </Guarded>
    );

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
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

    renderWithRouter(
      <Guarded allow="creator">
        <TestComponent />
      </Guarded>
    );

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    expect(screen.getByText('Loading permissions...')).toBeInTheDocument();
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

    renderWithRouter(
      <Guarded allow="creator">
        <TestComponent />
      </Guarded>
    );

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    expect(screen.getByText('Permission Error')).toBeInTheDocument();
    expect(screen.getByText('Failed to fetch roles')).toBeInTheDocument();
  });

  it('should deny access for unauthenticated users', () => {
    mockUseAppRoles.mockReturnValue({
      isCreator: false,
      isModerator: false,
      isAdmin: false,
      roles: [],
      loading: false,
      error: null
    });

    renderWithRouter(
      <Guarded allow="creator">
        <TestComponent />
      </Guarded>
    );

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
  });
});





