import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/auth';
import { ThemeProvider } from './contexts/theme-context-provider';
import { ToastProvider } from './components/ui/toast-provider';
import { SkipNavigation } from './components/ui/skip-navigation';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { EarlyAccessRoute } from './components/auth/EarlyAccessRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthRouter } from './components/AuthRouter';
import { GuestCookieService } from './services/guestCookie';
import { handleEarlyAccessRequired } from './lib/earlyAccessHandler';
import LandingPage from './pages/LandingPage';
import StoriesPage from './pages/stories/StoriesPage';
import StoryDetailPage from './pages/stories/StoryDetailPage';
import StartStoryPage from './pages/play/StartStoryPage';
import WorldsPage from './pages/worlds/WorldsPage';
import NPCsPage from './pages/npcs/NPCsPage';
import RulesetsPage from './pages/rulesets/RulesetsPage';
import CharacterCreationPage from './pages/CharacterSelectionPage';
import CharacterSelectionPage from './pages/CharacterSelectionPage';
import CharacterCreatorPage from './pages/CharacterCreatorPage';
import PlayerV3CreationPage from './pages/PlayerV3CreationPage';
import WorldDetailPage from './pages/worlds/WorldDetailPage';
import NPCDetailPage from './pages/npcs/NPCDetailPage';
import RulesetDetailPage from './pages/rulesets/RulesetDetailPage';
import WalletPage from './pages/WalletPage';
import PaymentsPage from './pages/PaymentsPage';
import ProfilePage from './pages/ProfilePage';
import SupportPage from './pages/SupportPage';
import GamePage from './pages/GamePage';
import UnifiedGamePage from './pages/UnifiedGamePage';
import AuthPage from './pages/AuthPage';
import AuthSuccessPage from './pages/AuthSuccessPage';
import ScenarioPicker from './pages/player/ScenarioPicker';
import RequestAccessPage from './pages/RequestAccessPage';
import MyAdventuresPage from './pages/MyAdventuresPage';
import { AdminRouteGuard } from './admin/AdminRouteGuard';
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
  }, []);

  useEffect(() => {
    // Initialize guest cookie for anonymous users
    GuestCookieService.getOrCreateGuestCookie();
    
    // Initialize auth store
    initialize();

    // Handle EARLY_ACCESS_REQUIRED errors globally
    const handleEarlyAccess = async (event: CustomEvent<{ path?: string }>) => {
      const { useNavigate } = await import('react-router-dom');
      // Use window.location for navigation since we're outside React Router context here
      const currentPath = event.detail?.path || window.location.pathname;
      if (currentPath !== '/') {
        window.location.href = '/';
      }
      // The actual toast/message will be shown by EarlyAccessBanner component
    };

    window.addEventListener('earlyAccessRequired', handleEarlyAccess as EventListener);
    
    return () => {
      window.removeEventListener('earlyAccessRequired', handleEarlyAccess as EventListener);
    };
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
                {/* Public routes - no early access required */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/auth/signin" element={<AuthPage mode="signin" />} />
                <Route path="/auth/signup" element={<AuthPage mode="signup" />} />
                <Route path="/auth/success" element={<AuthSuccessPage />} />
                <Route path="/request-access" element={<RequestAccessPage />} />
                <Route path="/support" element={<SupportPage pageType="faq" />} />
                
                {/* Protected routes - require early access approval */}
                <Route path="/stories" element={
                  <EarlyAccessRoute>
                    <StoriesPage />
                  </EarlyAccessRoute>
                } />
                <Route path="/stories/:id" element={
                  <EarlyAccessRoute>
                    <StoryDetailPage />
                  </EarlyAccessRoute>
                } />
                <Route path="/play/start" element={
                  <EarlyAccessRoute>
                    <StartStoryPage />
                  </EarlyAccessRoute>
                } />
                <Route path="/stories/:storyId/characters" element={
                  <EarlyAccessRoute>
                    <CharacterSelectionPage />
                  </EarlyAccessRoute>
                } />
                <Route path="/stories/:storyId/create-character" element={
                  <EarlyAccessRoute>
                    <PlayerV3CreationPage />
                  </EarlyAccessRoute>
                } />
                <Route path="/worlds" element={
                  <EarlyAccessRoute>
                    <WorldsPage />
                  </EarlyAccessRoute>
                } />
                <Route path="/worlds/:slug" element={
                  <EarlyAccessRoute>
                    <WorldDetailPage />
                  </EarlyAccessRoute>
                } />
                <Route path="/npcs" element={
                  <EarlyAccessRoute>
                    <NPCsPage />
                  </EarlyAccessRoute>
                } />
                <Route path="/npcs/:id" element={
                  <EarlyAccessRoute>
                    <NPCDetailPage />
                  </EarlyAccessRoute>
                } />
                <Route path="/rulesets" element={
                  <EarlyAccessRoute>
                    <RulesetsPage />
                  </EarlyAccessRoute>
                } />
                <Route path="/rulesets/:id" element={
                  <EarlyAccessRoute>
                    <RulesetDetailPage />
                  </EarlyAccessRoute>
                } />
                <Route path="/character-creation" element={
                  <EarlyAccessRoute>
                    <CharacterCreationPage />
                  </EarlyAccessRoute>
                } />
                <Route path="/character-creator" element={
                  <EarlyAccessRoute>
                    <CharacterCreatorPage />
                  </EarlyAccessRoute>
                } />
                <Route path="/game/:id" element={
                  <EarlyAccessRoute>
                    <GamePage />
                  </EarlyAccessRoute>
                } />
                <Route path="/play/:gameId" element={
                  <EarlyAccessRoute>
                    <UnifiedGamePage />
                  </EarlyAccessRoute>
                } />
                <Route path="/unified-game/:id" element={
                  <EarlyAccessRoute>
                    <UnifiedGamePage />
                  </EarlyAccessRoute>
                } />
                
                {/* Protected routes - require authentication + early access */}
                <Route path="/wallet" element={
                  <ProtectedRoute>
                    <EarlyAccessRoute>
                      <WalletPage />
                    </EarlyAccessRoute>
                  </ProtectedRoute>
                } />
                <Route path="/payments" element={
                  <ProtectedRoute>
                    <EarlyAccessRoute>
                      <PaymentsPage />
                    </EarlyAccessRoute>
                  </ProtectedRoute>
                } />
                <Route path="/profile" element={
                  <ProtectedRoute>
                    <EarlyAccessRoute>
                      <ProfilePage />
                    </EarlyAccessRoute>
                  </ProtectedRoute>
                } />
                <Route path="/my-adventures" element={
                  <ProtectedRoute>
                    <EarlyAccessRoute>
                      <MyAdventuresPage />
                    </EarlyAccessRoute>
                  </ProtectedRoute>
                } />
                <Route path="/scenarios" element={
                  <ProtectedRoute>
                    <EarlyAccessRoute>
                      <ScenarioPicker />
                    </EarlyAccessRoute>
                  </ProtectedRoute>
                } />
                
                {/* Admin routes - protected by AdminRouteGuard */}
                <Route path="/admin/*" element={<AdminRouteGuard />} />
                
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

