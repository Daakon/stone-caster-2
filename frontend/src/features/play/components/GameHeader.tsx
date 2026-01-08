import { Button } from "@/components/ui/button";
import { LogOut, Settings, Sun, Moon } from "lucide-react";

interface GameHeaderProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    scene: any;
    onExit?: () => void;
    onConfig?: () => void;
}

export function GameHeader({ scene, onExit, onConfig }: GameHeaderProps) {
    // Binding per "Verified JSON Paths"
    const storyTitle = scene?.name || "Untitled Story";
    const locationName = scene?.location || scene?.location_name || "Unknown Location";
    const time = scene?.time || "Unknown Time";
    const atmosphere = scene?.atmosphere || "";

    // Time Icon Logic
    const isNight = time.toLowerCase().includes('night') || time.toLowerCase().includes('evening');
    const TimeIcon = isNight ? Moon : Sun;

    return (
        <header className="h-14 border-b flex items-center justify-between px-4 bg-background/95 backdrop-blur z-40 flex-shrink-0 w-full relative">

            {/* Left: Exit & Story Title */}
            <div className="flex items-center gap-3 flex-1 min-w-0 z-10">
                <Button variant="ghost" size="icon" onClick={onExit} className="text-muted-foreground hover:text-destructive flex-shrink-0 h-9 w-9">
                    <LogOut className="w-4 h-4" />
                    <span className="sr-only">Exit Game</span>
                </Button>
                <div className="h-4 w-px bg-border hidden sm:block" />
                <span className="text-sm text-muted-foreground font-medium truncate hidden sm:block max-w-[200px]">
                    {storyTitle}
                </span>
            </div>

            {/* Center: Location Name - Absolutely centered for visual balance */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center max-w-[33%] hidden md:block">
                <h2 className="text-lg font-bold tracking-tight text-foreground truncate">
                    {locationName}
                </h2>
            </div>

            {/* Right: Time & Atmosphere */}
            <div className="flex items-center gap-4 flex-1 justify-end min-w-0 z-10">
                <div className="flex items-center gap-2 text-sm text-muted-foreground text-right">
                    <span className="hidden lg:inline-block italic opacity-70 border-r border-border pr-2 mr-1">{atmosphere}</span>
                    <span className="font-semibold uppercase text-xs tracking-wider">{time}</span>
                    <TimeIcon className="w-4 h-4 text-orange-400" />
                </div>

                <Button variant="ghost" size="icon" onClick={onConfig} className="text-muted-foreground h-9 w-9">
                    <Settings className="w-4 h-4" />
                    <span className="sr-only">Settings</span>
                </Button>
            </div>
        </header>
    );
}
