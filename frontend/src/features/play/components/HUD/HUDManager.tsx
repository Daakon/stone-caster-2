import { useActiveGameStore } from '@/stores/useActiveGameStore';
import { VitalGauge } from './VitalGauge';

export function HUDManager() {
    const { vitals } = useActiveGameStore();

    if (!vitals) return null;

    return (
        <div className="pointer-events-none">
            {/* Docked Area (Top Left or Sidebar) - Mobile: Top Bar */}
            <div className="absolute top-4 left-4 z-20 pointer-events-auto flex flex-col gap-1 w-64 flex-shrink-0 hidden md:flex">
                <div className="flex items-center gap-3 mb-2 p-2 bg-background/50 backdrop-blur rounded-lg border shadow-sm">
                    <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/50 overflow-hidden flex items-center justify-center">
                        {/* Placeholder Avatar */}
                        <span className="text-xs font-bold text-primary">YOU</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-foreground leading-none">Player</span>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Lvl 1 Traveler</span>
                    </div>
                </div>

                <VitalGauge type="hp" value={vitals.hp} max={vitals.maxHp} color="bg-red-500" />
                <VitalGauge type="stamina" value={vitals.stamina} max={100} color="bg-yellow-500" />
                {/* Saturation could be hidden unless critical? For now, render all. */}
                <VitalGauge type="saturation" value={vitals.saturation} max={100} color="bg-blue-500" threshold={20} />
            </div>

            {/* Mobile Header Version (Simple) */}
            <div className="md:hidden fixed top-0 inset-x-0 h-14 bg-background/80 backdrop-blur border-b z-20 flex items-center justify-between px-4 pointer-events-auto">
                <div className="font-bold text-sm tracking-tight text-primary">StoneCaster</div>
                {/* Mini Gauges for Mobile */}
                <div className="flex gap-2 w-1/2">
                    <div className="h-1.5 flex-1 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-red-500" style={{ width: `${(vitals.hp / vitals.maxHp) * 100}%` }} />
                    </div>
                    <div className="h-1.5 flex-1 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-yellow-500" style={{ width: `${vitals.stamina}%` }} />
                    </div>
                </div>
            </div>

            {/* Note: Floating gauges (Active Mode) will portal themselves to document.body 
                So we can render them here logically even though they appear elsewhere visually. 
            */}
            <div className="hidden">
                {/* 
                    Logic Twist: We render VitalGauge again? 
                    No, we want the SAME instance to switch modes. 
                    The `VitalGauge` component inside the desktop view handles the switch.
                    BUT, for Mobile, the header is separate.
                    So, if using portals, we should ensure we don't duplicate.
                    Currently `VitalGauge` output switches entirely to Portal if float.
                    So the docked version disappears and moves to float. This is desired.
                 */}
            </div>
        </div>
    );
}
