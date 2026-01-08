import { useActiveGameStore } from '@/stores/useActiveGameStore';
import { cn } from '@/lib/utils';
import { User, Skull, Box, HelpCircle, HeartCrack, Activity, Moon } from 'lucide-react';
import { VitalsPanel } from '../sidebar/VitalsPanel';
import { WorldClock } from '../sidebar/WorldClock';
import { StatusBadges } from '../sidebar/StatusBadges';

export function EntitySidebar() {
    const { entities, setSelectedEntity, selectedEntityId, gameState } = useActiveGameStore();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mechanicalState = gameState?.mechanical_state || (gameState as any)?.tier1_mechanical || {};

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
            {/* HUD Components */}
            <WorldClock mechanicalState={mechanicalState} />

            <div className="flex flex-col gap-2">
                <div className="flex items-end gap-3 px-2">
                    <div className="w-12 h-12 rounded-full bg-muted border-2 border-border shadow-sm flex items-center justify-center overflow-hidden flex-shrink-0 relative">
                        <User className="w-6 h-6 text-muted-foreground" />
                        {/* Combat Glow */}
                        {mechanicalState?.entities?.[mechanicalState?.index?.player_id]?.properties?.combat_condition &&
                            mechanicalState?.entities?.[mechanicalState?.index?.player_id]?.properties?.combat_condition !== 'Healthy' && (
                                <div className="absolute inset-0 border-2 border-red-500/50 rounded-full animate-pulse" />
                            )}
                    </div>
                    <div className="flex-1 pb-1">
                        <StatusBadges mechanicalState={mechanicalState} />
                    </div>
                </div>
                <VitalsPanel mechanicalState={mechanicalState} />
            </div>

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
                    const combatCondition = props.combat_condition || 'Healthy';

                    // Combat Condition Icon Logic
                    const getCombatConditionIcon = () => {
                        if (combatCondition === 'Wounded') {
                            return <HeartCrack className="w-3.5 h-3.5 text-red-500" />;
                        } else if (combatCondition === 'Defeated') {
                            return <Skull className="w-3.5 h-3.5 text-gray-500 opacity-50" />;
                        } else if (combatCondition === 'Unconscious') {
                            return <Moon className="w-3.5 h-3.5 text-blue-500" />;
                        }
                        return null; // Healthy - no icon
                    };

                    const combatIcon = getCombatConditionIcon();

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
                                
                                {/* Combat Condition Badge - Overlay on avatar corner */}
                                {combatIcon && (
                                    <div className="absolute top-0 left-0 w-4 h-4 bg-background/90 rounded-full flex items-center justify-center border border-border z-20">
                                        {combatIcon}
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col overflow-hidden min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                    <span className={cn(
                                        "text-sm font-semibold truncate tracking-tight transition-colors",
                                        selectedEntityId === entity.id ? "text-primary" : "text-foreground group-hover:text-primary"
                                    )}>
                                        {displayName}
                                    </span>
                                    {/* Combat Condition Icon - Next to name */}
                                    {combatIcon && (
                                        <div className="flex items-center flex-shrink-0">
                                            {combatIcon}
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground truncate opacity-70">
                                    <span>{props.archetype || props.race || "Entity"}</span>
                                    {combatCondition !== 'Healthy' && (
                                        <span className="text-red-500">• {combatCondition}</span>
                                    )}
                                </div>
                            </div>
                        </button>
                    )
                })}
            </div>
        </div>
    );
}
