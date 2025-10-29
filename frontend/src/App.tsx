import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/auth';
import { ThemeProvider } from './contexts/theme-context-provider';
import { ToastProvider } from './components/ui/toast-provider';
import { SkipNavigation } from './components/ui/skip-navigation';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthRouter } from './components/AuthRouter';
import { GuestCookieService } from './services/guestCookie';
import LandingPage from './pages/LandingPage';
import AdventuresPage from './pages/AdventuresPage';
import MyAdventuresPage from './pages/MyAdventuresPage';
import AdventureDetailPage from './pages/AdventureDetailPage';
import StoriesPage from './pages/stories/StoriesPage';
import StoryDetailPage from './pages/stories/StoryDetailPage';
import CharacterCreationPage from './pages/CharacterSelectionPage';
import CharacterSelectionPage from './pages/CharacterSelectionPage';
import CharacterCreatorPage from './pages/CharacterCreatorPage';
import PlayerV3CreationPage from './pages/PlayerV3CreationPage';
import WorldsPage from './pages/WorldsPage';
import WorldDetailPage from './pages/WorldDetailPage';
import WalletPage from './pages/WalletPage';
import PaymentsPage from './pages/PaymentsPage';
import ProfilePage from './pages/ProfilePage';
import SupportPage from './pages/SupportPage';
import GamePage from './pages/GamePage';
import UnifiedGamePage from './pages/UnifiedGamePage';
import AuthPage from './pages/AuthPage';
import AuthSuccessPage from './pages/AuthSuccessPage';
import ScenarioPicker from './pages/player/ScenarioPicker';
import { AppAdminShell } from './admin/AppAdminShell';
import NotFoundPage from './pages/NotFoundPage';
import { AdventureToStoryRedirect } from './components/redirects/AdventureToStoryRedirect';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnMount: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
});

function App() {
  const { loading, initialize } = useAuthStore();

  useEffect(() => {
    const buildId =
      import.meta.env.VITE_BUILD_ID ??
      import.meta.env.VITE_COMMIT_SHA ??
      import.meta.env.VITE_APP_VERSION ??
      'local-dev';

    console.log('[BUILD]', {
      mode: import.meta.env.MODE,
      buildId,
    });
  }, []);

  useEffect(() => {
    console.log('[BOOT] App mounted');
    
    // Initialize guest cookie for anonymous users
    GuestCookieService.getOrCreateGuestCookie();
    
    // Initialize auth store
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
    <ErrorBoundary>
      <ThemeProvider defaultTheme="system" storageKey="stonecaster-ui-theme">
        <QueryClientProvider client={queryClient}>
          <BrowserRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true
            }}
          >
            {(() => {
              console.log('[BOOT] Router provider mounted');
              return null;
            })()}
            <AuthRouter />
            <SkipNavigation 
              links={[
                { href: '#main-content', label: 'Skip to main content' },
                { href: '#navigation', label: 'Skip to navigation' },
                { href: '#footer', label: 'Skip to footer' },
              ]}
            />
            <AppLayout>
              <AdventureToStoryRedirect />
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/adventures" element={<AdventuresPage />} />
                <Route path="/stories" element={<StoriesPage />} />
                <Route path="/my-adventures" element={<MyAdventuresPage />} />
                <Route path="/adventures/:adventureId/characters" element={<CharacterSelectionPage />} />
                <Route path="/adventures/:adventureId/create-character" element={<PlayerV3CreationPage />} />
                <Route path="/adventures/:id" element={<AdventureDetailPage />} />
                <Route path="/stories/:id" element={<StoryDetailPage />} />
                <Route path="/stories/:storyId/characters" element={<CharacterSelectionPage />} />
                <Route path="/stories/:storyId/create-character" element={<PlayerV3CreationPage />} />
                <Route path="/character-creation" element={<CharacterCreationPage />} />
                <Route path="/character-creator" element={<CharacterCreatorPage />} />
                <Route path="/worlds" element={<WorldsPage />} />
                <Route path="/worlds/:id" element={<WorldDetailPage />} />
                <Route path="/wallet" element={
                  <ProtectedRoute>
                    <WalletPage />
                  </ProtectedRoute>
                } />
                <Route path="/payments" element={
                  <ProtectedRoute>
                    <PaymentsPage />
                  </ProtectedRoute>
                } />
                <Route path="/profile" element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                } />
                <Route path="/support" element={<SupportPage pageType="faq" />} />
                <Route path="/scenarios" element={
                  <ProtectedRoute>
                    <ScenarioPicker />
                  </ProtectedRoute>
                } />
                <Route path="/game/:id" element={<GamePage />} />
                <Route path="/play/:gameId" element={<UnifiedGamePage />} />
                <Route path="/unified-game/:id" element={<UnifiedGamePage />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/auth/signin" element={<AuthPage mode="signin" />} />
                <Route path="/auth/signup" element={<AuthPage mode="signup" />} />
                <Route path="/auth/success" element={<AuthSuccessPage />} />
                <Route path="/admin/*" element={<AppAdminShell />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </AppLayout>
            <ToastProvider />
          </BrowserRouter>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;


