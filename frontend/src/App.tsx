import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/auth';
import HomePage from './pages/HomePage';
import AuthPage from './pages/AuthPage';
import CharacterCreationPage from './pages/CharacterCreationPage';
import CharacterListPage from './pages/CharacterListPage';
import GamePlayPage from './pages/GamePlayPage';
import WorldSelectionPage from './pages/WorldSelectionPage';
import './App.css';

const queryClient = new QueryClient();

function App() {
  const { user, loading, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" role="status" aria-label="Loading">
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route
            path="/characters"
            element={user ? <CharacterListPage /> : <Navigate to="/auth" />}
          />
          <Route
            path="/characters/create"
            element={user ? <CharacterCreationPage /> : <Navigate to="/auth" />}
          />
          <Route
            path="/worlds"
            element={user ? <WorldSelectionPage /> : <Navigate to="/auth" />}
          />
          <Route
            path="/play/:gameId"
            element={user ? <GamePlayPage /> : <Navigate to="/auth" />}
          />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;

