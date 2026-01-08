import React from 'react';
import { cn } from '@/lib/utils';
import { User, Zap, Utensils } from "lucide-react";
import { VitalsPanel } from "./sidebar/VitalsPanel";
import { StatusBadges } from "./sidebar/StatusBadges";
import { useActiveGameStore } from '@/stores/useActiveGameStore';

// Icon Gauge Component
interface IconGaugeProps {
    icon: React.ElementType;
    value: number;
    max?: number;
    colorClass: string;
}

function IconGauge({ icon: Icon, value, max = 100, colorClass }: IconGaugeProps) {
    const pct = Math.min(100, Math.max(0, (value / max) * 100));

    return (
        <div className="relative w-6 h-6 flex items-center justify-center text-muted-foreground/30">
            {/* Background Icon (Empty) */}
            <Icon className="w-full h-full" />

            {/* Foreground Icon (Filled) - Clipped */}
            <div
                className={cn("absolute bottom-0 left-0 w-full overflow-hidden transition-all duration-500")}
                style={{ height: `${pct}%` }}
            >
                <div className="h-6 w-full flex items-end justify-center">
                    <Icon className={cn("w-6 h-6", colorClass)} />
                </div>
            </div>
        </div>
    );
}

interface LeftSidebarProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    player: any;
    onInspect?: () => void;
}

export function LeftSidebar({ player, onInspect }: LeftSidebarProps) {
    const props = player?.properties || {};

    // Binding per "Verified JSON Paths"
    const name = props.name || "Unknown";
    const role = props.occupation_tags?.[0] || "Adventurer";

    // Vitals Data - Read from store for reactivity (store is source of truth)
    const storeVitals = useActiveGameStore(state => state.vitals);
    const stamina = storeVitals.stamina ?? props.current_stamina ?? 100;
    const satiety = storeVitals.saturation ?? props.satiety ?? 100;

    return (
        <div className="flex flex-col gap-6 p-4 items-center lg:items-stretch">
            {/* Player Header */}
            <button
                onClick={onInspect}
                className="flex items-center gap-3 pb-4 border-b border-border/50 w-full hover:bg-accent/50 p-1 rounded-lg transition-colors group justify-center lg:justify-start"
            >
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center border-2 border-primary/50 text-foreground shadow-sm group-hover:border-primary transition-colors">
                    <User className="w-6 h-6" />
                </div>
                <div className="flex flex-col min-w-0 text-left hidden lg:flex">
                    <h3 className="font-bold text-sm truncate">{name}</h3>
                    <span className="text-xs text-muted-foreground truncate capitalize">{role}</span>
                </div>
            </button>

            {/* Vitals Section */}
            <div className="w-full flex flex-col items-center lg:items-stretch">
                <h4 className="text-[10px] uppercase font-bold text-muted-foreground mb-3 tracking-wider hidden lg:block">Condition</h4>

                {/* Full Panel (Large Screen) */}
                <div className="hidden lg:block space-y-4 w-full">
                    <StatusBadges mechanicalState={{ entities: { [player?.id]: player } }} />
                    <VitalsPanel mechanicalState={{ entities: { [player?.id]: player } }} />
                </div>

                {/* Slim Mode Icons (Medium Screen) */}
                <div className="hidden md:flex lg:hidden flex-col gap-4 items-center">
                    <IconGauge icon={Zap} value={stamina} colorClass="text-yellow-500" />
                    <div className="h-px w-8 bg-border/50" />
                    <IconGauge icon={Utensils} value={satiety} colorClass="text-teal-500" />
                </div>
            </div>
        </div>
    );
}
