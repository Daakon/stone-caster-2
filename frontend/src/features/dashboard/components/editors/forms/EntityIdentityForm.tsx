import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ImageUploader } from '@/components/forms/shared/ImageUploader';
import { TagSelector } from '@/components/forms/shared/TagSelector';
import { useAvailableWorlds } from '@/services/chimera-api';
import { type PendingImage } from '@/components/forms/shared/ImageUploader';

export interface EntityIdentityFormData {
    display_name: string;
    entity_type: 'NPC' | 'ITEM' | 'FACTION' | 'LOCATION';
    world_id: string;
    archetype_handle: string;
    images: PendingImage[];
    tags: string[];
}

interface EntityIdentityFormProps {
    data: EntityIdentityFormData;
    onChange: (data: EntityIdentityFormData) => void;
    isEditMode?: boolean;
}

export function EntityIdentityForm({ data, onChange, isEditMode = false }: EntityIdentityFormProps) {
    const { data: worlds } = useAvailableWorlds();

    // Notify parent of world_id change if we have worlds and none is selected (optional auto-select first?)
    // For now, we rely on user selection or parent hydration.

    const handleChange = (field: keyof EntityIdentityFormData, value: any) => {
        onChange({ ...data, [field]: value });
    };

    return (
        <div className="space-y-6 max-w-5xl animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {/* Left Column: Images */}
                <div>
                    <ImageUploader
                        label="Portrait"
                        value={data.images}
                        onChange={(images) => handleChange('images', images)}
                        folder="entities"
                    />
                </div>

                {/* Right Column: Key Details */}
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="display_name" className="text-stone-300">Name <span className="text-red-500">*</span></Label>
                        <Input
                            id="display_name"
                            value={data.display_name}
                            onChange={(e) => handleChange('display_name', e.target.value)}
                            placeholder="e.g. Eldric the Wise"
                            className="bg-stone-900 border-stone-800 focus:border-primary/50"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="world_id" className="text-stone-300">World <span className="text-red-500">*</span></Label>
                        <Select
                            value={data.world_id}
                            onValueChange={(val) => handleChange('world_id', val)}
                            disabled={isEditMode} // Usually we lock world on edit to prevent dependency breaks
                        >
                            <SelectTrigger className="bg-stone-900 border-stone-800">
                                <SelectValue placeholder="Select world..." />
                            </SelectTrigger>
                            <SelectContent className="bg-stone-900 border-stone-800">
                                {worlds?.map((world: any) => (
                                    <SelectItem key={world.id} value={world.id}>
                                        {world.display_name || world.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {isEditMode && <p className="text-xs text-stone-500">World cannot be changed after creation.</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="entity_type" className="text-stone-300">Entity Type <span className="text-red-500">*</span></Label>
                        <Select
                            value={data.entity_type}
                            onValueChange={(val: any) => handleChange('entity_type', val)}
                        >
                            <SelectTrigger className="bg-stone-900 border-stone-800">
                                <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent className="bg-stone-900 border-stone-800">
                                <SelectItem value="NPC">NPC</SelectItem>
                                <SelectItem value="LOCATION">Location</SelectItem>
                                <SelectItem value="ITEM">Item</SelectItem>
                                <SelectItem value="FACTION">Faction</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="archetype_handle" className="text-stone-300">Archetype</Label>
                        <Input
                            id="archetype_handle"
                            value={data.archetype_handle}
                            onChange={(e) => handleChange('archetype_handle', e.target.value)}
                            placeholder="e.g. Guard, Merchant"
                            className="bg-stone-900 border-stone-800 focus:border-primary/50"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label className="text-stone-300">Tags</Label>
                        <TagSelector
                            value={data.tags}
                            onChange={(tags) => handleChange('tags', tags)}
                            mode="user"
                            scope="entity"
                            placeholder="Add tags..."
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
