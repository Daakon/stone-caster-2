import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/auth';
import { ThemeProvider } from './contexts/theme-context-provider';
import { ToastProvider } from './components/ui/toast-provider';
import { SkipNavigation } from './components/ui/skip-navigation';
import { AppLayout } from './components/layout/AppLayout';
import LandingPage from './pages/LandingPage';
import AdventuresPage from './pages/AdventuresPage';
import AdventureDetailPage from './pages/AdventureDetailPage';
import CharacterSelectionPage from './pages/CharacterSelectionPage';
import WorldsPage from './pages/WorldsPage';
import WorldDetailPage from './pages/WorldDetailPage';
import WalletPage from './pages/WalletPage';
import PaymentsPage from './pages/PaymentsPage';
import ProfilePage from './pages/ProfilePage';
import SupportPage from './pages/SupportPage';
import GamePage from './pages/GamePage';
import NotFoundPage from './pages/NotFoundPage';

const queryClient = new QueryClient();

function App() {
  const { loading, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen w-full">
        <div 
          className="w-12 h-12 border-4 border-muted border-t-primary rounded-full animate-spin" 
          role="status" 
          aria-label="Loading"
        >
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider defaultTheme="system" storageKey="stonecaster-ui-theme">
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <SkipNavigation 
            links={[
              { href: '#main-content', label: 'Skip to main content' },
              { href: '#navigation', label: 'Skip to navigation' },
              { href: '#footer', label: 'Skip to footer' },
            ]}
          />
          <AppLayout>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/adventures" element={<AdventuresPage />} />
              <Route path="/adventures/:id" element={<AdventureDetailPage />} />
              <Route path="/adventures/:id/characters" element={<CharacterSelectionPage />} />
              <Route path="/game/:gameId" element={<GamePage />} />
              <Route path="/worlds" element={<WorldsPage />} />
              <Route path="/worlds/:id" element={<WorldDetailPage />} />
              <Route path="/wallet" element={<WalletPage />} />
              <Route path="/payments" element={<PaymentsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/tos" element={<SupportPage pageType="tos" />} />
              <Route path="/privacy" element={<SupportPage pageType="privacy" />} />
              <Route path="/ai-disclaimer" element={<SupportPage pageType="ai-disclaimer" />} />
              <Route path="/faq" element={<SupportPage pageType="faq" />} />
              <Route path="/about" element={<SupportPage pageType="about" />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </AppLayout>
          <ToastProvider />
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;

