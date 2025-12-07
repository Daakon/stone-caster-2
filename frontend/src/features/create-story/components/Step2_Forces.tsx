/**
 * Step 2: Forces
 * Deck building UI for selecting rulesets (physics/laws of the world)
 * 
 * Features:
 * - Foundations organized by exclusion_group
 * - Tag filtering
 * - Nested expansions within selected foundations
 * - Exclusion group enforcement
 * - Dependency validation
 */

import React, { useMemo, useState } from 'react';
import { Check, X, Radio, Lock, ChevronDown } from 'lucide-react';
import { useStoryDraftStore } from '../store/useStoryDraftStore';
import { AVAILABLE_RULESETS } from '../data/mock-rulesets';
import { RulesetFilterBar } from './RulesetFilterBar';
import { 
  groupRulesetsByExclusion, 
  getGroupLabel,
  getMissingDependencies,
  getChildRulesets,
} from '../utils/ruleset-interpreter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { RulesetDefinition } from '@shared/types/chimera-authoring';

export function Step2_Forces() {
  const draft = useStoryDraftStore((state) => state.draft);
  const updateMetadata = useStoryDraftStore((state) => state.updateMetadata);

  const selectedRulesetKeys = draft?.metadata.ruleset_keys || [];
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  // Get all foundation rulesets
  const foundationRulesets = useMemo(() => {
    return AVAILABLE_RULESETS.filter((r) => r.ui_category === 'foundation');
  }, []);

  // Get all unique tags from foundation rulesets
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    foundationRulesets.forEach((ruleset) => {
      ruleset.provides_tags?.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [foundationRulesets]);

  // Filter foundations by tags
  const filteredFoundations = useMemo(() => {
    if (activeFilters.length === 0) {
      return foundationRulesets;
    }
    return foundationRulesets.filter((ruleset) =>
      ruleset.provides_tags?.some((tag) => activeFilters.includes(tag))
    );
  }, [foundationRulesets, activeFilters]);

  // Group filtered foundations by exclusion_group
  const groupedFoundations = useMemo(() => {
    return groupRulesetsByExclusion(filteredFoundations);
  }, [filteredFoundations]);

  // Toggle tag filter
  const handleToggleTag = (tag: string) => {
    setActiveFilters((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  // Handle ruleset toggle with exclusion logic and auto-deselect
  const toggleRuleset = (ruleset: RulesetDefinition) => {
    const isSelected = selectedRulesetKeys.includes(ruleset.id);
    let newKeys: string[];

    if (isSelected) {
      // Remove this ruleset
      newKeys = selectedRulesetKeys.filter((key) => key !== ruleset.id);

      // Auto-deselect: Find all rulesets that depend on this one
      const dependentRulesets = getChildRulesets(ruleset.id, AVAILABLE_RULESETS);
      dependentRulesets.forEach((dependent) => {
        // Only remove if it's currently selected
        if (newKeys.includes(dependent.id)) {
          newKeys = newKeys.filter((key) => key !== dependent.id);
        }
      });
    } else {
      // Add this ruleset
      newKeys = [...selectedRulesetKeys, ruleset.id];

      // Handle exclusion groups: if this ruleset has an exclusion group,
      // remove ONLY other rulesets that share the SAME exclusion_group
      if (ruleset.exclusion_group) {
        const exclusionGroupRulesets = AVAILABLE_RULESETS.filter(
          (r) => r.exclusion_group === ruleset.exclusion_group && r.id !== ruleset.id
        );
        exclusionGroupRulesets.forEach((excluded) => {
          newKeys = newKeys.filter((key) => key !== excluded.id);
        });
      }
    }

    updateMetadata({ ruleset_keys: newKeys });
  };

  // Render a foundation card with nested expansions
  const renderFoundationCard = (foundation: RulesetDefinition, groupSize: number) => {
    const isSelected = selectedRulesetKeys.includes(foundation.id);
    const isExclusiveGroup = groupSize > 1;
    const childRulesets = getChildRulesets(foundation.id, AVAILABLE_RULESETS);

    return (
      <Card
        key={foundation.id}
        className={cn(
          'transition-all',
          isSelected && 'ring-2 ring-primary ring-offset-2'
        )}
      >
        {/* Foundation Header */}
        <CardHeader
          className={cn(
            'pb-3 cursor-pointer hover:bg-muted/50 transition-colors',
            isSelected && 'bg-primary/5'
          )}
          onClick={() => toggleRuleset(foundation)}
          role={isExclusiveGroup ? 'radio' : 'button'}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleRuleset(foundation);
            }
          }}
          aria-pressed={isSelected}
          aria-checked={isExclusiveGroup ? isSelected : undefined}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg flex items-center gap-2">
                {isExclusiveGroup && (
                  <Radio className={cn(
                    'h-4 w-4',
                    isSelected ? 'text-primary fill-primary' : 'text-muted-foreground'
                  )} />
                )}
                {foundation.name}
                {isSelected && (
                  <Badge variant="default" className="ml-2">
                    <Check className="h-3 w-3 mr-1" />
                    Selected
                  </Badge>
                )}
              </CardTitle>
              {foundation.description_short && (
                <CardDescription className="mt-1">{foundation.description_short}</CardDescription>
              )}
            </div>
          </div>
        </CardHeader>

        {/* Foundation Content */}
        <CardContent className="pt-0 space-y-3">
          {/* Tags */}
          {foundation.provides_tags && foundation.provides_tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {foundation.provides_tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Nested Expansions Drawer */}
          {isSelected && childRulesets.length > 0 && (
            <div className="mt-4 pt-4 border-t bg-muted/30 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-semibold">Available Expansions</h4>
              </div>
              <div className="space-y-2">
                {childRulesets.map((child) => {
                  const isChildSelected = selectedRulesetKeys.includes(child.id);
                  const missingDeps = getMissingDependencies(child, selectedRulesetKeys);
                  const isChildLocked = missingDeps.length > 0;
                  const canSelectChild = !isChildLocked;

                  const missingDepNames = missingDeps.map((depId) => {
                    const depRuleset = AVAILABLE_RULESETS.find((r) => r.id === depId);
                    return depRuleset?.name || depId;
                  });

                  return (
                    <div
                      key={child.id}
                      className={cn(
                        'p-3 rounded-md border transition-all',
                        canSelectChild && 'cursor-pointer hover:bg-background hover:border-primary/50',
                        !canSelectChild && 'opacity-70 cursor-not-allowed',
                        isChildSelected && 'bg-primary/10 border-primary'
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (canSelectChild) {
                          toggleRuleset(child);
                        }
                      }}
                      role="checkbox"
                      tabIndex={canSelectChild ? 0 : -1}
                      onKeyDown={(e) => {
                        if (canSelectChild && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          toggleRuleset(child);
                        }
                      }}
                      aria-checked={isChildSelected}
                      aria-disabled={!canSelectChild}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {isChildLocked && (
                              <Lock className="h-3 w-3 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                            )}
                            <span className={cn(
                              'text-sm font-medium',
                              isChildSelected && 'text-primary'
                            )}>
                              {child.name}
                            </span>
                            {isChildSelected && (
                              <Check className="h-4 w-4 text-primary" />
                            )}
                          </div>
                          {child.description_short && (
                            <p className="text-xs text-muted-foreground mb-2">
                              {child.description_short}
                            </p>
                          )}
                          {isChildLocked && (
                            <div className="flex items-start gap-1.5 p-2 bg-amber-50 dark:bg-amber-950/20 rounded border border-amber-200 dark:border-amber-800">
                              <Lock className="h-3 w-3 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                              <div className="text-xs text-amber-800 dark:text-amber-200">
                                <p className="font-medium">Requires:</p>
                                <ul className="list-disc list-inside mt-0.5">
                                  {missingDepNames.map((name, idx) => (
                                    <li key={idx}>{name}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Forces</h2>
        <p className="text-muted-foreground">
          Select the foundations that define the core systems of your world. Expansions will appear nested within their parent foundations.
        </p>
      </div>

      {/* Tag Filter Bar */}
      <RulesetFilterBar
        availableTags={availableTags}
        selectedTags={activeFilters}
        onToggleTag={handleToggleTag}
      />

      {/* Foundation Groups */}
      <div className="space-y-6">
        {Array.from(groupedFoundations.entries()).map(([groupKey, groupRulesets], groupIndex) => {
          const groupLabel = getGroupLabel(groupKey);
          const groupSize = groupRulesets.length;
          const isExclusiveGroup = groupSize > 1;

          return (
            <div key={groupKey ?? 'misc'} className={cn('space-y-4', groupIndex > 0 && 'pt-6 border-t')}>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">{groupLabel}</h3>
                {isExclusiveGroup && (
                  <Badge variant="outline" className="text-xs">
                    <Radio className="h-3 w-3 mr-1" />
                    Select One
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {groupRulesets.map((foundation) => renderFoundationCard(foundation, groupSize))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selection Summary */}
      {selectedRulesetKeys.length > 0 && (
        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="text-lg">Selected Rulesets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {selectedRulesetKeys.map((key) => {
                const ruleset = AVAILABLE_RULESETS.find((r) => r.id === key);
                if (!ruleset) return null;
                return (
                  <Badge key={key} variant="default" className="text-sm min-h-[32px] flex items-center gap-1">
                    {ruleset.name}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleRuleset(ruleset);
                      }}
                      className="ml-1 rounded-full hover:bg-primary-foreground/20 p-0.5"
                      aria-label={`Remove ${ruleset.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
