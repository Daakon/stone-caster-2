import React, { useState, useEffect } from 'react';
import { EditorLayout } from './shared/EditorLayout';
import { Book, Settings, ScrollText, AlertTriangle } from 'lucide-react';
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
import { useCreateWorld, useUpdateWorld, useWorldDetail, useRulesets, uploadImage } from '@/services/chimera-api';
import { type ChimeraAssetRef } from '@/types/chimera-v2';
import { GENRES, SETTINGS } from '@/data/world-presets';
import { PresetSelector } from './config/PresetSelector';
import { RulesetConfigurator } from './config/RulesetConfigurator';
import { ImageUploader, type PendingImage } from '@/components/forms/shared/ImageUploader';
import { TagSelector } from '@/components/forms/shared/TagSelector';
import { cn } from '@/lib/utils';

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
    const [selectedRulesetKeys, setSelectedRulesetKeys] = useState<string[]>([]);
    const [isConfigOpen, setConfigOpen] = useState(false);

    // Conflict/Confirmation Dialog State
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

    const createWorld = useCreateWorld();
    const updateWorld = useUpdateWorld();
    const { data: rulesets } = useRulesets();

    const { data: worldDetail, isLoading: isLoadingDetail } = useWorldDetail(open ? (worldId || null) : null);

    useEffect(() => {
        if (open && worldId && worldDetail) {
            // Normalize tags: Handle case where API returns objects ({id, tag_name}) instead of strings
            const normalizedTags = (worldDetail.tags || []).map((t: any) =>
                typeof t === 'string' ? t : t.tag_name || ''
            ).filter(Boolean);

            setFormData({
                display_name: worldDetail.display_name || '',
                description_short: worldDetail.description_short || '',
                description_long: worldDetail.description_long || '',
                images: worldDetail.images || [],
                tags: normalizedTags
            });

            // Load configuration from metadata
            if (worldDetail.metadata && (worldDetail.metadata as any).ruleset_keys) {
                setSelectedRulesetKeys((worldDetail.metadata as any).ruleset_keys);
                setSelectedGenreId((worldDetail.metadata as any).ui_genre_id || null);
                setSelectedSettingId((worldDetail.metadata as any).ui_setting_id || null);
            }
        } else if (open && !worldId) {
            // Reset for create mode
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

    // --- Dependency Logic ---

    const getRuleset = (id: string) => rulesets?.find(r => r.id === id);

    const getAllDependencies = (startKey: string): string[] => {
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
    };

    const handleRulesetToggle = (key: string) => {
        if (!rulesets) return;

        const isAdding = !selectedRulesetKeys.includes(key);

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
                    const existingId = selectedRulesetKeys.find(selectedId => {
                        const selectedRule = getRuleset(selectedId);
                        return selectedRule?.exclusion_group === addRule.exclusion_group;
                    });

                    if (existingId && existingId !== addId) {
                        // Conflict found! We must remove 'existingId' to add 'addId'.
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
                const newKeys = selectedRulesetKeys.filter(k => !toRemove.has(k));
                // Add all `toAdd` that aren't already there
                const finalKeys = [...new Set([...newKeys, ...toAdd])];
                setSelectedRulesetKeys(finalKeys);
                setConfirmationDialog(prev => ({ ...prev, isOpen: false }));
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
                                    {conflicts.map((c, i) => (
                                        <li key={i}>
                                            Switch <strong>{c.removed}</strong> to <strong>{c.added}</strong>
                                        </li>
                                    ))}
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
            const dependents = selectedRulesetKeys.filter(otherKey => {
                if (otherKey === key) return false;
                const deps = getAllDependencies(otherKey);
                return deps.includes(key);
            });

            const applyRemove = () => {
                const toRemove = [key, ...dependents];
                setSelectedRulesetKeys(prev => prev.filter(k => !toRemove.includes(k)));
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
    };

    // Upload State
    const [isUploading, setIsUploading] = useState(false);

    // ... existing code ...

    const handleSave = async () => {
        try {
            setIsUploading(true);
            // Process images: upload any Pending files
            const processedImages: ChimeraAssetRef[] = await Promise.all(
                formData.images.map(async (img, idx) => {
                    if (img instanceof File) {
                        try {
                            // Upload
                            const uploaded = await uploadImage(img, 'worlds');
                            uploaded.role = idx === 0 ? 'banner' : 'gallery';
                            return uploaded;
                        } catch (err) {
                            console.error(`Failed to upload image ${img.name}`, err);
                            // Fallback? Or fail? 
                            // If upload fails, we probably shouldn't proceed with saving partial data
                            throw err;
                        }
                    } else {
                        // Existing asset. 
                        return {
                            ...img,
                            role: idx === 0 ? 'banner' : 'gallery'
                        };
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
                // Add configuration
                ruleset_keys: selectedRulesetKeys,
                metadata: {
                    // Store UI state for Genre/Setting so we can restore it (if backend stores metadata)
                    ui_genre_id: selectedGenreId,
                    ui_setting_id: selectedSettingId
                }
            };

            if (worldId) {
                await updateWorld.mutateAsync({ id: worldId, data: payload });
            } else {
                await createWorld.mutateAsync(payload);
            }
            onOpenChange(false);
        } catch (error) {
            console.error(worldId ? "Failed to update world" : "Failed to create world", error);
        } finally {
            setIsUploading(false);
        }
    };

    const tabs = [
        { id: 'details', label: 'Details', icon: <Book className="w-4 h-4" /> },
        { id: 'config', label: 'Configuration', icon: <Settings className="w-4 h-4" /> },
        { id: 'lore', label: 'Lore', icon: <ScrollText className="w-4 h-4" /> },
    ];

    return (
        <EditorLayout
            open={open}
            onOpenChange={onOpenChange}
            title={worldId ? "Edit World" : "Create World"}
            status="Draft"
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onSave={handleSave}
            isSaving={createWorld.isPending || updateWorld.isPending || isUploading}
        >
            {isLoadingDetail && worldId ? (
                <div className="flex items-center justify-center p-12">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
                </div>
            ) : activeTab === 'details' ? (
                <div className="space-y-6 max-w-5xl">
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
                                <p className="text-xs text-stone-500">
                                    Short summary visible in the dashboard cards.
                                </p>
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
                <div className="space-y-8 max-w-4xl pb-10">
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
                            <div className="rounded-lg bg-stone-900/50 border border-stone-800 p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-medium text-stone-200">Configuration Summary</h3>
                                    <span className="text-xs text-stone-500 bg-stone-900 px-2 py-1 rounded-full border border-stone-800">
                                        {selectedRulesetKeys.length} Rules Active
                                    </span>
                                </div>
                                <p className="text-sm text-stone-400 leading-relaxed">
                                    {selectedRulesetKeys.map(key => {
                                        const r = rulesets.find(r => r.id === key);
                                        return r ? r.name : key;
                                    }).join(', ')}
                                </p>
                            </div>

                            <div className="space-y-4">
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
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-64 text-stone-500">
                    <div className="p-4 rounded-full bg-stone-900/50 mb-4">
                        <ScrollText className="w-8 h-8 opacity-50" />
                    </div>
                    <p>Lore management coming soon.</p>
                </div>
            )}
            {/* Confirmation Dialog */}
            <Dialog open={confirmationDialog.isOpen} onOpenChange={(open) => !open && setConfirmationDialog(prev => ({ ...prev, isOpen: false }))}>
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
                            onClick={() => setConfirmationDialog(prev => ({ ...prev, isOpen: false }))}
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
        </EditorLayout>
    );
}
