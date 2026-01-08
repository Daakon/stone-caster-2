import { Settings, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useActiveGameStore } from '@/stores/useActiveGameStore';
import { useGameSettings } from '@/stores/useGameSettings';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export function SceneDeck() {
    const { gameState } = useActiveGameStore();
    const {
        zenMode,
        toggleZenMode,
        showVitals,
        toggleVitals,
        showCast,
        toggleCast
    } = useGameSettings();

    // Extract Scene Context
    const anyState = gameState as any;
    const narrative = anyState?.tier0_narrative || anyState?.narrative_focus || anyState?.narrative || {};
    const context = narrative.scene_context || {};

    const locationName = context.location || context.name || "Unknown Location";
    const timeOfDay = context.time || null;

    return (
        <div
            className={cn(
                "fixed top-0 inset-x-0 z-50 transition-all duration-500 pt-safe",
                zenMode
                    ? "bg-transparent pointer-events-none opacity-0 hover:opacity-100 hover:bg-black/40 hover:backdrop-blur-sm pointer-events-auto"
                    : "bg-background/60 backdrop-blur-md border-b border-white/10"
            )}
        >
            <div className="container mx-auto max-w-5xl px-4 h-14 flex items-center justify-between">

                {/* Left: Location & Time */}
                <div className="flex flex-col">
                    <h1 className={cn(
                        "text-sm font-bold tracking-wider uppercase transition-colors",
                        zenMode ? "text-white/90" : "text-foreground"
                    )}>
                        {locationName}
                    </h1>
                    {timeOfDay && !zenMode && (
                        <span className="text-[10px] text-muted-foreground font-medium tracking-widest uppercase">
                            {timeOfDay}
                        </span>
                    )}
                </div>

                {/* Right: Controls */}
                <div className="flex items-center gap-2">

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className={cn(
                                    "h-8 w-8 transition-colors",
                                    zenMode ? "text-white/70 hover:text-white" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <Settings className="h-4 w-4" />
                                <span className="sr-only">Settings</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>Interface Settings</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={toggleZenMode}>
                                {zenMode ? <Minimize2 className="mr-2 h-4 w-4" /> : <Maximize2 className="mr-2 h-4 w-4" />}
                                {zenMode ? 'Exit Zen Mode' : 'Enter Zen Mode'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuCheckboxItem checked={showVitals} onCheckedChange={toggleVitals}>
                                Show Vitals
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem checked={showCast} onCheckedChange={toggleCast}>
                                Show Cast
                            </DropdownMenuCheckboxItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                </div>
            </div>
        </div>
    );
}
