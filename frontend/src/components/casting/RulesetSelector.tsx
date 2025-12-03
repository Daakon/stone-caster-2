/**
 * RulesetSelector Component
 * Phase 3-B: Hub & Spoke visual hierarchy
 * Main container that displays foundations, expansions, and flavors in a hierarchical layout
 */

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import type { RulesetDefinition } from '@shared/types/chimera-authoring';
import { useCastingStore } from '@/stores/useCastingStore';
import { FoundationCard } from './FoundationCard';
import { ExpansionGroup } from './ExpansionGroup';

interface RulesetSelectorProps {
  rulesets: RulesetDefinition[];
  selectedRulesetIds: Set<string>;
  onSelectionChange: (selectedIds: Set<string>) => void;
}

export function RulesetSelector({
  rulesets,
  selectedRulesetIds,
  onSelectionChange,
}: RulesetSelectorProps) {
  const store = useCastingStore();
  const { selectedFoundationId, selectFoundation, validateDependencies } = store;

  // Group rulesets by category
  const rulesetsByCategory = useMemo(() => {
    const grouped: Record<'foundation' | 'expansion' | 'flavor', RulesetDefinition[]> = {
      foundation: [],
      expansion: [],
      flavor: [],
    };
    rulesets.forEach((r) => {
      if (grouped[r.ui_category]) {
        grouped[r.ui_category].push(r);
      }
    });
    return grouped;
  }, [rulesets]);

  // Get selected foundation ruleset
  const selectedFoundation = useMemo(() => {
    if (!selectedFoundationId) {
      return null;
    }
    return rulesets.find((r) => r.id === selectedFoundationId) || null;
  }, [selectedFoundationId, rulesets]);

  // Check for missing dependencies
  const validation = useMemo(() => {
    return validateDependencies(selectedRulesetIds, rulesets);
  }, [selectedRulesetIds, rulesets, validateDependencies]);

  const handleFoundationSelect = (foundationId: string) => {
    selectFoundation(foundationId, rulesets);
    onSelectionChange(store.selectedRulesetIds);
  };

  const handleFlavorToggle = (flavorId: string) => {
    store.toggleFlavor(flavorId);
    onSelectionChange(store.selectedRulesetIds);
  };

  return (
    <div className="space-y-6">
      {/* Missing Dependencies Warning */}
      {!validation.valid && validation.errors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Missing Dependencies</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside mt-2 space-y-1">
              {validation.errors.map(({ ruleset, missing }) => (
                <li key={ruleset.id}>
                  <strong>{ruleset.name}</strong> requires:{' '}
                  {missing
                    .map((id) => {
                      const dep = rulesets.find((r) => r.id === id || r.name === id);
                      return dep?.name || id;
                    })
                    .join(', ')}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Zone 1: Foundations (Hubs) */}
      <div>
        <Card>
          <CardHeader>
            <CardTitle>Foundations</CardTitle>
            <CardDescription>
              Select exactly one foundation ruleset that defines the base game system.
              {selectedFoundation && (
                <span className="block mt-1 text-xs text-muted-foreground">
                  Selected: {selectedFoundation.name}
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rulesetsByCategory.foundation.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rulesetsByCategory.foundation.map((foundation) => (
                  <FoundationCard
                    key={foundation.id}
                    ruleset={foundation}
                    isSelected={selectedFoundationId === foundation.id}
                    onSelect={handleFoundationSelect}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No foundation rulesets available</p>
            )}
          </CardContent>
        </Card>

        {/* Zone 2: Expansions (Spokes) - Only shown when foundation is selected */}
        {selectedFoundationId && selectedFoundation && (
          <div className="mt-4">
            <ExpansionGroup
              foundationId={selectedFoundationId}
              foundationName={selectedFoundation.name}
              allRulesets={rulesets}
              selectedRulesetIds={selectedRulesetIds}
              onSelectionChange={onSelectionChange}
            />
          </div>
        )}
      </div>

      {/* Zone 3: Flavor (System-agnostic) */}
      {rulesetsByCategory.flavor.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Flavor</CardTitle>
            <CardDescription>
              Thematic rulesets that add flavor and atmosphere. These are system-agnostic and
              work with any foundation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {rulesetsByCategory.flavor.map((flavor) => {
              const isSelected = selectedRulesetIds.has(flavor.id);
              return (
                <div key={flavor.id} className="flex items-start space-x-3">
                  <Checkbox
                    id={`flavor-${flavor.id}`}
                    checked={isSelected}
                    onCheckedChange={() => handleFlavorToggle(flavor.id)}
                  />
                  <Label
                    htmlFor={`flavor-${flavor.id}`}
                    className="flex-1 cursor-pointer font-normal"
                  >
                    <div className="font-medium">{flavor.name}</div>
                    {flavor.description_short && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {flavor.description_short}
                      </div>
                    )}
                  </Label>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

