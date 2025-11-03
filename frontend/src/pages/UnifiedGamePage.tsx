import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Skeleton } from '../components/ui/skeleton';
import { WorldRuleMeters } from '../components/gameplay/WorldRuleMeters';
import { TurnInput } from '../components/gameplay/TurnInput';
import { HistoryFeed } from '../components/gameplay/HistoryFeed';
import { TurnErrorHandler } from '../components/gameplay/TurnErrorHandler';
import { ChoiceButtons } from '../components/gameplay/ChoiceButtons';
import { Breadcrumbs } from '../components/layout/Breadcrumbs';
import { Gem, RefreshCw, AlertCircle } from 'lucide-react';
import { 
  getGame, 
  getCharacter, 
  getContentWorlds,
  getWallet,
} from '../lib/api';
import { useAdventureTelemetry } from '../hooks/useAdventureTelemetry';
import { useGameTelemetry } from '../hooks/useGameTelemetry';
import { useLatestTurn, usePostTurn } from '../hooks/useTurns';
import { useAuthStore } from '../store/auth';
import { GuestCookieService } from '../services/guestCookie';

interface GameState {
  worldRules: Record<string, number>;
  history: Array<{
    id: string;
    timestamp: string;
    type: 'player' | 'npc' | 'system';
    content: string;
    character?: string;
  }>;
  currentTurn: number;
  currentChoices: Array<{
    id: string;
    label: string;
    description?: string;
  }>;
}

