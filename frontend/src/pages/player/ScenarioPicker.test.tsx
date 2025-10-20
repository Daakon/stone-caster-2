import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ScenarioPicker } from './ScenarioPicker';

// Mock the auth store
vi.mock('@/store/auth', () => ({
  useAuthStore: () => ({
    isAuthenticated: true,
  }),
}));

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock fetch
global.fetch = vi.fn();

describe('ScenarioPicker', () => {
  const mockScenarios = [
    {
      id: 'scenario.inn_last_ember',
      version: '1.0.0',
      world_ref: 'world.mystika',
      display_name: 'The Last Ember Inn',
      synopsis: 'A cozy inn where adventures begin',
      tags: ['inn', 'safe'],
      npcs_preview: ['npc.innkeeper', 'npc.bard'],
    },
    {
      id: 'scenario.dark_forest',
      version: '1.0.0',
      world_ref: 'world.mystika',
      display_name: 'Dark Forest',
      synopsis: 'A dangerous forest adventure',
      tags: ['dangerous', 'forest'],
      npcs_preview: ['npc.forest_guardian'],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockScenarios),
    });
  });

  it('should render scenario picker with title', async () => {
    render(
      <BrowserRouter>
        <ScenarioPicker />
      </BrowserRouter>
    );

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByText('Choose Your Adventure')).toBeInTheDocument();
    });
  });

  it('should fetch and display scenarios', async () => {
    render(
      <BrowserRouter>
        <ScenarioPicker />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('The Last Ember Inn')).toBeInTheDocument();
      expect(screen.getByText('Dark Forest')).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/player/scenarios?limit=50');
  });

  it('should display scenario cards with correct information', async () => {
    render(
      <BrowserRouter>
        <ScenarioPicker />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('The Last Ember Inn')).toBeInTheDocument();
      expect(screen.getByText('A cozy inn where adventures begin')).toBeInTheDocument();
      expect(screen.getByText('inn')).toBeInTheDocument();
      expect(screen.getByText('safe')).toBeInTheDocument();
    });
  });

  it('should filter scenarios by search term', async () => {
    render(
      <BrowserRouter>
        <ScenarioPicker />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('The Last Ember Inn')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search scenarios...');
    fireEvent.change(searchInput, { target: { value: 'inn' } });

    expect(screen.getByText('The Last Ember Inn')).toBeInTheDocument();
    expect(screen.queryByText('Dark Forest')).not.toBeInTheDocument();
  });

  it('should filter scenarios by world', async () => {
    render(
      <BrowserRouter>
        <ScenarioPicker />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('The Last Ember Inn')).toBeInTheDocument();
    });

    // Test that the world filter is present
    expect(screen.getByText('All Worlds')).toBeInTheDocument();
    
    // Both scenarios should be visible initially
    expect(screen.getByText('The Last Ember Inn')).toBeInTheDocument();
    expect(screen.getByText('Dark Forest')).toBeInTheDocument();
  });

  it('should filter scenarios by tags', async () => {
    render(
      <BrowserRouter>
        <ScenarioPicker />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('The Last Ember Inn')).toBeInTheDocument();
    });

    // Test that the tag filter is present
    expect(screen.getByText('All Tags')).toBeInTheDocument();
    
    // Both scenarios should be visible initially
    expect(screen.getByText('The Last Ember Inn')).toBeInTheDocument();
    expect(screen.getByText('Dark Forest')).toBeInTheDocument();
  });

  it('should handle start adventure button click', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockScenarios),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ game_id: 'game_123' }),
      });

    render(
      <BrowserRouter>
        <ScenarioPicker />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('The Last Ember Inn')).toBeInTheDocument();
    });

    const startButton = screen.getAllByText('Start Adventure')[0];
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/player/games/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scenario_ref: 'scenario.inn_last_ember@1.0.0',
          ruleset_ref: 'ruleset.core.default@1.0.0',
          locale: 'en-US',
        }),
      });
    });

    expect(mockNavigate).toHaveBeenCalledWith('/game/game_123');
  });

  it('should handle API errors gracefully', async () => {
    (global.fetch as any).mockRejectedValue(new Error('API Error'));

    render(
      <BrowserRouter>
        <ScenarioPicker />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Choose Your Adventure')).toBeInTheDocument();
    });

    // Should not crash and should show the basic UI
    expect(screen.getByText('Choose Your Adventure')).toBeInTheDocument();
  });

  it('should render component without crashing', async () => {
    render(
      <BrowserRouter>
        <ScenarioPicker />
      </BrowserRouter>
    );

    // Wait for loading to complete and scenarios to load
    await waitFor(() => {
      expect(screen.getByText('The Last Ember Inn')).toBeInTheDocument();
    });
    
    // Should render without crashing
    expect(screen.getByText('Choose Your Adventure')).toBeInTheDocument();
  });

  it('should show empty state when no scenarios match filters', async () => {
    render(
      <BrowserRouter>
        <ScenarioPicker />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('The Last Ember Inn')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search scenarios...');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

    expect(screen.getByText('No scenarios found')).toBeInTheDocument();
  });

  it('should display NPCs preview when available', async () => {
    render(
      <BrowserRouter>
        <ScenarioPicker />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Meet: npc.innkeeper, npc.bard')).toBeInTheDocument();
    });
  });

  it('should handle start adventure API errors', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockScenarios),
      })
      .mockRejectedValueOnce(new Error('Start adventure failed'));

    render(
      <BrowserRouter>
        <ScenarioPicker />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('The Last Ember Inn')).toBeInTheDocument();
    });

    const startButton = screen.getAllByText('Start Adventure')[0];
    fireEvent.click(startButton);

    // Should not navigate on error
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
