import { useState, useCallback } from 'react';

interface ErrorState {
  error: Error | null;
  isOpen: boolean;
}

export function useErrorHandler() {
  const [errorState, setErrorState] = useState<ErrorState>({
    error: null,
    isOpen: false
  });

  const handleError = useCallback((error: Error) => {
    console.error('Global error handler caught error:', error);
    
    setErrorState({
      error,
      isOpen: true
    });
  }, []);

  const clearError = useCallback(() => {
    setErrorState({
      error: null,
      isOpen: false
    });
  }, []);

  const retry = useCallback((retryFn?: () => void) => {
    clearError();
    if (retryFn) {
      try {
        retryFn();
      } catch (error) {
        handleError(error as Error);
      }
    }
  }, [clearError, handleError]);

  return {
    error: errorState.error,
    isErrorModalOpen: errorState.isOpen,
    handleError,
    clearError,
    retry
  };
}




