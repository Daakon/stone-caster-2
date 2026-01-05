import { useActiveGameStore } from '@/stores/useActiveGameStore';

export function SceneHeader() {
    const { gameState } = useActiveGameStore();

    // Safety Casting
    const anyState = gameState as any;
    const narrative = anyState?.tier0_narrative || anyState?.narrative_focus || anyState?.narrative || {};
    const context = narrative.scene_context || {};

    const title = context.name || "Unknown Location";
    const atmosphere = context.atmosphere || "Mysterious";

    if (!gameState) return null;

    return (
        <div className="w-full text-center py-6 border-b bg-background/50 backdrop-blur-sm z-10">
            <h2 className="text-2xl font-serif font-bold text-foreground tracking-wide">
                {title}
            </h2>
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest mt-1">
                {atmosphere}
            </p>
        </div>
    );
}
