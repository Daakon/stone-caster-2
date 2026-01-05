import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { loadState, castStone } from '@/services/game-client';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

// New Architecture Components
import { ActiveGameLayout } from '@/features/play/layout/ActiveGameLayout';
import { NarrativeStream } from '@/features/play/components/Narrative/NarrativeStream';
import { InputDeck } from '@/features/play/components/Deck/InputDeck';
import { SuggestionRail } from '@/features/play/components/Deck/SuggestionRail';
import { HUDManager } from '@/features/play/components/HUD/HUDManager';
import { InspectorPanel } from '@/features/play/components/Inspector/InspectorPanel';

// Store
import { useActiveGameStore } from '@/stores/useActiveGameStore';

interface ActiveGameInterfaceProps {
    gameStateId: string;
}

export function ActiveGameInterface({ gameStateId }: ActiveGameInterfaceProps) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const {
        unlockInput, clearDraft, updateVitals, setSuggestedActions, updateEntities,
        setActiveGameId, setDraft, commitInput
    } = useActiveGameStore();

    const { data: gameState, isLoading, error } = useQuery({
        queryKey: ['game-state', gameStateId],
        queryFn: async () => {
            if (!gameStateId) throw new Error('Game ID required');
            return await loadState(gameStateId);
        }
    });

    // Initialize Store with Game ID
    useEffect(() => {
        if (gameStateId) setActiveGameId(gameStateId);
    }, [gameStateId, setActiveGameId]);

    // Cleanup input state on unmount
    useEffect(() => {
        return () => unlockInput();
    }, [unlockInput]);

    // Sync State (Hybrid Sync Pattern)
    useEffect(() => {
        if (gameState) {
            // "The Handshake"
            // We pass the fresh server state directly to the store
            // The store handles parsing vitals, entities, logs, etc.
            useActiveGameStore.getState().syncState(gameState as any);
        }
    }, [gameState]);

    const handleCommit = async (text: string) => {
        try {
            setDraft(text);
            await commitInput();

            // Re-fetch to update logs/history since ActiveGameInterface relies on useQuery
            await queryClient.invalidateQueries({ queryKey: ['game-state', gameStateId] });

        } catch (err) {
            console.error('Cast failed:', err);
            toast.error("Failed to process turn");
            unlockInput();
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error || !gameState) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
                <p className="text-destructive">Failed to load game state.</p>
                <button onClick={() => navigate('/casting-circle')} className="underline">Back</button>
            </div>
        );
    }

    // Extract History & Map to Logs
    const history = (gameState as any)?.narrative?.dialogue_history ||
        (gameState as any)?.narrative?.history ||
        [];

    // Fallback for Turn 0
    if (history.length === 0) {
        const intro = (gameState as any)?.narrative?.description || "The story begins...";
        history.push({
            speaker: 'Narrator',
            text: intro,
            timestamp: new Date()
        });
    }

    const logs = history.map((entry: any, i: number) => ({
        id: `log-${i}`,
        role: entry.speaker === 'Narrator' ? 'narrator' : (entry.speaker === 'System' ? 'system' : 'player'),
        text: entry.text || entry.content,
        timestamp: new Date(entry.timestamp || Date.now()),
        metadata: entry.metadata
    }));

    // Construct Layers
    const narrativeLayer = <NarrativeStream logs={logs} />;

    const deckLayer = (
        <div className="w-full flex flex-col bg-background border-t">
            <SuggestionRail onCommit={handleCommit} />
            <InputDeck />
        </div>
    );

    const hudLayer = (
        <div className="absolute inset-0 pointer-events-none z-50">
            <HUDManager />
        </div>
    );

    return (
        <>
            <ActiveGameLayout
                narrativeStream={narrativeLayer}
                inputDeck={deckLayer}
                hud={hudLayer}
            />
            <InspectorPanel state={gameState} />
        </>
    );
}
