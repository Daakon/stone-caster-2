import { useActiveGameStore } from '@/stores/useActiveGameStore';
import { VitalGauge } from './VitalGauge';
import { EntitySidebar } from './EntitySidebar';

export function HUDManager() {
    const { vitals } = useActiveGameStore();

    if (!vitals) return null;

    return (
        <div className="pointer-events-none">
            {/* Docked Area (Top Left or Sidebar) - Mobile: Top Bar */}
            <div className="absolute top-4 left-4 z-20 pointer-events-auto flex flex-col gap-1 w-64 flex-shrink-0 hidden md:flex">
                <EntitySidebar />
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
