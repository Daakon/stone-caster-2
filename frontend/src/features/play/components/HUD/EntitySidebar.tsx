import { useActiveGameStore } from '@/stores/useActiveGameStore';
import { cn } from '@/lib/utils';
import { User, Skull, Box, HelpCircle } from 'lucide-react';

export function EntitySidebar() {
    const { entities, setSelectedEntity, selectedEntityId } = useActiveGameStore();

    if (!entities || Object.keys(entities).length === 0) return null;

    // Filter out player (heuristic: assume player is NOT in this list if list is purely NPCs, 
    // OR filter by type if present). 
    // Based on prompt: "Filter out the Player."
    const list = Object.values(entities).filter((e: any) => {
        // If entity has a flag, or simply isn't the 'client'
        // For now, let's filter if type is explicit 'player'
        return e.type !== 'player';
    });

    if (list.length === 0) return null;

    return (
        <div className="flex flex-col gap-2 mt-4 pointer-events-auto">
            <span className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Nearby</span>
            {list.map((entity: any) => (
                <button
                    key={entity.id}
                    onClick={() => setSelectedEntity(entity.id)}
                    className={cn(
                        "flex items-center gap-2 p-2 rounded-lg border transition-all text-left",
                        selectedEntityId === entity.id
                            ? "bg-primary/20 border-primary text-primary"
                            : "bg-background/60 backdrop-blur border-border hover:bg-accent/50 text-foreground"
                    )}
                >
                    <div className="flex-shrink-0 w-8 h-8 rounded-md bg-muted flex items-center justify-center">
                        {/* Icon Heuristics */}
                        {entity.type === 'enemy' ? <Skull className="w-4 h-4 text-destructive" /> :
                            entity.type === 'npc' ? <User className="w-4 h-4 text-secondary-foreground" /> :
                                entity.type === 'item' ? <Box className="w-4 h-4 text-blue-500" /> :
                                    <HelpCircle className="w-4 h-4 text-muted-foreground" />}
                    </div>
                    <div className="flex flex-col overflow-hidden">
                        <span className="text-xs font-bold truncate w-24">
                            {entity.display_name || entity.name || "Unknown"}
                        </span>
                        <span className="text-[9px] text-muted-foreground truncate">
                            {entity.status || "Active"}
                        </span>
                    </div>
                </button>
            ))}
        </div>
    );
}
