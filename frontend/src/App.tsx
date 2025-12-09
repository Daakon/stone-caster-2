import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
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
import { AccessStatusProvider } from './providers/AccessStatusProvider';
import { WalletProvider } from './providers/WalletProvider';
import { AuthProvider } from './providers/AuthProvider';
import { useAuth } from './hooks/useAuth';
import LandingPage from './pages/LandingPage';
import StoriesPage from './pages/stories/StoriesPage';
import StoryDetailPage from './pages/stories/StoryDetailPage';
import StartStoryPage from './pages/play/StartStoryPage';
import CharacterCreationPage from './pages/play/CharacterCreationPage';
import CharacterCreatorPageV2 from './pages/play/create/CharacterCreatorPage';
import PlayerGatewayPage from './pages/play/PlayerGatewayPage';
import WorldsPage from './pages/worlds/WorldsPage';
import NPCsPage from './pages/npcs/NPCsPage';
import RulesetsPage from './pages/rulesets/RulesetsPage';
import WorldDetailPage from './pages/worlds/WorldDetailPage';
import NPCDetailPage from './pages/npcs/NPCDetailPage';
import RulesetDetailPage from './pages/rulesets/RulesetDetailPage';
import ProfilePage from './pages/ProfilePage';
import MyCreationsDashboard from './pages/dashboard/creations/index';
import { MyCreationsPage } from './features/dashboard/MyCreationsPage';
import { CreateStoryPage } from './features/create-story';
import WorldEditor from './pages/dashboard/worlds/Editor';
import WorldManage from './pages/dashboard/worlds/Manage';
import EntityEditor from './pages/dashboard/entities/Editor';
import EntityManage from './pages/dashboard/entities/Manage';
import StoryManage from './pages/dashboard/stories/Manage';
import StoryStudio from './pages/dashboard/stories/Studio';
import PackEditor from './pages/dashboard/packs/Editor';
import PackManage from './pages/dashboard/packs/Manage';
import LoreEditor from './pages/dashboard/lore/Editor';
import LoreManage from './pages/dashboard/lore/Manage';
import CreatorProfileSettings from './pages/settings/CreatorProfile';
import GamePage from './pages/play/GamePage';
import SupportPage from './pages/SupportPage';
import AuthPage from './pages/AuthPage';
import AuthSuccessPage from './pages/AuthSuccessPage';
import RequestAccessPage from './pages/RequestAccessPage';
import { AdminRouteGuard } from './admin/AdminRouteGuard';
import NotFoundPage from './pages/NotFoundPage';
import { AdventureToStoryRedirect } from './components/redirects/AdventureToStoryRedirect';
import TestGalleryPage from './pages/_test_gallery';


/**
 * Inner App Content - Only renders after auth loading is complete
 * This prevents FOUC (Flash of Unauthenticated Content) by blocking
 * all route rendering until the session check is definitive
 */
