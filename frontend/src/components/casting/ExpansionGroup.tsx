/**
 * ExpansionGroup Component
 * Phase 3-B: Hub & Spoke visual hierarchy
 * Displays expansions filtered by foundation, rendered as subordinate to the foundation
 */

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RulesetDefinition } from '@shared/types/chimera-authoring';
import { useCastingStore } from '@/stores/useCastingStore';

interface ExpansionGroupProps {
  foundationId: string;
  foundationName: string;
  allRulesets: RulesetDefinition[];
  selectedRulesetIds: Set<string>;
  onSelectionChange: (selectedIds: Set<string>) => void;
}

export function ExpansionGroup({
  foundationId,
  foundationName,
  allRulesets,
  selectedRulesetIds,
  onSelectionChange,
}: ExpansionGroupProps) {
  const store = useCastingStore();
  const { getAvailableExpansions } = store;

  // Get expansions available for this foundation
  const availableExpansions = useMemo(() => {
    const expansions = getAvailableExpansions(foundationId, allRulesets);
    return expansions || [];
  }, [foundationId, allRulesets, getAvailableExpansions]);

  const handleToggle = (expansionId: string) => {
    store.toggleExpansion(expansionId, allRulesets);
    onSelectionChange(store.selectedRulesetIds);
  };

  if (!availableExpansions || availableExpansions.length === 0) {
    return null;
  }

  return (
    <Card className="ml-4 md:ml-8 border-l-2 border-l-primary/20 bg-muted/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          Expansions for {foundationName}
        </CardTitle>
        <CardDescription>
          Additional rulesets compatible with this foundation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {availableExpansions.map((expansion) => {
          const isSelected = selectedRulesetIds.has(expansion.id);
          return (
            <div key={expansion.id} className="flex items-start space-x-3">
              <Checkbox
                id={`expansion-${expansion.id}`}
                checked={isSelected}
                onCheckedChange={() => handleToggle(expansion.id)}
              />
              <Label
                htmlFor={`expansion-${expansion.id}`}
                className="flex-1 cursor-pointer font-normal"
              >
                <div className="font-medium">{expansion.name}</div>
                {expansion.description_short && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {expansion.description_short}
                  </div>
                )}
              </Label>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

