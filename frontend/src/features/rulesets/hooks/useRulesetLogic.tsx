import { useState, useCallback, useEffect } from 'react';
import { useRulesets } from '@/services/chimera-api';
import type { RulesetDefinition } from '@shared/types/chimera-authoring';

interface UseRulesetLogicProps {
    initialSelectedKeys?: string[];
    lockedKeys?: string[];
    onChange?: (keys: string[]) => void;
}

export function useRulesetLogic({ initialSelectedKeys = [], lockedKeys = [], onChange }: UseRulesetLogicProps) {
    const { data: rulesets } = useRulesets();
    const [selectedKeys, setSelectedKeys] = useState<string[]>(initialSelectedKeys);

    // Confirmation Dialog State
    const [confirmationDialog, setConfirmationDialog] = useState<{
        isOpen: boolean;
        title: string;
        description: React.ReactNode;
        confirmLabel: string;
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: '',
        description: null,
        confirmLabel: 'Confirm',
        onConfirm: () => { },
    });

    // Update internal state if initialSelectedKeys changes (optional, depending on usage pattern)
    // For controlled components, this might be needed.
    useEffect(() => {
        // Only update if different and not locked? 
        // We probably want to respect props if they update from outside (e.g. preset selection)
        // Merge locked keys in
        const merged = Array.from(new Set([...initialSelectedKeys, ...lockedKeys]));
        // Simplified check to avoid infinite loops if array ref changes but content is same
        if (JSON.stringify(merged.sort()) !== JSON.stringify(selectedKeys.sort())) {
            setSelectedKeys(merged);
        }
    }, [initialSelectedKeys, lockedKeys]);

    const getRuleset = useCallback((id: string) => rulesets?.find(r => r.id === id), [rulesets]);

    const getAllDependencies = useCallback((startKey: string): string[] => {
        const visited = new Set<string>();
        const queue = [startKey];
        const result: string[] = [];

        while (queue.length > 0) {
            const currentId = queue.shift()!;
            if (visited.has(currentId)) continue;
            visited.add(currentId);

            const ruleset = getRuleset(currentId);
            if (ruleset && ruleset.dependencies) {
                for (const depId of ruleset.dependencies) {
                    if (!result.includes(depId)) {
                        result.push(depId);
                        queue.push(depId);
                    }
                }
            }
        }
        return result;
    }, [getRuleset]);

    const toggleRuleset = useCallback((key: string) => {
        if (!rulesets) return;
        if (lockedKeys.includes(key)) return; // Prevents toggling locked keys

        const isAdding = !selectedKeys.includes(key);

        if (isAdding) {
            // logic for ADDING
            const target = getRuleset(key);
            if (!target) return;

            // 1. Calculate all implicitly added rules (dependencies)
            const dependencies = getAllDependencies(key);
            const toAdd = [key, ...dependencies];

            // 2. Check for conflicts
            const toRemove = new Set<string>();
            const conflicts: { added: string, removed: string, group: string }[] = [];

            toAdd.forEach(addId => {
                const addRule = getRuleset(addId);
                if (addRule?.exclusion_group) {
                    // Find existing selected rule in this group
                    const existingId = selectedKeys.find(selectedId => {
                        const selectedRule = getRuleset(selectedId);
                        return selectedRule?.exclusion_group === addRule.exclusion_group;
                    });

                    if (existingId && existingId !== addId) {
                        // Conflict found! 
                        // CRITICAL: Check if existingId is LOCKED.
                        if (lockedKeys.includes(existingId)) {
                            // Cannot resolve conflict by removing a locked key.
                            // Must block the addition.
                            // We'll throw/alert or just return.
                            // Let's create a blocking dialog/toast logic later, but for now just return.
                            // Actually, we should probably warn user.
                            return;
                        }

                        toRemove.add(existingId);
                        conflicts.push({
                            added: addRule.name,
                            removed: getRuleset(existingId)?.name || existingId,
                            group: addRule.exclusion_group
                        });
                    }
                }
            });

            // 3. Apply changes
            const applyAdd = () => {
                const newKeys = selectedKeys.filter(k => !toRemove.has(k));
                // Add all `toAdd` that aren't already there
                const finalKeys = Array.from(new Set([...newKeys, ...toAdd, ...lockedKeys]));

                setSelectedKeys(finalKeys);
                setConfirmationDialog(prev => ({ ...prev, isOpen: false }));
                onChange?.(finalKeys);
            };

            if (conflicts.length > 0) {
                // Double check no locked keys in conflicts (already checked above but safe)
                if (conflicts.some(c => lockedKeys.includes(selectedKeys.find(k => getRuleset(k)?.name === c.removed) || ''))) {
                    // Should be caught above, but safe guard
                    return;
                }

                const isDirectSwitch = conflicts.length === 1 && conflicts[0].added === target.name;

                if (isDirectSwitch) {
                    applyAdd();
                } else {
                    setConfirmationDialog({
                        isOpen: true,
                        title: "Resolve Conflicts",
                        description: (
                            <div className="space-y-2">
                                <p>Enabling <strong>{target.name}</strong> requires changes to your current selection:</p>
                                <ul className="list-disc pl-5 text-stone-400 space-y-1">
                                    {conflicts.map((c, i) => (
                                        <li key={i}>
                                            Switch <strong>{c.removed}</strong> to <strong>{c.added}</strong>
                                        </li>
                                    ))}
                                </ul>
                                <p>Do you want to proceed?</p>
                            </div >
                        ),

                        confirmLabel: "Switch Rulesets",
                        onConfirm: applyAdd
                    });
                    // We need to actually construct the description. 
                    // Since this is a hook file, if it's .ts it can't have JSX. If .tsx it can.
                    // I will make this file .tsx
                }
            } else {
                applyAdd();
            }

        } else {
            // Logic for REMOVING
            const dependents = selectedKeys.filter(otherKey => {
                if (otherKey === key) return false;
                const deps = getAllDependencies(otherKey);
                return deps.includes(key);
            });

            const applyRemove = () => {
                const toRemove = [key, ...dependents];
                // Ensure we don't remove locked keys
                const safeToRemove = toRemove.filter(k => !lockedKeys.includes(k));

                setSelectedKeys(prev => {
                    const next = prev.filter(k => !safeToRemove.includes(k));
                    onChange?.(next);
                    return next;
                });
                setConfirmationDialog(prev => ({ ...prev, isOpen: false }));
            };

            if (dependents.length > 0) {
                setConfirmationDialog({
                    isOpen: true,
                    title: "Remove Dependencies?",
                    description: (
                        <div className="space-y-2">
                            <p>The following rulesets depend on <strong>{getRuleset(key)?.name}</strong> and will also be removed:</p>
                            <ul className="list-disc pl-5 text-stone-400">
                                {dependents.map(d => (
                                    <li key={d}>{getRuleset(d)?.name || d}</li>
                                ))}
                            </ul>
                        </div>
                    ),
                    confirmLabel: "Remove All",
                    onConfirm: applyRemove
                });
            } else {
                applyRemove();
            }
        }
    }, [rulesets, selectedKeys, lockedKeys, getRuleset, getAllDependencies, onChange]);

    return {
        selectedKeys,
        setSelectedKeys,
        toggleRuleset,
        confirmationDialog,
        setConfirmationDialog,
        getRuleset
    };
}
