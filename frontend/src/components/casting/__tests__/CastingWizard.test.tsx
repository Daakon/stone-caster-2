/**
 * CastingWizard Component Tests
 * Phase 3-C: Guided Wizard Flow & Logic Integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CastingWizard } from '../CastingWizard';
import type { WorldDefinition, RulesetDefinition } from '@shared/types/chimera-authoring';

// Create a mock store that can be updated
const createMockStore = () => {
  const store = {
    currentStep: 'intent' as const,
    intent: null as string | null,
    worldId: null as string | null,
    selectedRulesetIds: new Set<string>(),
    entityIds: new Set<string>(),
    selectedFoundationId: null as string | null,
    setIntent: vi.fn(),
    setStep: vi.fn(),
    setWorld: vi.fn(),
    selectFoundation: vi.fn(),
    toggleExpansion: vi.fn(),
    toggleFlavor: vi.fn(),
    toggleEntity: vi.fn(),
    clearSelection: vi.fn(),
    getAvailableExpansions: vi.fn(() => []),
    validateDependencies: vi.fn(),
    autoSelectDefaults: vi.fn(),
    worldId: null,
    entityIds: new Set(),
    availableExpansions: [],
    availableFlavors: [],
  };

  return store;
};

let mockStore = createMockStore();

// Mock the store
vi.mock('@/stores/useCastingStore', () => ({
  useCastingStore: () => mockStore,
}));

// Mock API calls - must be defined inside factory to avoid hoisting issues
vi.mock('@/services/chimera-api', () => ({
  getWorlds: vi.fn(),
  getRulesets: vi.fn(),
  getEntities: vi.fn(),
  compileStory: vi.fn(),
}));

vi.mock('@/services/game-client', () => ({
  startGame: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Helper to render with QueryClientProvider
const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
};

// Helper to create mock worlds
const createMockWorld = (
  id: string,
  name: string,
  tags: string[] = []
): WorldDefinition => ({
  id,
  name,
  description: `Description for ${name}`,
  images: [],
  character_schema_extensions: {},
  lore_fragments: [],
  ...({ tags } as any),
});

// Helper to create mock rulesets
const createMockRuleset = (
  id: string,
  name: string,
  ui_category: 'foundation' | 'expansion' | 'flavor',
  options?: {
    dependencies?: string[];
  }
): RulesetDefinition => ({
  id,
  name,
  ui_category,
  dependencies: options?.dependencies || [],
  exclusion_group: null,
  description_short: null,
  description_long: null,
  provides_tags: [],
  state_contributions: {},
  actions: {},
  ai_instructions: {},
});

describe('CastingWizard', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockStore = createMockStore();
    
    const chimeraApi = await import('@/services/chimera-api');
    vi.mocked(chimeraApi.getWorlds).mockResolvedValue([]);
    vi.mocked(chimeraApi.getRulesets).mockResolvedValue([]);
    vi.mocked(chimeraApi.getEntities).mockResolvedValue([]);
    
    mockStore.validateDependencies.mockReturnValue({
      valid: true,
      errors: [],
    });
  });

  describe('Test 1: Intent Filtering', () => {
    it('should show only horror-tagged worlds when Horror intent is selected', async () => {
      const worlds: WorldDefinition[] = [
        createMockWorld('world-1', 'Horror World', ['horror', 'dark']),
        createMockWorld('world-2', 'Fantasy World', ['fantasy', 'magic']),
        createMockWorld('world-3', 'Gothic Horror', ['horror', 'gothic']),
      ];

      const chimeraApi = await import('@/services/chimera-api');
      vi.mocked(chimeraApi.getWorlds).mockResolvedValue(worlds);
      vi.mocked(chimeraApi.getRulesets).mockResolvedValue([]);
      vi.mocked(chimeraApi.getEntities).mockResolvedValue([]);

      mockStore.intent = 'horror';
      mockStore.currentStep = 'world';

      renderWithQueryClient(<CastingWizard />);

      await waitFor(() => {
        expect(screen.getByText('Horror World')).toBeInTheDocument();
        expect(screen.getByText('Gothic Horror')).toBeInTheDocument();
        expect(screen.queryByText('Fantasy World')).not.toBeInTheDocument();
      });
    });

    it('should show all worlds when Custom intent is selected', async () => {
      const worlds: WorldDefinition[] = [
        createMockWorld('world-1', 'Horror World', ['horror']),
        createMockWorld('world-2', 'Fantasy World', ['fantasy']),
      ];

      const chimeraApi = await import('@/services/chimera-api');
      vi.mocked(chimeraApi.getWorlds).mockResolvedValue(worlds);
      vi.mocked(chimeraApi.getRulesets).mockResolvedValue([]);
      vi.mocked(chimeraApi.getEntities).mockResolvedValue([]);

      mockStore.intent = 'custom';
      mockStore.currentStep = 'world';

      renderWithQueryClient(<CastingWizard />);

      await waitFor(() => {
        expect(screen.getByText('Horror World')).toBeInTheDocument();
        expect(screen.getByText('Fantasy World')).toBeInTheDocument();
      });
    });
  });

  describe('Test 2: Auto-Population of Rulesets', () => {
    it('should auto-populate rulesets when advancing from World to Forces step', async () => {
      const worlds: WorldDefinition[] = [
        createMockWorld('world-1', 'Test World'),
      ];

      const rulesets: RulesetDefinition[] = [
        createMockRuleset('foundation-1', 'Foundation 1', 'foundation'),
        createMockRuleset('expansion-1', 'Expansion 1', 'expansion', {
          dependencies: ['foundation-1'],
        }),
      ];

      const chimeraApi = await import('@/services/chimera-api');
      vi.mocked(chimeraApi.getWorlds).mockResolvedValue(worlds);
      vi.mocked(chimeraApi.getRulesets).mockResolvedValue(rulesets);
      vi.mocked(chimeraApi.getEntities).mockResolvedValue([]);

      mockStore.currentStep = 'world';
      mockStore.worldId = 'world-1';
      mockStore.selectedRulesetIds = new Set();
      mockStore.getAvailableExpansions.mockReturnValue([]);

      renderWithQueryClient(<CastingWizard />);

      // Wait for data to load
      await waitFor(() => {
        expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
      });

      // Simulate clicking Next to advance to Forces step
      const nextButton = await screen.findByText('Next');
      nextButton.click();

      // Verify autoSelectDefaults was called
      expect(mockStore.autoSelectDefaults).toHaveBeenCalledWith(worlds[0], rulesets);

      // Update store to reflect step change and auto-population
      mockStore.currentStep = 'forces';
      mockStore.selectedRulesetIds = new Set(['foundation-1', 'expansion-1']);
      mockStore.selectedFoundationId = 'foundation-1';
      mockStore.getAvailableExpansions.mockReturnValue([rulesets[1]]);

      // Verify rulesets are populated
      expect(mockStore.selectedRulesetIds.size).toBeGreaterThan(0);
      expect(mockStore.selectedFoundationId).not.toBeNull();
    });
  });

  describe('Test 3: Dependency Gatekeeping', () => {
    it('should block navigation when dependencies are not met', async () => {
      const rulesets: RulesetDefinition[] = [
        createMockRuleset('foundation-1', 'Foundation 1', 'foundation'),
        createMockRuleset('expansion-1', 'Expansion 1', 'expansion', {
          dependencies: ['foundation-1'],
        }),
      ];

      const chimeraApi = await import('@/services/chimera-api');
      vi.mocked(chimeraApi.getWorlds).mockResolvedValue([]);
      vi.mocked(chimeraApi.getRulesets).mockResolvedValue(rulesets);
      vi.mocked(chimeraApi.getEntities).mockResolvedValue([]);

      mockStore.currentStep = 'forces';
      mockStore.selectedFoundationId = 'foundation-1';
      // Select expansion without foundation (invalid state)
      mockStore.selectedRulesetIds = new Set(['expansion-1']);

      // Mock validation to return error
      mockStore.validateDependencies.mockReturnValue({
        valid: false,
        errors: [
          {
            ruleset: rulesets[1],
            missing: ['foundation-1'],
          },
        ],
      });

      renderWithQueryClient(<CastingWizard />);

      // Wait for data to load
      await waitFor(() => {
        expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
      });

      // Try to click Next
      const nextButton = await screen.findByText('Next');
      expect(nextButton).toBeDisabled();

      // Verify error is shown and Next button is disabled
      await waitFor(() => {
        expect(screen.getByText('Dependency Errors')).toBeInTheDocument();
      });
    });

    it('should allow navigation when dependencies are met', async () => {
      const rulesets: RulesetDefinition[] = [
        createMockRuleset('foundation-1', 'Foundation 1', 'foundation'),
        createMockRuleset('expansion-1', 'Expansion 1', 'expansion', {
          dependencies: ['foundation-1'],
        }),
      ];

      const chimeraApi = await import('@/services/chimera-api');
      vi.mocked(chimeraApi.getWorlds).mockResolvedValue([]);
      vi.mocked(chimeraApi.getRulesets).mockResolvedValue(rulesets);
      vi.mocked(chimeraApi.getEntities).mockResolvedValue([]);

      mockStore.currentStep = 'forces';
      mockStore.selectedFoundationId = 'foundation-1';
      mockStore.selectedRulesetIds = new Set(['foundation-1', 'expansion-1']);
      mockStore.getAvailableExpansions.mockReturnValue([rulesets[1]]);

      mockStore.validateDependencies.mockReturnValue({
        valid: true,
        errors: [],
      });

      renderWithQueryClient(<CastingWizard />);

      // Wait for data to load
      await waitFor(() => {
        expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
      });

      const nextButton = await screen.findByText('Next');
      expect(nextButton).not.toBeDisabled();
    });
  });

  describe('Test 4: Quick Start Bypass', () => {
    it('should skip to Review step and populate rulesets when Quick Start is clicked', async () => {
      const worlds: WorldDefinition[] = [
        createMockWorld('world-1', 'Test World'),
      ];

      const rulesets: RulesetDefinition[] = [
        createMockRuleset('foundation-1', 'Foundation 1', 'foundation'),
      ];

      const chimeraApi = await import('@/services/chimera-api');
      vi.mocked(chimeraApi.getWorlds).mockResolvedValue(worlds);
      vi.mocked(chimeraApi.getRulesets).mockResolvedValue(rulesets);
      vi.mocked(chimeraApi.getEntities).mockResolvedValue([]);

      mockStore.currentStep = 'world';
      mockStore.worldId = 'world-1';
      mockStore.selectedRulesetIds = new Set();

      renderWithQueryClient(<CastingWizard />);

      // Wait for data to load
      await waitFor(() => {
        expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
      });

      // Click Quick Start button
      const quickStartButton = await screen.findByText('Quick Start');
      quickStartButton.click();

      // Verify autoSelectDefaults was called
      expect(mockStore.autoSelectDefaults).toHaveBeenCalledWith(worlds[0], rulesets);

      // Verify setStep was called with 'review'
      expect(mockStore.setStep).toHaveBeenCalledWith('review');

      // Update store to reflect changes
      mockStore.currentStep = 'review';
      mockStore.selectedRulesetIds = new Set(['foundation-1']);
      mockStore.selectedFoundationId = 'foundation-1';

      // Verify rulesets are populated
      expect(mockStore.selectedRulesetIds.size).toBeGreaterThan(0);
      expect(mockStore.selectedFoundationId).not.toBeNull();
    });
  });

  describe('Additional Tests', () => {
    it('should show intent selection on initial load', async () => {
      mockStore.currentStep = 'intent';

      renderWithQueryClient(<CastingWizard />);

      // Wait for data to load
      await waitFor(() => {
        expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
      });

      expect(await screen.findByText('Step 0: Choose Your Intent')).toBeInTheDocument();
      expect(screen.getByText('High Fantasy')).toBeInTheDocument();
      expect(screen.getByText('Horror')).toBeInTheDocument();
    });

    it('should require world selection before proceeding from World step', async () => {
      const chimeraApi = await import('@/services/chimera-api');
      vi.mocked(chimeraApi.getWorlds).mockResolvedValue([]);
      vi.mocked(chimeraApi.getRulesets).mockResolvedValue([]);
      vi.mocked(chimeraApi.getEntities).mockResolvedValue([]);

      mockStore.currentStep = 'world';
      mockStore.worldId = null;

      renderWithQueryClient(<CastingWizard />);

      // Wait for data to load
      await waitFor(() => {
        expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
      }, { timeout: 3000 });

      const nextButton = await screen.findByText('Next', {}, { timeout: 3000 });
      expect(nextButton).toBeDisabled();
    });

    it('should require foundation selection before proceeding from Forces step', async () => {
      const rulesets: RulesetDefinition[] = [
        createMockRuleset('foundation-1', 'Foundation 1', 'foundation'),
      ];

      const chimeraApi = await import('@/services/chimera-api');
      vi.mocked(chimeraApi.getWorlds).mockResolvedValue([]);
      vi.mocked(chimeraApi.getRulesets).mockResolvedValue(rulesets);
      vi.mocked(chimeraApi.getEntities).mockResolvedValue([]);

      mockStore.currentStep = 'forces';
      mockStore.selectedFoundationId = null;
      mockStore.selectedRulesetIds = new Set();

      renderWithQueryClient(<CastingWizard />);

      // Wait for data to load
      await waitFor(() => {
        expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
      }, { timeout: 3000 });

      const nextButton = await screen.findByText('Next', {}, { timeout: 3000 });
      expect(nextButton).toBeDisabled();
    });
  });
});

