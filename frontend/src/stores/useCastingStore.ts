/**
 * Casting Circle State Store
 * Manages hierarchical ruleset selection with foundation/expansion dependencies
 * Phase 3-A: Casting Circle State Logic Refactor
 */

import { create } from 'zustand';
import type { RulesetDefinition, WorldDefinition } from '@shared/types/chimera-authoring';

export type WizardStep = 'intent' | 'world' | 'forces' | 'review';
export type IntentGenre = 'high-fantasy' | 'sci-fi' | 'horror' | 'survival' | 'custom';

interface CastingState {
  // Core state
  worldId: string | null;
  selectedRulesetIds: Set<string>;
  entityIds: Set<string>;
  currentStep: WizardStep;
  intent: IntentGenre | null;

  // Computed state
  selectedFoundationId: string | null;
  availableExpansions: RulesetDefinition[];
  availableFlavors: RulesetDefinition[];

  // Actions
  setIntent: (intent: IntentGenre | null) => void;
  setStep: (step: WizardStep) => void;
  setWorld: (worldId: string | null, worlds?: WorldDefinition[], rulesets?: RulesetDefinition[]) => void;
  selectFoundation: (foundationId: string, rulesets: RulesetDefinition[]) => void;
  toggleExpansion: (expansionId: string, rulesets: RulesetDefinition[]) => void;
  toggleFlavor: (flavorId: string) => void;
  toggleEntity: (entityId: string) => void;
  clearSelection: () => void;

  // Helpers
  getAvailableExpansions: (foundationId: string | null, rulesets: RulesetDefinition[]) => RulesetDefinition[];
  validateDependencies: (selectedIds: Set<string>, rulesets: RulesetDefinition[]) => {
    valid: boolean;
    errors: Array<{ ruleset: RulesetDefinition; missing: string[] }>;
  };
  autoSelectDefaults: (world: WorldDefinition | null, rulesets: RulesetDefinition[]) => void;
}

const initialState = {
  worldId: null,
  selectedRulesetIds: new Set<string>(),
  entityIds: new Set<string>(),
  currentStep: 'intent' as WizardStep,
  intent: null as IntentGenre | null,
  selectedFoundationId: null,
  availableExpansions: [],
  availableFlavors: [],
};

