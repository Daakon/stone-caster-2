import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { StoneCost } from '../components/gameplay/StoneCost';
import { WorldRuleMeters } from '../components/gameplay/WorldRuleMeters';
import { TurnInput } from '../components/gameplay/TurnInput';
import { HistoryFeed } from '../components/gameplay/HistoryFeed';
import { TurnsList } from '../components/gameplay/TurnsList'; // Phase 5: Paginated turns
import { DebugDrawer } from '../components/debug/DebugDrawer';
import { debugStore } from '../lib/debugStore';
import { Breadcrumbs } from '../components/layout/Breadcrumbs';
import { Gem, Settings, Save } from 'lucide-react';
import { submitTurn, sendTurn, getGame, getStoryById, getCharacter, getWorldById, getGameTurns, autoInitializeGame } from '../lib/api';
import { useWalletContext } from '../providers/WalletProvider';
import { generateIdempotencyKey, generateOptionId } from '../utils/idempotency';
import { generateIdempotencyKeyV4 } from '../lib/idempotency';
import { useAdventureTelemetry } from '../hooks/useAdventureTelemetry';
import { useDebugPanel } from '../hooks/useDebugPanel';
import { DebugPanel } from '../components/debug/DebugPanel';
import { useDebugResponses } from '../lib/debug';
import { makeTitle } from '../lib/meta';
// PromptApprovalModal removed - not needed with new backend system
import type { TurnDTO, GameDTO } from '@shared';
import type { Turn } from '../lib/types';

