import React from 'react';
import { User, MapPin, Box, Plus, Check } from 'lucide-react';
import type { EntityTemplate } from '@/types/chimera-domain';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EntityCardProps {
    entity: EntityTemplate;
    isSelected?: boolean; // Currently viewing details
    isStaged?: boolean;   // Added to story
    onToggleStage: (entity: EntityTemplate) => void;
    onClick: (entity: EntityTemplate) => void;
}

export function EntityCard({ entity, isSelected, isStaged, onToggleStage, onClick }: EntityCardProps) {
    const getIcon = () => {
        switch (entity.kind) {
            case 'npc': return <User className="h-5 w-5" />;
            case 'location': return <MapPin className="h-5 w-5" />;
            case 'item': return <Box className="h-5 w-5" />;
            default: return <User className="h-5 w-5" />;
        }
    };

    return (
        <Card
            className={cn(
                "cursor-pointer transition-all relative overflow-hidden group hover:shadow-md",
                // Viewing Details State
                isSelected && !isStaged ? "border-primary/50 bg-primary/5" : "border-border",
                // Staged (Selected for Story) State overrides standard border
                isStaged ? "ring-2 ring-emerald-500 border-emerald-500/50 bg-emerald-50/10" : ""
            )}
            onClick={() => onClick(entity)}
        >
            {/* Selection Checkmark Badge */}
            {isStaged && (
                <div className="absolute top-0 right-0 bg-emerald-500 text-white p-1 rounded-bl-lg shadow-sm z-10">
                    <Check className="h-3 w-3" />
                </div>
            )}

            <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className={cn(
                        "p-2 rounded-full flex-shrink-0 transition-colors",
                        isStaged ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
                    )}>
                        {getIcon()}
                    </div>
                    <div className="min-w-0">
                        <h4 className={cn("font-medium truncate", isStaged && "text-emerald-900 dark:text-emerald-50")}>
                            {entity.name}
                        </h4>
                        <div className="flex gap-1 mt-1">
                            {entity.tags?.slice(0, 2).map((tag, i) => (
                                <span key={i} className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-secondary-foreground border border-transparent">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                <Button
                    size="icon"
                    variant={isStaged ? "outline" : "secondary"}
                    className={cn(
                        "h-8 w-8 flex-shrink-0 rounded-full transition-all",
                        isStaged
                            ? "border-emerald-200 text-emerald-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                            : "hover:bg-emerald-50 hover:text-emerald-600"
                    )}
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleStage(entity);
                    }}
                >
                    {isStaged ? (
                        // Show Check usually, but X on hover (handled via CSS/interaction hint if needed, or just simplistic X)
                        // Requirement says: "Button... toggles".
                        // Let's rely on the variant change or an Icon swap. 
                        // To be intuitive: "Minus" or "Check" that turns to "X"?
                        // Let's use Check for "Included" state, but maybe X is clearer for "Remove".
                        // User asked for "Add/Remove".
                        <Check className="h-4 w-4" />
                    ) : (
                        <Plus className="h-4 w-4" />
                    )}
                </Button>
            </CardContent>
        </Card>
    );
}

