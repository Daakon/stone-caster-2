import React, { useMemo, useState } from 'react';
import { useRulesets } from '@/services/chimera-api';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Info, Layers, Puzzle, CornerDownRight } from 'lucide-react';
import { RulesetInfoModal } from './RulesetInfoModal';
import { cn } from '@/lib/utils';
import type { RulesetDefinition } from '@shared/types/chimera-authoring';

interface RulesetConfiguratorProps {
    selectedKeys: string[];
    lockedKeys?: string[];
    onToggle: (key: string) => void;
    className?: string;
}

export function RulesetConfigurator({ selectedKeys, lockedKeys = [], onToggle, className }: RulesetConfiguratorProps) {
    const { data: rulesets, isLoading } = useRulesets();
    const [viewInfo, setViewInfo] = useState<RulesetDefinition | null>(null);

    // Group rulesets hierarchy
    const { foundationGroups, disconnectedExpansions } = useMemo(() => {
        if (!rulesets) return { foundationGroups: [], disconnectedExpansions: [] };

        const foundations: RulesetDefinition[] = [];
        const expansions: RulesetDefinition[] = [];

        // 1. Separate Foundations and Expansions
        rulesets.forEach(r => {
            if (r.ui_category === 'foundation') {
                foundations.push(r);
            } else {
                expansions.push(r);
            }
        });

        // 2. expansionMap: foundationId -> expansions[]
        const expansionMap = new Map<string, RulesetDefinition[]>();
        const unmappedExpansions: RulesetDefinition[] = [];

        expansions.forEach(exp => {
            // Find which foundation this expansion depends on
            // Strategy: Look for a dependency that matches a known foundation ID
            const parentFoundationId = exp.dependencies?.find(depId =>
                foundations.some(f => f.id === depId)
            );

            if (parentFoundationId) {
                if (!expansionMap.has(parentFoundationId)) {
                    expansionMap.set(parentFoundationId, []);
                }
                expansionMap.get(parentFoundationId)!.push(exp);
            } else {
                unmappedExpansions.push(exp);
            }
        });

        // 3. Group Foundations by exclusion_group
        const groups: Record<string, { foundation: RulesetDefinition, expansions: RulesetDefinition[] }[]> = {};

        foundations.forEach(f => {
            const groupKey = f.exclusion_group || 'other';
            if (!groups[groupKey]) groups[groupKey] = [];

            groups[groupKey].push({
                foundation: f,
                expansions: expansionMap.get(f.id) || []
            });
        });

        // Convert to array for rendering
        const resultGroups = Object.entries(groups).map(([groupKey, items]) => ({
            groupKey,
            items
        }));

        return { foundationGroups: resultGroups, disconnectedExpansions: unmappedExpansions };
    }, [rulesets]);

    const handleInfoClick = (e: React.MouseEvent, ruleset: RulesetDefinition) => {
        e.stopPropagation();
        setViewInfo(ruleset);
    };

    if (isLoading) {
        return <div className="p-8 text-center text-stone-500">Loading rulesets...</div>;
    }

    return (
        <div className={cn("space-y-8", className)}>

            {/* HIERARCHICAL LIST */}
            <div className="space-y-6">
                {foundationGroups.map(({ groupKey, items }) => (
                    <div key={groupKey} className="space-y-4">
                        <div className="flex items-center gap-2 pb-1 border-b border-stone-800">
                            <Layers className="w-5 h-5 text-cyan-500" />
                            <h3 className="text-md font-semibold text-stone-300 uppercase tracking-wide">
                                {groupKey === 'other' ? 'Core Mechanics' : groupKey.split('-').join(' ')}
                            </h3>
                        </div>

                        {/* If exclusive group, render logic is tricky because we want visual separation 
                            but single RadioGroup logic. 
                            However, since we need to render *nested* expansions inside each option, 
                            standard RadioGroup component might be hard to style if we can't put arbitrary children.
                            Radix/Shadcn RadioGroup usually allows this.
                        */}

                        {/* Render as Checkboxes with Exclusion Logic (Visual radio behavior but using Checkbox component) */}
                        {groupKey !== 'other' ? (
                            <div className="space-y-4">
                                <p className="text-xs text-stone-500 italic">
                                    Select one ruleset from this group.
                                </p>
                                {items.map(({ foundation, expansions }) => {
                                    const isSelected = selectedKeys.includes(foundation.id);
                                    // Check if any OTHER item in this group is selected
                                    const isOtherSelected = items.some(i =>
                                        i.foundation.id !== foundation.id && selectedKeys.includes(i.foundation.id)
                                    );

                                    return (
                                        <div key={foundation.id} className="space-y-2">
                                            {/* Foundation Item */}
                                            <div className={cn(
                                                "flex items-center justify-between p-3 rounded-lg border transition-all",
                                                isSelected
                                                    ? "bg-stone-900 border-cyan-900/50 shadow-[0_0_15px_rgba(8,145,178,0.1)]"
                                                    : isOtherSelected
                                                        ? "bg-stone-950/30 border-stone-900 opacity-60"
                                                        : "bg-stone-950 border-stone-800 hover:border-stone-700 hover:bg-stone-900"
                                            )}>
                                                <div className="flex items-center space-x-3 flex-1">
                                                    <Checkbox
                                                        id={foundation.id}
                                                        checked={isSelected}
                                                        disabled={isOtherSelected || lockedKeys.includes(foundation.id)}
                                                        onCheckedChange={() => onToggle(foundation.id)}
                                                        className={cn(
                                                            "border-stone-600 data-[state=checked]:bg-cyan-600 data-[state=checked]:border-cyan-600",
                                                            isOtherSelected ? "opacity-50" : "",
                                                            lockedKeys.includes(foundation.id) ? "opacity-75 cursor-not-allowed" : ""
                                                        )}
                                                    />
                                                    <div className="grid gap-0.5">
                                                        <Label
                                                            htmlFor={foundation.id}
                                                            className={cn(
                                                                "font-medium cursor-pointer",
                                                                isSelected ? "text-cyan-100" : isOtherSelected ? "text-stone-500" : "text-stone-200"
                                                            )}
                                                        >
                                                            {foundation.name}
                                                        </Label>
                                                        <p className="text-xs text-stone-500 line-clamp-1">
                                                            {foundation.description_short}
                                                        </p>
                                                    </div>
                                                </div>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-stone-500 hover:text-stone-300" onClick={(e) => handleInfoClick(e, foundation)}>
                                                    <Info className="w-4 h-4" />
                                                </Button>
                                            </div>

                                            {/* Nested Expansions (Only show if parent selected) */}
                                            {isSelected && expansions.length > 0 && (
                                                <div className="ml-6 pl-4 border-l-2 border-stone-800 space-y-2 animate-in slide-in-from-top-2 duration-200">
                                                    {expansions.map(exp => (
                                                        <div key={exp.id} className={cn(
                                                            "flex items-start justify-between p-2 pl-3 rounded-r-lg border-y border-r border-stone-800/50 bg-stone-900/30",
                                                            selectedKeys.includes(exp.id) ? "bg-purple-900/10 border-purple-900/30" : ""
                                                        )}>
                                                            <div className="flex items-center gap-3 flex-1">
                                                                <CornerDownRight className="w-4 h-4 text-stone-600" />
                                                                <div className="flex items-start gap-2 flex-1">
                                                                    <Checkbox
                                                                        id={exp.id}
                                                                        checked={selectedKeys.includes(exp.id)}
                                                                        disabled={lockedKeys.includes(exp.id)}
                                                                        onCheckedChange={() => onToggle(exp.id)}
                                                                        className={cn(
                                                                            "mt-0.5 border-stone-600 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600",
                                                                            lockedKeys.includes(exp.id) ? "opacity-75 cursor-not-allowed" : ""
                                                                        )}
                                                                    />
                                                                    <div className="grid gap-0.5">
                                                                        <Label htmlFor={exp.id} className="text-stone-300 text-sm font-medium cursor-pointer">
                                                                            {exp.name}
                                                                        </Label>
                                                                        <p className="text-xs text-stone-500 line-clamp-1">
                                                                            {exp.description_short}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-stone-600 hover:text-stone-400" onClick={(e) => handleInfoClick(e, exp)}>
                                                                <Info className="w-3 h-3" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            // Non-exclusive foundations (Checkboxes)
                            <div className="space-y-4">
                                {items.map(({ foundation, expansions }) => {
                                    const isSelected = selectedKeys.includes(foundation.id);
                                    return (
                                        <div key={foundation.id} className="space-y-2">
                                            <div className={cn(
                                                "flex items-center justify-between p-3 rounded-lg border transition-all",
                                                isSelected
                                                    ? "bg-stone-900 border-stone-700"
                                                    : "bg-stone-950 border-stone-800 hover:border-stone-700"
                                            )}>
                                                <div className="flex items-center space-x-3 flex-1">
                                                    <Checkbox
                                                        id={foundation.id}
                                                        checked={isSelected}
                                                        disabled={lockedKeys.includes(foundation.id)}
                                                        onCheckedChange={() => onToggle(foundation.id)}
                                                        className={cn(
                                                            "border-stone-600 data-[state=checked]:bg-stone-200 data-[state=checked]:text-stone-900",
                                                            lockedKeys.includes(foundation.id) ? "opacity-75 cursor-not-allowed" : ""
                                                        )}
                                                    />
                                                    <div className="grid gap-0.5">
                                                        <Label htmlFor={foundation.id} className="text-stone-200 font-medium cursor-pointer">
                                                            {foundation.name}
                                                        </Label>
                                                    </div>
                                                </div>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-stone-500 hover:text-stone-300" onClick={(e) => handleInfoClick(e, foundation)}>
                                                    <Info className="w-4 h-4" />
                                                </Button>
                                            </div>

                                            {/* Nested Expansions (Only show if parent selected) */}
                                            {isSelected && expansions.length > 0 && (
                                                <div className="ml-6 pl-4 border-l-2 border-stone-800 space-y-2 animate-in slide-in-from-top-2 duration-200">
                                                    {expansions.map(exp => (
                                                        <div key={exp.id} className={cn(
                                                            "flex items-start justify-between p-2 pl-3 rounded-r-lg border-y border-r border-stone-800/50 bg-stone-900/30",
                                                            selectedKeys.includes(exp.id) ? "bg-purple-900/10 border-purple-900/30" : ""
                                                        )}>
                                                            <div className="flex items-center gap-3 flex-1">
                                                                <CornerDownRight className="w-4 h-4 text-stone-600" />
                                                                <div className="flex items-start gap-2 flex-1">
                                                                    <Checkbox
                                                                        id={exp.id}
                                                                        checked={selectedKeys.includes(exp.id)}
                                                                        onCheckedChange={() => onToggle(exp.id)}
                                                                        className="mt-0.5 border-stone-600 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                                                                    />
                                                                    <div className="grid gap-0.5">
                                                                        <Label htmlFor={exp.id} className="text-stone-300 text-sm font-medium cursor-pointer">
                                                                            {exp.name}
                                                                        </Label>
                                                                        <p className="text-xs text-stone-500 line-clamp-1">
                                                                            {exp.description_short}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-stone-600 hover:text-stone-400" onClick={(e) => handleInfoClick(e, exp)}>
                                                                <Info className="w-3 h-3" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ))}

                {/* DISCONNECTED EXPANSIONS (Global / No Parent) */}
                {disconnectedExpansions.length > 0 && (
                    <div className="space-y-4 pt-4 border-t border-stone-800">
                        <div className="flex items-center gap-2 pb-1">
                            <Puzzle className="w-5 h-5 text-purple-500" />
                            <h3 className="text-md font-semibold text-stone-300 uppercase tracking-wide">Global Expansions</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {disconnectedExpansions.map(ruleset => (
                                <div key={ruleset.id} className={cn(
                                    "relative flex items-start justify-between p-3 rounded-lg border transition-all",
                                    selectedKeys.includes(ruleset.id) ? "bg-stone-900 border-purple-900/50" : "bg-stone-950/50 border-stone-800 hover:bg-stone-950"
                                )}>
                                    <div className="flex items-start space-x-3 flex-1 pt-0.5">
                                        <Checkbox
                                            id={ruleset.id}
                                            checked={selectedKeys.includes(ruleset.id)}
                                            disabled={lockedKeys.includes(ruleset.id)}
                                            onCheckedChange={() => onToggle(ruleset.id)}
                                            className={cn(
                                                "mt-1 border-stone-600 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600",
                                                lockedKeys.includes(ruleset.id) ? "opacity-75 cursor-not-allowed" : ""
                                            )}
                                        />
                                        <div className="grid gap-1">
                                            <Label htmlFor={ruleset.id} className="text-stone-200 font-medium cursor-pointer leading-tight">
                                                {ruleset.name}
                                            </Label>
                                            <p className="text-xs text-stone-500 line-clamp-2">
                                                {ruleset.description_short}
                                            </p>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-stone-500 hover:text-stone-300" onClick={(e) => handleInfoClick(e, ruleset)}>
                                        <Info className="w-4 h-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <RulesetInfoModal
                isOpen={!!viewInfo}
                onClose={() => setViewInfo(null)}
                ruleset={viewInfo}
            />
        </div>
    );
}
