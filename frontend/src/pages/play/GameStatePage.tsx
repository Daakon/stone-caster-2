/**
 * Play Page
 * Main game loop UI for playing Chimera stories
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlayInput } from '@/components/play/PlayInput';
import { NarrativeStream } from '@/features/play/components/Narrative/NarrativeStream';
import { SensoryObserver } from '@/features/play/components/FX/SensoryObserver';
import { DebugPanel } from '@/components/play/DebugPanel';
import { chimeraPlayService } from '@/services/chimera.play';
import { chimeraStoriesService } from '@/services/chimera.stories';

export default function PlayPage() {
  const { gameStateId } = useParams<{ gameStateId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const debug = searchParams.get('debug') === 'true';

  const [storyName, setStoryName] = useState<string>('');

  // Fetch game state
  const {
    data: gameState,
    isLoading: isLoadingState,
    error: stateError,
    refetch: refetchGameState
  } = useQuery({
    queryKey: ['chimera-game-state', gameStateId],
    queryFn: () => chimeraPlayService.getGameState(gameStateId!),
    enabled: !!gameStateId,
  });

  // Fetch story details for display
  useEffect(() => {
    if (gameState?.story_id) {
      chimeraStoriesService
        .getStory(gameState.story_id)
        .then((story) => {
          setStoryName(story.display_name);
        })
        .catch((error) => {
          console.error('Failed to fetch story:', error);
        });
    }
  }, [gameState?.story_id]);

  // Cast stone mutation
  const castStoneMutation = useMutation({
    mutationFn: (textInput: string) =>
      chimeraPlayService.castStone(gameStateId!, { text_input: textInput }, debug),
    onError: (error: Error) => {
      toast.error('Failed to process action', {
        description: error.message || 'An error occurred while processing your action.',
      });
    },
  });

  // Handle mutation success
  useEffect(() => {
    if (castStoneMutation.isSuccess) {
      refetchGameState();
    }
  }, [castStoneMutation.isSuccess, refetchGameState]);

  const handleSubmit = useCallback(
    async (text: string) => {
      console.log('[Debug] GameStatePage handleSubmit', { text, gameStateId });
      if (!gameStateId) {
        toast.error('Game state ID is missing');
        return;
      }
      try {
        console.log('[Debug] Triggering mutation');
        await castStoneMutation.mutateAsync(text);
        console.log('[Debug] Mutation completed');
      } catch (err) {
        console.error('[Debug] Mutation failed', err);
        throw err;
      }
    },
    [gameStateId, castStoneMutation]
  );

  // Derive logs from gameState history
  // Derive logs from gameState history
  let historyLogs = ((gameState?.tier0_narrative as any)?.dialogue_history || (gameState?.tier0_narrative as any)?.history)?.map((h: any, i: number) => ({
    id: `history-${i}`,
    role: h.role || (h.speaker === 'Narrator' ? 'narrator' : 'player'), // Fallback for legacy
    text: h.content || h.text, // Fallback for legacy
    timestamp: new Date(h.timestamp || Date.now()),
    metadata: h.metadata
  })) || [];

  // Fault Tolerance: If history is empty but description exists (Opening Narrative), inject it.
  const description = (gameState?.tier0_narrative as any)?.description;
  if (historyLogs.length === 0 && description) {
    historyLogs = [{
      id: 'history-fallback-0',
      role: 'narrator',
      text: description,
      timestamp: new Date(gameState?.created_at || Date.now())
    }];
  }

  if (isLoadingState) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (stateError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Error Loading Game</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">
              {stateError instanceof Error ? stateError.message : 'Failed to load game state'}
            </p>
            <Button onClick={() => navigate(-1)} className="mt-4" variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Game Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">The game state could not be found.</p>
            <Button onClick={() => navigate(-1)} className="mt-4" variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Sensory Observer for Visual FX */}
      <SensoryObserver gameState={gameState} />

      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10 transition-colors">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
                aria-label="Go back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-lg font-semibold">{storyName || 'Playing Story'}</h1>
                <p className="text-xs text-muted-foreground">
                  Turn {gameState.turn_count || 0} • {gameState.status || 'Active'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Narrative Stream */}
        <div className="flex-1 flex flex-col min-w-0">
          <NarrativeStream logs={historyLogs} />
        </div>

        {/* Debug Panel (Sidebar) */}
        {debug && (
          <aside className="w-80 border-l border-border bg-muted/30 overflow-y-auto p-4 hidden md:block">
            <DebugPanel debugInfo={{
              state: gameState,
              last_mutation: castStoneMutation.data
            } as any} />
          </aside>
        )}
      </div>

      {/* Input Area */}
      <footer className="border-t border-border bg-background p-4 z-20">
        <div className="container mx-auto max-w-4xl">
          <PlayInput
            onSubmit={handleSubmit}
            disabled={castStoneMutation.isPending}
            placeholder="What do you do?"
          />
        </div>
      </footer>
    </div>
  );
}

