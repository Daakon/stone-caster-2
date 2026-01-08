import { cn } from '@/lib/utils';
import { User, Skull, Box, HelpCircle } from 'lucide-react';
import { resolveEntityDisplay } from '../../utils/entity-utils';

interface HudSidebarProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    context: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    entities: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    locations: any;
    playerId: string;
    activeSceneId: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onInspect: (entity: any) => void;
}

export function HudSidebar({ context, entities, locations, playerId, activeSceneId, onInspect }: HudSidebarProps) {
    // 1. Get Entities in Active Scene (excluding player)
    const list = Object.keys(locations || {}).filter(entityId => {
        if (entityId === playerId) return false;
        return locations[entityId] === activeSceneId;
    }).map(entityId => {
        return entities?.[entityId] || { id: entityId, name: "Unknown" }; // Fallback if missing in entities
    });

    // Sort: Stars -> Others
    list.sort((a: any, b: any) => {
        // Simple sort by name for now, or use resolveEntityDisplay to check unknowns
        const infoA = resolveEntityDisplay(a);
        const infoB = resolveEntityDisplay(b);
        if (infoA.isUnknown && !infoB.isUnknown) return 1;
        if (!infoA.isUnknown && infoB.isUnknown) return -1;
        return infoA.name.localeCompare(infoB.name);
    });

    return (
        <div className="flex flex-col gap-4 p-4 items-center xl:items-stretch">
            {/* Cast List */}
            <div className="flex flex-col gap-2 w-full">
                <div className="flex items-center justify-between px-1 xl:flex-row flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground hidden xl:block">Nearby</span>
                    {list.length > 0 && <span className="text-[9px] text-muted-foreground/50 border border-border px-1.5 rounded-full">{list.length}</span>}
                </div>

                {list.length === 0 && (
                    <div className="text-xs text-muted-foreground italic px-1 hidden xl:block">No one else is here.</div>
                )}

                <div className="flex flex-col gap-1 w-full">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {list.map((entity: any) => {
                        const { name, role, isUnknown } = resolveEntityDisplay(entity);
                        const status = entity.status || "active";
                        const isHostile = status === 'hostile'; // or check properties

                        return (
                            <button
                                key={entity.id}
                                onClick={() => onInspect(entity)}
                                title={name}
                                className={cn(
                                    "group rounded-lg transition-all border border-transparent hover:bg-accent/50 hover:border-border/50 p-2",
                                    "flex flex-col xl:flex-row items-center gap-1 xl:gap-3", // LG: Col, XL: Row
                                    "justify-center xl:justify-start"
                                )}
                            >
                                {/* Avatar */}
                                <div className="relative flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center border border-border group-hover:border-primary/50 transition-colors overflow-hidden">
                                    {entity.type === 'enemy' ? <Skull className="w-4 h-4 text-destructive" /> :
                                        entity.type === 'item' ? <Box className="w-4 h-4 text-blue-500" /> :
                                            isUnknown ? <HelpCircle className="w-4 h-4 text-muted-foreground/70" /> :
                                                <User className="w-4 h-4 text-secondary-foreground" />
                                    }
                                    <span className={cn(
                                        "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-background z-10",
                                        isHostile ? "bg-red-500" : "bg-green-500"
                                    )} />
                                </div>

                                {/* Text Info */}
                                <div className="flex flex-col items-center xl:items-start min-w-0 max-w-[60px] xl:max-w-full">
                                    <span className="text-[10px] xl:text-sm font-semibold truncate tracking-tight text-foreground/80 group-hover:text-primary leading-tight">
                                        {name}
                                    </span>
                                    {/* Role only visible on XL */}
                                    <span className="hidden xl:block text-[10px] text-muted-foreground truncate opacity-70">
                                        {role}
                                    </span>
                                </div>
                            </button>
                        )
                    })}
                </div>
            </div>
        </div>
    );
}
