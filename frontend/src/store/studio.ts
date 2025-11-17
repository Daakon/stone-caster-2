/**
 * Studio State Store
 * Shared state management for Story Studio page
 * Holds selected rulesets that can be accessed by all sections
 */

import { create } from 'zustand';
import type { RulesetTemplate } from '@/services/admin.chimera';

interface StudioState {
  // Selected rulesets (full objects, not just IDs)
  selectedRulesets: RulesetTemplate[];
  
  // Actions
  setSelectedRulesets: (rulesets: RulesetTemplate[]) => void;
  addRuleset: (ruleset: RulesetTemplate) => void;
  removeRuleset: (rulesetId: string) => void;
  clearRulesets: () => void;
  
  // Helper: Check if any selected ruleset has plot_panel_components
  hasPlotPanelComponents: () => boolean;
}

export const useStudioStore = create<StudioState>((set, get) => ({
  selectedRulesets: [],
  
  setSelectedRulesets: (rulesets) => set({ selectedRulesets: rulesets }),
  
  addRuleset: (ruleset) => {
    const current = get().selectedRulesets;
    if (!current.find((r) => r.id === ruleset.id)) {
      set({ selectedRulesets: [...current, ruleset] });
    }
  },
  
  removeRuleset: (rulesetId) => {
    set({ selectedRulesets: get().selectedRulesets.filter((r) => r.id !== rulesetId) });
  },
  
  clearRulesets: () => set({ selectedRulesets: [] }),
  
  hasPlotPanelComponents: () => {
    const rulesets = get().selectedRulesets;
    return rulesets.some((ruleset) => {
      if (!ruleset.definition) return false;
      const def = ruleset.definition as Record<string, unknown>;
      const uiSchema = def.ui_schema as Record<string, unknown> | undefined;
      return Array.isArray(uiSchema?.plot_panel_components) && (uiSchema.plot_panel_components as unknown[]).length > 0;
    });
  },
}));