export const useCastingStore = create<CastingState>((set, get) => ({
  ...initialState,

  /**
   * Set the intent/genre for filtering worlds
   */
  setIntent: (intent) => {
    set({ intent });
  },

  /**
   * Set the current wizard step
   */
  setStep: (step) => {
    set({ currentStep: step });
  },

  /**
   * Set the selected world and trigger auto-selection of defaults
   */
  setWorld: (worldId, worlds = [], rulesets = []) => {
    const world = worldId ? worlds.find((w) => w.id === worldId) : null;
    
    // Auto-select defaults when world is selected
    if (world) {
      // Set worldId first, then auto-select defaults
      set({ worldId });
      get().autoSelectDefaults(world, rulesets);
    } else {
      // Clear selection when world is cleared
      set({ worldId: null });
      get().clearSelection();
    }
  },

  /**
   * Select a foundation (radio button behavior - only one foundation)
   * This clears incompatible expansions
   */
  selectFoundation: (foundationId, rulesets) => {
    const state = get();
    const newSelection = new Set(state.selectedRulesetIds);

    // Remove all foundations (only one allowed)
    const foundations = rulesets.filter((r) => r.ui_category === 'foundation');
    foundations.forEach((f) => {
      newSelection.delete(f.id);
    });

    // Add the selected foundation
    newSelection.add(foundationId);

    // Remove expansions that depend on a different foundation
    const selectedFoundation = rulesets.find((r) => r.id === foundationId);
    if (selectedFoundation) {
      const expansions = rulesets.filter((r) => r.ui_category === 'expansion');
      expansions.forEach((exp) => {
        // If expansion has dependencies, check if they include the selected foundation
        if (exp.dependencies.length > 0) {
          const isCompatible = exp.dependencies.some((depId) => {
            // Check if dependency matches the foundation ID or name
            return depId === foundationId || 
                   depId === selectedFoundation.id ||
                   depId === selectedFoundation.name;
          });
          
          if (!isCompatible) {
            newSelection.delete(exp.id);
          }
        }
      });
    }

    set({ 
      selectedRulesetIds: newSelection,
      selectedFoundationId: foundationId,
    });
  },

  /**
   * Toggle an expansion (checkbox behavior)
   * Only allows selection if dependencies are met
   */
  toggleExpansion: (expansionId, rulesets) => {
    const state = get();
    const expansion = rulesets.find((r) => r.id === expansionId);
    
    if (!expansion || expansion.ui_category !== 'expansion') {
      return;
    }

    const isSelected = state.selectedRulesetIds.has(expansionId);
    const newSelection = new Set(state.selectedRulesetIds);

    if (isSelected) {
      // Remove expansion
      newSelection.delete(expansionId);
      set({ selectedRulesetIds: newSelection });
    } else {
      // Validate dependencies before adding
      // Check if this expansion's dependencies are met
      const foundationId = state.selectedFoundationId;
      if (!foundationId) {
        // No foundation selected, can't add expansion
        return;
      }

      const hasRequiredDeps = expansion.dependencies.length === 0 || 
        expansion.dependencies.some((depId) => {
          const depRuleset = rulesets.find((r) => r.id === depId || r.name === depId);
          return depRuleset && newSelection.has(depRuleset.id);
        });

      if (hasRequiredDeps) {
        newSelection.add(expansionId);
        set({ selectedRulesetIds: newSelection });
      }
    }
  },

  /**
   * Toggle a flavor (checkbox behavior)
   * Flavors have no dependencies, so they can always be toggled
   */
  toggleFlavor: (flavorId) => {
    const state = get();
    const newSelection = new Set(state.selectedRulesetIds);

    if (newSelection.has(flavorId)) {
      newSelection.delete(flavorId);
    } else {
      newSelection.add(flavorId);
    }

    set({ selectedRulesetIds: newSelection });
  },

  /**
   * Toggle an entity
   */
  toggleEntity: (entityId) => {
    const state = get();
    const newEntityIds = new Set(state.entityIds);

    if (newEntityIds.has(entityId)) {
      newEntityIds.delete(entityId);
    } else {
      newEntityIds.add(entityId);
    }

    set({ entityIds: newEntityIds });
  },

  /**
   * Clear all selections
   */
  clearSelection: () => {
    set({
      selectedRulesetIds: new Set<string>(),
      selectedFoundationId: null,
      availableExpansions: [],
      availableFlavors: [],
      worldId: null,
      intent: null,
      currentStep: 'intent',
    });
  },

  /**
   * Get available expansions based on selected foundation
   * Only returns expansions that:
   * - Have no dependencies, OR
   * - Have dependencies that include the selected foundation
   */
  getAvailableExpansions: (foundationId, rulesets) => {
    if (!foundationId) {
      return [];
    }

    const foundation = rulesets.find((r) => r.id === foundationId);
    if (!foundation) {
      return [];
    }

    return rulesets.filter((r) => {
      if (r.ui_category !== 'expansion') {
        return false;
      }

      // Expansions with no dependencies are always available
      if (r.dependencies.length === 0) {
        return true;
      }

      // Check if any dependency matches the foundation
      return r.dependencies.some((depId) => {
        return depId === foundationId || 
               depId === foundation.id ||
               depId === foundation.name;
      });
    });
  },

  /**
   * Validate that all selected rulesets have their dependencies met
   */
  validateDependencies: (selectedIds, rulesets) => {
    const errors: Array<{ ruleset: RulesetDefinition; missing: string[] }> = [];
    
    selectedIds.forEach((id) => {
      const ruleset = rulesets.find((r) => r.id === id);
      if (!ruleset) {
        return;
      }

      if (ruleset.dependencies.length > 0) {
        const missing = ruleset.dependencies.filter((depId) => {
          // Check if dependency is satisfied
          const depRuleset = rulesets.find((r) => r.id === depId || r.name === depId);
          return !depRuleset || !selectedIds.has(depRuleset.id);
        });

        if (missing.length > 0) {
          errors.push({ ruleset, missing });
        }
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  /**
   * Auto-select defaults when a world is selected
   * 1. If world suggests a foundation, select it
   * 2. Auto-select all "Essential" expansions that have no conflicts
   */
  autoSelectDefaults: (world, rulesets) => {
    if (!world) {
      return;
    }

    const state = get();
    const newSelection = new Set<string>();

    // Step 1: Check if world suggests a foundation
    // Look for recommended_foundation in world definition or metadata
    const worldDef = world as any;
    const suggestedFoundationId = 
      worldDef.recommended_foundation_id ||
      worldDef.recommended_foundation ||
      worldDef.suggested_rulesets?.[0]; // First suggested ruleset might be foundation

    let foundationId: string | null = null;

    if (suggestedFoundationId) {
      // Try to find by ID or name
      const foundation = rulesets.find(
        (r) => 
          r.ui_category === 'foundation' &&
          (r.id === suggestedFoundationId || r.name === suggestedFoundationId)
      );

      if (foundation) {
        foundationId = foundation.id;
        newSelection.add(foundation.id);
      }
    }

    // If no suggested foundation, select the first available foundation
    if (!foundationId) {
      const firstFoundation = rulesets.find((r) => r.ui_category === 'foundation');
      if (firstFoundation) {
        foundationId = firstFoundation.id;
        newSelection.add(firstFoundation.id);
      }
    }

    // Step 2: Auto-select "Essential" expansions
    // Expansions marked as essential that depend on the selected foundation
    if (foundationId) {
      const availableExpansions = get().getAvailableExpansions(foundationId, rulesets);
      
      availableExpansions.forEach((exp) => {
        // Check if expansion is marked as "essential"
        const expDef = exp as any;
        const isEssential = 
          expDef.essential === true ||
          expDef.auto_select === true ||
          expDef.recommended === true;

        if (isEssential) {
          // Verify dependencies are met
          const hasDeps = exp.dependencies.length === 0 ||
            exp.dependencies.some((depId) => {
              const depRuleset = rulesets.find((r) => r.id === depId || r.name === depId);
              return depRuleset && newSelection.has(depRuleset.id);
            });

          if (hasDeps) {
            newSelection.add(exp.id);
          }
        }
      });
    }

    set({
      selectedRulesetIds: newSelection,
      selectedFoundationId: foundationId,
    });
  },
}));

