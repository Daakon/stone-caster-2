import { User } from "lucide-react";
import { VitalsPanel } from "./sidebar/VitalsPanel";
import { StatusBadges } from "./sidebar/StatusBadges";

interface LeftSidebarProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mechanicalState: any;
}

export function LeftSidebar({ mechanicalState }: LeftSidebarProps) {
    // Extract Player Entity
    const playerId = mechanicalState?.index?.player_id;
    const playerEntity = mechanicalState?.entities?.[playerId] || {};
    const props = playerEntity.properties || {};
    const name = props.display_name || playerEntity.name || "Player";
    const archetype = props.archetype || props.race || "Adventurer";

    return (
        <div className="flex flex-col gap-6 p-4">
            {/* Player Header */}
            <div className="flex items-center gap-3 pb-4 border-b border-border/50">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center border-2 border-primary/50 text-foreground shadow-sm">
                    {/* Placeholder Avatar */}
                    <User className="w-6 h-6" />
                </div>
                <div className="flex flex-col min-w-0">
                    <h3 className="font-bold text-sm truncate">{name}</h3>
                    <span className="text-xs text-muted-foreground truncate">{archetype}</span>
                </div>
            </div>

            {/* Vitals Section */}
            <div>
                <h4 className="text-[10px] uppercase font-bold text-muted-foreground mb-3 tracking-wider">Condition</h4>
                <div className="space-y-4">
                    <StatusBadges mechanicalState={mechanicalState} />
                    <VitalsPanel mechanicalState={mechanicalState} />
                </div>
            </div>
        </div>
    );
}