function AppContent() {
  // Use the singleton useAuth hook to check loading state
  // This is the nuclear option - blocks the entire app until session is resolved
  const { isLoading } = useAuth();

  // CRITICAL: Block ALL rendering until auth loading is complete
  // This prevents the login screen flash by ensuring we never render
  // routes before we know the user's authentication state
  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary"></div>
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <>
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
          <Route path="/_test_gallery" element={<TestGalleryPage />} />

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
          <Route path="/play/:gameStateId" element={
            <EarlyAccessRoute>
              <GamePage />
            </EarlyAccessRoute>
          } />
          <Route path="/play/create/:storyId" element={
            <EarlyAccessRoute>
              <CharacterCreatorPageV2 />
            </EarlyAccessRoute>
          } />
          <Route path="/create-character/:storyId" element={
            <EarlyAccessRoute>
              <CharacterCreationPage />
            </EarlyAccessRoute>
          } />
          <Route path="/player-gateway/:storyId" element={
            <EarlyAccessRoute>
              <PlayerGatewayPage />
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

          {/* Protected routes - require authentication + early access */}
          <Route path="/profile" element={
            <ProtectedRoute>
              <EarlyAccessRoute>
                <ProfilePage />
              </EarlyAccessRoute>
            </ProtectedRoute>
          } />
          <Route path="/dashboard/creations" element={
            <ProtectedRoute>
              <EarlyAccessRoute>
                <Navigate to="/dashboard/creations/worlds" replace />
              </EarlyAccessRoute>
            </ProtectedRoute>
          } />
          <Route path="/dashboard/creations/:tab" element={
            <ProtectedRoute>
              <EarlyAccessRoute>
                <MyCreationsDashboard />
              </EarlyAccessRoute>
            </ProtectedRoute>
          } />
          {/* Story Creation Wizard Routes */}
          <Route path="/my-creations" element={
            <ProtectedRoute>
              <EarlyAccessRoute>
                <MyCreationsPage />
              </EarlyAccessRoute>
            </ProtectedRoute>
          } />
          <Route path="/create-story" element={
            <ProtectedRoute>
              <EarlyAccessRoute>
                <CreateStoryPage />
              </EarlyAccessRoute>
            </ProtectedRoute>
          } />
          <Route path="/dashboard/worlds/new" element={
            <ProtectedRoute>
              <EarlyAccessRoute>
                <WorldEditor />
              </EarlyAccessRoute>
            </ProtectedRoute>
          } />
          <Route path="/dashboard/worlds/edit/:id" element={
            <ProtectedRoute>
              <EarlyAccessRoute>
                <WorldEditor />
              </EarlyAccessRoute>
            </ProtectedRoute>
          } />
          <Route path="/dashboard/worlds/:id/manage" element={
            <ProtectedRoute>
              <EarlyAccessRoute>
                <WorldManage />
              </EarlyAccessRoute>
            </ProtectedRoute>
          } />
          <Route path="/dashboard/entities/new" element={
            <ProtectedRoute>
              <EarlyAccessRoute>
                <EntityEditor />
              </EarlyAccessRoute>
            </ProtectedRoute>
          } />
          <Route path="/dashboard/entities/edit/:id" element={
            <ProtectedRoute>
              <EarlyAccessRoute>
                <EntityEditor />
              </EarlyAccessRoute>
            </ProtectedRoute>
          } />
          <Route path="/dashboard/entities/:id/manage" element={
            <ProtectedRoute>
              <EarlyAccessRoute>
                <EntityManage />
              </EarlyAccessRoute>
            </ProtectedRoute>
          } />
          <Route path="/dashboard/stories/:id/studio" element={
            <ProtectedRoute>
              <EarlyAccessRoute>
                <StoryStudio />
              </EarlyAccessRoute>
            </ProtectedRoute>
          } />
          {/* Old wizard routes removed - show 404 */}
          <Route path="/dashboard/stories/new" element={
            <ProtectedRoute>
              <EarlyAccessRoute>
                <NotFoundPage />
              </EarlyAccessRoute>
            </ProtectedRoute>
          } />
          <Route path="/dashboard/stories/edit/:id" element={
            <ProtectedRoute>
              <EarlyAccessRoute>
                <NotFoundPage />
              </EarlyAccessRoute>
            </ProtectedRoute>
          } />
          <Route path="/dashboard/stories/:id/manage" element={
            <ProtectedRoute>
              <EarlyAccessRoute>
                <StoryManage />
              </EarlyAccessRoute>
            </ProtectedRoute>
          } />
          <Route path="/dashboard/packs/new" element={
            <ProtectedRoute>
              <EarlyAccessRoute>
                <PackEditor />
              </EarlyAccessRoute>
            </ProtectedRoute>
          } />
          <Route path="/dashboard/packs/edit/:id" element={
            <ProtectedRoute>
              <EarlyAccessRoute>
                <PackEditor />
              </EarlyAccessRoute>
            </ProtectedRoute>
          } />
          <Route path="/dashboard/packs/:id/manage" element={
            <ProtectedRoute>
              <EarlyAccessRoute>
                <PackManage />
              </EarlyAccessRoute>
            </ProtectedRoute>
          } />
          <Route path="/dashboard/lore/new" element={
            <ProtectedRoute>
              <EarlyAccessRoute>
                <LoreEditor />
              </EarlyAccessRoute>
            </ProtectedRoute>
          } />
          <Route path="/dashboard/lore/edit/:id" element={
            <ProtectedRoute>
              <EarlyAccessRoute>
                <LoreEditor />
              </EarlyAccessRoute>
            </ProtectedRoute>
          } />
          <Route path="/dashboard/lore/:id/manage" element={
            <ProtectedRoute>
              <EarlyAccessRoute>
                <LoreManage />
              </EarlyAccessRoute>
            </ProtectedRoute>
          } />
          <Route path="/settings/profile" element={
            <ProtectedRoute>
              <EarlyAccessRoute>
                <CreatorProfileSettings />
              </EarlyAccessRoute>
            </ProtectedRoute>
          } />

          {/* Admin routes - protected by AdminRouteGuard */}
          <Route path="/admin/*" element={<AdminRouteGuard />} />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AppLayout>
      <ToastProvider />
    </>
  );
}

function App() {
  const { initialize } = useAuthStore();

  // Build ID tracking removed - not used

  useEffect(() => {
    // Initialize guest cookie for anonymous users
    GuestCookieService.getOrCreateGuestCookie();

    // Initialize auth store listener (doesn't fetch - AuthProvider handles that via React Query)
    initialize();

    // Handle EARLY_ACCESS_REQUIRED errors globally
    const handleEarlyAccess = (event: Event) => {
      const customEvent = event as CustomEvent<{ path?: string }>;
      // Use window.location for navigation since we're outside React Router context here
      const currentPath = customEvent.detail?.path || window.location.pathname;
      if (currentPath !== '/') {
        window.location.href = '/';
      }
      // The actual toast/message will be shown by EarlyAccessBanner component
    };

    window.addEventListener('earlyAccessRequired', handleEarlyAccess);

    return () => {
      window.removeEventListener('earlyAccessRequired', handleEarlyAccess);
    };
  }, [initialize]);

  // Ensure default title is always "Stone Caster" if no page sets it
  useEffect(() => {
    // Set a default title if it's still "frontend" or empty
    // Note: Individual pages will set their own titles via useEffect
    if (!document.title || document.title === 'frontend' || document.title.trim() === '') {
      document.title = 'Stone Caster';
    }
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="system" storageKey="stonecaster-ui-theme">
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <AccessStatusProvider>
              <WalletProvider>
                <BrowserRouter
                  future={{
                    v7_startTransition: true,
                    v7_relativeSplatPath: true
                  }}
                >
                  <AppContent />
                </BrowserRouter>
              </WalletProvider>
            </AccessStatusProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