// Phase 8: Simple toast fallback (replace with proper toast hook if available)
const useToast = () => {
  return {
    toast: (options: { title: string; description?: string; variant?: 'default' | 'destructive' }) => {
      if (options.variant === 'destructive') {
        console.error(`[Toast] ${options.title}: ${options.description || ''}`);
      } else {
        console.log(`[Toast] ${options.title}: ${options.description || ''}`);
      }
    },
  };
};

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
  const debugResponses = useDebugResponses();
  const [debugDrawerOpen, setDebugDrawerOpen] = useState(false);
  const [gameErrorState, setGameErrorState] = useState<string | null>(null);
  const { toast } = useToast(); // Phase 8: Toast notifications
  
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

  // Set document title
  useEffect(() => {
    document.title = makeTitle(['Game', 'Stone Caster']);
  }, []);

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

  // Load wallet data - use WalletProvider context instead of duplicate query
  // Wallet is already fetched in WalletProvider at layout level
  const { wallet: walletData, isLoading: isLoadingWallet } = useWalletContext();

  // Phase 5: Load game turns with pagination (using new API)
  // Note: Keeping gameTurns query for legacy compatibility, but we'll use TurnsList component
  // which handles its own pagination

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
      
      // Phase 5: Check if game needs initialization (turn count is 0, and not already initialized)
      // Note: TurnsList will fetch turns independently, so we can't check hasExistingTurns here
      // We'll rely on turnCount === 0 as the indicator
      const shouldAutoInit = gameData.turnCount === 0 && 
                            !hasInitializedGame && 
                            !isAutoInitializing && 
                            !autoInitAttempted && 
                            !autoInitCalledRef.current &&
                            gameId && !isAutoInitInProgress(gameId);
      
      console.log('GamePage: Auto-initialization check:', {
        turnCount: gameData.turnCount,
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

  // Phase 5: TurnsList component handles its own data fetching and display
  // Legacy history mapping removed - TurnsList fetches paginated turns directly

  // Handle game error
  useEffect(() => {
    if (gameError) {
      setGameErrorState(gameError.message);
    }
  }, [gameError]);

  // Phase 8: Track optimistic turns for rollback
  const [optimisticTurns, setOptimisticTurns] = useState<Turn[]>([]);
  const [turnsRefreshKey, setTurnsRefreshKey] = useState(0); // Trigger TurnsList refetch

  const handleTurnSubmit = async (action: string) => {
    if (!gameId || isSubmittingTurn) return;

    setIsSubmittingTurn(true);
    setTurnError(null);

    // Phase 8: Generate idempotency key for send-turn
    const idempotencyKey = generateIdempotencyKeyV4();

    // Phase 8: Optimistic update - add player turn immediately
    const tempPlayerTurn: Turn = {
      id: `temp-${Date.now()}`,
      game_id: gameId,
      turn_number: (game?.turnCount || 0) + 1,
      role: 'player',
      content: action,
      created_at: new Date().toISOString(),
    };
    setOptimisticTurns([tempPlayerTurn]); // Show immediately

    try {
      // Phase 8: Use simple send-turn endpoint with debug parameter
      const result = await sendTurn(gameId, action, { 
        idempotencyKey,
        debug: debugResponses.enabled,
        debugDepth: 'safe',
      });

      // Capture debug data from response and store in debugStore
      if (result.ok && result.data.debug && debugResponses.enabled) {
        const debug = result.data.debug;
        // Extract turn number from debugId or use turn_number from response
        const turnNumber = standardizedTurn.turn_number;
        const turnKey = `${gameId}:${turnNumber}`;
        debugStore.addDebug(turnKey, debug);
        
        // Auto-open drawer on first debug capture
        if (!debugDrawerOpen) {
          setDebugDrawerOpen(true);
        }
      }

      if (!result.ok) {
        // Phase 8: Roll back optimistic turn on error
        setOptimisticTurns([]);
        
        // Handle specific error cases
        const errorCode = result.error.code;
        if (errorCode === 'RATE_LIMITED') {
          setTurnError('Too many requests. Please wait a moment and try again.');
        } else if (errorCode === 'VALIDATION_FAILED') {
          setTurnError('Invalid message. Please check your input.');
        } else if (errorCode === 'NOT_FOUND') {
          setTurnError('Game not found. Please refresh the page.');
        } else if (errorCode === 'INSUFFICIENT_STONES') {
          setTurnError('Not enough casting stones to take this turn.');
        } else {
          setTurnError(result.error.message || 'Failed to submit turn. Please try again.');
        }
        
        // Show toast for errors
        toast({
          title: 'Turn Failed',
          description: result.error.message || 'Failed to submit turn',
          variant: 'destructive',
        });
        return;
      }

      // Phase 8: Success - remove optimistic turn, trigger refetch
      setOptimisticTurns([]);
      const returnedTurn = result.data.turn;
      
      // Trigger TurnsList to refetch (by incrementing refresh key)
      setTurnsRefreshKey(prev => prev + 1);
      
      // Also invalidate React Query cache if any
      queryClient.invalidateQueries({ queryKey: ['game-turns', gameId] });
      
      // Update turn count
      setGameState(prev => ({
        ...prev,
        currentTurn: returnedTurn.turn_number
      }));

      // Phase 8: Show success toast (quiet, not too intrusive)
      toast({
        title: 'Turn submitted',
        description: 'Your turn has been processed.',
      });

      // Game state is now managed by database-driven history loading

    } catch (error) {
      console.error('Turn submission error:', error);
      // Phase 8: Roll back optimistic turn on error
      setOptimisticTurns([]);
      setTurnError('An unexpected error occurred. Please try again.');
      toast({
        title: 'Error',
        description: 'Failed to submit turn. Please try again.',
        variant: 'destructive',
      });
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

  const globalErrorMessage = turnError || gameErrorState;

  return (
    <>
      {globalErrorMessage && (
        <div className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
          <div className="max-w-3xl w-full pointer-events-auto">
            <div className="bg-red-600 text-white px-4 py-3 rounded-md shadow-lg flex items-center justify-between">
              <span className="text-sm font-medium">{globalErrorMessage}</span>
              <button
                type="button"
                className="text-white/80 hover:text-white text-xs ml-4"
                onClick={() => {
                  setTurnError(null);
                  setGameErrorState(null);
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
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
              {debugResponses.visible && (
                <div className="flex items-center gap-2">
                  <Switch
                    id="debug-responses"
                    checked={debugResponses.enabled}
                    onCheckedChange={debugResponses.setEnabled}
                  />
                  <Label htmlFor="debug-responses" className="text-sm cursor-pointer">
                    Debug responses
                  </Label>
                </div>
              )}
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
                {debugResponses.visible && lastDebug && (
                  <DebugMiniPanel debug={lastDebug} />
                )}
              </CardContent>
            </Card>

            {/* Phase 8: Paginated Turns List with Error Boundary and optimistic updates */}
            <ErrorBoundary>
              <TurnsList 
                gameId={gameId || ''} 
                initialLimit={50}
                refreshKey={turnsRefreshKey}
                optimisticTurns={optimisticTurns}
              />
            </ErrorBoundary>
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
      
      {/* Debug Drawer */}
      {debugResponses.visible && gameId && (
        <DebugDrawer
          gameId={gameId}
          open={debugDrawerOpen}
          onOpenChange={setDebugDrawerOpen}
        />
      )}
      
      {/* Prompt Approval Modal removed - not needed with new backend system */}
    </div>
    </>
  );
}
