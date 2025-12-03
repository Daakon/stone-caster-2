// [CHIMERA V3] Architecture: Greenfield | Layer: Frontend
/**
 * Forces Selector Component
 * Complex selection logic for rulesets with exclusion groups and dependencies
 * Phase 3-B: Updated to use hierarchical RulesetSelector component
 */

import type { RulesetDefinition } from '@shared/types/chimera-authoring';
import { RulesetSelector } from '@/components/casting/RulesetSelector';

interface ForcesSelectorProps {
  rulesets: RulesetDefinition[];
  selectedRulesetIds: Set<string>;
  onSelectionChange: (selectedIds: Set<string>) => void;
}

export function ForcesSelector({
  rulesets,
  selectedRulesetIds,
  onSelectionChange,
}: ForcesSelectorProps) {
  return (
    <RulesetSelector
      rulesets={rulesets}
      selectedRulesetIds={selectedRulesetIds}
      onSelectionChange={onSelectionChange}
    />
  );
}

