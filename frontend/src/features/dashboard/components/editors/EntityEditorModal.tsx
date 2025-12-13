import { useState, useEffect, useRef } from 'react';
import { GuidedEditorLayout } from './shared/GuidedEditorLayout';
import { ScrollText } from 'lucide-react';
import { useCreateEntity, useUpdateEntity, useEntityDetail, uploadImage, useLoreByWorld, useMyWorlds } from '@/services/chimera-api';
import { type ChimeraAssetRef } from '@/types/chimera-v2';
import { EntityIdentityForm, type EntityIdentityFormData } from './forms/EntityIdentityForm';
import { EntityDetailsForm } from './forms/EntityDetailsForm';
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
        raw_data: {},
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
                raw_data: raw,
                images: (() => {
                    const imgs = (entityDetail.images || []).map((img: any) => ({
                        id: img.id,
                        url: img.url,
                        role: img.role || 'portrait'
                    }));
                    // Ensure primary image is included if not present in the list
                    if (entityDetail.primary_image_url && !imgs.some((i: any) => i.url === entityDetail.primary_image_url)) {
                        imgs.unshift({
                            id: crypto.randomUUID(),
                            url: entityDetail.primary_image_url,
                            role: 'portrait'
                        });
                    }
                    return imgs;
                })(),
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
                raw_data: {},
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

        // Simplified Step Architecture: Identity -> Details -> Lore
        // Details step label changes based on type
        let detailsLabel = 'Details';
        if (type === 'NPC') detailsLabel = 'Personality & Stats';
        if (type === 'LOCATION') detailsLabel = 'Geography';

        const detailsStep = {
            id: 'details',
            label: detailsLabel,
            isComplete: !!formData.archetype_handle || type !== 'NPC', // Logic can be improved
        };

        return [baseIdentity, detailsStep, baseLore];
    };

    const steps = getStepsForType(formData.entity_type);

    const isGlobalValid = !!formData.display_name && !!formData.world_id && !!formData.entity_type;

    const handleSave = async (isIntermediate = false) => {
        if (!isIntermediate && !isGlobalValid) {
            toast.error("Please fill in all required fields (Name, World, Type).", {
                description: "These fields are necessary to create the entity."
            });
            return;
        }

        try {
            setIsUploading(true);

            // Process images
            const processedImages: ChimeraAssetRef[] = await Promise.all(
                formData.images.map(async (img) => {
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
                // archetype_handle maps to SQL if column added, but we strictly pack into raw_data
                base_state_json: { ...baseState },
                // Explicitly pack raw_data
                raw_data: {
                    ...existingRaw,
                    ...formData.raw_data, // Merge dynamic form data
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
            case 'LOCATION': return 'world';
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
            isValid={isGlobalValid}
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
            ) : activeTab === 'details' ? (
                <EntityDetailsForm
                    worldId={formData.world_id}
                    entityType={formData.entity_type}
                    data={formData.raw_data}
                    onChange={(newData) => setFormData(prev => ({ ...prev, raw_data: newData }))}
                    archetype={formData.archetype_handle}
                    onArchetypeChange={(val) => setFormData(d => ({ ...d, archetype_handle: val }))}
                />
            ) : activeTab === 'lore' ? (
                <div className="min-h-[400px] animate-in fade-in slide-in-from-right-4 duration-300">
                    {entityId ? (
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
                <div className="flex flex-col items-center justify-center h-64 text-stone-500">
                    <p>Unknown Step</p>
                </div>
            )}
        </GuidedEditorLayout>
    );
}
