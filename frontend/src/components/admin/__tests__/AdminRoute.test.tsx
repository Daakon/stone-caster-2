import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AdminRoute } from '../AdminRoute';
import { useAdminRole } from '@/hooks/useAdminRole';

// Mock the admin role hook
jest.mock('@/hooks/useAdminRole');
const mockUseAdminRole = useAdminRole as jest.MockedFunction<typeof useAdminRole>;

const TestComponent = () => <div>Admin Content</div>;
const TestFallback = () => <div>Access Denied</div>;

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('AdminRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show loading state when verifying role', () => {
    mockUseAdminRole.mockReturnValue({
      isAdmin: false,
      isLoading: true,
      userRole: null,
      error: null,
    });

    renderWithRouter(
      <AdminRoute>
        <TestComponent />
      </AdminRoute>
    );

    expect(screen.getByText('Verifying Access')).toBeInTheDocument();
    expect(screen.getByText('Checking admin permissions...')).toBeInTheDocument();
  });

  it('should render children when user is admin', () => {
    mockUseAdminRole.mockReturnValue({
      isAdmin: true,
      isLoading: false,
      userRole: 'prompt_admin',
      error: null,
    });

    renderWithRouter(
      <AdminRoute>
        <TestComponent />
      </AdminRoute>
    );

    expect(screen.getByText('Admin Content')).toBeInTheDocument();
  });

  it('should show access denied when user is not admin', () => {
    mockUseAdminRole.mockReturnValue({
      isAdmin: false,
      isLoading: false,
      userRole: 'user',
      error: 'Insufficient permissions',
    });

    renderWithRouter(
      <AdminRoute>
        <TestComponent />
      </AdminRoute>
    );

    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.getByText('You need prompt_admin role to access this area.')).toBeInTheDocument();
  });

  it('should show fallback when provided and user is not admin', () => {
    mockUseAdminRole.mockReturnValue({
      isAdmin: false,
      isLoading: false,
      userRole: 'user',
      error: 'Insufficient permissions',
    });

    renderWithRouter(
      <AdminRoute fallback={<TestFallback />}>
        <TestComponent />
      </AdminRoute>
    );

    expect(screen.getByText('Access Denied')).toBeInTheDocument();
  });

  it('should show different error messages based on error type', () => {
    mockUseAdminRole.mockReturnValue({
      isAdmin: false,
      isLoading: false,
      userRole: null,
      error: 'Not authenticated',
    });

    renderWithRouter(
      <AdminRoute>
        <TestComponent />
      </AdminRoute>
    );

    expect(screen.getByText('You must be logged in to access this area.')).toBeInTheDocument();
  });
});























