import { type ReactNode } from 'react';
import { GlobalHeader } from './GlobalHeader';
import { GlobalFooter } from './GlobalFooter';

interface ExploreShellProps {
  children: ReactNode;
}

export function ExploreShell({ children }: ExploreShellProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <GlobalHeader variant="full" showSearch={true} />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <GlobalFooter />
    </div>
  );
}
