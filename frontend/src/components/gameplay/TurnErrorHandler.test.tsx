import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TurnErrorHandler } from './TurnErrorHandler';

describe('TurnErrorHandler', () => {
  const defaultProps = {
    error: 'Test error message',
    onRetry: vi.fn(),
    onGoToWallet: vi.fn(),
    onGoToHelp: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Insufficient Stones Error', () => {
    it('should display insufficient stones error correctly', () => {
      render(
        <TurnErrorHandler
          {...defaultProps}
          error="Insufficient casting stones"
          errorCode="insufficient_stones"
        />
      );

      expect(screen.getByText('Insufficient Casting Stones')).toBeInTheDocument();
      expect(screen.getByText("You don't have enough stones to perform this action.")).toBeInTheDocument();
      expect(screen.getByText('Add stones to your wallet')).toBeInTheDocument();
      expect(screen.getByText('Go to Wallet')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    it('should call onGoToWallet when wallet button is clicked', () => {
      const onGoToWallet = vi.fn();
      render(
        <TurnErrorHandler
          {...defaultProps}
          errorCode="insufficient_stones"
          onGoToWallet={onGoToWallet}
        />
      );

      fireEvent.click(screen.getByText('Go to Wallet'));
      expect(onGoToWallet).toHaveBeenCalledTimes(1);
    });

    it('should show helpful information for insufficient stones', () => {
      render(
        <TurnErrorHandler
          {...defaultProps}
          errorCode="insufficient_stones"
        />
      );

      expect(screen.getByText(/Need more stones\?/)).toBeInTheDocument();
      expect(screen.getByText(/You can purchase additional casting stones/)).toBeInTheDocument();
    });
  });

  describe('Timeout Error', () => {
    it('should display timeout error correctly', () => {
      render(
        <TurnErrorHandler
          {...defaultProps}
          error="Request timeout"
          errorCode="upstream_timeout"
        />
      );

      expect(screen.getByText('Action Timeout')).toBeInTheDocument();
      expect(screen.getByText('The action took too long to process. This might be due to high server load.')).toBeInTheDocument();
      expect(screen.getByText('Try again in a moment')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    it('should show helpful information for timeout', () => {
      render(
        <TurnErrorHandler
          {...defaultProps}
          errorCode="upstream_timeout"
        />
      );

      expect(screen.getByText(/Server busy\?/)).toBeInTheDocument();
      expect(screen.getByText(/During peak times, actions may take longer to process/)).toBeInTheDocument();
    });
  });

  describe('Validation Error', () => {
    it('should display validation error correctly', () => {
      render(
        <TurnErrorHandler
          {...defaultProps}
          error="Invalid action"
          errorCode="validation_failed"
        />
      );

      expect(screen.getByText('Invalid Action')).toBeInTheDocument();
      expect(screen.getByText('The action you tried to perform is not valid in this context.')).toBeInTheDocument();
      expect(screen.getByText('Try a different action')).toBeInTheDocument();
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });

    it('should show helpful information for validation error', () => {
      render(
        <TurnErrorHandler
          {...defaultProps}
          errorCode="validation_failed"
        />
      );

      expect(screen.getByText(/Action not allowed\?/)).toBeInTheDocument();
      expect(screen.getByText(/Some actions may not be valid in your current situation/)).toBeInTheDocument();
    });
  });

  describe('Network Error', () => {
    it('should display network error correctly', () => {
      render(
        <TurnErrorHandler
          {...defaultProps}
          error="Network error"
          errorCode="network_error"
        />
      );

      expect(screen.getByText('Connection Error')).toBeInTheDocument();
      expect(screen.getByText('Unable to connect to the server. Please check your internet connection.')).toBeInTheDocument();
      expect(screen.getByText('Retry when connection is restored')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  describe('Idempotency Error', () => {
    it('should display idempotency error correctly', () => {
      render(
        <TurnErrorHandler
          {...defaultProps}
          error="Duplicate action"
          errorCode="idempotency_required"
        />
      );

      expect(screen.getByText('Duplicate Action')).toBeInTheDocument();
      expect(screen.getByText('This action was already submitted. Please wait for it to complete.')).toBeInTheDocument();
      expect(screen.getByText('Wait for the current action to finish')).toBeInTheDocument();
      // Should not show retry button for idempotency errors
      expect(screen.queryByText('Retry')).not.toBeInTheDocument();
    });
  });

  describe('Generic Error', () => {
    it('should display generic error correctly', () => {
      render(
        <TurnErrorHandler
          {...defaultProps}
          error="Something went wrong"
          errorCode="unknown_error"
        />
      );

      expect(screen.getByText('Action Failed')).toBeInTheDocument();
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText('Please try again')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    it('should use error message when no error code provided', () => {
      render(
        <TurnErrorHandler
          {...defaultProps}
          error="Custom error message"
        />
      );

      expect(screen.getByText('Action Failed')).toBeInTheDocument();
      expect(screen.getByText('Custom error message')).toBeInTheDocument();
    });
  });

  describe('Retry Functionality', () => {
    it('should call onRetry when retry button is clicked', () => {
      const onRetry = vi.fn();
      render(
        <TurnErrorHandler
          {...defaultProps}
          onRetry={onRetry}
        />
      );

      fireEvent.click(screen.getByText('Retry'));
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('should disable retry button when isRetrying is true', () => {
      render(
        <TurnErrorHandler
          {...defaultProps}
          isRetrying={true}
        />
      );

      const retryButton = screen.getByText('Retry');
      expect(retryButton).toBeDisabled();
    });

    it('should show loading spinner when retrying', () => {
      render(
        <TurnErrorHandler
          {...defaultProps}
          isRetrying={true}
        />
      );

      // Should show spinner icon (RefreshCw with animate-spin class)
      const spinner = screen.getByRole('button', { name: /retry/i });
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Help Functionality', () => {
    it('should call onGoToHelp when help button is clicked', () => {
      const onGoToHelp = vi.fn();
      render(
        <TurnErrorHandler
          {...defaultProps}
          onGoToHelp={onGoToHelp}
        />
      );

      fireEvent.click(screen.getByText('Get Help'));
      expect(onGoToHelp).toHaveBeenCalledTimes(1);
    });

    it('should not show help button when onGoToHelp is not provided', () => {
      const { onGoToHelp, ...propsWithoutHelp } = defaultProps;
      render(
        <TurnErrorHandler
          {...propsWithoutHelp}
        />
      );

      expect(screen.queryByText('Get Help')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(
        <TurnErrorHandler
          {...defaultProps}
          errorCode="insufficient_stones"
        />
      );

      // Check for proper heading structure
      expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
      
      // Check for alert role
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('should have proper button labels', () => {
      render(
        <TurnErrorHandler
          {...defaultProps}
          errorCode="insufficient_stones"
        />
      );

      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /go to wallet/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /get help/i })).toBeInTheDocument();
    });
  });
});
