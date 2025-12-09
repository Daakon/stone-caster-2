import React from 'react';
import { Info, Check } from 'lucide-react';
import { CardBase } from '@/components/ui/card-base';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { WorldDefinition } from '@/types/chimera-domain';
import { cn } from '@/lib/utils';

interface WorldCardProps {
    world: WorldDefinition;
    isSelected: boolean;
    onSelect: () => void;
    onInspect: () => void;
}

export function WorldCard({ world, isSelected, onSelect, onInspect }: WorldCardProps) {
    // WorldDefinition uses 'title' but sometimes 'name' in legacy/mock data might be used
    const title = world.title || (world as any).name || 'Untitled World';

    return (
        <CardBase
            isSelected={isSelected}
            onClick={onSelect}
            className="flex flex-col h-full min-h-[180px] group"
        >
            {/* Header */}
            <div className="flex justify-between items-start gap-2 mb-2">
                <h3 className="tex-lg font-bold text-foreground line-clamp-1">{title}</h3>

                {/* Info / Inspect Button (Secondary Action) */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0"
                    onClick={(e) => {
                        e.stopPropagation();
                        onInspect();
                    }}
                >
                    <Info className="h-4 w-4" />
                </Button>
            </div>

            {/* Selection Indicator (Top Right Overlap if selected) */}
            {isSelected && (
                <div className="absolute top-4 right-12 h-5 w-5 bg-emerald-500 rounded-full flex items-center justify-center animate-in fade-in zoom-in duration-200">
                    <Check className="h-3 w-3 text-white" />
                </div>
            )}

            {/* Body */}
            <p className="text-stone-400 text-sm line-clamp-3 mb-4 flex-grow">
                {world.summary || 'No description available.'}
            </p>

            {/* Footer */}
            <div className="flex flex-wrap gap-1 mt-auto pt-2">
                {(world.genre_tags || []).slice(0, 3).map(tag => (
                    <Badge
                        key={tag}
                        variant="secondary"
                        className={cn("text-[10px] h-5 px-1.5", isSelected ? "bg-emerald-900/40 text-emerald-100" : "")}
                    >
                        {tag}
                    </Badge>
                ))}
            </div>
        </CardBase>
    );
}
