import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { loadState } from '@/services/game-client';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

// New Architecture Components
import { ThreeColumnLayout } from '@/features/play/layout/ThreeColumnLayout';
import { GameHeader } from '@/features/play/components/GameHeader';
import { LeftSidebar } from '@/features/play/components/LeftSidebar';
import { NarrativeStream } from '@/features/play/components/Narrative/NarrativeStream';
import { InputDeck } from '@/features/play/components/Deck/InputDeck';
import { SuggestionRail } from '@/features/play/components/Deck/SuggestionRail';
import { HudSidebar } from '@/features/play/components/HUD/HudSidebar';
import { MobileVitalsBar } from '@/features/play/components/HUD/MobileVitalsBar';
import { EntityInspectorModal } from '@/features/play/components/modals/EntityInspectorModal';

// Store
import { useActiveGameStore } from '@/stores/useActiveGameStore';

interface ActiveGameInterfaceProps {
    gameStateId: string;
}

export function ActiveGameInterface({ gameStateId }: ActiveGameInterfaceProps) {
    const navigate = useNavigate();
    const {
        unlockInput,
        setActiveGameId, setDraft, commitInput
    } = useActiveGameStore();
    const pendingInput = useActiveGameStore(state => state.pendingInput);

    const [inspectEntity, setInspectEntity] = useState<any>(null);
    const [showMyChar, setShowMyChar] = useState(false);

    const handleInspect = (entity: any) => {
        setInspectEntity(entity);
    };

    // Extract History - MUST be called before any conditional returns
    const history = useActiveGameStore(state => {
        const gs = state.gameState as any;
        return gs?.narrative_focus?.dialogue_history ||
            gs?.tier0_narrative?.dialogue_history ||
            gs?.narrative?.dialogue_history ||
            gs?.narrative?.history ||
            [];
    });

    // State Extraction - MUST be called before any conditional returns
    const storeState = useActiveGameStore(state => state.gameState);
    const storeEntities = useActiveGameStore(state => state.entities);
    // Entity selected by clicking a name inside the narrative text
    const selectedEntityId = useActiveGameStore(state => state.selectedEntityId);
    const setSelectedEntity = useActiveGameStore(state => state.setSelectedEntity);

    const { data: gameState, isLoading, error } = useQuery({
        queryKey: ['game-state', gameStateId],
        queryFn: async () => {
            if (!gameStateId) throw new Error('Game ID required');
            return await loadState(gameStateId);
        }
    });

    // Initialize Store
    useEffect(() => {
        if (gameStateId) setActiveGameId(gameStateId);
    }, [gameStateId, setActiveGameId]);

    // Cleanup
    useEffect(() => {
        return () => unlockInput();
    }, [unlockInput]);

    // Sync State
    useEffect(() => {
        if (gameState) {
            useActiveGameStore.getState().syncState(gameState as any);
        }
    }, [gameState]);

    // Single reconciliation strategy: the store applies the server delta
    // optimistically (both for chips and free text); the mount-time GET
    // remains the authoritative resync. Errors are toasted by the store.
    const handleCommit = async (text: string) => {
        setDraft(text);
        await commitInput();
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
                <button onClick={() => navigate('/stories')} className="underline">Back to Stories</button>
            </div>
        );
    }

    // Fallback Logs
    // Entries carry `role` (current backend format) or `speaker` (legacy rows)
    const logs = history.length > 0 ? history.map((entry: any, i: number) => ({
        id: `log-${i}`,
        role: entry.role || (entry.speaker === 'Narrator' ? 'narrator' : (entry.speaker === 'System' ? 'system' : 'player')),
        text: entry.text || entry.content,
        timestamp: new Date(entry.timestamp || Date.now()),
        metadata: entry.metadata
    })) : [{
        id: 'intro',
        role: 'narrator',
        text: (gameState as any)?.tier0_narrative?.description ||
            (gameState as any)?.narrative_focus?.description ||
            (gameState as any)?.narrative?.description ||
            "The story begins...",
        timestamp: new Date()
    }];

    // State Extraction - Read from store for optimistic updates, fallback to React Query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyState = (storeState || gameState) as any;
    const mechanical = anyState?.mechanical_state || anyState?.tier1_mechanical || anyState?.mechanical || {};
    const narrative = anyState?.tier0_narrative || anyState?.narrative_focus || {};
    const registry = anyState?.scene_registry || anyState?.tier2_spatial || {};

    const sceneContext = narrative?.scene_context || {};

    // Entities & Player - Use store entities for reactivity
    const entities = storeEntities && Object.keys(storeEntities).length > 0 
        ? storeEntities 
        : (mechanical?.entities || {});
    const statePlayerId = mechanical?.index?.player_id;
    const playerEntity = entities[statePlayerId] || {};

    // Locations
    const locations = registry?.entity_locations || {};

    // Header
    const headerContent = (
        <GameHeader
            scene={sceneContext}
            onExit={() => navigate('/stories')}
            onConfig={() => toast.info("Config Menu Coming Soon")}
        />
    );

    // Left: Player Stats
    const leftSidebarContent = (
        <LeftSidebar
            player={playerEntity}
            onInspect={() => setShowMyChar(true)}
        />
    );

    // Right: HUD
    const rightSidebarContent = (
        <HudSidebar
            context={sceneContext}
            entities={entities}
            locations={locations}
            playerId={statePlayerId}
            activeSceneId={registry?.active_scene_id}
            onInspect={handleInspect}
        />
    );

    // Footer
    const footerContent = (
        <div className="w-full">
            <SuggestionRail onCommit={handleCommit} />
            <InputDeck />
        </div>
    );

    // Entity picked via narrative-text click (StoryBlock -> setSelectedEntity).
    // Fall back to a minimal shell so the modal still opens for stale IDs.
    const selectedEntity = selectedEntityId
        ? (entities[selectedEntityId] || { id: selectedEntityId })
        : null;

    return (
        <>
            <ThreeColumnLayout
                header={headerContent}
                leftSidebar={leftSidebarContent}
                rightSidebar={rightSidebarContent}
                footer={footerContent}
                mobileBar={<MobileVitalsBar onInspect={() => setShowMyChar(true)} />}
            >
                <NarrativeStream logs={logs} pendingInput={pendingInput} />
            </ThreeColumnLayout>

            {/* Modals Layer */}
            <EntityInspectorModal
                entity={inspectEntity}
                isOpen={!!inspectEntity}
                onClose={() => setInspectEntity(null)}
            />

            <EntityInspectorModal
                entity={playerEntity}
                isOpen={showMyChar}
                onClose={() => setShowMyChar(false)}
            />

            {/* Narrative-text entity clicks */}
            <EntityInspectorModal
                entity={selectedEntity}
                isOpen={!!selectedEntity}
                onClose={() => setSelectedEntity(null)}
            />
        </>
    );
}
