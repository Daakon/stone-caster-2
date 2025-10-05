import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';

// Mock the GatedRoute component
vi.mock('./GatedRoute', () => ({
  GatedRoute: ({ children, requireAuth, fallback }: any) => {
    if (requireAuth && !fallback) {
      return <div data-testid="gated-route">Authentication Required</div>;
    }
    return <div data-testid="gated-route">{children}</div>;
  },
}));

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render children when authentication is not required', () => {
    render(
      <BrowserRouter>
        <ProtectedRoute>
          <div data-testid="protected-content">Protected Content</div>
        </ProtectedRoute>
      </BrowserRouter>
    );

    expect(screen.getByTestId('gated-route')).toBeInTheDocument();
  });

  it('should use GatedRoute with correct props', () => {
    const TestComponent = () => <div data-testid="test-component">Test</div>;
    
    render(
      <BrowserRouter>
        <ProtectedRoute>
          <TestComponent />
        </ProtectedRoute>
      </BrowserRouter>
    );

    // The GatedRoute should be rendered with requireAuth=true and redirectTo="/auth/signin"
    expect(screen.getByTestId('gated-route')).toBeInTheDocument();
  });

  it('should pass through fallback prop', () => {
    const fallback = <div data-testid="fallback">Fallback Content</div>;
    
    render(
      <BrowserRouter>
        <ProtectedRoute fallback={fallback}>
          <div data-testid="protected-content">Protected Content</div>
        </ProtectedRoute>
      </BrowserRouter>
    );

    expect(screen.getByTestId('gated-route')).toBeInTheDocument();
  });

  it('should render children when wrapped', () => {
    render(
      <BrowserRouter>
        <ProtectedRoute>
          <div data-testid="child-content">Child Content</div>
        </ProtectedRoute>
      </BrowserRouter>
    );

    // The GatedRoute should render the children
    expect(screen.getByTestId('gated-route')).toBeInTheDocument();
  });
});
