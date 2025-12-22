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
    filterKeys?: string[]; // Only show these keys
    excludeKeys?: string[]; // Hide these keys
}

export function RulesetConfigurator({ selectedKeys, lockedKeys = [], onToggle, className, filterKeys, excludeKeys }: RulesetConfiguratorProps) {
    const { data: rulesets, isLoading } = useRulesets();
    const [viewInfo, setViewInfo] = useState<RulesetDefinition | null>(null);

    // Group rulesets hierarchy
    const { foundationGroups, disconnectedExpansions } = useMemo(() => {
        if (!rulesets) return { foundationGroups: [], disconnectedExpansions: [] };

        // 1. Filter available rulesets
        const availableRulesets = rulesets.filter(r => {
            if (filterKeys && !filterKeys.includes(r.id)) return false;
            if (excludeKeys && excludeKeys.includes(r.id)) return false;
            return true;
        });

        const roots: RulesetDefinition[] = [];
        const childrenMap = new Map<string, RulesetDefinition[]>(); // ParentID -> Children
        const orphans: RulesetDefinition[] = [];

        // 2. Identify Roots and Children based on Dependencies
        availableRulesets.forEach(r => {
            // SAFE PARSING: Dependencies might be stringified JSON or plain array or null
            let deps: string[] = [];
            if (Array.isArray(r.dependencies)) {
                deps = r.dependencies;
            } else if (typeof r.dependencies === 'string') {
                try {
                    deps = JSON.parse(r.dependencies);
                    if (!Array.isArray(deps)) deps = []; // Fallback if parse result isn't array
                } catch (e) {
                    deps = []; // Failed parse
                }
            }

            // Find a parent that is ALSO in the available list
            // MATCHING: Child's dependency Key === Parent's Key
            // We search for a parent whose 'key' is in the child's 'deps'
            const parent = availableRulesets.find(parentCandidate =>
                parentCandidate.key && deps.includes(parentCandidate.key)
            );

            if (parent) {
                // Resolved to a parent present in the list
                const actualParentId = parent.id;
                if (!childrenMap.has(actualParentId)) {
                    childrenMap.set(actualParentId, []);
                }
                childrenMap.get(actualParentId)!.push(r);
            } else {
                // No visible parent -> Root
                // But check ui_category for "Orphans" (Global Expansions)
                // If it's an Expansion but has NO parent, it's an orphan/global.
                // If it's a Foundation, it's a Root.
                if (r.ui_category === 'expansion') {
                    orphans.push(r);
                } else {
                    roots.push(r);
                }
            }
        });

        // 3. Group Roots by exclusion_group
        const groups: Record<string, { foundation: RulesetDefinition, expansions: RulesetDefinition[] }[]> = {};

        roots.forEach(f => {
            const groupKey = f.exclusion_group || 'other';
            if (!groups[groupKey]) groups[groupKey] = [];

            groups[groupKey].push({
                foundation: f,
                expansions: childrenMap.get(f.id) || []
            });
        });

        // Convert to array for rendering
        const resultGroups = Object.entries(groups).map(([groupKey, items]) => ({
            groupKey,
            items
        }));

        // Sort groups: 'other' (Core) first, then others alphabetical
        resultGroups.sort((a, b) => {
            if (a.groupKey === 'other') return -1;
            if (b.groupKey === 'other') return 1;
            return a.groupKey.localeCompare(b.groupKey);
        });

        return { foundationGroups: resultGroups, disconnectedExpansions: orphans };
    }, [rulesets, filterKeys, excludeKeys]);

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

                        <div className="space-y-4">
                            {groupKey !== 'other' && (
                                <p className="text-xs text-stone-500 italic">
                                    Select one ruleset from this group.
                                </p>
                            )}

                            {items.map(({ foundation, expansions }) => {
                                const isSelected = selectedKeys.includes(foundation.id);
                                // Check if any OTHER item in this exclusive group is selected
                                const isOtherSelected = groupKey !== 'other' && items.some(i =>
                                    i.foundation.id !== foundation.id && selectedKeys.includes(i.foundation.id)
                                );
                                const isDisabled = isOtherSelected || lockedKeys?.includes(foundation.id);

                                return (
                                    <div key={foundation.id} className="space-y-2">
                                        {/* Foundation Card */}
                                        <div
                                            onClick={() => !isDisabled && onToggle(foundation.id)}
                                            className={cn(
                                                "flex items-center justify-between p-3 rounded-lg border transition-all select-none",
                                                isSelected
                                                    ? "bg-stone-900 border-cyan-900/50 shadow-[0_0_15px_rgba(8,145,178,0.1)]"
                                                    : isOtherSelected
                                                        ? "bg-stone-950/30 border-stone-900 opacity-60"
                                                        : "bg-stone-950 border-stone-800 hover:border-stone-700 hover:bg-stone-900",
                                                !isDisabled ? "cursor-pointer" : "cursor-not-allowed"
                                            )}
                                        >
                                            <div className="flex items-center space-x-3 flex-1">
                                                <Checkbox
                                                    id={foundation.id}
                                                    checked={isSelected}
                                                    disabled={isDisabled}
                                                    onCheckedChange={() => onToggle(foundation.id)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className={cn(
                                                        "border-stone-600 data-[state=checked]:bg-cyan-600 data-[state=checked]:border-cyan-600",
                                                        isDisabled ? "opacity-75" : ""
                                                    )}
                                                />
                                                <div className="grid gap-0.5">
                                                    <Label
                                                        htmlFor={foundation.id}
                                                        className={cn(
                                                            "font-medium",
                                                            !isDisabled && "cursor-pointer",
                                                            isSelected ? "text-cyan-100" : isOtherSelected ? "text-stone-500" : "text-stone-200"
                                                        )}
                                                        onClick={(e) => e.stopPropagation()} // Let card expander handle it or label->checkbox handle it? Checkbox click stops prop, Label htmlFor triggers checkbox.
                                                    // Actually, if I click label, it clicks checkbox. Checkbox stops prop. Correct.
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

                                        {/* Nested Expansions (Indented) */}
                                        {expansions.length > 0 && (
                                            <div className="ml-4 pl-4 border-l-2 border-stone-800 space-y-2 animate-in slide-in-from-top-2 duration-200">
                                                {expansions.map(exp => {
                                                    const isExpDisabled = lockedKeys?.includes(exp.id);
                                                    return (
                                                        <div
                                                            key={exp.id}
                                                            onClick={() => !isExpDisabled && onToggle(exp.id)}
                                                            className={cn(
                                                                "flex items-start justify-between p-2 pl-3 rounded-r-lg border-y border-r border-stone-800/50 bg-stone-900/30 select-none",
                                                                selectedKeys.includes(exp.id) ? "bg-purple-900/10 border-purple-900/30" : "",
                                                                !isExpDisabled ? "cursor-pointer hover:bg-stone-900/50" : "cursor-not-allowed opacity-75"
                                                            )}
                                                        >
                                                            <div className="flex items-center gap-3 flex-1">
                                                                <CornerDownRight className="w-4 h-4 text-stone-600 shrink-0" />
                                                                <div className="flex items-start gap-2 flex-1">
                                                                    <Checkbox
                                                                        id={exp.id}
                                                                        checked={selectedKeys.includes(exp.id)}
                                                                        disabled={isExpDisabled}
                                                                        onCheckedChange={() => onToggle(exp.id)}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        className={cn(
                                                                            "mt-0.5 border-stone-600 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600",
                                                                            isExpDisabled ? "opacity-75" : ""
                                                                        )}
                                                                    />
                                                                    <div className="grid gap-0.5">
                                                                        <Label
                                                                            htmlFor={exp.id}
                                                                            className={cn("text-stone-300 text-sm font-medium", !isExpDisabled && "cursor-pointer")}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                        >
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
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
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
                            {disconnectedExpansions.map(ruleset => {
                                const isDisDisabled = lockedKeys?.includes(ruleset.id);
                                return (
                                    <div
                                        key={ruleset.id}
                                        onClick={() => !isDisDisabled && onToggle(ruleset.id)}
                                        className={cn(
                                            "relative flex items-start justify-between p-3 rounded-lg border transition-all select-none",
                                            selectedKeys.includes(ruleset.id) ? "bg-stone-900 border-purple-900/50" : "bg-stone-950/50 border-stone-800 hover:bg-stone-950",
                                            !isDisDisabled ? "cursor-pointer" : "cursor-not-allowed opacity-75"
                                        )}
                                    >
                                        <div className="flex items-start space-x-3 flex-1 pt-0.5">
                                            <Checkbox
                                                id={ruleset.id}
                                                checked={selectedKeys.includes(ruleset.id)}
                                                disabled={isDisDisabled}
                                                onCheckedChange={() => onToggle(ruleset.id)}
                                                onClick={(e) => e.stopPropagation()}
                                                className={cn(
                                                    "mt-1 border-stone-600 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600",
                                                    isDisDisabled ? "opacity-75" : ""
                                                )}
                                            />
                                            <div className="grid gap-1">
                                                <Label
                                                    htmlFor={ruleset.id}
                                                    className={cn("text-stone-200 font-medium leading-tight", !isDisDisabled && "cursor-pointer")}
                                                    onClick={(e) => e.stopPropagation()}
                                                >
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
                                );
                            })}
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