export default function UnifiedGamePage() {
  const { gameId, characterId } = useParams<{ gameId?: string; characterId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  
  const [gameState, setGameState] = useState<GameState>({
    worldRules: {},
    history: [],
    currentTurn: 0,
    currentChoices: []
  });
  const [isSubmittingTurn, setIsSubmittingTurn] = useState(false);
  const [turnError, setTurnError] = useState<string | null>(null);
  const [turnErrorCode, setTurnErrorCode] = useState<string | null>(null);
  const [gameStartTime, setGameStartTime] = useState<number | null>(null);
  const [hasTrackedFirstTurn, setHasTrackedFirstTurn] = useState(false);
  const [turnStartTime, setTurnStartTime] = useState<number | null>(null);
  
  const telemetry = useAdventureTelemetry();
  const gameTelemetry = useGameTelemetry();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load character data first if we have characterId but no gameId
  const { data: characterForGame, isLoading: isLoadingCharacterForGame } = useQuery({
    queryKey: ['character-for-game', characterId],
    queryFn: async () => {
      if (!characterId) throw new Error('No character ID provided');
      const result = await getCharacter(characterId);
      if (!result.ok) {
        throw new Error(result.error.message || 'Failed to load character');
      }
      return result.data;
    },
    enabled: !!characterId && !gameId,
    staleTime: 30 * 1000, // 30 seconds cache
    retry: 1,
  });

  // Determine the actual gameId to use
  const actualGameId = gameId || characterForGame?.activeGameId;

  // Note: Auto-initialization is now handled by the latest turn endpoint
  // No need for separate initialization state or logic

  // Load game data
  const { data: game, isLoading: isLoadingGame, error: gameError } = useQuery({
    queryKey: ['game', actualGameId],
    queryFn: async () => {
      if (!actualGameId) throw new Error('No game ID available');
      const result = await getGame(actualGameId);
      if (!result.ok) {
        throw new Error(result.error.message || 'Failed to load game');
      }
      return result.data;
    },
    enabled: !!actualGameId,
    refetchOnWindowFocus: false,
    staleTime: 30 * 1000,
    retry: 1,
  });

  // Load latest turn using React Query hook
  const { data: latestTurn, isLoading: isLoadingLatestTurn, error: latestTurnError } = useLatestTurn(actualGameId);

  // Character data is now included in the game response, no need for separate query
  const character = game ? {
    id: game.characterId,
    name: game.characterName,
    worldData: game.characterWorldData,
    level: game.characterLevel,
    currentHealth: game.characterCurrentHealth,
    maxHealth: game.characterMaxHealth,
    race: game.characterRace,
    class: game.characterClass,
  } : null;

  // Load world data
  const { data: worlds, isLoading: isLoadingWorlds } = useQuery({
    queryKey: ['content-worlds'],
    queryFn: async () => {
      const result = await getContentWorlds();
      if (!result.ok) {
        throw new Error(result.error.message || 'Failed to load worlds');
      }
      return result.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  // Load wallet data
  const { data: wallet } = useQuery({
    queryKey: ['wallet'],
    queryFn: async () => {
      const result = await getWallet();
      if (!result.ok) {
        throw new Error(result.error.message || 'Failed to load wallet');
      }
      return result.data;
    },
    staleTime: 10 * 1000, // 10 seconds cache
  });

  // Find current world
  const currentWorld = worlds?.find(w => w.slug === game?.worldSlug);

  // Handle navigation and game start time
  useEffect(() => {
    if (!user && !GuestCookieService.hasGuestCookie()) {
      navigate('/');
      return;
    }
    setGameStartTime(Date.now());
  }, [user, navigate]);

  // Track game loaded
  useEffect(() => {
    if (game && character && gameStartTime) {
      const loadTime = Date.now() - gameStartTime;
      gameTelemetry.trackGameLoaded(
        game.id,
        character.id,
        game.adventureSlug,
        loadTime
      );
    }
  }, [game, character, gameStartTime, gameTelemetry]);

  // Update game state when data changes
  useEffect(() => {
    if (game) {
      setGameState(prev => ({
        ...prev,
        currentTurn: game.turnCount
      }));

      // Initialize world rules if not set
      if (currentWorld && Object.keys(gameState.worldRules).length === 0) {
        const initialRules: Record<string, number> = {};
        // Initialize with default values - these would come from world config
        initialRules['magic'] = 50;
        initialRules['technology'] = 30;
        initialRules['nature'] = 70;
        setGameState(prev => ({
          ...prev,
          worldRules: initialRules
        }));
      }
    }
  }, [game, latestTurn, currentWorld, gameState.worldRules]);

  // Auto-scroll to bottom of history
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gameState.history]);

  // Update game state from latestTurn (TurnDTO)
  useEffect(() => {
    if (latestTurn) {
      setGameState(prev => ({
        ...prev,
        currentTurn: latestTurn.turnCount,
        currentChoices: latestTurn.choices || [],
        history: [
          ...prev.history.filter(h => h.id !== `turn-${latestTurn.id}`),
          {
            id: `turn-${latestTurn.id}`,
            timestamp: latestTurn.createdAt,
            type: 'npc' as const,
            content: latestTurn.narrative,
          },
        ],
      }));
    }
  }, [latestTurn]);

  // Submit turn mutation using React Query hook (new format: sends choice text directly)
  const postTurnMutation = usePostTurn(actualGameId);
  
  // Wrap mutation to track telemetry and update local state
  const submitTurnMutation = {
    ...postTurnMutation,
    mutate: (payload: { kind: 'choice' | 'text'; text: string }) => {
      setIsSubmittingTurn(true);
      setTurnError(null);
      setTurnErrorCode(null);
      setTurnStartTime(Date.now());
      
      // Track turn started
      gameTelemetry.trackTurnStarted(
        actualGameId!,
        character?.id || '',
        game?.adventureSlug || '',
        payload.text
      );
      
      postTurnMutation.mutate(payload, {
        onSuccess: (turnData) => {
          // Track turn completion
          if (turnStartTime) {
            const duration = Date.now() - turnStartTime;
            gameTelemetry.trackTurnCompleted(
              actualGameId!,
              character?.id || '',
              game?.adventureSlug || '',
              duration,
              turnData.turnCount
            );
          }

          // Track first turn
          if (!hasTrackedFirstTurn && gameStartTime) {
            const duration = Date.now() - gameStartTime;
            telemetry.trackTimeToFirstTurn(
              'existing',
              game?.characterId || '',
              game?.adventureSlug || '',
              duration
            );
            setHasTrackedFirstTurn(true);
          }

          // Add player choice to history
          setGameState(prev => ({
            ...prev,
            history: [
              ...prev.history,
              {
                id: `player-${Date.now()}`,
                timestamp: new Date().toISOString(),
                type: 'player' as const,
                content: payload.text,
                character: character?.name || 'You'
              }
            ]
          }));

          setIsSubmittingTurn(false);
          setTurnStartTime(null);
        },
        onError: (error: any) => {
          const errorCode = error.code || 'unknown_error';
          setTurnError(error.message);
          setTurnErrorCode(errorCode);
          
          gameTelemetry.trackTurnFailed(
            actualGameId!,
            character?.id || '',
            game?.adventureSlug || '',
            errorCode,
            'turn_submission'
          );
          
          setIsSubmittingTurn(false);
          setTurnStartTime(null);
        },
      });
    },
    isPending: postTurnMutation.isPending,
  };

  // Handler for choice selection (wired to ChoiceButtons component)
  // New format: sends choice text directly instead of choiceId
  const handleChoiceSelect = (choice: { id: string; label: string; description?: string }) => {
    if (isSubmittingTurn || submitTurnMutation.isPending) return;
    submitTurnMutation.mutate({ kind: 'choice', text: choice.label });
  };
  
  // Handler for text input (optional - may be removed if only using choices)
  const handleTurnSubmit = (action: string) => {
    if (isSubmittingTurn || submitTurnMutation.isPending) return;
    if (!action.trim()) {
      setTurnError('Text input cannot be empty');
      return;
    }
    submitTurnMutation.mutate({ kind: 'text', text: action.trim() });
  };

  const handleRetryTurn = () => {
    setTurnError(null);
    setTurnErrorCode(null);
    
    if (turnErrorCode) {
      gameTelemetry.trackRetryAttempted(
        gameId!,
        character?.id || '',
        game?.adventureSlug || '',
        turnErrorCode
      );
    }
  };

  const handleGoToWallet = () => {
    navigate('/wallet');
  };

  const handleGoToHelp = () => {
    // Could navigate to help page or open help modal
    window.open('/help', '_blank');
  };

  // Loading states
  if (isLoadingGame || isLoadingWorlds || isLoadingCharacterForGame) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Breadcrumbs />
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-6 md:grid-cols-3">
            <div className="md:col-span-2 space-y-4">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error states
  if (gameError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Breadcrumbs />
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load game: {gameError.message}
          </AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button onClick={() => navigate('/worlds')}>
            Back to Worlds
          </Button>
        </div>
      </div>
    );
  }

  // Handle case where character has no active game
  if (characterId && characterForGame && !characterForGame.activeGameId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Breadcrumbs />
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This character is not currently in an active game. Please start a new adventure.
          </AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button onClick={() => navigate('/worlds')}>
            Start New Adventure
          </Button>
        </div>
      </div>
    );
  }

  if (!game || !character || !currentWorld) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Breadcrumbs />
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Game data not found. Please try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumbs />
      
      {/* Game Header */}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{game.adventureTitle}</h1>
            <p className="text-muted-foreground">
              Playing as {character.name} in {currentWorld.title}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="outline">
              Turn {gameState.currentTurn}
            </Badge>
            {wallet && (
              <div className="flex items-center gap-2">
                <Gem className="h-4 w-4" />
                <span className="font-medium">{wallet.balance || 0}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error Handler */}
      {turnError && (
        <div className="mb-6">
          <TurnErrorHandler
            error={turnError}
            errorCode={turnErrorCode || undefined}
            onRetry={handleRetryTurn}
            onGoToWallet={handleGoToWallet}
            onGoToHelp={handleGoToHelp}
            isRetrying={isSubmittingTurn}
          />
        </div>
      )}

      {/* Main Game Layout */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Story and Choices - Main Content */}
        <div className="md:col-span-2 space-y-6">
          {/* Story History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>Story</span>
                {isSubmittingTurn && (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Render narrative from latest turn */}
              {isLoadingLatestTurn ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : latestTurn ? (
                <div className="prose prose-sm max-w-none">
                  {/* Show warning if narrative is empty or fallback was used */}
                  {latestTurn.narrative.length === 0 || latestTurn.meta?.warnings?.includes('AI_EMPTY_NARRATIVE') ? (
                    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                      <strong>Note:</strong> The narrative is temporarily unavailable, but you can still make choices to continue.
                    </div>
                  ) : null}
                  <p>{latestTurn.narrative}</p>
                </div>
              ) : latestTurnError ? (
                <div className="text-muted-foreground">Failed to load story. Please try again.</div>
              ) : (
                <div className="text-muted-foreground">No story available yet.</div>
              )}
              <div ref={messagesEndRef} />
            </CardContent>
          </Card>

          {/* AI-Generated Choices - render from latestTurn */}
          {isLoadingLatestTurn ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : latestTurn?.choices && latestTurn.choices.length > 0 ? (
            <ChoiceButtons
              choices={latestTurn.choices.map(c => ({ id: c.id, label: c.label }))}
              onChoiceSelect={handleChoiceSelect}
              disabled={isSubmittingTurn || submitTurnMutation.isPending}
            />
          ) : latestTurnError ? (
            <div className="text-muted-foreground">Failed to load choices. Please try again.</div>
          ) : (
            <div className="text-muted-foreground">No choices available yet.</div>
          )}

          {/* Turn Input */}
          <Card>
            <CardHeader>
              <CardTitle>Your Action</CardTitle>
            </CardHeader>
            <CardContent>
              <TurnInput
                onSubmit={handleTurnSubmit}
                disabled={isSubmittingTurn}
                placeholder="What do you do?"
                stoneCost={1}
                hasChoices={gameState.currentChoices.length > 0}
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Character, World Rules, etc. */}
        <div className="space-y-6">
          {/* Character Info */}
          <Card>
            <CardHeader>
              <CardTitle>Character</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="font-medium">{character.name}</div>
                <div className="text-sm text-muted-foreground">
                  {character.worldData?.class || 'Adventurer'}
                </div>
                {character.worldData?.faction_alignment && (
                  <Badge variant="secondary" className="text-xs">
                    {character.worldData.faction_alignment}
                  </Badge>
                )}
                {/* Show skills for PlayerV3 characters */}
                {character.worldData?.playerV3?.skills && (
                  <div className="mt-2">
                    <div className="text-xs text-muted-foreground mb-1">Skills</div>
                    <div className="space-y-1">
                      {Object.entries(character.worldData.playerV3.skills).slice(0, 3).map(([skill, value]) => {
                        const skillValue = typeof value === 'number' ? value : 0;
                        return (
                          <div key={skill} className="flex items-center justify-between text-xs">
                            <span className="capitalize">{skill.replace('_', ' ')}</span>
                            <div className="flex items-center gap-1">
                              <div className="w-12 bg-muted rounded-full h-1">
                                <div 
                                  className="bg-primary h-1 rounded-full"
                                  style={{ width: `${skillValue}%` }}
                                />
                              </div>
                              <span className="text-muted-foreground">{skillValue}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* World Rules */}
          {currentWorld && (
            <Card>
              <CardHeader>
                <CardTitle>World Rules</CardTitle>
              </CardHeader>
              <CardContent>
                <WorldRuleMeters 
                  rules={[]}
                />
              </CardContent>
            </Card>
          )}

          {/* Stone Balance */}
          {wallet && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gem className="h-4 w-4" />
                  Casting Stones
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {wallet.balance || 0}
                </div>
                <div className="text-sm text-muted-foreground">
                  Available for actions
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
