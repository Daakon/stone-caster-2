/**
 * WalletProvider
 * Provides wallet data via context to prevent duplicate queries
 * Mounted in always-present layout
 */

import { createContext, useContext, type ReactNode } from 'react';
import { useWallet, type Wallet } from '@/lib/queries/index';

interface WalletContextValue {
  wallet: Wallet | null;
  isLoading: boolean;
  balance: number;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  // Only fetch on mount, no polling - updates via transaction invalidations
  const { data: wallet, isLoading } = useWallet();
  
  const value: WalletContextValue = {
    wallet: wallet ?? null,
    isLoading,
    balance: wallet?.balance ?? 0,
  };
  
  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWalletContext() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWalletContext must be used within WalletProvider');
  }
  return context;
}

