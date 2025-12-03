/**
 * Game Page Tests
 * Phase 7: Game Play Interface (Frontend)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import GamePage from './GamePage';
import { castStone, loadState } from '@/services/game-client';
import type { GameState } from '@shared/types/chimera-runtime';

// Mock the game client
vi.mock('@/services/game-client', () => ({
  castStone: vi.fn(),
  loadState: vi.fn(),
}));

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ gameStateId: 'test-game-state-id' }),
    useNavigate: () => mockNavigate,
  };
});

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const createMockGameState = (hp: number = 10): GameState => ({
  tier1_mechanical: {
    entities: {
      player: {
        stats: {
          hp,
          max_hp: 10,
          str: 3,
          dex: 2,
        },
      },
    },
  },
  tier0_narrative: {},
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>
  );
};

describe('GamePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  describe('Test A: Load', () => {
    it('should load initial game state and display HP in StatsPanel', async () => {
      const mockState = createMockGameState(10);
      vi.mocked(loadState).mockResolvedValue(mockState);

      renderWithProviders(<GamePage />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
      });

      // Verify HP is displayed
      await waitFor(() => {
        expect(screen.getByText(/HP/i)).toBeInTheDocument();
        expect(screen.getByText(/10 \/ 10/i)).toBeInTheDocument();
      });
    });

    it('should show loading state while fetching', () => {
      vi.mocked(loadState).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      renderWithProviders(<GamePage />);

      // Should show loading indicator
      expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument();
    });

    it('should show error state when load fails', async () => {
      vi.mocked(loadState).mockRejectedValue(new Error('Failed to load'));

      renderWithProviders(<GamePage />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to load game state/i)).toBeInTheDocument();
      });
    });
  });

  describe('Test B: Play Loop', () => {
    it('should process cast action, update log, and update HP in StatsPanel', async () => {
      const initialState = createMockGameState(10);
      const updatedState = createMockGameState(5); // HP reduced to 5

      vi.mocked(loadState).mockResolvedValue(initialState);
      vi.mocked(castStone).mockResolvedValue({
        mas1: {
          action_slug: 'attack',
          parameters: {},
          sentiment: 'aggressive',
        },
        engine: {
          success: true,
          outcome_summary: 'attack',
          numeric_deltas: {},
        },
        mas2: {
          ripple_narrative: 'Hit!',
          tier0_mutations: {},
        },
        updatedState,
      });

      renderWithProviders(<GamePage />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
      }, { timeout: 3000 });

      // Find input and submit button
      const input = screen.getByPlaceholderText(/What do you want to do/i);
      const castButton = screen.getByText(/Cast/i);

      // Type "attack" and submit
      fireEvent.change(input, { target: { value: 'attack' } });
      fireEvent.click(castButton);

      // Wait for the narrative to appear
      await waitFor(() => {
        expect(screen.getByText('Hit!')).toBeInTheDocument();
      });

      // Verify log contains the narrative
      expect(screen.getByText('Hit!')).toBeInTheDocument();

      // Verify StatsPanel updates to show HP: 5/10
      await waitFor(() => {
        expect(screen.getByText(/5 \/ 10/i)).toBeInTheDocument();
      });
    });

    it('should add player message optimistically before API call', async () => {
      const initialState = createMockGameState(10);
      vi.mocked(loadState).mockResolvedValue(initialState);
      
      // Delay the API response to test optimistic update
      vi.mocked(castStone).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                mas1: {
                  action_slug: 'attack',
                  parameters: {},
                  sentiment: 'aggressive',
                },
                engine: {
                  success: true,
                  outcome_summary: 'attack',
                  numeric_deltas: {},
                },
                mas2: {
                  ripple_narrative: 'You attack!',
                  tier0_mutations: {},
                },
                updatedState: initialState,
              });
            }, 100);
          })
      );

      renderWithProviders(<GamePage />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/What do you want to do/i);
      const castButton = screen.getByText(/Cast/i);

      fireEvent.change(input, { target: { value: 'attack enemy' } });
      fireEvent.click(castButton);

      // Player message should appear immediately (optimistic)
      await waitFor(() => {
        expect(screen.getByText('attack enemy')).toBeInTheDocument();
      });

      // Then narrator response should appear
      await waitFor(() => {
        expect(screen.getByText('You attack!')).toBeInTheDocument();
      }, { timeout: 200 });
    });

    it('should disable input during processing', async () => {
      const initialState = createMockGameState(10);
      vi.mocked(loadState).mockResolvedValue(initialState);
      
      vi.mocked(castStone).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      renderWithProviders(<GamePage />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/What do you want to do/i);
      const castButton = screen.getByText(/Cast/i);

      fireEvent.change(input, { target: { value: 'attack' } });
      fireEvent.click(castButton);

      // Input should be disabled
      await waitFor(() => {
        expect(input).toBeDisabled();
        expect(castButton).toBeDisabled();
      });
    });
  });

  describe('Additional Tests', () => {
    it('should handle Enter key to submit', async () => {
      const initialState = createMockGameState(10);
      vi.mocked(loadState).mockResolvedValue(initialState);
      vi.mocked(castStone).mockResolvedValue({
        mas1: {
          action_slug: 'inspect',
          parameters: {},
          sentiment: 'curious',
        },
        engine: {
          success: true,
          outcome_summary: 'inspect',
          numeric_deltas: {},
        },
        mas2: {
          ripple_narrative: 'You look around.',
          tier0_mutations: {},
        },
        updatedState: initialState,
      });

      renderWithProviders(<GamePage />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading/i)).not.toBeTheDocument();
      });

      const input = screen.getByPlaceholderText(/What do you want to do/i);
      
      fireEvent.change(input, { target: { value: 'look around' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText('You look around.')).toBeInTheDocument();
      });
    });

    it('should not submit empty input', async () => {
      const initialState = createMockGameState(10);
      vi.mocked(loadState).mockResolvedValue(initialState);

      renderWithProviders(<GamePage />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
      });

      const castButton = screen.getByText(/Cast/i);
      
      // Button should be disabled when input is empty
      expect(castButton).toBeDisabled();
    });
  });
});

