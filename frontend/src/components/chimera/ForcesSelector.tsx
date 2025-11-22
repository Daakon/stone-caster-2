// [CHIMERA V3] Architecture: Greenfield | Layer: Frontend
/**
 * Forces Selector Component
 * Complex selection logic for rulesets with exclusion groups and dependencies
 */

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import type { RulesetDefinition } from '@shared/types/chimera-authoring';

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

  // Map rulesets by exclusion group
  const rulesetsByExclusionGroup = useMemo(() => {
    const map = new Map<string, RulesetDefinition[]>();
    rulesets.forEach((r) => {
      if (r.exclusion_group) {
        const group = r.exclusion_group;
        if (!map.has(group)) {
          map.set(group, []);
        }
        map.get(group)!.push(r);
      }
    });
    return map;
  }, [rulesets]);

  // Check for missing dependencies
  const missingDependencies = useMemo(() => {
    const missing: Array<{ ruleset: RulesetDefinition; missing: string[] }> = [];
    selectedRulesetIds.forEach((id) => {
      const ruleset = rulesets.find((r) => r.id === id);
      if (ruleset && ruleset.dependencies.length > 0) {
        const missingDeps = ruleset.dependencies.filter((depId) => !selectedRulesetIds.has(depId));
        if (missingDeps.length > 0) {
          missing.push({ ruleset, missing: missingDeps });
        }
      }
    });
    return missing;
  }, [selectedRulesetIds, rulesets]);

  const handleRulesetToggle = (ruleset: RulesetDefinition, checked: boolean) => {
    const newSelection = new Set(selectedRulesetIds);

    if (checked) {
      // Add the ruleset
      newSelection.add(ruleset.id);

      // If it has an exclusion group, remove others in that group
      if (ruleset.exclusion_group) {
        const groupRulesets = rulesetsByExclusionGroup.get(ruleset.exclusion_group) || [];
        groupRulesets.forEach((r) => {
          if (r.id !== ruleset.id) {
            newSelection.delete(r.id);
          }
        });
      }
    } else {
      // Remove the ruleset
      newSelection.delete(ruleset.id);
    }

    onSelectionChange(newSelection);
  };

  const handleRadioGroupChange = (groupId: string, selectedId: string) => {
    const newSelection = new Set(selectedRulesetIds);
    const groupRulesets = rulesetsByExclusionGroup.get(groupId) || [];

    // Remove all rulesets in this exclusion group
    groupRulesets.forEach((r) => {
      newSelection.delete(r.id);
    });

    // Add the selected one
    newSelection.add(selectedId);

    onSelectionChange(newSelection);
  };

  const renderRuleset = (ruleset: RulesetDefinition) => {
    const isSelected = selectedRulesetIds.has(ruleset.id);

    // If it has an exclusion group, render as radio button
    if (ruleset.exclusion_group) {
      const groupId = `exclusion-group-${ruleset.exclusion_group}`;
      const groupRulesets = rulesetsByExclusionGroup.get(ruleset.exclusion_group) || [];
      const selectedInGroup = groupRulesets.find((r) => selectedRulesetIds.has(r.id))?.id || '';

      return (
        <div key={ruleset.id} className="flex items-start space-x-3">
          <RadioGroup
            value={selectedInGroup}
            onValueChange={(value) => handleRadioGroupChange(ruleset.exclusion_group!, value)}
            className="flex-1"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value={ruleset.id} id={`radio-${ruleset.id}`} />
              <Label
                htmlFor={`radio-${ruleset.id}`}
                className="flex-1 cursor-pointer font-normal"
              >
                {ruleset.name}
                {ruleset.exclusion_group && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({ruleset.exclusion_group})
                  </span>
                )}
              </Label>
            </div>
          </RadioGroup>
        </div>
      );
    }

    // Otherwise, render as checkbox
    return (
      <div key={ruleset.id} className="flex items-start space-x-3">
        <Checkbox
          id={`checkbox-${ruleset.id}`}
          checked={isSelected}
          onCheckedChange={(checked) => handleRulesetToggle(ruleset, checked === true)}
        />
        <Label
          htmlFor={`checkbox-${ruleset.id}`}
          className="flex-1 cursor-pointer font-normal"
        >
          {ruleset.name}
        </Label>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Missing Dependencies Warning */}
      {missingDependencies.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Missing Dependencies</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside mt-2 space-y-1">
              {missingDependencies.map(({ ruleset, missing }) => (
                <li key={ruleset.id}>
                  <strong>{ruleset.name}</strong> requires:{' '}
                  {missing
                    .map((id) => {
                      const dep = rulesets.find((r) => r.id === id);
                      return dep?.name || id;
                    })
                    .join(', ')}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Foundations */}
      <Card>
        <CardHeader>
          <CardTitle>Foundations</CardTitle>
          <CardDescription>
            Core rulesets that define the base game system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {rulesetsByCategory.foundation.length > 0 ? (
            rulesetsByCategory.foundation.map(renderRuleset)
          ) : (
            <p className="text-sm text-muted-foreground">No foundation rulesets available</p>
          )}
        </CardContent>
      </Card>

      {/* Expansions */}
      <Card>
        <CardHeader>
          <CardTitle>Expansions</CardTitle>
          <CardDescription>
            Additional rulesets that extend the game system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {rulesetsByCategory.expansion.length > 0 ? (
            rulesetsByCategory.expansion.map(renderRuleset)
          ) : (
            <p className="text-sm text-muted-foreground">No expansion rulesets available</p>
          )}
        </CardContent>
      </Card>

      {/* Flavor */}
      <Card>
        <CardHeader>
          <CardTitle>Flavor</CardTitle>
          <CardDescription>
            Thematic rulesets that add flavor and atmosphere
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {rulesetsByCategory.flavor.length > 0 ? (
            rulesetsByCategory.flavor.map(renderRuleset)
          ) : (
            <p className="text-sm text-muted-foreground">No flavor rulesets available</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

