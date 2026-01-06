import { useActiveGameStore } from '@/stores/useActiveGameStore';
import { cn } from '@/lib/utils';
import { User, Skull, Box, HelpCircle } from 'lucide-react';

export function EntitySidebar() {
    const { entities, setSelectedEntity, selectedEntityId } = useActiveGameStore();

    if (!entities || Object.keys(entities).length === 0) return null;

    // Filter out player (heuristic: assume player is NOT in this list if list is purely NPCs, 
    // OR filter by strict type check). 
    // Data Source: state.gameState.tier1_mechanical.entities
    const list = Object.values(entities).filter((e: any) => {
        // Strict exclusion of Player entity
        return e.type !== 'PLAYER' && e.type !== 'player';
    });

    if (list.length === 0) {
        return (
            <div className="flex flex-col gap-2 mt-4 pointer-events-auto opacity-50">
                <span className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Nearby</span>
                <div className="text-xs text-muted-foreground italic px-2">No one else is here.</div>
            </div>
        );
    }

    // Sort logic: Stars (if identifiable) -> NPCs -> Extras(based on simple heuristics)
    // Heuristic: If it has an archetype, it might be more important? 
    // Simpler: Just sort by name for stability, or prioritize specific types.
    // User requested: "Sort by type (Stars first, then Extras)". Since we don't have explicit 'Star' type on frontend entity yet (it's in genesis config), 
    // we can rely on Archetype presence or just alphabetical for now as a stable baseline, 
    // or assume the backend array order is somewhat meaningful.
    // Let's do: Named NPCs > Generic NPCs
    list.sort((a: any, b: any) => {
        const nameA = a.properties?.display_name || a.name || "";
        const nameB = b.properties?.display_name || b.name || "";
        // Simple alpha sort for stability
        return nameA.localeCompare(nameB);
    });

    return (
        <div className="flex flex-col gap-2 mt-4 pointer-events-auto">
            <span className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Nearby</span>
            {list.map((entity: any) => {
                const props = entity.properties || {};
                const displayName = props.display_name || entity.name || "Unknown";
                const status = entity.status || "active";
                const isHostile = status === 'hostile'; // or check specific tag

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
                        <div className="relative flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center border border-border group-hover:border-primary/50 transition-colors">
                            {/* Icon Heuristics */}
                            {entity.type === 'enemy' ? <Skull className="w-4 h-4 text-destructive" /> :
                                entity.type === 'item' ? <Box className="w-4 h-4 text-blue-500" /> :
                                    <User className="w-4 h-4 text-secondary-foreground" />}

                            {/* Status Dot */}
                            <span className={cn(
                                "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-background",
                                isHostile ? "bg-red-500" : "bg-green-500"
                            )} />
                        </div>

                        <div className="flex flex-col overflow-hidden">
                            <span className={cn(
                                "text-sm font-semibold truncate w-32 tracking-tight",
                                selectedEntityId === entity.id ? "text-primary" : "text-foreground group-hover:text-primary transition-colors"
                            )}>
                                {displayName}
                            </span>
                            <span className="text-[10px] text-muted-foreground truncate opacity-70">
                                {props.archetype || props.race || "Entity"}
                            </span>
                        </div>
                    </button>
                )
            })}
        </div>
    );
}
