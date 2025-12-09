import React, { useState, useEffect } from 'react';
import { EditorLayout } from './shared/EditorLayout';
import { User, Brain, ScrollText, UserCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateEntity, useUpdateEntity, useEntityDetail } from '@/services/chimera-api';
import { getPrimaryImageUrl } from '@/types/chimera-v2';

interface EntityEditorModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    entityId?: string | null;
}

export function EntityEditorModal({ open, onOpenChange, entityId }: EntityEditorModalProps) {
    const [activeTab, setActiveTab] = useState('identity');

    // Form State
    const [formData, setFormData] = useState({
        display_name: '',
        entity_type: 'NPC' as 'NPC' | 'ITEM' | 'FACTION' | 'LOCATION',
        archetype_handle: '',
        description_short: '',
        primary_image_url: ''
    });

    // API Hooks
    const createEntity = useCreateEntity();
    const updateEntity = useUpdateEntity();
    const { data: entityDetail, isLoading: isLoadingDetail } = useEntityDetail(open ? (entityId || null) : null);

    // Hydrate form on load
    useEffect(() => {
        if (open && entityId && entityDetail) {
            setFormData({
                display_name: entityDetail.display_name || '',
                entity_type: (entityDetail.entity_type as any) || 'NPC',
                archetype_handle: entityDetail.archetype_handle || '',
                description_short: '', // Note: description_short is not in ChimeraEntityV2 interface yet, keeping empty
                primary_image_url: getPrimaryImageUrl(entityDetail.images) || ''
            });
        } else if (open && !entityId) {
            setFormData({
                display_name: '',
                entity_type: 'NPC',
                archetype_handle: '',
                description_short: '',
                primary_image_url: ''
            });
        }
    }, [open, entityId, entityDetail]);

    const handleSave = async () => {
        const payload: any = {
            display_name: formData.display_name,
            entity_type: formData.entity_type,
            archetype_handle: formData.archetype_handle,
            // Inject empty base_state_json as requested
            base_state_json: {},
            status: 'draft',
            images: formData.primary_image_url ? [{
                url: formData.primary_image_url,
                role: 'portrait',
                type: 'image'
            }] : []
        };

        try {
            if (entityId) {
                await updateEntity.mutateAsync({ id: entityId, data: payload });
            } else {
                await createEntity.mutateAsync(payload);
            }
            onOpenChange(false);
        } catch (error) {
            console.error(entityId ? "Failed to update entity" : "Failed to create entity", error);
        }
    };

    const tabs = [
        { id: 'identity', label: 'Identity', icon: <User className="w-4 h-4" /> },
        { id: 'personality', label: 'Personality', icon: <Brain className="w-4 h-4" /> },
        { id: 'lore', label: 'Lore', icon: <ScrollText className="w-4 h-4" /> },
    ];

    return (
        <EditorLayout
            open={open}
            onOpenChange={onOpenChange}
            title={entityId ? "Edit Entity" : "Create Entity"}
            status="Draft"
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onSave={handleSave}
            isSaving={createEntity.isPending || updateEntity.isPending}
        >
            {isLoadingDetail && entityId ? (
                <div className="flex items-center justify-center p-12">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
                </div>
            ) : activeTab === 'identity' ? (
                <div className="space-y-6 max-w-2xl">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="display_name" className="text-stone-300">Name</Label>
                            <Input
                                id="display_name"
                                value={formData.display_name}
                                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                                placeholder="e.g. Eldric the Wise"
                                className="bg-stone-900 border-stone-800 focus:border-primary/50"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="entity_type" className="text-stone-300">Entity Type</Label>
                            <Select
                                value={formData.entity_type}
                                onValueChange={(val: any) => setFormData({ ...formData, entity_type: val })}
                            >
                                <SelectTrigger className="bg-stone-900 border-stone-800">
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="NPC">NPC</SelectItem>
                                    <SelectItem value="ITEM">Item</SelectItem>
                                    <SelectItem value="FACTION">Faction</SelectItem>
                                    <SelectItem value="LOCATION">Location</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="archetype_handle" className="text-stone-300">Archetype / Class</Label>
                        <Input
                            id="archetype_handle"
                            value={formData.archetype_handle}
                            onChange={(e) => setFormData({ ...formData, archetype_handle: e.target.value })}
                            placeholder="e.g. Merchant, Guard, Glitch-Witch"
                            className="bg-stone-900 border-stone-800 focus:border-primary/50"
                        />
                        <p className="text-xs text-stone-500">
                            Logic template to use for this entity.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="primary_image_url" className="text-stone-300">Portrait URL</Label>
                        <Input
                            id="primary_image_url"
                            value={formData.primary_image_url}
                            onChange={(e) => setFormData({ ...formData, primary_image_url: e.target.value })}
                            placeholder="https://..."
                            className="bg-stone-900 border-stone-800 focus:border-primary/50"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description_short" className="text-stone-300">Summary</Label>
                        <Textarea
                            id="description_short"
                            value={formData.description_short}
                            onChange={(e) => setFormData({ ...formData, description_short: e.target.value })}
                            placeholder="Brief summary..."
                            className="bg-stone-900 border-stone-800 focus:border-primary/50 min-h-[100px]"
                        />
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-64 text-stone-500">
                    <div className="p-4 rounded-full bg-stone-900/50 mb-4">
                        <UserCircle className="w-8 h-8 opacity-50" />
                    </div>
                    <p>This section is coming soon.</p>
                </div>
            )}
        </EditorLayout>
    );
}
