import { Button } from "@/components/ui/button";
import { LogOut, Settings } from "lucide-react";

interface GameHeaderProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    scene: any;
    onExit?: () => void;
    onConfig?: () => void;
}

export function GameHeader({ scene, onExit, onConfig }: GameHeaderProps) {
    const title = scene?.location_name || scene?.scene_name || "Unknown Location";
    const time = scene?.time_of_day || "Time Unknown";

    return (
        <header className="h-14 border-b flex items-center justify-between px-4 bg-card/50 backdrop-blur z-40 flex-shrink-0">
            <div className="flex items-center">
                <Button variant="ghost" size="icon" onClick={onExit} className="text-muted-foreground hover:text-destructive">
                    <LogOut className="w-5 h-5" />
                    <span className="sr-only">Exit Game</span>
                </Button>
            </div>

            <div className="flex flex-col items-center justify-center flex-1 min-w-0 px-4">
                <h2 className="text-sm font-bold tracking-tight truncate max-w-full">
                    {title}
                </h2>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {time}
                </span>
            </div>

            <div className="flex items-center">
                <Button variant="ghost" size="icon" onClick={onConfig} className="text-muted-foreground">
                    <Settings className="w-5 h-5" />
                    <span className="sr-only">Settings</span>
                </Button>
            </div>
        </header>
    );
}
