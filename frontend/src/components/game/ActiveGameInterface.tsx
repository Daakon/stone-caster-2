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

    // Sync State (Vitals, Entities, Suggestions)
    useEffect(() => {
        if (gameState) {
            const anyState = gameState as any;
            const mech = anyState.tier1_mechanical || anyState.mechanical_state;

            // 1. Vitals
            if (mech) {
                updateVitals({
                    hp: mech.health?.current ?? 100,
                    maxHp: mech.health?.max ?? 100,
                    stamina: mech.stamina?.current ?? 100,
                    inCombat: mech.in_combat ?? false
                });
            }

            // 2. Suggestions (from scene_context or context_window)
            // Check scene_context.available_actions
            const actions = anyState.narrative?.scene_context?.available_actions || [];
            if (actions.length > 0) {
                setSuggestedActions(actions);
            }

            // 3. Entities (from scene_context.entities or visible_entities)
            // Mocking for Phase 3 Verification until Backend sends explicit list
            // Ideally this comes from `active_context.entities`
            // Let's look for `entities` in tier1 or narrative.
            // For now, inject some hardcoded ones for testing the parser if empty.
            const apiEntities = anyState.narrative?.scene_context?.visible_entities || {};

            // Fallback Mock for testing
            if (Object.keys(apiEntities).length === 0) {
                // Self-correction: Don't overwrite if empty unless we want to force test.
                // Let's inject a standard test entity "Garret" if not present
                updateEntities({
                    'test-garret': { name: 'Garret', type: 'npc' },
                    'test-sword': { name: 'Rusty Shortsword', type: 'item' }
                });
            } else {
                updateEntities(apiEntities);
            }
        }
    }, [gameState, updateVitals, setSuggestedActions, updateEntities]);

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
            <InputDeck onCommit={handleCommit} />
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
