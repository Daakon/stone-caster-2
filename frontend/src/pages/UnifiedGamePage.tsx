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
import { Breadcrumbs } from '../components/layout/Breadcrumbs';
import { Gem, RefreshCw, AlertCircle } from 'lucide-react';
import { 
  getGame, 
  submitTurn, 
  getCharacter, 
  getContentWorlds,
  getWallet,
  getGameTurns,
  autoInitializeGame
} from '../lib/api';
import { generateIdempotencyKey, generateOptionId } from '../utils/idempotency';
import { useAdventureTelemetry } from '../hooks/useAdventureTelemetry';
import { useGameTelemetry } from '../hooks/useGameTelemetry';
import type { TurnDTO } from '@shared';
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
}

export default function UnifiedGamePage() {
  const { gameId, characterId } = useParams<{ gameId?: string; characterId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  
  const [gameState, setGameState] = useState<GameState>({
    worldRules: {},
    history: [],
    currentTurn: 0
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

  // Game initialization state - use sessionStorage to prevent duplicate calls across page refreshes
  const [hasInitializedGame, setHasInitializedGame] = useState(() => {
    if (typeof window !== 'undefined' && actualGameId) {
      return sessionStorage.getItem(`game-${actualGameId}-initialized`) === 'true';
    }
    return false;
  });
  const [isAutoInitializing, setIsAutoInitializing] = useState(false);
  const [autoInitAttempted, setAutoInitAttempted] = useState(false);
  const autoInitCalledRef = useRef(false);
  
  // Add a more robust check using sessionStorage for the actual call
  const getAutoInitKey = (gameId: string) => `auto-init-${gameId}`;
  const isAutoInitInProgress = (gameId: string) => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem(getAutoInitKey(gameId)) === 'true';
  };
  const setAutoInitInProgress = (gameId: string, inProgress: boolean) => {
    if (typeof window === 'undefined') return;
    if (inProgress) {
      sessionStorage.setItem(getAutoInitKey(gameId), 'true');
    } else {
      sessionStorage.removeItem(getAutoInitKey(gameId));
    }
  };

  // Clear sessionStorage flags on component mount to start fresh
  useEffect(() => {
    if (actualGameId && typeof window !== 'undefined') {
      console.log('UnifiedGamePage: Clearing sessionStorage flags for fresh start');
      sessionStorage.removeItem(`game-${actualGameId}-initialized`);
      sessionStorage.removeItem(getAutoInitKey(actualGameId));
      // Reset state flags too
      setHasInitializedGame(false);
      setIsAutoInitializing(false);
      setAutoInitAttempted(false);
      autoInitCalledRef.current = false;
    }
  }, [actualGameId]);

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
    staleTime: 30 * 1000, // 30 seconds cache
    retry: 1,
  });

  // Load game turns
  const { data: gameTurns } = useQuery({
    queryKey: ['game-turns', actualGameId],
    queryFn: async () => {
      if (!actualGameId) throw new Error('No game ID available');
      const result = await getGameTurns(actualGameId);
      if (!result.ok) {
        throw new Error(result.error.message || 'Failed to load game turns');
      }
      return result.data;
    },
    enabled: !!actualGameId,
    staleTime: 5 * 60 * 1000, // 5 minutes cache for game turns
    retry: 1,
  });

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

      // Check if game needs initialization (turn count is 0, no existing turns, and not already initialized)
      const hasExistingTurns = gameTurns && gameTurns.length > 0;
      const shouldAutoInit = game.turnCount === 0 && 
                            !hasExistingTurns &&
                            !hasInitializedGame && 
                            !isAutoInitializing && 
                            !autoInitAttempted && 
                            !autoInitCalledRef.current &&
                            !isAutoInitInProgress(actualGameId);
      
      console.log('UnifiedGamePage: Auto-initialization check:', {
        turnCount: game.turnCount,
        hasExistingTurns,
        gameTurnsLength: gameTurns?.length || 0,
        hasInitializedGame,
        isAutoInitializing,
        autoInitAttempted,
        autoInitCalledRef: autoInitCalledRef.current,
        isAutoInitInProgress: isAutoInitInProgress(actualGameId),
        shouldAutoInit,
        gameId: actualGameId,
        sessionStorage: {
          initialized: typeof window !== 'undefined' ? sessionStorage.getItem(`game-${actualGameId}-initialized`) : 'N/A',
          inProgress: typeof window !== 'undefined' ? sessionStorage.getItem(getAutoInitKey(actualGameId)) : 'N/A'
        }
      });
      
      if (shouldAutoInit) {
        console.log('UnifiedGamePage: Game has turnCount: 0, triggering auto-initialization...');
        console.log('UnifiedGamePage: Game data:', game);
        console.log('UnifiedGamePage: Setting auto-init flags...');
        
        // Set all flags immediately to prevent duplicate calls
        autoInitCalledRef.current = true;
        setAutoInitInProgress(actualGameId, true);
        setHasInitializedGame(true);
        setIsAutoInitializing(true);
        setAutoInitAttempted(true);
        
        handleAutoInitialize();
      }

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
  }, [game, gameTurns, currentWorld, gameState.worldRules]);

  // Auto-scroll to bottom of history
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gameState.history]);

  // Auto-initialize game with 0 turns
  const handleAutoInitialize = async () => {
    if (!actualGameId) {
      console.log('No gameId available for auto-initialization');
      return;
    }
    
    if (isAutoInitializing) {
      console.log('Auto-initialization already in progress');
      return;
    }
    
    try {
      console.log(`UnifiedGamePage: Auto-initializing game ${actualGameId} with 0 turns...`);
      const result = await autoInitializeGame(actualGameId);
      
      if (result.ok) {
        console.log('Game auto-initialized successfully:', result.data);
        
        // Log full prompt and AI response details if available
        if (result.data.details) {
          console.log('=== AUTO-INITIALIZATION DETAILS ===');
          console.log('Full Prompt:', result.data.details.prompt);
          console.log('AI Response:', result.data.details.aiResponse);
          console.log('Transformed Response:', result.data.details.transformedResponse);
          console.log('Timestamp:', result.data.details.timestamp);
          console.log('Cached:', result.data.details.cached || false);
          console.log('=====================================');
        }
        
        // Mark as initialized in sessionStorage to prevent duplicate calls
        if (typeof window !== 'undefined' && actualGameId) {
          sessionStorage.setItem(`game-${actualGameId}-initialized`, 'true');
        }
        // Clear the in-progress flag
        setAutoInitInProgress(actualGameId, false);
        // Refresh game turns to get the initial prompt result
        queryClient.invalidateQueries({ queryKey: ['game-turns', actualGameId] });
        // Refresh game data to get updated turn count
        queryClient.invalidateQueries({ queryKey: ['game', actualGameId] });
      } else {
        console.error('Failed to auto-initialize game:', result.error);
        console.error('Error details:', result.error.details);
        setTurnError('Failed to initialize game. Please try again.');
        // Clear the in-progress flag on error too
        setAutoInitInProgress(actualGameId, false);
      }
    } catch (error) {
      console.error('Error auto-initializing game:', error);
      setTurnError('Failed to initialize game. Please try again.');
      // Clear the in-progress flag on error too
      setAutoInitInProgress(actualGameId, false);
    } finally {
      setIsAutoInitializing(false);
    }
  };

  // Turn submission mutation
  const submitTurnMutation = useMutation({
    mutationFn: async (optionId: string): Promise<TurnDTO> => {
      if (!gameId) throw new Error('No game ID');
      const idempotencyKey = generateIdempotencyKey();
      const result = await submitTurn(gameId, optionId, idempotencyKey);
      if (!result.ok) {
        const error = new Error(result.error.message || 'Failed to submit turn');
        (error as any).code = result.error.code;
        throw error;
      }
      return result.data as TurnDTO;
    },
    onSuccess: (turnData: TurnDTO) => {
      // Track turn completion
      if (turnStartTime) {
        const duration = Date.now() - turnStartTime;
        gameTelemetry.trackTurnCompleted(
          gameId!,
          character?.id || '',
          game?.adventureSlug || '',
          duration,
          gameState.currentTurn + 1
        );
      }

      // Track first turn
      if (!hasTrackedFirstTurn && gameStartTime) {
        const duration = Date.now() - gameStartTime;
        telemetry.trackTimeToFirstTurn(
          'existing', // characterType
          game?.characterId || '',
          game?.adventureSlug || '',
          duration
        );
        setHasTrackedFirstTurn(true);
      }

      // Update game state with new turn data
      setGameState(prev => ({
        ...prev,
        currentTurn: prev.currentTurn + 1,
        history: [
          ...prev.history,
          {
            id: turnData.id,
            timestamp: turnData.createdAt,
            type: 'npc',
            content: turnData.narrative,
          }
        ]
      }));

      // Invalidate and refetch game data
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      
      setTurnError(null);
      setTurnErrorCode(null);
    },
    onError: (error: any) => {
      const errorCode = error.code || 'unknown_error';
      setTurnError(error.message);
      setTurnErrorCode(errorCode);
      
      gameTelemetry.trackTurnFailed(
        gameId!,
        character?.id || '',
        game?.adventureSlug || '',
        errorCode,
        'turn_submission'
      );
    },
    onSettled: () => {
      setIsSubmittingTurn(false);
      setTurnStartTime(null);
    }
  });

  const handleTurnSubmit = async (action: string) => {
    if (!action.trim() || isSubmittingTurn) return;
    
    setIsSubmittingTurn(true);
    setTurnError(null);
    setTurnErrorCode(null);
    setTurnStartTime(Date.now());

    // Track turn started
    gameTelemetry.trackTurnStarted(
      gameId!,
      character?.id || '',
      game?.adventureSlug || '',
      action
    );

    // Add player action to history immediately
    const optionId = generateOptionId(action);
    setGameState(prev => ({
      ...prev,
      history: [
        ...prev.history,
        {
          id: `player-${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: 'player',
          content: action,
          character: character?.name || 'You'
        }
      ]
    }));

    // Submit turn
    submitTurnMutation.mutate(optionId);
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
              <HistoryFeed 
                history={gameState.history}
              />
              <div ref={messagesEndRef} />
            </CardContent>
          </Card>

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
