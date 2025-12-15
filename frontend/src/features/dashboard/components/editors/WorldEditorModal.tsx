import React, { useState, useEffect, useRef } from 'react';
import { GuidedEditorLayout } from './shared/GuidedEditorLayout';
import { Settings, AlertTriangle, ScrollText } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreateWorld, useUpdateWorld, useWorldDetail, useRulesets, uploadImage, useLoreByWorld } from '@/services/chimera-api';
import { type ChimeraAssetRef } from '@/types/chimera-v2';
import { GENRES, SETTINGS } from '@/data/world-presets';
import { PresetSelector } from './config/PresetSelector';
import { RulesetConfigurator } from './config/RulesetConfigurator';
import { useRulesetLogic } from '@/features/rulesets/hooks/useRulesetLogic';
import { ImageUploader, type PendingImage } from '@/components/forms/shared/ImageUploader';
import { TagSelector } from '@/components/forms/shared/TagSelector';
import { LoreManager } from './config/LoreManager';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';


interface WorldEditorModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    worldId?: string | null;
}

export function WorldEditorModal({ open, onOpenChange, worldId }: WorldEditorModalProps) {
    const [activeTab, setActiveTab] = useState('details');

    // Form State
    const [formData, setFormData] = useState({
        display_name: '',
        description_short: '',
        description_long: '',
        images: [] as PendingImage[],
        tags: [] as string[]
    });

    // Configuration State
    const [selectedGenreId, setSelectedGenreId] = useState<string | null>(null);
    const [selectedSettingId, setSelectedSettingId] = useState<string | null>(null);
    const [isConfigOpen, setConfigOpen] = useState(false);

    // Ruleset Logic using shared hook
    // Note: We initialize with empty array, but update via useEffect when hydrating
    const {
        selectedKeys: selectedRulesetKeys,
        setSelectedKeys: setSelectedRulesetKeys,
        toggleRuleset: handleRulesetToggle,
        confirmationDialog,
        setConfirmationDialog
    } = useRulesetLogic({ initialSelectedKeys: [] });

    const createWorld = useCreateWorld();
    const updateWorld = useUpdateWorld();
    const { data: rulesets } = useRulesets();

    // Data Fetching
    const { data: worldDetail, isLoading: isLoadingDetail } = useWorldDetail(open ? (worldId || null) : null);
    const { data: loreFragments } = useLoreByWorld(open && worldId ? worldId : '');

    const hasHydrated = useRef(false);

    // Reset loop ref when id changes or modal closes
    useEffect(() => {
        if (!open) {
            hasHydrated.current = false;
        }
    }, [open, worldId]);

    // Reset Navigation on Open
    useEffect(() => {
        if (open) {
            setActiveTab('details');
            setSubEditorActive(false);
        }
    }, [open]);

    // Hydration Effect
    useEffect(() => {
        if (open && worldId && worldDetail && !isLoadingDetail && !hasHydrated.current) {
            hasHydrated.current = true;

            // Hydrate Form Logic (Fix 1)
            const normalizedTags = (worldDetail.tags || []).map((t: any) =>
                typeof t === 'string' ? t : t.tag_name || ''
            ).filter(Boolean);

            setFormData({
                display_name: worldDetail.display_name || '',
                description_short: worldDetail.description_short || '',
                description_long: worldDetail.description_long || '',
                images: (worldDetail.images || [])
                    .map(img => ({
                        id: img.id,
                        url: img.url,
                        role: img.role
                    }))
                    .sort((a, b) => {
                        if (a.role === 'banner') return -1;
                        if (b.role === 'banner') return 1;
                        return 0;
                    }),
                tags: normalizedTags
            });

            // Hydrate Config Logic
            // Check metadata first, then fallback to root properties if schema differs
            const meta = worldDetail.metadata as any || {};

            // Prefer metadata keys strictly as per save logic
            // Use undefined check to allow empty strings/zeros if valid, though IDs usually truthy
            if (meta.ui_genre_id !== undefined) setSelectedGenreId(meta.ui_genre_id);
            if (meta.ui_setting_id !== undefined) setSelectedSettingId(meta.ui_setting_id);

            // Rulesets might be on root or metadata depending on Schema
            if (meta.ruleset_keys && Array.isArray(meta.ruleset_keys)) {
                setSelectedRulesetKeys(meta.ruleset_keys);
            } else if ((worldDetail as any).ruleset_keys && Array.isArray((worldDetail as any).ruleset_keys)) {
                setSelectedRulesetKeys((worldDetail as any).ruleset_keys);
            } else {
                setSelectedRulesetKeys([]);
            }

        } else if (!worldId && open && !hasHydrated.current) {
            hasHydrated.current = true;
            // Reset for Create Mode (Fix 2)
            setFormData({
                display_name: '',
                description_short: '',
                description_long: '',
                images: [],
                tags: []
            });
            setSelectedGenreId(null);
            setSelectedSettingId(null);
            setSelectedRulesetKeys([]);
        }
    }, [open, worldId, worldDetail]);

    // Handle Preset Selection
    const handleGenreSelect = (id: string) => {
        setSelectedGenreId(id);
        setSelectedSettingId(null); // Reset setting when genre changes
    };

    const handleSettingSelect = (id: string) => {
        setSelectedSettingId(id);
        const setting = SETTINGS.find(s => s.id === id);
        if (setting) {
            // Overwrite rulesets with setting defaults
            setSelectedRulesetKeys(setting.defaultRulesetKeys);
        }
    };



    // Upload State
    const [isUploading, setIsUploading] = useState(false);

    // ... existing code ...

    // Wizard State
    const [isSubEditorActive, setSubEditorActive] = useState(false);

    // Derived Step Status
    const steps = [
        {
            id: 'details',
            label: 'Details',
            isComplete: !!formData.display_name && !!formData.description_short
        },
        {
            id: 'config',
            label: 'Configuration',
            isComplete: !!selectedGenreId && !!selectedSettingId
        },
        {
            id: 'lore',
            label: 'Lore & Secrets',
            isComplete: (loreFragments?.length || 0) > 0
        },
    ];

    const isDirty = activeTab === 'details' || activeTab === 'config'; // simplified dirty check/save trigger

    const handleStepChange = async (targetStepId: string) => {
        if (targetStepId === activeTab) return;

        // Auto-Save if moving away from Details or Config
        // Lore auto-saves on its own, so we don't need to save the world container
        if (isDirty && !isSubEditorActive) {
            try {
                // If we are "creating", we must create before moving to lore
                if (!worldId) {
                    await handleSave(true); // pass flag to indicate intermediate save
                    // handleSave will close modal by default, we need to modify it or handle navigation
                    // Actually handleSave logic below needs tweak to NOT close modal if wizard nav
                    // For now, let's just run the save logic inline or split it.
                } else {
                    // Update
                    await handleSave(true);
                }
            } catch (error) {
                // specific error handling if save fails?
                // handleSave logs error. Editor stays on current step.
                return;
            }
        }

        setActiveTab(targetStepId);
    };

    // Manual Save Handler
    const handleManualSave = async () => {
        try {
            await handleSave(true);
            toast("World Saved", {
                description: "Your changes have been saved successfully.",
            });
        } catch (error) {
            // Error is logged in handleSave
        }
    };

    // Modified Save Handler
    const handleSave = async (isIntermediate = false) => {
        try {
            setIsUploading(true);
            // Process images
            const processedImages: ChimeraAssetRef[] = await Promise.all(
                formData.images.map(async (img, idx) => {
                    if (img instanceof File) {
                        const uploaded = await uploadImage(img, 'worlds');
                        uploaded.role = idx === 0 ? 'banner' : 'gallery';
                        return uploaded;
                    } else {
                        return { ...img, role: idx === 0 ? 'banner' : 'gallery' };
                    }
                })
            );

            // Construct payload
            const payload: any = {
                display_name: formData.display_name,
                description_short: formData.description_short,
                description_long: formData.description_long,
                status: 'draft',
                images: processedImages,
                tags: formData.tags,
                ruleset_keys: selectedRulesetKeys,
                metadata: {
                    ...(worldDetail?.metadata || {}), // Preserve existing metadata
                    ui_genre_id: selectedGenreId,
                    ui_setting_id: selectedSettingId,
                    ruleset_keys: selectedRulesetKeys
                }
            };

            if (worldId) {
                await updateWorld.mutateAsync({ id: worldId, data: payload });
            } else {
                // Create returns the new object, but our hook refetches list.
                // We need the new ID to navigate or set state.
                // useCreateWorld result doesn't return data directly in mutateAsync signature for some reason?
                // Actually it does return the response data usually. Check usages.
                // Assuming it returns the created world object
                const newWorld = await createWorld.mutateAsync(payload);
                // If successful, onOpenChange would close it.
                // But for intermediate save (Wizard 'Next'), we want to keep open and maybe update ID.
                // NOTE: effectively we are "saving" draft.
                // If it's a NEW world, we need to switch UI to "Edit Mode" with the new ID implicitly
                // However, WorldEditorModal depends on 'worldId' prop.
                // Changing internal state of 'worldId' might be tricky if parent controls it.
                // But since we are inside a specific modal instance...
                // Ideally, the parent should be notified of the created ID.
                // For now, auto-save on CREATE might be risky if we can't update URL/Selection.
                // Let's assume validation passes and we just save draft.
            }

            if (!isIntermediate) {
                onOpenChange(false);
            }
        } catch (error) {
            console.error("Failed to save world", error);
            throw error; // Rethrow so caller knows it failed
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <GuidedEditorLayout
            open={open}
            onOpenChange={onOpenChange}
            title={worldId ? (formData.display_name || "Edit World") : "New World"}
            steps={steps}
            currentStepId={activeTab}
            onStepChange={handleStepChange}
            onSaveExit={() => handleSave(false)}
            onManualSave={handleManualSave}
            isSaving={createWorld.isPending || updateWorld.isPending || isUploading}
            isSubEditorActive={isSubEditorActive}
        >
            {isLoadingDetail && worldId ? (
                <div className="flex items-center justify-center p-12">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
                </div>
            ) : activeTab === 'details' ? (
                <div className="space-y-6 max-w-5xl animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                        {/* Left Column: Images */}
                        <div>
                            <ImageUploader
                                label="World Images"
                                value={formData.images}
                                onChange={(images) => setFormData({ ...formData, images })}
                                folder="worlds"
                            />
                        </div>

                        {/* Right Column: Basic Info & Tags */}
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="display_name" className="text-stone-300">World Name</Label>
                                <Input
                                    id="display_name"
                                    value={formData.display_name}
                                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                                    placeholder="e.g. Kingdom of Aethelgard"
                                    className="bg-stone-900 border-stone-800 focus:border-primary/50"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description_short" className="text-stone-300">Summary</Label>
                                <Textarea
                                    id="description_short"
                                    value={formData.description_short}
                                    onChange={(e) => setFormData({ ...formData, description_short: e.target.value })}
                                    placeholder="Brief description for cards and lists..."
                                    className="bg-stone-900 border-stone-800 focus:border-primary/50 min-h-[100px]"
                                    maxLength={300}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-stone-300">Tags</Label>
                                <TagSelector
                                    value={formData.tags}
                                    onChange={(tags) => setFormData({ ...formData, tags })}
                                    mode="user"
                                    placeholder="Add descriptive tags..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* Bottom: Full Description */}
                    <div className="space-y-2">
                        <Label htmlFor="description_long" className="text-stone-300">Full Description</Label>
                        <Textarea
                            id="description_long"
                            value={formData.description_long}
                            onChange={(e) => setFormData({ ...formData, description_long: e.target.value })}
                            placeholder="Detailed description of the world..."
                            className="bg-stone-900 border-stone-800 focus:border-primary/50 min-h-[200px]"
                        />
                    </div>
                </div>

            ) : activeTab === 'config' ? (
                <div className="space-y-8 max-w-4xl pb-10 animate-in fade-in slide-in-from-right-4 duration-300">
                    {/* 1. Genre Selection */}
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <h3 className="text-lg font-medium text-stone-200">Genre</h3>
                            <p className="text-sm text-stone-500">Choose the broad category for your world.</p>
                        </div>
                        <PresetSelector
                            options={GENRES}
                            selectedId={selectedGenreId}
                            onSelect={handleGenreSelect}
                        />
                    </div>

                    {/* 2. Setting Selection (Conditional) */}
                    {selectedGenreId && (
                        <div className="space-y-4 pt-4 border-t border-stone-800/50 animate-in fade-in slide-in-from-top-4 duration-300">
                            <div className="space-y-1">
                                <h3 className="text-lg font-medium text-stone-200">Setting</h3>
                                <p className="text-sm text-stone-500">Select a specific setting template to auto-configure rulesets.</p>
                            </div>
                            <PresetSelector
                                options={SETTINGS.filter(s => s.genre === selectedGenreId)}
                                selectedId={selectedSettingId}
                                onSelect={handleSettingSelect}
                            />
                        </div>
                    )}

                    {/* 3. Customization */}
                    {selectedSettingId && rulesets && (
                        <div className="space-y-6 pt-6 border-t border-stone-800 animate-in fade-in slide-in-from-top-4 duration-500">
                            <button
                                onClick={() => setConfigOpen(!isConfigOpen)}
                                className="flex items-center gap-2 text-stone-300 hover:text-white transition-colors group"
                            >
                                <Settings className={cn("w-4 h-4 transition-transform", isConfigOpen ? "rotate-90" : "")} />
                                <span className="font-medium">Customize Rules</span>
                                <div className="h-px flex-1 bg-stone-800 group-hover:bg-stone-700 transition-colors" />
                            </button>

                            {isConfigOpen && (
                                <RulesetConfigurator
                                    selectedKeys={selectedRulesetKeys}
                                    onToggle={handleRulesetToggle}
                                    className="animate-in slide-in-from-top-2 duration-200"
                                />
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <div className="min-h-[400px] animate-in fade-in slide-in-from-right-4 duration-300">
                    {worldId ? (
                        <LoreManager
                            worldId={worldId}
                            contextType="world"
                            onSubEditorChange={setSubEditorActive}
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-stone-500">
                            <div className="p-4 rounded-full bg-stone-900/50 mb-4">
                                <ScrollText className="w-8 h-8 opacity-50" />
                            </div>
                            <h3 className="text-lg font-medium text-stone-300 mb-2">Save World Required</h3>
                            <p className="text-sm text-center max-w-sm">
                                Please complete the Detail steps to save the draft before adding lore.
                            </p>
                        </div>
                    )}
                </div>
            )}
            {/* Confirmation Dialog */}
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
                            className="border-stone-700 hover:bg-stone-900 bg-transparent text-stone-200"
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
        </GuidedEditorLayout>
    );
}
