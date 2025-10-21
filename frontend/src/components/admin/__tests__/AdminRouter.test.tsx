import { render, screen } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { AdminRouter } from '../AdminRouter';
import { useAdminRole } from '@/hooks/useAdminRole';

// Mock the admin role hook
jest.mock('@/hooks/useAdminRole');
const mockUseAdminRole = useAdminRole as jest.MockedFunction<typeof useAdminRole>;

// Mock PromptAdmin component
jest.mock('@/pages/admin/PromptAdmin', () => {
  return function MockPromptAdmin() {
    return <div>Prompt Admin Component</div>;
  };
});

const renderWithRouter = (initialEntries: string[] = ['/admin']) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AdminRouter />
    </MemoryRouter>
  );
};

describe('AdminRouter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should redirect to /admin/prompts when accessing /admin', () => {
    mockUseAdminRole.mockReturnValue({
      isAdmin: true,
      isLoading: false,
      userRole: 'prompt_admin',
      error: null,
    });

    renderWithRouter(['/admin']);

    expect(screen.getByText('Prompt Admin Component')).toBeInTheDocument();
  });

  it('should render prompts page when accessing /admin/prompts', () => {
    mockUseAdminRole.mockReturnValue({
      isAdmin: true,
      isLoading: false,
      userRole: 'prompt_admin',
      error: null,
    });

    renderWithRouter(['/admin/prompts']);

    expect(screen.getByText('Prompt Admin Component')).toBeInTheDocument();
  });

  it('should redirect unknown admin routes to /admin/prompts', () => {
    mockUseAdminRole.mockReturnValue({
      isAdmin: true,
      isLoading: false,
      userRole: 'prompt_admin',
      error: null,
    });

    renderWithRouter(['/admin/unknown']);

    expect(screen.getByText('Prompt Admin Component')).toBeInTheDocument();
  });

  it('should show access denied when user is not admin', () => {
    mockUseAdminRole.mockReturnValue({
      isAdmin: false,
      isLoading: false,
      userRole: 'user',
      error: 'Insufficient permissions',
    });

    renderWithRouter(['/admin/prompts']);

    expect(screen.getByText('Access Denied')).toBeInTheDocument();
  });

  it('should show loading state when verifying role', () => {
    mockUseAdminRole.mockReturnValue({
      isAdmin: false,
      isLoading: true,
      userRole: null,
      error: null,
    });

    renderWithRouter(['/admin/prompts']);

    expect(screen.getByText('Verifying Access')).toBeInTheDocument();
  });
});









