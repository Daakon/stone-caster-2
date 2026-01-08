import { useState, useCallback, useEffect, useRef } from 'react';
import { useRulesets, fetchGenrePreset } from '@/services/chimera-api';
import type { RulesetDefinition } from '@shared/types/chimera-authoring';
import { toast } from 'sonner';

interface UseRulesetSelectionManagerProps {
    initialSelectedKeys?: string[];
    lockedKeys?: string[];
    onChange?: (keys: string[]) => void;
}

export function useRulesetSelectionManager({ initialSelectedKeys = [], lockedKeys = [], onChange }: UseRulesetSelectionManagerProps) {
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

    // Track previous initial keys to prevent aggressive resets on parent re-renders
    const prevInitialKeysRef = useRef<string[]>(initialSelectedKeys);

    // Better implementation of the above logic:
    // We want to sync state only when props change meaningfully.
    useEffect(() => {
        const prevInitial = prevInitialKeysRef.current;
        const initialChanged = JSON.stringify(initialSelectedKeys.sort()) !== JSON.stringify(prevInitial.sort());

        if (initialChanged) {
            // Prop actually changed content, so we accept the new "initial" value
            const merged = Array.from(new Set([...initialSelectedKeys, ...lockedKeys]));
            setSelectedKeys(merged);
            prevInitialKeysRef.current = initialSelectedKeys;
        } else {
            // Initial prop content is same (stale ref).
            // We should ensure lockedKeys are enforced, but NOT reset the whole state to initial.
            if (lockedKeys.length > 0) {
                setSelectedKeys(prev => {
                    const withLocked = new Set([...prev, ...lockedKeys]);
                    return Array.from(withLocked);
                });
            }
        }
    }, [initialSelectedKeys, lockedKeys]);

    // Helper to find ruleset by ID or Key (Slug)
    const getRuleset = useCallback((identifier: string) => {
        return rulesets?.find(r => r.id === identifier || r.key === identifier);
    }, [rulesets]);

    const getAllDependencies = useCallback((startKey: string): string[] => {
        if (!rulesets) return [];

        const visited = new Set<string>();
        // Ensure startKey is resolved to ID
        const startRuleset = getRuleset(startKey);
        if (!startRuleset) return [];

        const queue = [startRuleset.id];
        const result: string[] = [];

        while (queue.length > 0) {
            const currentId = queue.shift()!;
            if (visited.has(currentId)) continue;
            visited.add(currentId);

            const ruleset = getRuleset(currentId);
            if (ruleset && ruleset.dependencies) {
                const deps = Array.isArray(ruleset.dependencies) ? ruleset.dependencies : [];
                for (const depIdentifier of deps) {
                    // depIdentifier might be a Slug or ID. Resolve it.
                    const depRuleset = getRuleset(depIdentifier);
                    if (depRuleset) {
                        const depId = depRuleset.id;
                        if (!result.includes(depId)) {
                            result.push(depId);
                            queue.push(depId);
                        }
                    }
                }
            }
        }
        return result;
    }, [rulesets, getRuleset]);

    const applyPreset = useCallback(async (presetId: string) => {
        console.log('[useRulesetSelectionManager] applyPreset called with:', presetId);
        try {
            // Backend now returns UUIDs directly
            const presetRuleIds = await fetchGenrePreset(presetId);
            console.log('[useRulesetSelectionManager] fetched presetRuleIds (UUIDs):', presetRuleIds);

            // 1. Merge with locked keys (which should also be UUIDs)
            // We start with the remote preset + any local locked overrides
            const initialSet = Array.from(new Set([...presetRuleIds, ...lockedKeys]));

            // 2. Resolve implicit dependencies
            // Although backend *should* return complete sets, we validate frontend-side to be safe
            // and ensures that locking a key correctly pulls in its dependencies even if preset didn't have them
            const finalKeys = new Set<string>();

            for (const id of initialSet) {
                finalKeys.add(id);
                const deps = getAllDependencies(id);
                deps.forEach(d => finalKeys.add(d));
            }

            const newKeys = Array.from(finalKeys);
            console.log('[useRulesetSelectionManager] calculated newKeys (with dependencies):', newKeys);

            setSelectedKeys(newKeys);
            onChange?.(newKeys);
            toast.success(`Applied preset`, {
                description: "Rulesets updated to match defaults."
            });
        } catch (error) {
            console.error("Failed to apply preset", error);
            toast.error("Failed to apply preset");
        }
    }, [lockedKeys, onChange, getAllDependencies]);

    const toggleRuleset = useCallback((key: string) => {
        if (!rulesets) return;
        if (lockedKeys.includes(key)) return;

        const isAdding = !selectedKeys.includes(key);

        if (isAdding) {
            // Logic for ADDING
            const target = getRuleset(key);
            if (!target) return;

            // 1. Calculate all implicitly added rules (dependencies)
            const dependencies = getAllDependencies(key);
            const toAdd = [key, ...dependencies];

            // 2. Check for conflicts (Exclusion Groups)
            const toRemove = new Set<string>();
            const conflicts: { added: string, removed: string, group: string }[] = [];

            toAdd.forEach(addId => {
                const addRule = getRuleset(addId);
                if (addRule?.exclusion_group && addRule.exclusion_group !== 'none') {
                    // Find existing selected rule in this group
                    const existingId = selectedKeys.find(selectedId => {
                        const selectedRule = getRuleset(selectedId);
                        return selectedRule?.exclusion_group === addRule.exclusion_group && selectedId !== addId;
                    });

                    if (existingId) {
                        if (lockedKeys.includes(existingId)) {
                            // Cannot resolve conflict by removing a locked key.
                            // Silently fail or warn?
                            return;
                        }
                        toRemove.add(existingId);
                        const existingRule = getRuleset(existingId);
                        conflicts.push({
                            added: addRule.name,
                            removed: existingRule?.name || existingId,
                            group: addRule.exclusion_group
                        });
                    }
                }
            });

            // 3. Apply changes
            const applyAdd = () => {
                const newKeys = selectedKeys.filter(k => !toRemove.has(k));
                const finalKeys = Array.from(new Set([...newKeys, ...toAdd, ...lockedKeys]));

                setSelectedKeys(finalKeys);
                setConfirmationDialog(prev => ({ ...prev, isOpen: false }));
                onChange?.(finalKeys);

                // Feedback for auto-selected dependencies
                const autoSelected = dependencies.filter(d => !selectedKeys.includes(d));
                if (autoSelected.length > 0) {
                    const names = autoSelected.map(id => getRuleset(id)?.name || id).join(', ');
                    toast.info(`Auto-selected dependencies: ${names}`);
                }
            };

            if (conflicts.length > 0) {
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
                                    {
                                        conflicts.map((c, i) => (
                                            <li key={i}>
                                                Switch <strong>{c.removed}</strong> to <strong>{c.added}</strong>
                                            </li>
                                        ))
                                    }
                                </ul>
                                <p>Do you want to proceed?</p>
                            </div>
                        ),
                        confirmLabel: "Switch Rulesets",
                        onConfirm: applyAdd
                    });
                }
            } else {
                applyAdd();
            }

        } else {
            // Logic for REMOVING
            // Find dependents: rulesets currently selected that depend on 'key'
            const dependents = selectedKeys.filter(otherKey => {
                if (otherKey === key) return false;
                const deps = getAllDependencies(otherKey);
                return deps.includes(key);
            });

            const applyRemove = () => {
                const toRemove = [key, ...dependents];
                const safeToRemove = toRemove.filter(k => !lockedKeys.includes(k));

                const nextKeys = selectedKeys.filter(k => !safeToRemove.includes(k));
                setSelectedKeys(nextKeys);
                onChange?.(nextKeys);
                setConfirmationDialog(prev => ({ ...prev, isOpen: false }));

                if (dependents.length > 0) {
                    const names = dependents.map(d => getRuleset(d)?.name || d).join(', ');
                    toast.info(`Removed dependent rulesets: ${names}`);
                }
            };

            if (dependents.length > 0) {
                setConfirmationDialog({
                    isOpen: true,
                    title: "Remove Dependencies?",
                    description: (
                        <div className="space-y-2">
                            <p>The following rulesets depend on <strong>{getRuleset(key)?.name}</strong> and will also be removed:</p>
                            <ul className="list-disc pl-5 text-stone-400">
                                {
                                    dependents.map(d => (
                                        <li key={d}>{getRuleset(d)?.name || d}</li>
                                    ))
                                }
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
        applyPreset,
        confirmationDialog,
        setConfirmationDialog,
        getRuleset
    };
}
