import { useActiveGameStore } from '@/stores/useActiveGameStore';
import { cn } from '@/lib/utils';
import { User, Skull, Box, HelpCircle, Heart, Zap } from 'lucide-react';

function PlayerCard() {
    const { vitals, gameState } = useActiveGameStore();
    // Heuristic: Get player name from genesis or default
    const entityRecord = (gameState as any)?.tier1_mechanical?.entities;
    // Find player entity if possible
    const playerEntity = entityRecord ? Object.values(entityRecord).find((e: any) => e.type === 'PLAYER') : null;
    const playerName = (playerEntity as any)?.properties?.name || "Traveler";
    const archetype = (playerEntity as any)?.properties?.archetype || "Adventurer";

    if (!vitals) return null;

    return (
        <div className="flex flex-col gap-2 p-3 bg-background/60 backdrop-blur-md rounded-lg border border-primary/20 shadow-sm mb-2">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/50 overflow-hidden flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-primary" />
                </div>
                <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold text-foreground leading-none truncate">{playerName}</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider truncate">{archetype}</span>
                </div>
            </div>

            {/* Vitals Bars */}
            <div className="flex flex-col gap-1.5 mt-1">
                {/* HP */}
                <div className="flex items-center gap-2">
                    <Heart className="w-3 h-3 text-red-500 shrink-0" />
                    <div className="h-1.5 flex-1 bg-secondary/50 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-red-500 transition-all duration-500 ease-out"
                            style={{ width: `${(vitals.hp / vitals.maxHp) * 100}%` }}
                        />
                    </div>
                </div>
                {/* Stamina */}
                <div className="flex items-center gap-2">
                    <Zap className="w-3 h-3 text-yellow-500 shrink-0" />
                    <div className="h-1.5 flex-1 bg-secondary/50 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-yellow-500 transition-all duration-500 ease-out"
                            style={{ width: `${vitals.stamina}%` }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

export function EntitySidebar() {
    const { entities, setSelectedEntity, selectedEntityId } = useActiveGameStore();

    // Filter out player
    const list = entities ? Object.values(entities).filter((e: any) => e.type !== 'PLAYER' && e.type !== 'player') : [];

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

    return (
        <div className="flex flex-col gap-2 mt-4 pointer-events-auto w-full">
            {/* Player Card at top */}
            <PlayerCard />

            {/* Divider or Header */}
            {list.length > 0 && (
                <div className="flex items-center justify-between px-1 mt-2">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground mr-2">Nearby Cast</span>
                    <span className="text-[9px] text-muted-foreground/50 border border-border px-1.5 rounded-full">{list.length}</span>
                </div>
            )}

            {/* Empty State */}
            {list.length === 0 && (
                <div className="flex flex-col gap-2 mt-2 opacity-50 px-1">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">Nearby Cast</span>
                    <div className="text-xs text-muted-foreground italic">No one else is here.</div>
                </div>
            )}

            <div className="flex flex-col gap-1">
                {list.map((entity: any) => {
                    const props = entity.properties || {};
                    const displayName = props.display_name || entity.name || "Unknown";
                    const status = entity.status || "active";
                    const isHostile = status === 'hostile';
                    const isUnknown = displayName.toLowerCase().includes("unknown") || displayName.toLowerCase().includes("figure");

                    return (
                        <button
                            key={entity.id}
                            onClick={() => setSelectedEntity(entity.id)}
                            className={cn(
                                "flex items-center gap-3 p-2 rounded-lg border transition-all text-left group",
                                selectedEntityId === entity.id
                                    ? "bg-primary/10 border-primary shadow-sm"
                                    : "bg-background/80 backdrop-blur border-border hover:bg-accent hover:border-accent-foreground/20"
                            )}
                        >
                            <div className="relative flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center border border-border group-hover:border-primary/50 transition-colors overflow-hidden">
                                { /* Icon Logic */}
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

                            <div className="flex flex-col overflow-hidden min-w-0">
                                <span className={cn(
                                    "text-sm font-semibold truncate tracking-tight transition-colors",
                                    selectedEntityId === entity.id ? "text-primary" : "text-foreground group-hover:text-primary"
                                )}>
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
    );
}
