import React from 'react';
import { User, MapPin, Box, Check, Plus } from 'lucide-react';
import { CardBase } from '@/components/ui/card-base';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { EntityTemplate } from '@/types/chimera-domain';

interface EntityCardProps {
    entity: EntityTemplate;
    isSelected: boolean; // Means "Staged/Added" in this context
    onToggle: () => void;
    onInspect?: () => void; // Optional if we just want to select
}

export function EntityCard({ entity, isSelected, onToggle, onInspect }: EntityCardProps) {
    const Icon = entity.kind === 'npc' ? User : entity.kind === 'location' ? MapPin : Box;

    return (
        <CardBase
            isSelected={isSelected}
            onClick={onInspect || onToggle} // Default to inspect if available, else toggle? Or split? Pattern: Card Body = Inspect, Button = Select
            className="flex flex-col h-full group"
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 overflow-hidden">
                    <div className="h-8 w-8 rounded-full bg-stone-800 flex items-center justify-center shrink-0 border border-white/5">
                        <Icon className="h-4 w-4 text-stone-400" />
                    </div>
                    <div className="font-medium text-stone-200 truncate">{entity.name}</div>
                </div>

                {/* Action Button: Toggle Selection */}
                <Button
                    size="sm"
                    variant={isSelected ? "default" : "outline"}
                    className={isSelected ? "bg-emerald-600 hover:bg-emerald-700 h-8 px-2" : "h-8 px-2 border-dashed border-stone-600 hover:border-stone-400"}
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggle();
                    }}
                >
                    {isSelected ? (
                        <>
                            <Check className="h-3 w-3 mr-1" />
                            Added
                        </>
                    ) : (
                        <>
                            <Plus className="h-3 w-3 mr-1" />
                            Add
                        </>
                    )}
                </Button>
            </div>

            {/* Body */}
            <p className="text-xs text-stone-500 line-clamp-2 mb-3 min-h-[2.5em]">
                {/* raw_data is not in EntityTemplate type definition in file, check if it exists in runtime or use name/tags */}
                {(entity as any).raw_data?.description || "No description provided."}
            </p>

            {/* Footer */}
            <div className="flex gap-1 mt-auto">
                {entity.tags.slice(0, 2).map((tag) => (
                    <Badge
                        key={tag}
                        variant="outline"
                        className="text-[10px] h-5 px-1.5 border-stone-700 text-stone-400"
                    >
                        {tag}
                    </Badge>
                ))}
            </div>
        </CardBase>
    );
}
