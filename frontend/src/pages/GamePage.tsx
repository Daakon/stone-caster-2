import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { StoneCost } from '../components/gameplay/StoneCost';
import { WorldRuleMeters } from '../components/gameplay/WorldRuleMeters';
import { TurnInput } from '../components/gameplay/TurnInput';
import { HistoryFeed } from '../components/gameplay/HistoryFeed';
import { Breadcrumbs } from '../components/layout/Breadcrumbs';
import { Gem, Settings, Save } from 'lucide-react';
import { submitTurn, getGame, getStoryById, getCharacter, getWorldById, getWallet, getGameTurns, autoInitializeGame } from '../lib/api';
import { generateIdempotencyKey, generateOptionId } from '../utils/idempotency';
import { useAdventureTelemetry } from '../hooks/useAdventureTelemetry';
import { useDebugPanel } from '../hooks/useDebugPanel';
import { DebugPanel } from '../components/debug/DebugPanel';
// PromptApprovalModal removed - not needed with new backend system
import type { TurnDTO, GameDTO } from '@shared';

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

export default function GamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [adventure, setAdventure] = useState<any | null>(null);
  const [world, setWorld] = useState<any | null>(null);
  const [character, setCharacter] = useState<any | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    worldRules: {},
    history: [],
    currentTurn: 0
  });
  const [wallet, setWallet] = useState<any | null>(null);
  const [isInvited] = useState(true); // For now, assume all users are invited
  const [isSubmittingTurn, setIsSubmittingTurn] = useState(false);
  const [turnError, setTurnError] = useState<string | null>(null);
  const [game, setGame] = useState<GameDTO | null>(null);
  const [gameStartTime, setGameStartTime] = useState<number | null>(null);
  const [hasTrackedFirstTurn, setHasTrackedFirstTurn] = useState(false);
  
  const telemetry = useAdventureTelemetry();
  const debugPanel = useDebugPanel();
  const [gameErrorState, setGameErrorState] = useState<string | null>(null);
  
  // Game initialization state - use sessionStorage to prevent duplicate calls across page refreshes
  const [hasInitializedGame, setHasInitializedGame] = useState(() => {
    if (typeof window !== 'undefined' && gameId) {
      return sessionStorage.getItem(`game-${gameId}-initialized`) === 'true';
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
    if (gameId && typeof window !== 'undefined') {
      console.log('GamePage: Clearing sessionStorage flags for fresh start');
      sessionStorage.removeItem(`game-${gameId}-initialized`);
      sessionStorage.removeItem(getAutoInitKey(gameId));
      // Reset state flags too
      setHasInitializedGame(false);
      setIsAutoInitializing(false);
      setAutoInitAttempted(false);
      autoInitCalledRef.current = false;
    }
  }, [gameId]);

  // Use React Query to load game data (prevents duplicate calls in StrictMode)
  const { data: gameData, isLoading: isLoadingGame, error: gameError } = useQuery({
    queryKey: ['game', gameId],
    queryFn: async () => {
      if (!gameId) throw new Error('No game ID provided');
      console.log(`[GamePage] React Query: Loading game data for ID: ${gameId}`);
      const result = await getGame(gameId);
      if (!result.ok) {
        throw new Error(result.error.message || 'Failed to load game');
      }
      return result.data;
    },
    enabled: !!gameId && !!isInvited,
    staleTime: 30 * 1000, // 30 seconds cache for game data
    retry: 1,
  });

  // Load adventure data
  const { data: adventureData, isLoading: isLoadingAdventure } = useQuery({
    queryKey: ['adventure', gameData?.adventureId],
    queryFn: async () => {
      if (!gameData?.adventureId) throw new Error('No adventure ID provided');
      const result = await getStoryById(gameData.adventureId);
      if (!result.ok) {
        throw new Error(result.error.message || 'Failed to load adventure');
      }
      return result.data;
    },
    enabled: !!gameData?.adventureId,
    staleTime: 5 * 60 * 1000, // 5 minutes cache for adventure data
    retry: 1,
  });

  // Load character data (if characterId exists)
  const { data: characterData, isLoading: isLoadingCharacter } = useQuery({
    queryKey: ['character', gameData?.characterId],
    queryFn: async () => {
      if (!gameData?.characterId) throw new Error('No character ID provided');
      const result = await getCharacter(gameData.characterId);
      if (!result.ok) {
        throw new Error(result.error.message || 'Failed to load character');
      }
      return result.data;
    },
    enabled: !!gameData?.characterId,
    staleTime: 5 * 60 * 1000, // 5 minutes cache for character data
    retry: 1,
  });

  // Load world data
  const { data: worldData, isLoading: isLoadingWorld } = useQuery({
    queryKey: ['world', adventureData?.worldId],
    queryFn: async () => {
      if (!adventureData?.worldId) throw new Error('No world ID provided');
      const result = await getWorldById(adventureData.worldId);
      if (!result.ok) {
        throw new Error(result.error.message || 'Failed to load world');
      }
      return result.data;
    },
    enabled: !!adventureData?.worldId,
    staleTime: 5 * 60 * 1000, // 5 minutes cache for world data
    retry: 1,
  });

  // Load wallet data
  const { data: walletData, isLoading: isLoadingWallet } = useQuery({
    queryKey: ['wallet'],
    queryFn: async () => {
      const result = await getWallet();
      if (!result.ok) {
        throw new Error(result.error.message || 'Failed to load wallet');
      }
      return result.data;
    },
    staleTime: 30 * 1000, // 30 seconds cache for wallet data
    retry: 1,
  });

  // Load game turns
  const { data: gameTurns } = useQuery({
    queryKey: ['game-turns', gameId],
    queryFn: async () => {
      if (!gameId) throw new Error('No game ID provided');
      const result = await getGameTurns(gameId);
      if (!result.ok) {
        throw new Error(result.error.message || 'Failed to load game turns');
      }
      return result.data;
    },
    enabled: !!gameId,
    staleTime: 5 * 60 * 1000, // 5 minutes cache for game turns
    retry: 1,
  });

  // Handle navigation and game start time
  useEffect(() => {
    if (!isInvited) {
      navigate('/');
      return;
    }
    setGameStartTime(Date.now());
  }, [isInvited, navigate]);

  // Update game state when data changes
  useEffect(() => {
    if (gameData) {
      setGame(gameData);
      setGameState(prev => ({
        ...prev,
        currentTurn: gameData.turnCount
      }));
      
      // Check if game needs initialization (turn count is 0, no existing turns, and not already initialized)
      const hasExistingTurns = gameTurns && gameTurns.length > 0;
      const shouldAutoInit = gameData.turnCount === 0 && 
                            !hasExistingTurns &&
                            !hasInitializedGame && 
                            !isAutoInitializing && 
                            !autoInitAttempted && 
                            !autoInitCalledRef.current &&
                            gameId && !isAutoInitInProgress(gameId);
      
      console.log('GamePage: Auto-initialization check:', {
        turnCount: gameData.turnCount,
        hasExistingTurns,
        gameTurnsLength: gameTurns?.length || 0,
        hasInitializedGame,
        isAutoInitializing,
        autoInitAttempted,
        autoInitCalledRef: autoInitCalledRef.current,
        isAutoInitInProgress: gameId ? isAutoInitInProgress(gameId) : false,
        shouldAutoInit,
        gameId: gameId,
        sessionStorage: {
          initialized: typeof window !== 'undefined' && gameId ? sessionStorage.getItem(`game-${gameId}-initialized`) : 'N/A',
          inProgress: typeof window !== 'undefined' && gameId ? sessionStorage.getItem(getAutoInitKey(gameId)) : 'N/A'
        }
      });
      
      if (shouldAutoInit && gameId) {
        console.log('GamePage: Game has turnCount: 0, triggering auto-initialization...');
        console.log('GamePage: Game data:', gameData);
        console.log('GamePage: Setting auto-init flags...');
        
        // Set all flags immediately to prevent duplicate calls
        autoInitCalledRef.current = true;
        setAutoInitInProgress(gameId, true);
        setHasInitializedGame(true);
        setIsAutoInitializing(true);
        setAutoInitAttempted(true);
        
        handleAutoInitialize();
      }
    }
  }, [gameData, gameTurns]);

  // Update adventure, character, world, and wallet state when data changes
  useEffect(() => {
    if (adventureData) {
      setAdventure(adventureData);
    }
  }, [adventureData]);

  useEffect(() => {
    if (characterData) {
      setCharacter(characterData);
    }
  }, [characterData]);

  useEffect(() => {
    if (worldData) {
      setWorld(worldData);
      
      // Initialize world rules if not set
      if (worldData.rules && Object.keys(gameState.worldRules).length === 0) {
        const initialRules: Record<string, number> = {};
        worldData.rules.forEach((rule: any) => {
          initialRules[rule.id] = rule.current || rule.default || 0;
        });
        setGameState(prev => ({
          ...prev,
          worldRules: initialRules
        }));
      }
    }
  }, [worldData, gameState.worldRules]);

  useEffect(() => {
    if (walletData) {
      setWallet(walletData);
    }
  }, [walletData]);

  // Load game turns into history
  useEffect(() => {
    if (gameTurns && gameTurns.length > 0) {
      const history = gameTurns.map((turn: any) => ({
        id: turn.id,
        timestamp: turn.created_at,
        type: 'system' as const,
        content: turn.ai_response?.narrative || 'Turn completed',
        character: turn.ai_response?.character || undefined,
      }));
      
      setGameState(prev => ({
        ...prev,
        history: history
      }));
    }
  }, [gameTurns]);

  // Handle game error
  useEffect(() => {
    if (gameError) {
      setGameErrorState(gameError.message);
    }
  }, [gameError]);

  const handleTurnSubmit = async (action: string) => {
    if (!adventure || !character || !gameId || isSubmittingTurn) return;

    setIsSubmittingTurn(true);
    setTurnError(null);

    try {
      // Generate idempotency key and option ID
      const idempotencyKey = generateIdempotencyKey();
      const optionId = generateOptionId(action);

      // Submit turn to Layer M3 turn engine
      const result = await submitTurn<TurnDTO>(gameId, optionId, idempotencyKey);

      if (!result.ok) {
        // Handle specific error cases
        switch (result.error.code) {
          case 'INSUFFICIENT_STONES':
            setTurnError('Not enough casting stones to take this turn.');
            break;
          case 'IDEMPOTENCY_REQUIRED':
            setTurnError('Turn submission requires an idempotency key.');
            break;
          case 'VALIDATION_FAILED':
            setTurnError('The AI response was invalid. Please try again.');
            break;
          case 'UPSTREAM_TIMEOUT':
            setTurnError('The AI service timed out. Please try again.');
            break;
          case 'NOT_FOUND':
            setTurnError('Game not found. Please refresh the page.');
            break;
          case 'FORBIDDEN':
            setTurnError('You do not have permission to take turns in this game.');
            break;
          default:
            setTurnError(result.error.message || 'Failed to submit turn. Please try again.');
        }
        return;
      }

      const turnDTO = result.data;

      // Track time to first turn if this is the first turn
      if (!hasTrackedFirstTurn && gameStartTime && game) {
        const duration = Date.now() - gameStartTime;
        await telemetry.trackTimeToFirstTurn(
          'existing', // We don't know the character type here, so default to existing
          character.id,
          game.adventureId || 'unknown',
          duration
        );
        setHasTrackedFirstTurn(true);
      }

      // Refresh game turns from database instead of manually managing history
      queryClient.invalidateQueries({ queryKey: ['game-turns', gameId] });
      
      // Update turn count
      setGameState(prev => ({
        ...prev,
        currentTurn: turnDTO.turnCount
      }));

      // Update wallet balance from the response
      setWallet((prev: any) => ({
        ...prev,
        balance: turnDTO.castingStonesBalance
      }));

      // Update world rules if there are relationship/faction deltas
      if (turnDTO.relationshipDeltas || turnDTO.factionDeltas) {
        setGameState(prev => ({
          ...prev,
          worldRules: {
            ...prev.worldRules,
            ...turnDTO.relationshipDeltas,
            ...turnDTO.factionDeltas
          }
        }));
      }

      // Game state is now managed by database-driven history loading

    } catch (error) {
      console.error('Turn submission error:', error);
      setTurnError('Network error. Please check your connection and try again.');
    } finally {
      setIsSubmittingTurn(false);
    }
  };

  const handleSaveGame = () => {
    // In a real implementation, this would save to the backend
    alert('Game saved!');
  };

  // Auto-initialize game with 0 turns
  const handleAutoInitialize = async () => {
    if (!gameId) {
      console.log('No gameId available for auto-initialization');
      return;
    }
    
    if (isAutoInitializing) {
      console.log('Auto-initialization already in progress');
      return;
    }
    
    try {
      console.log(`Auto-initializing game ${gameId} with 0 turns...`);
      const result = await autoInitializeGame(gameId);
      
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
        if (typeof window !== 'undefined' && gameId) {
          sessionStorage.setItem(`game-${gameId}-initialized`, 'true');
        }
        // Clear the in-progress flag
        setAutoInitInProgress(gameId, false);
        // Refresh game turns to get the initial prompt result
        queryClient.invalidateQueries({ queryKey: ['game-turns', gameId] });
        // Refresh game data to get updated turn count
        queryClient.invalidateQueries({ queryKey: ['game', gameId] });
      } else {
        console.error('Failed to auto-initialize game:', result.error);
        console.error('Error details:', result.error.details);
        setGameErrorState('Failed to initialize game. Please try again.');
        // Clear the in-progress flag on error too
        setAutoInitInProgress(gameId, false);
      }
    } catch (error) {
      console.error('Error auto-initializing game:', error);
      setGameErrorState('Failed to initialize game. Please try again.');
      // Clear the in-progress flag on error too
      setAutoInitInProgress(gameId, false);
    } finally {
      setIsAutoInitializing(false);
    }
  };

  // handleGameInitialization removed - initial prompts are now handled automatically by the backend

  // handlePromptApproval removed - not needed with new backend system

  if (!isInvited) {
    return null; // Will redirect
  }

  if (isLoadingGame || isAutoInitializing) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <Breadcrumbs />
          
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <Skeleton className="h-6 w-48 mb-2" />
                <Skeleton className="h-4 w-64" />
              </div>
              <div className="flex items-center gap-4">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-8" />
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-3/4" />
                </CardContent>
              </Card>
            </div>
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (gameErrorState) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2">Game Not Found</h2>
          <p className="text-muted-foreground mb-4">{gameErrorState}</p>
          <Button onClick={() => navigate('/adventures')}>
            Back to Adventures
          </Button>
        </div>
      </div>
    );
  }

  // Show loading state if any critical data is still loading
  if (isLoadingAdventure || isLoadingWorld || (gameData?.characterId && isLoadingCharacter) || isLoadingWallet) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <Breadcrumbs />
          
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <Skeleton className="h-6 w-48 mb-2" />
                <Skeleton className="h-4 w-64" />
              </div>
              <div className="flex items-center gap-4">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-8" />
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-3/4" />
                </CardContent>
              </Card>
            </div>
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show error if critical data is missing after loading
  if (!game || !adventure || !world) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2">Missing Game Data</h2>
          <p className="text-muted-foreground mb-4">Unable to load required game information.</p>
          <Button onClick={() => navigate('/adventures')}>
            Back to Adventures
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Game Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Breadcrumbs />
        
        {/* Game Header Info */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">{adventure.title}</h1>
              <p className="text-sm text-muted-foreground">
                Playing as {character?.name || 'Guest'} in {world.title}
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Gem className="h-4 w-4 text-primary" />
                <span className="font-medium">{wallet?.balance || 0}</span>
                <span className="text-sm text-muted-foreground">stones</span>
              </div>
              <Button variant="outline" size="sm" onClick={handleSaveGame}>
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Game Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Adventure Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <img
                    src={adventure.cover || '/images/adventures/default.jpg'}
                    alt={adventure.title}
                    className="w-12 h-12 rounded object-cover"
                  />
                  <div>
                    <div>{adventure.title}</div>
                    <div className="text-sm font-normal text-muted-foreground">
                      {adventure.excerpt || adventure.description}
                    </div>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Badge variant="secondary">{adventure.difficulty || 'medium'}</Badge>
                  <StoneCost cost={adventure.stoneCost || 5} />
                  <span className="text-sm text-muted-foreground">
                    Turn {gameState.currentTurn}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Turn Input */}
            <Card>
              <CardHeader>
                <CardTitle>Your Turn</CardTitle>
              </CardHeader>
              <CardContent>
                {turnError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-600">{turnError}</p>
                  </div>
                )}
                <TurnInput
                  onSubmit={handleTurnSubmit}
                  stoneCost={1}
                  disabled={(wallet?.balance || 0) < 1 || isSubmittingTurn}
                  placeholder={isSubmittingTurn ? "Processing your turn..." : "Describe your action..."}
                />
              </CardContent>
            </Card>

            {/* Game History */}
            <HistoryFeed
              history={gameState.history}
              className="h-96"
            />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* World Rules */}
            {world.rules && world.rules.length > 0 && (
              <WorldRuleMeters
                rules={world.rules.map((rule: any) => ({
                  ...rule,
                  current: gameState.worldRules[rule.id] || rule.current
                }))}
              />
            )}

            {/* Character Info */}
            {character && (
              <Card>
                <CardHeader>
                  <CardTitle>Character</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={`/images/avatars/${character.avatar || 'default'}.jpg`}
                        alt={character.name}
                        className="w-12 h-12 rounded object-cover"
                      />
                      <div>
                        <div className="font-medium">{character.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {world.title}
                        </div>
                      </div>
                    </div>
                    {character.backstory && (
                      <p className="text-sm text-muted-foreground">
                        {character.backstory}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* World Info */}
            <Card>
              <CardHeader>
                <CardTitle>World</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <h4 className="font-medium">{world.title}</h4>
                    <p className="text-sm text-muted-foreground">{world.tagline}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(world.tags || []).slice(0, 3).map((tag: any) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      
      {/* Debug Panel */}
      <DebugPanel 
        gameId={gameId} 
        isVisible={debugPanel.isVisible} 
        onToggle={debugPanel.toggle} 
      />
      
      {/* Prompt Approval Modal removed - not needed with new backend system */}
    </div>
  );
}
