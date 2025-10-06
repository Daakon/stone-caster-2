import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ErrorBanner } from './error-banner';
import { ApiErrorCode } from '@shared';

// Mock clipboard API
const mockWriteText = vi.fn();
Object.assign(navigator, {
  clipboard: {
    writeText: mockWriteText,
  },
});

describe('ErrorBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultError = {
    code: ApiErrorCode.INTERNAL_ERROR,
    message: 'Something went wrong',
  };

  it('should render error message', () => {
    render(<ErrorBanner error={defaultError} />);
    
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('should display traceId when provided', () => {
    const errorWithTraceId = {
      ...defaultError,
      traceId: '123e4567-e89b-12d3-a456-426614174000',
    };

    render(<ErrorBanner error={errorWithTraceId} />);
    
    expect(screen.getByText('Trace ID:')).toBeInTheDocument();
    expect(screen.getByText('123e4567-e89b-12d3-a456-426614174000')).toBeInTheDocument();
  });

  it('should not display traceId section when not provided', () => {
    render(<ErrorBanner error={defaultError} />);
    
    expect(screen.queryByText('Trace ID:')).not.toBeInTheDocument();
  });

  it('should copy traceId to clipboard when copy button is clicked', async () => {
    const errorWithTraceId = {
      ...defaultError,
      traceId: '123e4567-e89b-12d3-a456-426614174000',
    };

    mockWriteText.mockResolvedValue(undefined);

    render(<ErrorBanner error={errorWithTraceId} />);
    
    const copyButton = screen.getByTitle('Copy trace ID for support');
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000');
    });

    // Should show checkmark briefly
    expect(screen.getByTestId('check-icon')).toBeInTheDocument();
  });

  it('should handle clipboard copy failure gracefully', async () => {
    const errorWithTraceId = {
      ...defaultError,
      traceId: '123e4567-e89b-12d3-a456-426614174000',
    };

    mockWriteText.mockRejectedValue(new Error('Clipboard access denied'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<ErrorBanner error={errorWithTraceId} />);
    
    const copyButton = screen.getByTitle('Copy trace ID for support');
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to copy trace ID:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });

  it('should show retry button for retryable errors', () => {
    const retryableError = {
      code: ApiErrorCode.UPSTREAM_TIMEOUT,
      message: 'Request timed out',
    };

    const onRetry = vi.fn();

    render(<ErrorBanner error={retryableError} onRetry={onRetry} />);
    
    const retryButton = screen.getByText('Try Again');
    expect(retryButton).toBeInTheDocument();

    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalled();
  });

  it('should show sign in button for auth errors', () => {
    const authError = {
      code: ApiErrorCode.REQUIRES_AUTH,
      message: 'Authentication required',
    };

    const onSignIn = vi.fn();

    render(<ErrorBanner error={authError} onSignIn={onSignIn} />);
    
    const signInButton = screen.getByText('Sign In');
    expect(signInButton).toBeInTheDocument();

    fireEvent.click(signInButton);
    expect(onSignIn).toHaveBeenCalled();
  });

  it('should show wallet button for insufficient stones error', () => {
    const insufficientStonesError = {
      code: ApiErrorCode.INSUFFICIENT_STONES,
      message: 'Not enough stones',
    };

    const onGoToWallet = vi.fn();

    render(<ErrorBanner error={insufficientStonesError} onGoToWallet={onGoToWallet} />);
    
    const walletButton = screen.getByText('Go to Wallet');
    expect(walletButton).toBeInTheDocument();

    fireEvent.click(walletButton);
    expect(onGoToWallet).toHaveBeenCalled();
  });

  it('should show help button when onGoToHelp is provided', () => {
    const onGoToHelp = vi.fn();

    render(<ErrorBanner error={defaultError} onGoToHelp={onGoToHelp} />);
    
    const helpButton = screen.getByText('Get Help');
    expect(helpButton).toBeInTheDocument();

    fireEvent.click(helpButton);
    expect(onGoToHelp).toHaveBeenCalled();
  });

  it('should show dismiss button when onDismiss is provided', () => {
    const onDismiss = vi.fn();

    render(<ErrorBanner error={defaultError} onDismiss={onDismiss} />);
    
    const dismissButton = screen.getByRole('button', { name: /close/i });
    expect(dismissButton).toBeInTheDocument();

    fireEvent.click(dismissButton);
    expect(onDismiss).toHaveBeenCalled();
  });

  it('should show resume button for resume errors', () => {
    const resumeError = {
      code: ApiErrorCode.CONFLICT,
      message: 'Game already exists',
      existingGameId: 'existing-game-123',
    };

    const onResume = vi.fn();

    render(<ErrorBanner error={resumeError} onResume={onResume} />);
    
    const resumeButton = screen.getByText('Resume Game');
    expect(resumeButton).toBeInTheDocument();

    fireEvent.click(resumeButton);
    expect(onResume).toHaveBeenCalled();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <ErrorBanner error={defaultError} className="custom-class" />
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should be accessible with proper ARIA attributes', () => {
    render(<ErrorBanner error={defaultError} />);
    
    // Should have proper role and aria attributes
    const errorCard = screen.getByRole('alert');
    expect(errorCard).toBeInTheDocument();
  });

  it('should display support instructions for traceId', () => {
    const errorWithTraceId = {
      ...defaultError,
      traceId: '123e4567-e89b-12d3-a456-426614174000',
    };

    render(<ErrorBanner error={errorWithTraceId} />);
    
    expect(screen.getByText('Include this ID when reporting issues to support')).toBeInTheDocument();
  });

  it('should handle multiple action buttons correctly', () => {
    const errorWithMultipleActions = {
      code: ApiErrorCode.INSUFFICIENT_STONES,
      message: 'Not enough stones',
    };

    const onGoToWallet = vi.fn();
    const onGoToHelp = vi.fn();
    const onRetry = vi.fn();

    render(
      <ErrorBanner 
        error={errorWithMultipleActions} 
        onGoToWallet={onGoToWallet}
        onGoToHelp={onGoToHelp}
        onRetry={onRetry}
      />
    );
    
    expect(screen.getByText('Go to Wallet')).toBeInTheDocument();
    expect(screen.getByText('Get Help')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('should not show action buttons when callbacks are not provided', () => {
    const retryableError = {
      code: ApiErrorCode.UPSTREAM_TIMEOUT,
      message: 'Request timed out',
    };

    render(<ErrorBanner error={retryableError} />);
    
    expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
    expect(screen.queryByText('Sign In')).not.toBeInTheDocument();
    expect(screen.queryByText('Go to Wallet')).not.toBeInTheDocument();
    expect(screen.queryByText('Get Help')).not.toBeInTheDocument();
  });
});
