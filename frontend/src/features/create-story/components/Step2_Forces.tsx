/**
 * Step 2: Forces
 * Define the physical and metaphysical laws (Rulesets) of the world.
 *
 * New Flow:
 * 1. "Choose Your Experience" -> Select a Playstyle (Theme)
 *    - This applies a DEFAULT set of rulesets.
 * 2. "Customize Forces" (Optional) -> Detailed deck building
 *    - Allows tweaking the defaults.
 */

import React, { useMemo, useState } from 'react';
import { Check, Radio, Lock, ChevronDown, ChevronRight, Settings2 } from 'lucide-react';
import { useStoryDraftStore } from '../store/useStoryDraftStore';
import { AVAILABLE_RULESETS } from '../data/mock-rulesets';
import { PLAYSTYLES, type PlaystyleDefinition } from '../data/mock-playstyles';
import { RulesetFilterBar } from './RulesetFilterBar';
import {
  groupRulesetsByExclusion,
  getGroupLabel,
  getMissingDependencies,
  getChildRulesets,
} from '../utils/ruleset-interpreter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { RulesetDefinition } from '@shared/types/chimera-authoring';

export function Step2_Forces() {
  const draft = useStoryDraftStore((state) => state.draft);
  const updateMetadata = useStoryDraftStore((state) => state.updateMetadata);

  const selectedRulesetKeys = draft?.metadata.ruleset_keys || [];
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [isCustomizing, setIsCustomizing] = useState(false);

  // Determine active playstyle (naive check: if current rules match a playstyle exactly)
  const activePlaystyleId = useMemo(() => {
    // If no rules selected, no playstyle
    if (selectedRulesetKeys.length === 0) return null;

    // Check if matches a playstyle exactly
    // Note: This is weak if user customizes even slightly, but serves as a UI hint
    const match = PLAYSTYLES.find(p => {
      const sortedP = [...p.default_ruleset_keys].sort();
      const sortedS = [...selectedRulesetKeys].sort();
      return JSON.stringify(sortedP) === JSON.stringify(sortedS);
    });
    return match ? match.id : 'custom';
  }, [selectedRulesetKeys]);

  const handleSelectPlaystyle = (playstyle: PlaystyleDefinition) => {
    updateMetadata({
      ruleset_keys: playstyle.default_ruleset_keys
    });
  };

  // =========================================================================
  // Existing Logic for Customization
  // =========================================================================

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

  // Handle ruleset toggle with exclusion logic
  const toggleRuleset = (ruleset: RulesetDefinition) => {
    const isSelected = selectedRulesetKeys.includes(ruleset.id);
    let newKeys: string[];

    if (isSelected) {
      // Remove
      newKeys = selectedRulesetKeys.filter((key) => key !== ruleset.id);

      // Auto-deselect dependents
      const dependentRulesets = getChildRulesets(ruleset.id, AVAILABLE_RULESETS);
      dependentRulesets.forEach((dependent) => {
        if (newKeys.includes(dependent.id)) {
          newKeys = newKeys.filter((key) => key !== dependent.id);
        }
      });
    } else {
      // Add
      newKeys = [...selectedRulesetKeys, ruleset.id];

      // Handle exclusion groups
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
        <CardHeader
          className={cn(
            'pb-3 cursor-pointer hover:bg-muted/50 transition-colors',
            isSelected && 'bg-primary/5'
          )}
          onClick={() => toggleRuleset(foundation)}
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
              </CardTitle>
              {foundation.description_short && (
                <CardDescription className="mt-1">{foundation.description_short}</CardDescription>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0 space-y-3">
          {foundation.provides_tags && foundation.provides_tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {foundation.provides_tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

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
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-2">Forces</h2>
        <p className="text-muted-foreground">
          Define the physics and laws of your world. Start by choosing a playstyle, then customize if needed.
        </p>
      </div>

      {/* 1. Playstyle Selection */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Choose Your Experience
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLAYSTYLES.map(playstyle => {
            const Icon = playstyle.icon;
            const isActive = activePlaystyleId === playstyle.id;

            return (
              <Card
                key={playstyle.id}
                className={cn(
                  "cursor-pointer hover:border-primary/50 transition-all",
                  isActive && "ring-2 ring-primary ring-offset-2 bg-primary/5"
                )}
                onClick={() => handleSelectPlaystyle(playstyle)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2 rounded-lg",
                      isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <h4 className="font-semibold">{playstyle.name}</h4>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{playstyle.description}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* 2. Customization Accordion/Section */}
      <div className="pt-6 border-t">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Customize Forces {activePlaystyleId === 'custom' && '(Custom)'}
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCustomizing(!isCustomizing)}
          >
            {isCustomizing ? 'Hide Details' : 'Show Details'}
            <ChevronDown className={cn("ml-2 h-4 w-4 transition-transform", isCustomizing && "rotate-180")} />
          </Button>
        </div>

        {isCustomizing && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-300 space-y-6">
            <RulesetFilterBar
              availableTags={availableTags}
              selectedTags={activeFilters}
              onToggleTag={handleToggleTag}
            />

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
          </div>
        )}

        {/* Selected Rulesets Review (Compact) */}
        {!isCustomizing && selectedRulesetKeys.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedRulesetKeys.map(key => {
              const r = AVAILABLE_RULESETS.find(x => x.id === key);
              if (!r) return null;
              return (
                <Badge key={key} variant="secondary">
                  {r.name}
                </Badge>
              )
            })}
          </div>
        )}
      </div>
      {/* Floating Continue Button */}
      {selectedRulesetKeys.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Button
            size="lg"
            className="shadow-lg hover:shadow-xl transition-all gap-2 px-8 rounded-full"
            onClick={() => useStoryDraftStore.setState(state => {
              if (state.draft) state.draft.current_step += 1;
              return { draft: { ...state.draft!, current_step: 2 } };
            })}
          >
            Continue to Elements
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

