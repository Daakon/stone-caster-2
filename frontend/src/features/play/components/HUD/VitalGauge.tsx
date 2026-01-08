import { cn } from '@/lib/utils';
import { useActiveGameStore } from '@/stores/useActiveGameStore';
import { createPortal } from 'react-dom';
import { Heart, Activity, Droplets } from 'lucide-react';
import { useEffect, useState } from 'react';

interface VitalGaugeProps {
    type: 'hp' | 'stamina' | 'saturation';
    value: number;
    max: number;
    threshold?: number; // Percentage (0-100) below which it becomes 'critical'
    label?: string;
    icon?: React.ReactNode;
    color?: string; // Tailwind class component (e.g., 'bg-red-500')
}

export function VitalGauge({ type, value, max, threshold = 30, icon, color = 'bg-primary' }: VitalGaugeProps) {
    const { vitals } = useActiveGameStore();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const percentage = Math.min(100, Math.max(0, (value / max) * 100));
    const isCritical = percentage < threshold;
    const isCombat = vitals.inCombat;

    // Float condition: Combat active OR Critical State
    const shouldFloat = isCombat || isCritical;

    // Default Icons if not provided
    const displayIcon = icon || (
        type === 'hp' ? <Heart className="w-4 h-4" /> :
            type === 'stamina' ? <Activity className="w-4 h-4" /> :
                <Droplets className="w-4 h-4" />
    );

    // Render Logic
    // Passive (Sidebar/Docked)
    const passiveView = (
        <div className="flex items-center gap-2 w-full p-2 rounded-md hover:bg-muted/50 transition-colors group" title={`${type}: ${value}/${max}`}>
            <div className={cn("text-muted-foreground", isCritical && "text-destructive animate-pulse")}>
                {displayIcon}
            </div>
            <div className="h-2 flex-1 bg-secondary rounded-full overflow-hidden">
                <div
                    className={cn("h-full transition-all duration-500", color, isCritical && "animate-pulse", percentage === 100 && "opacity-60")}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );

    // Critical (Floating Overlay)
    // Renders into a portal if supported, or absolute. Portal is safer for z-index containment escape.
    // For now, let's assume we render portal to document.body or a dedicated HUD layer div.
    if (shouldFloat && mounted) {
        // Floating HUD location: Bottom Left or Top Center? 
        // Spec says "floats as a larger overlay above the Input Deck". 
        // InputDeck is bottom. So this should be bottom-left or simply above deck.
        // Let's position it Fixed Bottom Left.
        return createPortal(
            <div className={cn(
                "fixed bottom-24 left-4 z-40 p-4 bg-background/95 backdrop-blur border rounded-lg shadow-xl w-64 animate-in slide-in-from-bottom-4 fade-in duration-300",
                isCritical && "border-destructive/50 ring-1 ring-destructive/20"
            )}>
                <div className="flex justify-between items-center mb-1">
                    <span className="font-bold uppercase text-xs flex items-center gap-2">
                        {displayIcon} {type}
                    </span>
                    <span className="font-mono text-sm">{value}/{max}</span>
                </div>
                <div className="h-3 w-full bg-secondary rounded-full overflow-hidden">
                    <div
                        className={cn("h-full transition-all duration-300", color)}
                        style={{ width: `${percentage}%` }}
                    />
                </div>
            </div>,
            document.body
        );
    }

    // Default return passive
    return passiveView;
}
