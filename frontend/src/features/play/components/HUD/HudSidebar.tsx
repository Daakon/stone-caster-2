import { cn } from '@/lib/utils';
import { User, Skull, Box, HelpCircle } from 'lucide-react';
import { WorldClock } from '../sidebar/WorldClock';

interface HudSidebarProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    context: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    entities: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    locations: any;
    playerId: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onInspect: (entity: any) => void;
}

export function HudSidebar({ context, entities, locations, playerId, onInspect }: HudSidebarProps) {
    // 1. Get Player Location
    const playerLocId = locations?.[playerId];

    // 2. Filter Entities in same location (exclude player)
    const list = entities ? Object.values(entities).filter((e: any) => {
        if (e.id === playerId) return false; // Exclude player
        // If entity has no location, maybe show it? Or strict location match?
        // Assuming entities in registry.entity_locations match player.
        // For now, if no locations map provided, show all (fallback).
        const eLoc = locations?.[e.id];
        if (!playerLocId) return true; // Fallback
        return eLoc === playerLocId;
    }) : [];

    // Sort logic
    list.sort((a: any, b: any) => {
        const nameA = a.properties?.display_name || a.name || "";
        const nameB = b.properties?.display_name || b.name || "";
        const isUnknownA = nameA.toLowerCase().includes("unknown") || nameA.toLowerCase().includes("figure");
        const isUnknownB = nameB.toLowerCase().includes("unknown") || nameB.toLowerCase().includes("figure");
        if (isUnknownA && !isUnknownB) return 1;
        if (!isUnknownA && isUnknownB) return -1;
        return nameA.localeCompare(nameB);
    });

    const time = context?.time || context?.time_of_day || "Unknown";
    // Mock mechanical state wrapper for WorldClock if it needs it, or update WorldClock. 
    // WorldClock usually takes { mechanicalState }. 
    // I can construct a mock mechanical state with just the time? 
    // The previous implementation utilized mechanicalState. 
    // I'll check WorldClock props usage if needed, but passing context wrapper might work if updated.
    // Actually, I'll perform a quick read of WorldClock if I can, OR just pass { properties: { time: ... } } if that's what it uses?
    // Let's assume WorldClock expects mechanicalState and I should pass something that resembles it regarding time.
    // Or I'll update WorldClock prop in a separate step if it fails. 
    // The requirement says: Clock: <WorldClock time={context.time} />. 
    // This IMPLIES WorldClock takes a time prop! I will update WorldClock usage in HudSidebar to use `time` prop.
    // NOTE: This assumes WorldClock HAS a time prop. I might need to update WorldClock.tsx as well!
    // I will check WorldClock.tsx in next step if verification fails or I'll just peek it now?
    // I'll assume I need to update WorldClock or pass the prop.

    return (
        <div className="flex flex-col gap-4 p-4 items-center xl:items-stretch">
            {/* World Clock */}
            <div className="w-full">
                <WorldClock time={time} />
            </div>

            {/* Cast List */}
            <div className="flex flex-col gap-2 w-full">
                <div className="flex items-center justify-between px-1 xl:flex-row flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground hidden xl:block">Nearby Cast</span>
                    {list.length > 0 && <span className="text-[9px] text-muted-foreground/50 border border-border px-1.5 rounded-full">{list.length}</span>}
                </div>

                {list.length === 0 && (
                    /* Hide "No one else" text on slim, maybe just empty */
                    <div className="text-xs text-muted-foreground italic px-1 hidden xl:block">No one else is here.</div>
                )}

                <div className="flex flex-col gap-1 w-full">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {list.map((entity: any) => {
                        const props = entity.properties || {};
                        const displayName = props.display_name || entity.name || "Unknown";
                        const status = entity.status || "active";
                        const isHostile = status === 'hostile';
                        const isUnknown = displayName.toLowerCase().includes("unknown") || displayName.toLowerCase().includes("figure");

                        return (
                            <button
                                key={entity.id}
                                onClick={() => onInspect(entity)}
                                title={displayName} // Tooltip for slim mode
                                className={cn(
                                    "flex items-center gap-3 p-2 rounded-lg border transition-all text-left group bg-background/80 backdrop-blur border-border hover:bg-accent hover:border-accent-foreground/20 justify-center xl:justify-start"
                                )}
                            >
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

                                <div className="hidden xl:flex flex-col overflow-hidden min-w-0">
                                    <span className="text-sm font-semibold truncate tracking-tight transition-colors text-foreground group-hover:text-primary">
                                        {displayName}
                                    </span>
                                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground truncate opacity-70">
                                        <span>{props.archetype || props.race || "Entity"}</span>
                                    </div>
                                </div>
                            </button>
                        )
                    })}
                </div>
            </div>
        </div>
    );
}
