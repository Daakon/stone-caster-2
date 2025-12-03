// [CHIMERA V3] Architecture: Greenfield | Layer: Frontend
/**
 * Game View
 * Main gameplay interface for Chimera V3
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { NarrativeFeed, type NarrativeEntry } from '@/components/game/NarrativeFeed';
import { StatsPanel } from '@/components/game/StatsPanel';
import { ActionInput } from '@/components/game/ActionInput';
import { startGame, castStone, type CastStoneResponse } from '@/services/game-client';
import type { GameState } from '@shared/types/chimera-runtime';

export default function GameView() {
  const { gameStateId } = useParams<{ gameStateId: string }>();
  const navigate = useNavigate();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [narrativeHistory, setNarrativeHistory] = useState<NarrativeEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Load initial game state
  const { data: initialState, isLoading, error } = useQuery({
    queryKey: ['game-state', gameStateId],
    queryFn: async () => {
      if (!gameStateId) throw new Error('Game state ID is required');
      // For now, we'll get the state from the first castStone call
      // In a real implementation, you'd have a GET endpoint
      return null;
    },
    enabled: !!gameStateId,
  });

  // Initialize game state from first narrative entry or load from API
  useEffect(() => {
    if (gameStateId && !gameState) {
      // Set initial state - in production, this would come from an API call
      setGameState({
        tier1_mechanical: {
          hp: 10,
          max_hp: 10,
        },
        tier0_narrative: {},
      });
    }
  }, [gameStateId, gameState]);

  const handleCastStone = async (text: string) => {
    if (!gameStateId) {
      toast.error('Game state ID is missing');
      return;
    }

    setIsProcessing(true);
    try {
      const result: CastStoneResponse = await castStone(gameStateId, text);

      // Update game state with the new state from backend
      setGameState(result.updatedState);

      // Add narrative entry to history
      const newEntry: NarrativeEntry = {
        id: `entry-${Date.now()}`,
        narrative: result.mas2.ripple_narrative,
        outcome_summary: result.engine.outcome_summary,
        timestamp: new Date(),
      };

      setNarrativeHistory((prev) => [...prev, newEntry]);

      // Show success feedback
      toast.success('Action processed');
    } catch (error) {
      console.error('Error casting stone:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to process action'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <div className="p-6 text-center">
            <p className="text-destructive mb-4">
              Failed to load game state
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              {error instanceof Error ? error.message : 'Unknown error'}
            </p>
            <Button onClick={() => navigate('/casting-circle')} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Casting Circle
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Layout */}
      <div className="md:hidden flex flex-col h-screen">
        {/* Header */}
        <div className="p-4 border-b">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/casting-circle')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>

        {/* Main Narrative Area */}
        <div className="flex-1 overflow-hidden">
          <NarrativeFeed history={narrativeHistory} />
        </div>

        {/* Stats Drawer (can be toggled) */}
        {gameState && (
          <div className="border-t max-h-[200px] overflow-auto">
            <StatsPanel tier1Data={gameState.tier1_mechanical} />
          </div>
        )}

        {/* Input Bar */}
        <div className="p-4 border-t bg-background">
          <ActionInput onSend={handleCastStone} disabled={isProcessing} />
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:grid md:grid-cols-[1fr_300px] md:h-screen">
        {/* Main Area */}
        <div className="flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/casting-circle')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>

          {/* Narrative Feed */}
          <div className="flex-1 overflow-hidden">
            <NarrativeFeed history={narrativeHistory} />
          </div>

          {/* Input Bar */}
          <div className="p-4 border-t bg-background">
            <ActionInput onSend={handleCastStone} disabled={isProcessing} />
          </div>
        </div>

        {/* Sidebar */}
        <div className="border-l overflow-hidden">
          {gameState ? (
            <StatsPanel tier1Data={gameState.tier1_mechanical} />
          ) : (
            <Card className="m-4">
              <div className="p-4 text-center text-muted-foreground">
                Loading stats...
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

