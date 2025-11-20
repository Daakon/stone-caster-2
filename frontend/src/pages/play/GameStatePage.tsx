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
import { MessageLog, type Message } from '@/components/play/MessageLog';
import { DebugPanel } from '@/components/play/DebugPanel';
import { chimeraPlayService } from '@/services/chimera.play';
import { chimeraStoriesService } from '@/services/chimera.stories';
import type { CastStoneResponse } from '@/services/chimera.play';

export default function PlayPage() {
  const { gameStateId } = useParams<{ gameStateId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const debug = searchParams.get('debug') === 'true';

  const [messages, setMessages] = useState<Message[]>([]);
  const [storyName, setStoryName] = useState<string>('');

  // Fetch game state
  const {
    data: gameState,
    isLoading: isLoadingState,
    error: stateError,
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
    onSuccess: (response: CastStoneResponse) => {
      // Add player message
      setMessages((prev) => [
        ...prev,
        {
          id: `player-${Date.now()}`,
          type: 'player',
          content: response.debug_info?.mas_1_input || '...',
          timestamp: new Date(),
        },
      ]);

      // Add narrative response
      setMessages((prev) => [
        ...prev,
        {
          id: `narrative-${Date.now()}`,
          type: 'narrative',
          content: response.ripple_narrative,
          timestamp: new Date(),
        },
      ]);
    },
    onError: (error: Error) => {
      toast.error('Failed to process action', {
        description: error.message || 'An error occurred while processing your action.',
      });
    },
  });

  const handleSubmit = useCallback(
    async (text: string) => {
      if (!gameStateId) {
        toast.error('Game state ID is missing');
        return;
      }
      await castStoneMutation.mutateAsync(text);
    },
    [gameStateId, castStoneMutation]
  );

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
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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
                  Turn {gameState.turn_count} • {gameState.status}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Message Log */}
        <div className="flex-1 flex flex-col min-w-0">
          <MessageLog messages={messages} className="flex-1" />
        </div>

        {/* Debug Panel (Sidebar) */}
        {debug && castStoneMutation.data?.debug_info && (
          <aside className="w-80 border-l border-border bg-muted/30 overflow-y-auto p-4">
            <DebugPanel debugInfo={castStoneMutation.data.debug_info} />
          </aside>
        )}
      </div>

      {/* Input Area */}
      <footer className="border-t border-border bg-background p-4">
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

