import { useEffect, useMemo } from 'react';
import { useStoryDraftStore } from '@/features/casting-circle/stores/useStoryDraftStore';
import { useWorldDetail, updateStoryDraft } from '@/services/chimera-api';
import { RulesetConfigurator } from '@/features/dashboard/components/editors/config/RulesetConfigurator';
import { useRulesetLogic } from '@/features/rulesets/hooks/useRulesetLogic';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

export function ForcesStone() {
    const { draft, setDraftData } = useStoryDraftStore();
    const storyId = draft?.id;
    const worldId = draft?.world_id;

    // 1. Fetch World Details to get Mandatory Rules
    const { data: world, isLoading: isWorldLoading } = useWorldDetail(worldId || null);

    // 2. Determine Locked (Mandatory) Rules
    const lockedKeys = useMemo(() => {
        if (!world?.definition) return [];
        // Rulesets are stored in definition.ruleset_template_ids
        return (world.definition as any).ruleset_template_ids || [];
    }, [world]);

    // 3. Initialize Shared Logic
    // We want the initial selection to be the draft's saved rules or the world's defaults if empty
    const {
        selectedKeys,
        toggleRuleset,
        confirmationDialog,
        setConfirmationDialog
    } = useRulesetLogic({
        // If draft has rules, use them. If not (e.g. world switch reset), use locked keys.
        initialSelectedKeys: (draft?.active_ruleset_ids && draft.active_ruleset_ids.length > 0)
            ? draft.active_ruleset_ids
            : lockedKeys,
        lockedKeys,
        onChange: handleRulesetChange
    });

    // 4. Persistence Handler
    // useRulesetLogic calls this on change
    async function handleRulesetChange(newKeys: string[]) {
        if (!storyId) return;

        // Optimistic Update
        setDraftData({ active_ruleset_ids: newKeys });

        // API Update
        try {
            await updateStoryDraft(storyId, { active_ruleset_ids: newKeys });
        } catch (error) {
            console.error("Failed to save rulesets:", error);
            // Could revert store here
        }
    }

    // Effect to ensure Locked Keys are always selected (if draft was stale)
    useEffect(() => {
        if (lockedKeys.length > 0) {
            // Check if any locked key is missing from current draft
            const missing = lockedKeys.some((k: string) => !(draft?.active_ruleset_ids || []).includes(k));
            if (missing) {
                // Force update to include all locked keys
                const merged = Array.from(new Set([...(draft?.active_ruleset_ids || []), ...lockedKeys]));
                handleRulesetChange(merged);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lockedKeys, draft?.active_ruleset_ids]);

    if (!worldId) {
        return <div className="text-center text-stone-500 py-12">Please select a World first.</div>;
    }

    if (isWorldLoading) {
        return <div className="text-center text-stone-500 py-12">Summoning World Laws...</div>;
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="space-y-2 text-center md:text-left">
                <h2 className="text-2xl font-light text-stone-100">Dimensional Forces</h2>
                <p className="text-stone-400 max-w-2xl">
                    The laws of <span className="text-cyan-400">{world?.display_name}</span> are absolute.
                    You may bind additional forces, provided they do not contradict the nature of this reality.
                </p>
            </div>

            <div className="bg-black/40 border border-stone-800/50 rounded-xl p-6 backdrop-blur-sm">
                <RulesetConfigurator
                    selectedKeys={selectedKeys}
                    lockedKeys={lockedKeys}
                    onToggle={toggleRuleset}
                    className="max-w-3xl"
                />
            </div>

            {/* Conflict Dialog (Rendered by component via state passed from hook) */}
            <Dialog open={confirmationDialog.isOpen} onOpenChange={(open) => !open && setConfirmationDialog((prev: any) => ({ ...prev, isOpen: false }))}>
                <DialogContent className="bg-stone-950 border-stone-800 text-stone-200">
                    <DialogHeader>
                        <div className="flex items-center gap-2 text-amber-500 mb-2">
                            <AlertTriangle className="w-5 h-5" />
                            <DialogTitle>{confirmationDialog.title}</DialogTitle>
                        </div>
                        <DialogDescription asChild>
                            <div className="text-stone-400">
                                {confirmationDialog.description}
                            </div>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4">
                        <Button
                            variant="outline"
                            onClick={() => setConfirmationDialog((prev: any) => ({ ...prev, isOpen: false }))}
                            className="border-stone-700 hover:bg-stone-900"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmationDialog.onConfirm}
                            className="bg-amber-600 hover:bg-amber-700 text-white border-none"
                        >
                            {confirmationDialog.confirmLabel}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
