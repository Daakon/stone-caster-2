import { useActiveGameStore } from '@/stores/useActiveGameStore';

export function SceneHeader() {
    const { gameState } = useActiveGameStore();

    // Safety Casting
    const anyState = gameState as any;
    const narrative = anyState?.tier0_narrative || anyState?.narrative_focus || anyState?.narrative || {};
    const context = narrative.scene_context || {};

    const title = context.name || "Unknown Location";
    const atmosphere = context.atmosphere || (context.description ? context.description.slice(0, 50) + "..." : "Mysterious");

    if (!gameState) return null;

    return (
        <div className="sticky top-0 w-full text-center py-4 border-b bg-background/80 backdrop-blur-md z-30 shadow-sm">
            <h2 className="text-xl font-serif font-bold text-foreground tracking-wide">
                {title}
            </h2>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mt-1">
                {atmosphere}
            </p>
        </div>
    );
}
