/**
 * RulesetSelector Component Tests
 * Phase 3-B: Hub & Spoke visual hierarchy
 * Tests verify UI restrictions based on useCastingStore logic
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { RulesetSelector } from '../RulesetSelector';
import type { RulesetDefinition } from '@shared/types/chimera-authoring';

// Create a mock store that can be updated
const createMockStore = () => {
  const store = {
    selectedFoundationId: null as string | null,
    selectedRulesetIds: new Set<string>(),
    selectFoundation: vi.fn(),
    toggleExpansion: vi.fn(),
    toggleFlavor: vi.fn(),
    getAvailableExpansions: vi.fn(),
    validateDependencies: vi.fn(),
    setWorld: vi.fn(),
    toggleEntity: vi.fn(),
    clearSelection: vi.fn(),
    worldId: null,
    entityIds: new Set(),
    availableExpansions: [],
    availableFlavors: [],
  };

  return store;
};

let mockStore = createMockStore();

// Mock the store - Zustand stores export a hook function
vi.mock('@/stores/useCastingStore', () => ({
  useCastingStore: () => mockStore,
}));

// Helper to create mock rulesets
const createMockRuleset = (
  id: string,
  name: string,
  ui_category: 'foundation' | 'expansion' | 'flavor',
  options?: {
    dependencies?: string[];
    description_short?: string;
  }
): RulesetDefinition => ({
  id,
  name,
  ui_category,
  dependencies: options?.dependencies || [],
  exclusion_group: null,
  description_short: options?.description_short || null,
  description_long: null,
  provides_tags: [],
  state_contributions: {},
  actions: {},
  ai_instructions: {},
});

describe('RulesetSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock store
    mockStore = createMockStore();
    mockStore.validateDependencies.mockReturnValue({
      valid: true,
      errors: [],
    });
  });

  describe('Test 1: Hierarchy Visibility', () => {
    it('should show D20 expansions when D20 Core foundation is selected', () => {
      const rulesets: RulesetDefinition[] = [
        createMockRuleset('foundation-d20', 'D20 Core', 'foundation'),
        createMockRuleset('foundation-d100', 'D100 Core', 'foundation'),
        createMockRuleset('expansion-d20-classic', 'Classic Attributes', 'expansion', {
          dependencies: ['foundation-d20'],
        }),
        createMockRuleset('expansion-d100-skills', 'D100 Skills', 'expansion', {
          dependencies: ['foundation-d100'],
        }),
        createMockRuleset('flavor-gothic', 'Gothic Theme', 'flavor'),
      ];

      // Setup mock store with D20 selected
      mockStore.selectedFoundationId = 'foundation-d20';
      mockStore.selectedRulesetIds = new Set(['foundation-d20']);
      mockStore.getAvailableExpansions.mockReturnValue([rulesets[2]]); // D20 expansion

      render(
        <RulesetSelector
          rulesets={rulesets}
          selectedRulesetIds={new Set(['foundation-d20'])}
          onSelectionChange={vi.fn()}
        />
      );

      // Assert D20 expansion is visible
      expect(screen.getByText('Classic Attributes')).toBeInTheDocument();
      
      // Assert D100 expansion is NOT visible
      expect(screen.queryByText('D100 Skills')).not.toBeInTheDocument();
      
      // Assert flavor is visible (system-agnostic)
      expect(screen.getByText('Gothic Theme')).toBeInTheDocument();
    });
  });

  describe('Test 2: Switching Foundations', () => {
    it('should hide D20 expansions and show D100 expansions when switching foundations', async () => {
      const rulesets: RulesetDefinition[] = [
        createMockRuleset('foundation-d20', 'D20 Core', 'foundation'),
        createMockRuleset('foundation-d100', 'D100 Core', 'foundation'),
        createMockRuleset('expansion-d20-classic', 'Classic Attributes', 'expansion', {
          dependencies: ['foundation-d20'],
        }),
        createMockRuleset('expansion-d100-skills', 'D100 Skills', 'expansion', {
          dependencies: ['foundation-d100'],
        }),
      ];

      // Start with D20 selected
      mockStore.selectedFoundationId = 'foundation-d20';
      mockStore.selectedRulesetIds = new Set(['foundation-d20']);
      mockStore.getAvailableExpansions.mockImplementation((foundationId: string) => {
        if (foundationId === 'foundation-d20') {
          return [rulesets[2]]; // D20 expansion
        }
        if (foundationId === 'foundation-d100') {
          return [rulesets[3]]; // D100 expansion
        }
        return [];
      });
      mockStore.selectFoundation.mockImplementation((id: string) => {
        mockStore.selectedFoundationId = id;
        mockStore.selectedRulesetIds = new Set([id]);
      });

      const { rerender } = render(
        <RulesetSelector
          rulesets={rulesets}
          selectedRulesetIds={mockStore.selectedRulesetIds}
          onSelectionChange={vi.fn()}
        />
      );

      // Initially, D20 expansion should be visible
      expect(screen.getByText('Classic Attributes')).toBeInTheDocument();
      expect(screen.queryByText('D100 Skills')).not.toBeInTheDocument();

      // Click D100 foundation
      const d100Foundation = screen.getByText('D100 Core');
      const foundationCard = d100Foundation.closest('[role="radio"]') as HTMLElement;
      if (foundationCard) {
        foundationCard.click();
      }

      // Update store state (simulating store update)
      mockStore.selectedFoundationId = 'foundation-d100';
      mockStore.selectedRulesetIds = new Set(['foundation-d100']);

      // Rerender with updated state
      rerender(
        <RulesetSelector
          rulesets={rulesets}
          selectedRulesetIds={new Set(['foundation-d100'])}
          onSelectionChange={vi.fn()}
        />
      );

      // Wait for updates
      await waitFor(() => {
        // D20 expansion should disappear
        expect(screen.queryByText('Classic Attributes')).not.toBeInTheDocument();
        // D100 expansion should appear
        expect(screen.getByText('D100 Skills')).toBeInTheDocument();
      });
    });
  });

  describe('Test 3: Interaction', () => {
    it('should call toggleExpansion when clicking an expansion checkbox', async () => {
      const rulesets: RulesetDefinition[] = [
        createMockRuleset('foundation-d20', 'D20 Core', 'foundation'),
        createMockRuleset('expansion-d20-classic', 'Classic Attributes', 'expansion', {
          dependencies: ['foundation-d20'],
        }),
      ];

      mockStore.selectedFoundationId = 'foundation-d20';
      mockStore.selectedRulesetIds = new Set(['foundation-d20']);
      mockStore.getAvailableExpansions.mockReturnValue([rulesets[1]]);

      render(
        <RulesetSelector
          rulesets={rulesets}
          selectedRulesetIds={new Set(['foundation-d20'])}
          onSelectionChange={vi.fn()}
        />
      );

      // Find and click the expansion checkbox
      const expansionCheckbox = screen.getByLabelText(/Classic Attributes/i);
      expansionCheckbox.click();

      // Verify toggleExpansion was called with correct ID
      expect(mockStore.toggleExpansion).toHaveBeenCalledWith('expansion-d20-classic', rulesets);
    });
  });

  describe('Test 4: Flavor Rulesets', () => {
    it('should show flavor rulesets regardless of which foundation is selected', () => {
      const rulesets: RulesetDefinition[] = [
        createMockRuleset('foundation-d20', 'D20 Core', 'foundation'),
        createMockRuleset('foundation-d100', 'D100 Core', 'foundation'),
        createMockRuleset('flavor-gothic', 'Gothic Theme', 'flavor'),
        createMockRuleset('flavor-steampunk', 'Steampunk Theme', 'flavor'),
      ];

      // Test with D20 selected
      mockStore.selectedFoundationId = 'foundation-d20';
      mockStore.selectedRulesetIds = new Set(['foundation-d20']);
      mockStore.getAvailableExpansions.mockReturnValue([]);

      const { rerender } = render(
        <RulesetSelector
          rulesets={rulesets}
          selectedRulesetIds={new Set(['foundation-d20'])}
          onSelectionChange={vi.fn()}
        />
      );

      // Flavor rulesets should be visible with D20
      expect(screen.getByText('Gothic Theme')).toBeInTheDocument();
      expect(screen.getByText('Steampunk Theme')).toBeInTheDocument();

      // Switch to D100
      mockStore.selectedFoundationId = 'foundation-d100';
      mockStore.selectedRulesetIds = new Set(['foundation-d100']);

      rerender(
        <RulesetSelector
          rulesets={rulesets}
          selectedRulesetIds={new Set(['foundation-d100'])}
          onSelectionChange={vi.fn()}
        />
      );

      // Flavor rulesets should still be visible with D100
      expect(screen.getByText('Gothic Theme')).toBeInTheDocument();
      expect(screen.getByText('Steampunk Theme')).toBeInTheDocument();
    });

    it('should call toggleFlavor when clicking a flavor checkbox', async () => {
      const rulesets: RulesetDefinition[] = [
        createMockRuleset('foundation-d20', 'D20 Core', 'foundation'),
        createMockRuleset('flavor-gothic', 'Gothic Theme', 'flavor'),
      ];

      mockStore.selectedFoundationId = 'foundation-d20';
      mockStore.selectedRulesetIds = new Set(['foundation-d20']);
      mockStore.getAvailableExpansions.mockReturnValue([]);

      render(
        <RulesetSelector
          rulesets={rulesets}
          selectedRulesetIds={new Set(['foundation-d20'])}
          onSelectionChange={vi.fn()}
        />
      );

      // Click flavor checkbox
      const flavorCheckbox = screen.getByLabelText(/Gothic Theme/i);
      flavorCheckbox.click();

      // Verify toggleFlavor was called
      expect(mockStore.toggleFlavor).toHaveBeenCalledWith('flavor-gothic');
    });
  });

  describe('Additional Tests', () => {
    it('should not show expansion group when no foundation is selected', () => {
      const rulesets: RulesetDefinition[] = [
        createMockRuleset('foundation-d20', 'D20 Core', 'foundation'),
        createMockRuleset('expansion-d20-classic', 'Classic Attributes', 'expansion', {
          dependencies: ['foundation-d20'],
        }),
      ];

      mockStore.selectedFoundationId = null;
      mockStore.selectedRulesetIds = new Set();
      mockStore.getAvailableExpansions.mockReturnValue([]);

      render(
        <RulesetSelector
          rulesets={rulesets}
          selectedRulesetIds={new Set()}
          onSelectionChange={vi.fn()}
        />
      );

      // Expansion group should not be visible
      expect(screen.queryByText(/Expansions for/i)).not.toBeInTheDocument();
      expect(screen.queryByText('Classic Attributes')).not.toBeInTheDocument();
    });

    it('should display dependency validation errors', () => {
      const rulesets: RulesetDefinition[] = [
        createMockRuleset('foundation-d20', 'D20 Core', 'foundation'),
        createMockRuleset('expansion-d20-classic', 'Classic Attributes', 'expansion', {
          dependencies: ['foundation-d20'],
        }),
      ];

      mockStore.selectedFoundationId = null;
      mockStore.selectedRulesetIds = new Set(['expansion-d20-classic']);
      mockStore.validateDependencies.mockReturnValue({
        valid: false,
        errors: [
          {
            ruleset: rulesets[1],
            missing: ['foundation-d20'],
          },
        ],
      });

      render(
        <RulesetSelector
          rulesets={rulesets}
          selectedRulesetIds={new Set(['expansion-d20-classic'])}
          onSelectionChange={vi.fn()}
        />
      );

      // Error alert should be visible
      expect(screen.getByText('Missing Dependencies')).toBeInTheDocument();
      // Check for the error message (text is split across elements)
      expect(screen.getByText('Classic Attributes')).toBeInTheDocument();
      expect(screen.getByText(/requires/i)).toBeInTheDocument();
    });
  });
});

