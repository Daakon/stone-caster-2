/**
 * AccessStatusProvider
 * Provides access request status via context to prevent duplicate queries
 */

import { createContext, useContext, type ReactNode } from 'react';
import { useAccessStatus, type AccessStatus } from '@/lib/queries/index';

interface AccessStatusContextValue {
  accessStatus: AccessStatus;
  isLoading: boolean;
  hasApprovedAccess: boolean;
}

const AccessStatusContext = createContext<AccessStatusContextValue | null>(null);

export function AccessStatusProvider({ children }: { children: ReactNode }) {
  const { data: accessStatus, isLoading, isError } = useAccessStatus();
  
  // Only consider approved if we have a status and it's 'approved'
  // If accessStatus is null, it means no request exists (not approved)
  // If isLoading, we don't know yet
  const hasApprovedAccess = accessStatus?.status === 'approved';
  
  // Debug logging
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log('[AccessStatusProvider]', {
      accessStatus,
      accessStatusStatus: accessStatus?.status,
      accessStatusKeys: accessStatus ? Object.keys(accessStatus) : [],
      accessStatusFull: accessStatus, // Log full object to see structure
      isLoading,
      isError,
      hasApprovedAccess,
      statusCheck: accessStatus?.status === 'approved',
    });
  }
  
  const value: AccessStatusContextValue = {
    accessStatus: accessStatus ?? null,
    isLoading,
    hasApprovedAccess,
  };
  
  return (
    <AccessStatusContext.Provider value={value}>
      {children}
    </AccessStatusContext.Provider>
  );
}

export function useAccessStatusContext() {
  const context = useContext(AccessStatusContext);
  if (!context) {
    throw new Error('useAccessStatusContext must be used within AccessStatusProvider');
  }
  return context;
}

