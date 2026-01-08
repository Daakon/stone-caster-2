import React from 'react';
import { cn } from '@/lib/utils';
import { Zap, Utensils, Apple, Activity, Footprints } from 'lucide-react';

interface VitalsPanelProps {
    mechanicalState: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    playerId?: string;
}

export const VitalsPanel = ({ mechanicalState, playerId }: VitalsPanelProps) => {
    // Defensive coding
    const pId = playerId || mechanicalState?.index?.player_id;
    const playerEntity = pId ? mechanicalState?.entities?.[pId] : null;
    const props = playerEntity?.properties || {};

    // Stamina
    const currentStamina = props.current_stamina ?? props.stamina ?? 100;
    const maxStamina = 100; // Assumption max is 100 for percentage
    const staminaPct = Math.min(100, Math.max(0, currentStamina));

    // Color Logic for Stamina
    let staminaColor = "bg-green-500";
    if (staminaPct < 80) staminaColor = "bg-yellow-500";
    if (staminaPct < 50) staminaColor = "bg-orange-500";
    if (staminaPct < 20) staminaColor = "bg-red-500";

    // Satiety
    const currentSatiety = props.current_satiety ?? props.satiety ?? 100;
    const satietyPct = Math.min(100, Math.max(0, currentSatiety));

    return (
        <div className="flex flex-col gap-3 w-full p-2 bg-background/50 rounded-lg border border-border/50">
            {/* Stamina Bar */}
            <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                    <div className="flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5" />
                        <span>Stamina</span>
                    </div>
                    <span>{currentStamina}</span>
                </div>
                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                    <div
                        className={cn("h-full rounded-full transition-all duration-500 ease-out", staminaColor)}
                        style={{ width: `${staminaPct}%` }}
                    />
                </div>
            </div>

            {/* Satiety Bar */}
            <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                    <div className="flex items-center gap-1.5">
                        <Utensils className="w-3.5 h-3.5" />
                        <span>Satiety</span>
                    </div>
                    <span>{currentSatiety}</span>
                </div>
                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                    <div
                        className="h-full bg-teal-500 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${satietyPct}%` }}
                    />
                </div>
            </div>
        </div>
    );
};
