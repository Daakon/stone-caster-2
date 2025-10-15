import { type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { MarketingShell } from './MarketingShell';
import { ExploreShell } from './ExploreShell';
import { PlayShell } from './PlayShell';
import { AccountLegalShell } from './AccountLegalShell';

export type LayoutVariant = 'marketing' | 'explore' | 'play' | 'account-legal' | 'admin';

interface AppLayoutProps {
  children: ReactNode;
}

// Route to layout mapping
const getLayoutVariant = (pathname: string): LayoutVariant => {
  // Marketing Shell - Landing, FAQ, About
  if (
    pathname === '/' ||
    pathname.startsWith('/faq') ||
    pathname.startsWith('/about') ||
    pathname.startsWith('/contact')
  ) {
    return 'marketing';
  }

  // Play Shell - Character Select/Create, Game
  if (
    pathname.includes('/characters') ||
    pathname.startsWith('/game/') ||
    pathname.startsWith('/play/')
  ) {
    return 'play';
  }

  // Admin Shell - Admin routes
  if (pathname.startsWith('/admin')) {
    return 'admin';
  }

  // Account/Legal Shell - Wallet, Payments, Profile, ToS, Privacy, AI Disclaimer
  if (
    pathname.startsWith('/wallet') ||
    pathname.startsWith('/payments') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/tos') ||
    pathname.startsWith('/privacy') ||
    pathname.startsWith('/ai-disclaimer')
  ) {
    return 'account-legal';
  }

  // Explore Shell - Adventures, Adventure Detail, Worlds, World Detail
  if (
    pathname.startsWith('/adventures') ||
    pathname.startsWith('/worlds')
  ) {
    return 'explore';
  }

  // Default to marketing for any unmatched routes
  return 'marketing';
};

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const variant = getLayoutVariant(location.pathname);
  
  console.log('AppLayout: pathname =', location.pathname, 'variant =', variant);

  switch (variant) {
    case 'marketing':
      return <MarketingShell>{children}</MarketingShell>;
    case 'explore':
      return <ExploreShell>{children}</ExploreShell>;
    case 'play':
      return <PlayShell>{children}</PlayShell>;
    case 'account-legal':
      return <AccountLegalShell>{children}</AccountLegalShell>;
    case 'admin':
      // Admin routes use their own layout (AdminLayout) - just render children
      return <>{children}</>;
    default:
      return <MarketingShell>{children}</MarketingShell>;
  }
}
