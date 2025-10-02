import { type ReactNode } from 'react';
import { GlobalHeader } from './GlobalHeader';
import { GlobalFooter } from './GlobalFooter';

interface AccountLegalShellProps {
  children: ReactNode;
}

export function AccountLegalShell({ children }: AccountLegalShellProps) {
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
