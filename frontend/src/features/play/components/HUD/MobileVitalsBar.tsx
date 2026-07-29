import { Heart, Zap, Droplets } from 'lucide-react';
import { useActiveGameStore } from '@/stores/useActiveGameStore';
import { cn } from '@/lib/utils';

interface MobileVitalsBarProps {
    onInspect?: () => void;
}

/**
 * Compact vitals strip for phones — both sidebars are hidden below `md`,
 * so this is the only place mobile players see their condition.
 * Rendered statically between the header and the narrative stream.
 */
export function MobileVitalsBar({ onInspect }: MobileVitalsBarProps) {
    const vitals = useActiveGameStore(state => state.vitals);

    if (!vitals) return null;

    const hpPct = Math.min(100, Math.max(0, (vitals.hp / (vitals.maxHp || 100)) * 100));
    const staminaPct = Math.min(100, Math.max(0, vitals.stamina));
    const satietyPct = Math.min(100, Math.max(0, vitals.saturation));

    return (
        <button
            type="button"
            data-testid="mobile-vitals"
            onClick={onInspect}
            className="md:hidden w-full flex items-center gap-3 px-4 py-1.5 border-b bg-background/90 backdrop-blur text-left"
            aria-label="Your vitals — tap for details"
        >
            <div className="flex items-center gap-1 flex-1">
                <Heart className={cn("w-3.5 h-3.5 shrink-0", hpPct < 30 ? "text-destructive animate-pulse" : "text-red-500/70")} />
                <div className="h-1.5 flex-1 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-red-500 transition-all duration-500 ease-out" style={{ width: `${hpPct}%` }} />
                </div>
            </div>
            <div className="flex items-center gap-1 flex-1">
                <Zap className={cn("w-3.5 h-3.5 shrink-0", staminaPct < 30 ? "text-destructive animate-pulse" : "text-yellow-500/70")} />
                <div className="h-1.5 flex-1 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-500 transition-all duration-500 ease-out" style={{ width: `${staminaPct}%` }} />
                </div>
                <span data-testid="mobile-stamina-value" className="text-[10px] font-mono text-muted-foreground w-6 text-right">
                    {Math.round(vitals.stamina)}
                </span>
            </div>
            <div className="flex items-center gap-1 flex-1">
                <Droplets className="w-3.5 h-3.5 shrink-0 text-blue-500/70" />
                <div className="h-1.5 flex-1 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 transition-all duration-500 ease-out" style={{ width: `${satietyPct}%` }} />
                </div>
            </div>
            {vitals.condition && (
                <span
                    data-testid="mobile-condition"
                    className="text-[10px] font-bold uppercase tracking-wide text-destructive shrink-0"
                >
                    {vitals.condition}
                </span>
            )}
        </button>
    );
}
