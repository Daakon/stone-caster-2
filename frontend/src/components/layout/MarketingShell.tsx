import { type ReactNode } from 'react';
import { GlobalHeader } from './GlobalHeader';
import { GlobalFooter } from './GlobalFooter';

interface MarketingShellProps {
  children: ReactNode;
}

export function MarketingShell({ children }: MarketingShellProps) {
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
