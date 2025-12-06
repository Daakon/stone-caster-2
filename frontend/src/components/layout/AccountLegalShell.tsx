import { type ReactNode, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { GlobalHeader } from './GlobalHeader';
import { GlobalFooter } from './GlobalFooter';
import { makeTitle } from '@/lib/meta';

interface AccountLegalShellProps {
  children: ReactNode;
}

export function AccountLegalShell({ children }: AccountLegalShellProps) {
  const location = useLocation();

  // Set default title for account/legal routes (individual pages can override)
  useEffect(() => {
    const pathname = location.pathname;
    
    // Only set default if no specific title is set by the page component
    // Most pages (Profile, Wallet, etc.) set their own titles
    if (pathname.startsWith('/dashboard') && !document.title.includes('Dashboard')) {
      document.title = makeTitle(['Dashboard', 'Stone Caster']);
    }
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col">
      <GlobalHeader variant="full" />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <GlobalFooter />
    </div>
  );
}
