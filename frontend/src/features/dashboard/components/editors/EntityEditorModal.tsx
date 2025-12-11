import React, { useState, useEffect, useRef } from 'react';
import { GuidedEditorLayout } from './shared/GuidedEditorLayout';
import { ScrollText, Box } from 'lucide-react';
import { useCreateEntity, useUpdateEntity, useEntityDetail, uploadImage, useLoreByWorld, useMyWorlds } from '@/services/chimera-api';
import { type ChimeraAssetRef } from '@/types/chimera-v2';
import { EntityIdentityForm, type EntityIdentityFormData } from './forms/EntityIdentityForm';
import { LoreManager } from './config/LoreManager';
import { toast } from 'sonner';

interface EntityEditorModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    entityId?: string | null;
}

export function EntityEditorModal({ open, onOpenChange, entityId }: EntityEditorModalProps) {
    const [activeTab, setActiveTab] = useState('identity');
    const hasHydrated = useRef(false);

    // Form State
    const [formData, setFormData] = useState<EntityIdentityFormData>({
        display_name: '',
        entity_type: 'NPC',
        world_id: '',
        archetype_handle: '',
        images: [],
        tags: []
    });

    // Sub-editor state for Lore (prevents Wizard navigation if true)
    const [isSubEditorActive, setSubEditorActive] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    // API Hooks
    const createEntity = useCreateEntity();
    const updateEntity = useUpdateEntity();
    const { data: entityDetail, isLoading: isLoadingDetail } = useEntityDetail(open ? (entityId || null) : null);

    // Check ownership to determine if public (Read Only)
    const { data: myWorlds } = useMyWorlds({ enabled: open });
    const isWorldPublic = Boolean(open && formData.world_id && myWorlds && !myWorlds.some(w => w.id === formData.world_id));

    // We fetch lore just to check completion status, but ONLY if we own the world
    const { data: loreFragments } = useLoreByWorld((open && formData.world_id && !isWorldPublic) ? formData.world_id : '');

    // Reset loop ref when id changes or modal closes
    useEffect(() => {
        if (!open) {
            hasHydrated.current = false;
            setActiveTab('identity');
        }
    }, [open, entityId]);

    // Hydration Effect
    useEffect(() => {
        if (open && entityId && entityDetail && !hasHydrated.current) {
            hasHydrated.current = true;

            // Handle raw_data unpack (support legacy base_state_json fallback)
            const raw = (entityDetail as any).raw_data || (entityDetail as any).base_state_json || {};

            setFormData({
                display_name: entityDetail.display_name || (entityDetail as any).name || '',
                entity_type: (entityDetail.entity_type as any) || (entityDetail as any).type || 'NPC',
                world_id: entityDetail.world_id || '',
                archetype_handle: raw.archetype_handle || entityDetail.archetype_handle || '', // Unpack from raw first
                images: (entityDetail.images || []).map(img => ({
                    id: img.id,
                    url: img.url,
                    role: img.role || 'portrait'
                })),
                tags: (entityDetail.tags || []).map((t: any) =>
                    typeof t === 'string' ? t : t.tag_name || ''
                ).filter(Boolean)
            });
        } else if (open && !entityId && !hasHydrated.current) {
            hasHydrated.current = true;
            // Reset for new entity
            setFormData({
                display_name: '',
                entity_type: 'NPC',
                world_id: '',
                archetype_handle: '',
                images: [],
                tags: []
            });
        }
    }, [open, entityId, entityDetail]);

    // Polymorphic Steps Logic
    const getStepsForType = (type: string) => {
        const isIdentityValid = !!formData.display_name && !!formData.world_id && !!formData.entity_type;
        const baseIdentity = {
            id: 'identity',
            label: 'Identity',
            isComplete: isIdentityValid,
            isValid: isIdentityValid // Blocks Next if false
        };
        const baseLore = { id: 'lore', label: 'Lore', isComplete: (loreFragments?.length || 0) > 0 };

        switch (type) {
            case 'NPC':
                return [
                    baseIdentity,
                    { id: 'personality', label: 'Personality', isComplete: false },
                    { id: 'stats', label: 'Stats', isComplete: false },
                    baseLore
                ];
            case 'LOCATION':
                return [
                    baseIdentity,
                    { id: 'geography', label: 'Geography', isComplete: false },
                    { id: 'hierarchy', label: 'Hierarchy', isComplete: false },
                    baseLore
                ];
            case 'ITEM':
            case 'FACTION':
            default:
                // Default simple flow
                return [baseIdentity, baseLore];
        }
    };

    const steps = getStepsForType(formData.entity_type);

    const handleSave = async (isIntermediate = false) => {
        try {
            setIsUploading(true);

            // Process images
            const processedImages: ChimeraAssetRef[] = await Promise.all(
                formData.images.map(async (img, idx) => {
                    if (img instanceof File) {
                        const uploaded = await uploadImage(img, 'entities');
                        uploaded.role = 'portrait';
                        return uploaded;
                    } else {
                        return { ...img, role: 'portrait' };
                    }
                })
            );

            // Pack fields into raw_data as requested
            const existingRaw = (entityDetail as any)?.raw_data || {};
            const baseState = (entityDetail as any)?.base_state_json || {};

            const payload: any = {
                display_name: formData.display_name,
                description_short: (entityDetail as any)?.description_short, // Preserve existing
                entity_type: formData.entity_type,
                world_id: formData.world_id,
                // archetype_handle: formData.archetype_handle, // Maps to SQL, but we want it in raw_data too
                base_state_json: { ...baseState },
                // Explicitly pack raw_data
                raw_data: {
                    ...existingRaw,
                    archetype_handle: formData.archetype_handle, // Pack Form Field -> JSONB
                },
                status: 'draft',
                tags: formData.tags,
                images: processedImages
            };

            if (entityId) {
                await updateEntity.mutateAsync({ id: entityId, data: payload });
            } else {
                await createEntity.mutateAsync(payload);
            }

            if (!isIntermediate) {
                onOpenChange(false);
                toast.success("Entity saved successfully");
            }
        } catch (error) {
            console.error("Failed to save entity", error);
            toast.error("Failed to save entity");
        } finally {
            setIsUploading(false);
        }
    };

    const handleStepChange = async (targetStepId: string) => {
        if (targetStepId === activeTab) return;

        // Auto-save on step change if basic requirements met
        if (activeTab === 'identity' && formData.display_name && formData.world_id) {
            await handleSave(true);
        }

        setActiveTab(targetStepId);
    };

    const getLoreContextType = (entityType: string) => {
        switch (entityType) {
            case 'NPC': return 'npc';
            case 'LOCATION': return 'world'; // Or specific location type? 'world' covers geo usually. Using default behavior strictly request says 'contextType derived from entity type'
            // The request example said "LoreManager (pass contextType derived from entity type)"
            // Looking at LoreManager, it accepts 'world' | 'npc' | 'item' | 'faction'
            case 'ITEM': return 'item';
            case 'FACTION': return 'faction';
            default: return 'world';
        }
    };

    return (
        <GuidedEditorLayout
            open={open}
            onOpenChange={onOpenChange}
            title={entityId ? (formData.display_name || "Edit Entity") : "New Entity"}
            steps={steps}
            currentStepId={activeTab}
            onStepChange={handleStepChange}
            onSaveExit={() => handleSave(false)}
            onManualSave={() => handleSave(true)}
            isSaving={createEntity.isPending || updateEntity.isPending || isUploading}
            isSubEditorActive={isSubEditorActive}
        >
            {isLoadingDetail && entityId ? (
                <div className="flex items-center justify-center p-12">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
                </div>
            ) : activeTab === 'identity' ? (
                <EntityIdentityForm
                    data={formData}
                    onChange={setFormData}
                    isEditMode={!!entityId}
                />
            ) : activeTab === 'lore' ? (
                <div className="min-h-[400px] animate-in fade-in slide-in-from-right-4 duration-300">
                    {entityId ? ( // Only allow Lore editing if entity exists (for now) - technically we auto-save so it should exist
                        <LoreManager
                            worldId={formData.world_id}
                            contextType={getLoreContextType(formData.entity_type) as any}
                            onSubEditorChange={setSubEditorActive}
                            readOnly={isWorldPublic}
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-stone-500">
                            <ScrollText className="w-8 h-8 opacity-50 mb-4" />
                            <p>Please save the entity first.</p>
                        </div>
                    )}
                </div>
            ) : (
                // Placeholder for other steps
                <div className="flex flex-col items-center justify-center h-64 text-stone-500 border border-dashed border-stone-800 rounded-lg bg-stone-900/30">
                    <div className="p-4 rounded-full bg-stone-900/50 mb-4">
                        <Box className="w-8 h-8 opacity-50" />
                    </div>
                    <h3 className="text-lg font-medium text-stone-300 mb-2">Step Under Construction</h3>
                    <p className="text-sm text-center max-w-sm">
                        The <strong>{steps.find(s => s.id === activeTab)?.label}</strong> editor is coming in the next phase.
                    </p>
                </div>
            )}
        </GuidedEditorLayout>
    );
}
