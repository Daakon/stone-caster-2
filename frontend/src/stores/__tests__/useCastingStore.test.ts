/**
 * Unit tests for useCastingStore
 * Phase 3-A: Casting Circle State Logic Refactor
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useCastingStore } from '../useCastingStore';
import type { RulesetDefinition, WorldDefinition } from '@shared/types/chimera-authoring';

// Helper to create mock rulesets
const createMockRuleset = (
  id: string,
  name: string,
  ui_category: 'foundation' | 'expansion' | 'flavor',
  options?: {
    dependencies?: string[];
    exclusion_group?: string | null;
    essential?: boolean;
  }
): RulesetDefinition => ({
  id,
  name,
  ui_category,
  dependencies: options?.dependencies || [],
  exclusion_group: options?.exclusion_group || null,
  description_short: null,
  description_long: null,
  provides_tags: [],
  state_contributions: {},
  actions: {},
  ai_instructions: {},
  ...(options?.essential !== undefined && { essential: options.essential } as any),
});

// Helper to create mock world
const createMockWorld = (
  id: string,
  name: string,
  options?: {
    recommended_foundation_id?: string;
    recommended_foundation?: string;
  }
): WorldDefinition => ({
  id,
  name,
  description: `Description for ${name}`,
  images: [],
  character_schema_extensions: {},
  lore_fragments: [],
  ...(options || {}),
} as any);

describe('useCastingStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useCastingStore.getState().clearSelection();
    useCastingStore.setState({
      worldId: null,
      selectedRulesetIds: new Set(),
      entityIds: new Set(),
    });
  });

  describe('Foundation Selection', () => {
    it('should allow selecting exactly one foundation', () => {
      const rulesets: RulesetDefinition[] = [
        createMockRuleset('foundation-1', 'D20 Core', 'foundation'),
        createMockRuleset('foundation-2', 'D100 Core', 'foundation'),
      ];

      // Select first foundation
      useCastingStore.getState().selectFoundation('foundation-1', rulesets);
      let state = useCastingStore.getState();
      expect(state.selectedFoundationId).toBe('foundation-1');
      expect(state.selectedRulesetIds.has('foundation-1')).toBe(true);
      expect(state.selectedRulesetIds.has('foundation-2')).toBe(false);

      // Select second foundation - should clear first
      useCastingStore.getState().selectFoundation('foundation-2', rulesets);
      state = useCastingStore.getState();
      expect(state.selectedFoundationId).toBe('foundation-2');
      expect(state.selectedRulesetIds.has('foundation-1')).toBe(false);
      expect(state.selectedRulesetIds.has('foundation-2')).toBe(true);
    });

    it('should clear incompatible expansions when switching foundations', () => {
      const rulesets: RulesetDefinition[] = [
        createMockRuleset('foundation-d20', 'D20 Core', 'foundation'),
        createMockRuleset('foundation-d100', 'D100 Core', 'foundation'),
        createMockRuleset('expansion-d20', 'D20 Magic', 'expansion', {
          dependencies: ['foundation-d20'],
        }),
        createMockRuleset('expansion-d100', 'D100 Magic', 'expansion', {
          dependencies: ['foundation-d100'],
        }),
      ];

      // Select D20 foundation and its expansion
      useCastingStore.getState().selectFoundation('foundation-d20', rulesets);
      useCastingStore.getState().toggleExpansion('expansion-d20', rulesets);
      let state = useCastingStore.getState();
      expect(state.selectedRulesetIds.has('expansion-d20')).toBe(true);

      // Switch to D100 foundation - D20 expansion should be cleared
      useCastingStore.getState().selectFoundation('foundation-d100', rulesets);
      state = useCastingStore.getState();
      expect(state.selectedRulesetIds.has('expansion-d20')).toBe(false);
      expect(state.selectedRulesetIds.has('expansion-d100')).toBe(false);
    });
  });

  describe('getAvailableExpansions', () => {
    it('should return empty array when no foundation is selected', () => {
      const rulesets: RulesetDefinition[] = [
        createMockRuleset('expansion-1', 'Expansion 1', 'expansion'),
      ];

      const store = useCastingStore.getState();
      const available = store.getAvailableExpansions(null, rulesets);
      expect(available).toEqual([]);
    });

    it('should return expansions with no dependencies', () => {
      const rulesets: RulesetDefinition[] = [
        createMockRuleset('foundation-1', 'Foundation 1', 'foundation'),
        createMockRuleset('expansion-no-deps', 'Expansion No Deps', 'expansion'),
      ];

      const store = useCastingStore.getState();
      store.selectFoundation('foundation-1', rulesets);
      
      const available = store.getAvailableExpansions('foundation-1', rulesets);
      expect(available.length).toBe(1);
      expect(available[0].id).toBe('expansion-no-deps');
    });

    it('should return expansions that depend on selected foundation', () => {
      const rulesets: RulesetDefinition[] = [
        createMockRuleset('foundation-1', 'Foundation 1', 'foundation'),
        createMockRuleset('expansion-1', 'Expansion 1', 'expansion', {
          dependencies: ['foundation-1'],
        }),
        createMockRuleset('expansion-2', 'Expansion 2', 'expansion', {
          dependencies: ['foundation-2'],
        }),
      ];

      const store = useCastingStore.getState();
      store.selectFoundation('foundation-1', rulesets);
      
      const available = store.getAvailableExpansions('foundation-1', rulesets);
      expect(available.length).toBe(1);
      expect(available[0].id).toBe('expansion-1');
      expect(available.some((e) => e.id === 'expansion-2')).toBe(false);
    });

    it('should filter out expansions for different foundations', () => {
      const rulesets: RulesetDefinition[] = [
        createMockRuleset('foundation-d20', 'D20 Core', 'foundation'),
        createMockRuleset('foundation-d100', 'D100 Core', 'foundation'),
        createMockRuleset('expansion-d20', 'D20 Magic', 'expansion', {
          dependencies: ['foundation-d20'],
        }),
        createMockRuleset('expansion-d100', 'D100 Magic', 'expansion', {
          dependencies: ['foundation-d100'],
        }),
      ];

      const store = useCastingStore.getState();
      store.selectFoundation('foundation-d20', rulesets);
      
      const available = store.getAvailableExpansions('foundation-d20', rulesets);
      expect(available.length).toBe(1);
      expect(available[0].id).toBe('expansion-d20');
    });
  });

  describe('validateDependencies', () => {
    it('should return valid when all dependencies are met', () => {
      const rulesets: RulesetDefinition[] = [
        createMockRuleset('foundation-1', 'Foundation 1', 'foundation'),
        createMockRuleset('expansion-1', 'Expansion 1', 'expansion', {
          dependencies: ['foundation-1'],
        }),
      ];

      const store = useCastingStore.getState();
      const selectedIds = new Set(['foundation-1', 'expansion-1']);
      
      const validation = store.validateDependencies(selectedIds, rulesets);
      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });

    it('should return errors when dependencies are missing', () => {
      const rulesets: RulesetDefinition[] = [
        createMockRuleset('foundation-1', 'Foundation 1', 'foundation'),
        createMockRuleset('expansion-1', 'Expansion 1', 'expansion', {
          dependencies: ['foundation-1'],
        }),
      ];

      const store = useCastingStore.getState();
      const selectedIds = new Set(['expansion-1']); // Missing foundation
      
      const validation = store.validateDependencies(selectedIds, rulesets);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBe(1);
      expect(validation.errors[0].ruleset.id).toBe('expansion-1');
    });

    it('should handle multiple missing dependencies', () => {
      const rulesets: RulesetDefinition[] = [
        createMockRuleset('foundation-1', 'Foundation 1', 'foundation'),
        createMockRuleset('foundation-2', 'Foundation 2', 'foundation'),
        createMockRuleset('expansion-1', 'Expansion 1', 'expansion', {
          dependencies: ['foundation-1', 'foundation-2'],
        }),
      ];

      const store = useCastingStore.getState();
      const selectedIds = new Set(['expansion-1']);
      
      const validation = store.validateDependencies(selectedIds, rulesets);
      expect(validation.valid).toBe(false);
      expect(validation.errors[0].missing.length).toBeGreaterThan(0);
    });
  });

  describe('autoSelectDefaults', () => {
    it('should auto-select suggested foundation from world', () => {
      const rulesets: RulesetDefinition[] = [
        createMockRuleset('foundation-1', 'Foundation 1', 'foundation'),
        createMockRuleset('foundation-2', 'Foundation 2', 'foundation'),
      ];

      const world = createMockWorld('world-1', 'Test World', {
        recommended_foundation_id: 'foundation-1',
      });

      useCastingStore.getState().autoSelectDefaults(world, rulesets);
      const state = useCastingStore.getState();

      expect(state.selectedFoundationId).toBe('foundation-1');
      expect(state.selectedRulesetIds.has('foundation-1')).toBe(true);
    });

    it('should auto-select first foundation if world has no suggestion', () => {
      const rulesets: RulesetDefinition[] = [
        createMockRuleset('foundation-1', 'Foundation 1', 'foundation'),
        createMockRuleset('foundation-2', 'Foundation 2', 'foundation'),
      ];

      const world = createMockWorld('world-1', 'Test World');

      useCastingStore.getState().autoSelectDefaults(world, rulesets);
      const state = useCastingStore.getState();

      expect(state.selectedFoundationId).toBe('foundation-1');
      expect(state.selectedRulesetIds.has('foundation-1')).toBe(true);
    });

    it('should auto-select essential expansions', () => {
      const rulesets: RulesetDefinition[] = [
        createMockRuleset('foundation-1', 'Foundation 1', 'foundation'),
        createMockRuleset('expansion-essential', 'Essential Expansion', 'expansion', {
          dependencies: ['foundation-1'],
          essential: true,
        }),
        createMockRuleset('expansion-optional', 'Optional Expansion', 'expansion', {
          dependencies: ['foundation-1'],
          essential: false,
        }),
      ];

      const world = createMockWorld('world-1', 'Test World');

      useCastingStore.getState().autoSelectDefaults(world, rulesets);
      const state = useCastingStore.getState();

      expect(state.selectedRulesetIds.has('foundation-1')).toBe(true);
      expect(state.selectedRulesetIds.has('expansion-essential')).toBe(true);
      expect(state.selectedRulesetIds.has('expansion-optional')).toBe(false);
    });

    it('should not auto-select expansions if dependencies are not met', () => {
      const rulesets: RulesetDefinition[] = [
        createMockRuleset('foundation-1', 'Foundation 1', 'foundation'),
        createMockRuleset('expansion-essential', 'Essential Expansion', 'expansion', {
          dependencies: ['foundation-2'], // Wrong foundation
          essential: true,
        }),
      ];

      const world = createMockWorld('world-1', 'Test World');

      useCastingStore.getState().autoSelectDefaults(world, rulesets);
      const state = useCastingStore.getState();

      expect(state.selectedRulesetIds.has('foundation-1')).toBe(true);
      expect(state.selectedRulesetIds.has('expansion-essential')).toBe(false);
    });

    it('should handle world with no rulesets gracefully', () => {
      const world = createMockWorld('world-1', 'Test World');
      const rulesets: RulesetDefinition[] = [];

      const store = useCastingStore.getState();
      store.autoSelectDefaults(world, rulesets);

      expect(store.selectedFoundationId).toBe(null);
      expect(store.selectedRulesetIds.size).toBe(0);
    });
  });

  describe('toggleExpansion', () => {
    it('should not allow adding expansion without foundation', () => {
      const rulesets: RulesetDefinition[] = [
        createMockRuleset('expansion-1', 'Expansion 1', 'expansion'),
      ];

      const store = useCastingStore.getState();
      store.toggleExpansion('expansion-1', rulesets);

      expect(store.selectedRulesetIds.has('expansion-1')).toBe(false);
    });

    it('should allow adding expansion with valid foundation', () => {
      const rulesets: RulesetDefinition[] = [
        createMockRuleset('foundation-1', 'Foundation 1', 'foundation'),
        createMockRuleset('expansion-1', 'Expansion 1', 'expansion', {
          dependencies: ['foundation-1'],
        }),
      ];

      useCastingStore.getState().selectFoundation('foundation-1', rulesets);
      useCastingStore.getState().toggleExpansion('expansion-1', rulesets);
      const state = useCastingStore.getState();

      expect(state.selectedRulesetIds.has('expansion-1')).toBe(true);
    });

    it('should allow removing expansion', () => {
      const rulesets: RulesetDefinition[] = [
        createMockRuleset('foundation-1', 'Foundation 1', 'foundation'),
        createMockRuleset('expansion-1', 'Expansion 1', 'expansion', {
          dependencies: ['foundation-1'],
        }),
      ];

      useCastingStore.getState().selectFoundation('foundation-1', rulesets);
      useCastingStore.getState().toggleExpansion('expansion-1', rulesets);
      let state = useCastingStore.getState();
      expect(state.selectedRulesetIds.has('expansion-1')).toBe(true);

      useCastingStore.getState().toggleExpansion('expansion-1', rulesets);
      state = useCastingStore.getState();
      expect(state.selectedRulesetIds.has('expansion-1')).toBe(false);
    });
  });

  describe('setWorld', () => {
    it('should trigger autoSelectDefaults when world is selected', () => {
      const rulesets: RulesetDefinition[] = [
        createMockRuleset('foundation-1', 'Foundation 1', 'foundation'),
      ];

      const worlds: WorldDefinition[] = [
        createMockWorld('world-1', 'Test World'),
      ];

      useCastingStore.getState().setWorld('world-1', worlds, rulesets);
      const state = useCastingStore.getState();

      expect(state.worldId).toBe('world-1');
      expect(state.selectedFoundationId).toBe('foundation-1');
    });

    it('should clear selection when world is cleared', () => {
      const rulesets: RulesetDefinition[] = [
        createMockRuleset('foundation-1', 'Foundation 1', 'foundation'),
      ];

      const store = useCastingStore.getState();
      store.selectFoundation('foundation-1', rulesets);
      store.setWorld(null, [], rulesets);

      expect(store.worldId).toBe(null);
      expect(store.selectedFoundationId).toBe(null);
      expect(store.selectedRulesetIds.size).toBe(0);
    });
  });
});

