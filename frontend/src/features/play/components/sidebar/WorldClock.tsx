import React from 'react';
import { Sun, Moon, Sunset, Cloud } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WorldClockProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mechanicalState?: any;
    time?: string;
}

export const WorldClock = ({ mechanicalState, time }: WorldClockProps) => {
    // Defensive coding
    const world = mechanicalState?.world || mechanicalState?.tier1_world || {};
    const timeBand = time || world.time_band || "Day";

    // Icon Mapping
    let Icon = Sun;
    let color = "text-yellow-500";
    let glow = "shadow-yellow-500/20";

    const tb = timeBand.toLowerCase();

    if (tb.includes('early morning') || tb.includes('dawn')) {
        Icon = Sun;
        color = "text-orange-300";
    } else if (tb.includes('midday') || tb.includes('noon') || tb === 'day') {
        Icon = Sun;
        color = "text-yellow-500";
    } else if (tb.includes('dusk') || tb.includes('sunset') || tb.includes('evening')) {
        Icon = Sunset;
        color = "text-orange-500";
    } else if (tb.includes('night') || tb.includes('midnight')) {
        Icon = Moon;
        color = "text-indigo-400";
        glow = "shadow-indigo-500/20";
    }

    return (
        <div className="flex items-center gap-3 p-3 bg-background/80 border border-border rounded-xl shadow-sm mb-2">
            <div className={cn("p-2 rounded-full bg-background border border-border shadow-inner items-center flex justify-center", glow)}>
                <Icon className={cn("w-5 h-5", color)} />
            </div>
            <div className="flex flex-col">
                <span className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest">Time</span>
                <span className="text-sm font-semibold text-foreground capitalize leading-none">{timeBand}</span>
            </div>
        </div>
    );
};
