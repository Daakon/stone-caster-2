import { useActiveGameStore } from '@/stores/useActiveGameStore';

export function SceneHeader() {
    const { gameState } = useActiveGameStore();

    // Safety Casting
    const anyState = gameState as any;
    const narrative = anyState?.tier0_narrative || anyState?.narrative_focus || anyState?.narrative || {};
    const context = narrative.scene_context || {};

    const title = context.location || context.name || "Unknown Location";
    const atmosphere = context.atmosphere || (context.description ? context.description.slice(0, 50) + "..." : "Mysterious");
    const timeOfDay = context.time || "Unknown Time";
    const sceneName = context.name || "The Beginning";

    console.log('[SceneHeader] Render Context:', { title, timeOfDay, context });

    if (!gameState) return null;

    return (
        <div className="sticky top-0 w-full flex items-center justify-between px-6 py-4 border-b bg-background/80 backdrop-blur-md z-30 shadow-sm md:pl-72 transition-all duration-300">
            <div className="flex flex-col items-start">
                <h1 className="text-xl font-serif font-bold text-foreground tracking-wide">
                    {title}
                </h1>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mt-1 flex items-center gap-2">
                    <span>{timeOfDay}</span>
                    <span className="w-1 h-1 rounded-full bg-border" />
                    <span>{atmosphere}</span>
                </p>
            </div>

            <div className="hidden md:block">
                <span className="text-xs font-medium text-muted-foreground/50 uppercase tracking-widest border border-border/50 px-2 py-1 rounded">
                    {sceneName}
                </span>
            </div>
        </div>
    );
}
