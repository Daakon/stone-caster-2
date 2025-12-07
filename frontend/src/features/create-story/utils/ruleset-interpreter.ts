/**
 * Ruleset Interpreter
 * Utility functions to determine UI behavior based on selected rulesets
 */

import type { RulesetDefinition } from '@shared/types/chimera-authoring';

/**
 * Group rulesets by their exclusion_group
 * Returns a Map where keys are exclusion_group names (or 'misc' for null groups)
 * and values are arrays of rulesets in that group
 */
export function groupRulesetsByExclusion(
  rulesets: RulesetDefinition[]
): Map<string | null, RulesetDefinition[]> {
  const groups = new Map<string | null, RulesetDefinition[]>();

  rulesets.forEach((ruleset) => {
    const groupKey = ruleset.exclusion_group ?? null;
    
    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    
    groups.get(groupKey)!.push(ruleset);
  });

  return groups;
}

/**
 * Get human-readable label for an exclusion group
 * Converts technical keys like "skill_system_root" to readable titles like "Skill System"
 */
export function getGroupLabel(groupKey: string | null): string {
  if (!groupKey) {
    return 'Optional';
  }

  const labelMap: Record<string, string> = {
    skill_system_root: 'Skill System',
    time_core: 'Time System',
    vitality_core: 'Health System',
    // Add more mappings as needed
  };

  // If we have a mapping, use it
  if (labelMap[groupKey]) {
    return labelMap[groupKey];
  }

  // Otherwise, convert snake_case to Title Case
  return groupKey
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Get required stat fields based on selected rulesets
 * Returns the stat field names that should be rendered in entity forms
 */
export function getRequiredStatFields(rulesetKeys: string[]): string[] {
  // Check for d100-5-pillars or d100-lite (foundation rulesets)
  const hasD1005Pillars = rulesetKeys.includes('foundation-d100-5-pillars');
  const hasD100Lite = rulesetKeys.includes('foundation-d100-lite');

  if (hasD1005Pillars || hasD100Lite) {
    return [
      'root_force',
      'root_finesse',
      'root_awareness',
      'root_insight',
      'root_influence',
    ];
  }

  // Future extensibility: if d20-system was selected, return Str/Dex/Con
  // if (rulesetKeys.includes('d20-system')) {
  //   return ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
  // }

  // Default: return empty array if no matching ruleset
  return [];
}

/**
 * Check if the stamina system is enabled
 * Returns true if vitality-stamina-system is selected
 */
export function hasStaminaSystem(rulesetKeys: string[]): boolean {
  return rulesetKeys.includes('expansion-vitality-stamina');
}

/**
 * Get human-readable label for a stat field
 * Converts technical keys like "root_force" to readable labels like "Force"
 */
export function getStatLabel(statKey: string): string {
  const labelMap: Record<string, string> = {
    root_force: 'Force',
    root_finesse: 'Finesse',
    root_awareness: 'Awareness',
    root_insight: 'Insight',
    root_influence: 'Influence',
    // Future extensibility
    strength: 'Strength',
    dexterity: 'Dexterity',
    constitution: 'Constitution',
    intelligence: 'Intelligence',
    wisdom: 'Wisdom',
    charisma: 'Charisma',
  };

  return labelMap[statKey] || statKey.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Get missing dependencies for a ruleset
 * Returns an array of dependency keys that are not in the selected keys
 */
export function getMissingDependencies(
  rule: RulesetDefinition,
  selectedKeys: string[]
): string[] {
  if (rule.dependencies.length === 0) {
    return [];
  }
  
  return rule.dependencies.filter((depId) => !selectedKeys.includes(depId));
}

/**
 * Check if a ruleset should be visible (progressive disclosure)
 * Returns true if:
 * - The ruleset has no dependencies (base rule), OR
 * - At least one dependency is selected (show but may be locked)
 * Returns false if:
 * - The ruleset has dependencies AND none are selected (hide completely)
 */
export function isRuleVisible(
  rule: RulesetDefinition,
  selectedKeys: string[]
): boolean {
  // Base rules (no dependencies) are always visible
  if (rule.dependencies.length === 0) {
    return true;
  }
  
  // Show if at least one dependency is selected
  return rule.dependencies.some((depId) => selectedKeys.includes(depId));
}

/**
 * Get all child rulesets that depend on a parent ruleset
 * Returns an array of rulesets where dependencies includes the parentKey
 */
export function getChildRulesets(
  parentKey: string,
  allRulesets: RulesetDefinition[]
): RulesetDefinition[] {
  return allRulesets.filter((ruleset) => ruleset.dependencies.includes(parentKey));
}
