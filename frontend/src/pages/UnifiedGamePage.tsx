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
import { InsufficientStonesDialog } from '../components/gameplay/InsufficientStonesDialog';
import { ChoiceButtons } from '../components/gameplay/ChoiceButtons';
import { Breadcrumbs } from '../components/layout/Breadcrumbs';
import { Gem, RefreshCw, AlertCircle } from 'lucide-react';
import { 
  getGame, 
  getCharacter, 
  getContentWorlds,
  getConversationHistory,
} from '../lib/api';
import type { ConversationEntry } from '@shared';
import { useAdventureTelemetry } from '../hooks/useAdventureTelemetry';
import { useGameTelemetry } from '../hooks/useGameTelemetry';
import { useLatestTurn, usePostTurn } from '../hooks/useTurns';
import { useAuthStore } from '../store/auth';
import { GuestCookieService } from '../services/guestCookie';
import { useWalletContext } from '../providers/WalletProvider';
import { subscribeToGameEvents } from '../lib/events';
import { queryKeys } from '../lib/queryKeys';

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
  const { wallet, balance } = useWalletContext();
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
  const [actualStoneCost, setActualStoneCost] = useState<number>(1); // Default to 1, will be updated from error or config
  const [showInsufficientStonesDialog, setShowInsufficientStonesDialog] = useState(false);
  const [gameStartTime, setGameStartTime] = useState<number | null>(null);
  const [hasTrackedFirstTurn, setHasTrackedFirstTurn] = useState(false);
  const [turnStartTime, setTurnStartTime] = useState<number | null>(null);
  const [pendingChoice, setPendingChoice] = useState<string | null>(null);
  const [pendingNarrativeId, setPendingNarrativeId] = useState<string | null>(null);
  // Track displayed entries to prevent duplicates and append new turns
  const [displayedEntries, setDisplayedEntries] = useState<ConversationEntry[]>([]);
  const [displayedLatestTurnId, setDisplayedLatestTurnId] = useState<number | null>(null);
  
  const telemetry = useAdventureTelemetry();
  const gameTelemetry = useGameTelemetry();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const storyContainerRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);
  const userHasScrolled = useRef(false);
  const lastEntryCount = useRef(0);
  const shouldAutoScroll = useRef(true);

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
  
  // Subscribe to game events for real-time updates (PR7)
  useEffect(() => {
    if (!actualGameId) return;
    
    const unsubscribe = subscribeToGameEvents(queryClient, actualGameId);
    return unsubscribe;
  }, [actualGameId, queryClient]);

  // Load conversation history - ONLY on initial load, not after each turn
  const { data: conversationHistory, isLoading: isLoadingHistory } = useQuery({
    queryKey: queryKeys.conversationHistory(actualGameId),
    queryFn: async () => {
      if (!actualGameId) throw new Error('No game ID available');
      const result = await getConversationHistory(actualGameId, 20);
      if (!result.ok) {
        throw new Error(result.error.message || 'Failed to load conversation history');
      }
      return result.data;
    },
    enabled: !!actualGameId,
    refetchOnWindowFocus: false,
    refetchOnMount: false, // Only fetch on initial load
    staleTime: Infinity, // Never consider stale - we'll append new turns manually
    retry: false,
  });
  
  // Initialize displayed entries from conversation history on load
  // Always sync with conversationHistory when it loads (but don't overwrite if we have newer entries)
  useEffect(() => {
    if (conversationHistory && conversationHistory.entries.length > 0) {
      // If we have no displayed entries, initialize from history
      if (displayedEntries.length === 0) {
        setDisplayedEntries(conversationHistory.entries);
      } else {
        // If we have displayed entries, merge them with history to ensure we have all entries
        // This handles the case where history loads after we've already started displaying
        setDisplayedEntries(prev => {
          // Create a map of existing entries by turnCount and type
          const existingMap = new Map<string, ConversationEntry>();
          prev.forEach(entry => {
            const key = `${entry.turnCount}-${entry.type}`;
            existingMap.set(key, entry);
          });
          
          // Add all history entries
          conversationHistory.entries.forEach(entry => {
            const key = `${entry.turnCount}-${entry.type}`;
            if (!existingMap.has(key)) {
              existingMap.set(key, entry);
            }
          });
          
          // Convert back to array and sort by turnCount
          const merged = Array.from(existingMap.values());
          merged.sort((a, b) => {
            // Sort by turnCount, then by type (user before ai for same turn)
            if (a.turnCount !== b.turnCount) {
              return a.turnCount - b.turnCount;
            }
            return a.type === 'user' ? -1 : 1;
          });
          
          return merged;
        });
      }
    }
  }, [conversationHistory]);

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

  // Wallet data is provided by WalletProvider in layout
  // No need to query here - use useWalletContext() if wallet data is needed

  // Find current world (content service shape). Optional – we can render without it.
  const currentWorld = worlds?.find(w => w.slug === game?.worldSlug);

  // Handle navigation and game start time
  useEffect(() => {
    if (!user && !GuestCookieService.hasGuestCookie()) {
      navigate('/');
      return;
    }
    setGameStartTime(Date.now());
    // Reset scroll state when game changes
    isInitialLoad.current = true;
    userHasScrolled.current = false;
    shouldAutoScroll.current = true;
    lastEntryCount.current = 0;
    // Reset displayed entries when game changes
    setDisplayedEntries([]);
    setDisplayedLatestTurnId(null);
  }, [user, navigate, actualGameId]);

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

  // Track user scroll to disable auto-scroll if they manually scroll
  useEffect(() => {
    const container = storyContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      // Check if user scrolled up (not at bottom)
      const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
      if (!isAtBottom) {
        userHasScrolled.current = true;
        shouldAutoScroll.current = false;
      } else {
        // If user scrolls back to bottom, re-enable auto-scroll
        userHasScrolled.current = false;
        shouldAutoScroll.current = true;
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-scroll only when user submits a choice (pending content), not when turn completes
  useEffect(() => {
    const hasPendingContent = pendingChoice || pendingNarrativeId;
    
    // Skip scroll on initial load
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      lastEntryCount.current = displayedEntries.length;
      return;
    }

    // Only scroll if:
    // 1. Pending content appeared (user just submitted a choice)
    // 2. User hasn't manually scrolled away
    // 3. Auto-scroll is enabled
    // Do NOT scroll when turn completes (when pending content disappears and new entry appears)
    const shouldScroll = hasPendingContent && shouldAutoScroll.current && !userHasScrolled.current;
    
    if (shouldScroll) {
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      });
    }

    // Update entry count for tracking, but don't use it to trigger scroll
    lastEntryCount.current = displayedEntries.length;
  }, [pendingChoice, pendingNarrativeId, displayedEntries.length]);

  // Update game state and displayed entries from latestTurn (TurnDTO)
  // Append new turn to displayed entries when it arrives
  useEffect(() => {
    if (latestTurn && latestTurn.id !== displayedLatestTurnId) {
      // Clear pending state when new narrative arrives
      if (pendingNarrativeId && latestTurn.narrative && latestTurn.narrative.length > 0) {
        setPendingChoice(null);
        setPendingNarrativeId(null);
      }
      
      // Update game state
      setGameState(prev => ({
        ...prev,
        currentTurn: latestTurn.turnCount,
        currentChoices: latestTurn.choices || [],
      }));
      
      // Append new turn entries to displayed entries
      // Update the user choice entry with correct turn count if needed
      if (pendingChoice) {
        setDisplayedEntries(prev => {
          // Check if we already have this user entry
          const hasUserEntry = prev.some(e => e.turnCount === latestTurn.turnCount && e.type === 'user' && e.content === pendingChoice);
          if (hasUserEntry) {
            // Just update the turn count if needed
            return prev.map(entry => {
              if (entry.type === 'user' && entry.content === pendingChoice && entry.turnCount !== latestTurn.turnCount) {
                return {
                  ...entry,
                  id: latestTurn.turnCount,
                  turnCount: latestTurn.turnCount,
                };
              }
              return entry;
            });
          } else {
            // Add the user choice entry
            const userEntry: ConversationEntry = {
              id: latestTurn.turnCount,
              gameId: actualGameId || '',
              turnCount: latestTurn.turnCount,
              type: 'user',
              content: pendingChoice,
              createdAt: new Date().toISOString(),
            };
            return [...prev, userEntry].sort((a, b) => {
              if (a.turnCount !== b.turnCount) return a.turnCount - b.turnCount;
              return a.type === 'user' ? -1 : 1;
            });
          }
        });
      }
      
      // Add the AI narrative
      if (latestTurn.narrative && latestTurn.narrative.length > 0) {
        const aiEntry: ConversationEntry = {
          id: latestTurn.turnCount,
          gameId: actualGameId || '',
          turnCount: latestTurn.turnCount,
          type: 'ai',
          content: latestTurn.narrative,
          createdAt: latestTurn.createdAt || new Date().toISOString(),
        };
        setDisplayedEntries(prev => {
          // Check if this turn is already displayed (prevent duplicates)
          const exists = prev.some(e => e.turnCount === latestTurn.turnCount && e.type === 'ai');
          if (exists) return prev;
          // Add and sort to maintain chronological order
          return [...prev, aiEntry].sort((a, b) => {
            if (a.turnCount !== b.turnCount) return a.turnCount - b.turnCount;
            return a.type === 'user' ? -1 : 1;
          });
        });
      }
      
      setDisplayedLatestTurnId(latestTurn.id); // TurnDTO.id is a number
    }
  }, [latestTurn, pendingNarrativeId, pendingChoice, displayedLatestTurnId, actualGameId]);

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
      
      // Optimistically show the user's choice immediately and add it to displayed entries
      setPendingChoice(payload.text);
      // Generate a temporary ID for the pending narrative
      const tempNarrativeId = `pending-${Date.now()}`;
      setPendingNarrativeId(tempNarrativeId);
      
      // Immediately add the user's choice to displayed entries
      const userEntry: ConversationEntry = {
        id: (gameState.currentTurn + 1), // Next turn number
        gameId: actualGameId || '',
        turnCount: gameState.currentTurn + 1,
        type: 'user',
        content: payload.text,
        createdAt: new Date().toISOString(),
      };
      setDisplayedEntries(prev => [...prev, userEntry]);
      
      // Track turn started
      gameTelemetry.trackTurnStarted(
        actualGameId!,
        character?.id || '',
        game?.adventureSlug || '',
        payload.text
      );
      
      postTurnMutation.mutate(payload, {
        onSuccess: (turnData) => {
          // The turn data is already in the cache via setQueryData in usePostTurn
          // The useEffect watching latestTurn will append it to displayedEntries
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
          const errorMessage = error.message || '';
          
          // Parse actual cost from error message if it's insufficient stones
          if (errorCode === 'INSUFFICIENT_STONES') {
            // Error format: "Insufficient casting stones. Have 1, need 2"
            const needMatch = errorMessage.match(/need (\d+)/i);
            if (needMatch) {
              const cost = parseInt(needMatch[1], 10);
              if (!isNaN(cost)) {
                setActualStoneCost(cost);
              }
            }
            setShowInsufficientStonesDialog(true);
            // Don't set turnError for insufficient stones - it's handled by dialog
          } else {
            setTurnError(errorMessage);
          }
          
          setTurnErrorCode(errorCode);
          // Clear pending state on error
          setPendingChoice(null);
          setPendingNarrativeId(null);
          
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

  // Render as long as we have game data; character/world are optional and displayed with fallbacks
  if (!game) {
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
              Playing as {character?.name || 'You'} in {(
                (currentWorld as any)?.title || (currentWorld as any)?.name || game.worldName || game.worldSlug || 'the world'
              )}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="outline">
              Turn {gameState.currentTurn}
            </Badge>
            {wallet && (
              <div className="flex items-center gap-2">
                <Gem className="h-4 w-4" />
                <span className="font-medium">{balance}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error Handler - only show non-insufficient-stones errors inline */}
      {turnError && turnErrorCode !== 'INSUFFICIENT_STONES' && (
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

      {/* Insufficient Stones Dialog - overlay upsell */}
      <InsufficientStonesDialog
        open={showInsufficientStonesDialog}
        onOpenChange={setShowInsufficientStonesDialog}
        currentBalance={wallet?.balance || 0}
        requiredCost={actualStoneCost}
        onGoToWallet={handleGoToWallet}
      />

      {/* Main Game Layout */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Story and Choices - Main Content */}
        <div className="md:col-span-2 space-y-6">
          {/* Conversation History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>Story</span>
                {isSubmittingTurn && (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent 
              ref={storyContainerRef}
              className="max-h-[600px] overflow-y-auto"
            >
              {/* Render conversation history */}
              {isLoadingHistory || isLoadingLatestTurn ? (
                <div className="space-y-4">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-3/4" />
                </div>
              ) : displayedEntries.length > 0 ? (
                <div className="space-y-4">
                  {displayedEntries.map((entry: ConversationEntry, index: number) => (
                    <div key={`${entry.id}-${entry.type}-${index}`}>
                      {/* Horizontal rule before each entry (except first) */}
                      {index > 0 && (
                        <hr className="my-4 border-t border-border/50" />
                      )}
                      
                      {/* Entry content */}
                      <div className={`rounded-lg p-4 ${
                        entry.type === 'user' 
                          ? 'bg-primary/5 border-l-4 border-primary' 
                          : 'bg-muted/20 border-l-4 border-blue-500'
                      }`}>
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-0.5">
                            {entry.type === 'user' ? (
                              <span className="text-xs font-semibold text-primary">You:</span>
                            ) : (
                              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">Story:</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm whitespace-pre-wrap break-words">{entry.content}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Show pending narrative loader */}
                  {pendingNarrativeId && (
                    <>
                      <hr className="my-4 border-t border-border/50" />
                      <div className="rounded-lg p-4 bg-muted/20 border-l-4 border-blue-500">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-0.5">
                            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">Story:</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <RefreshCw className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                              <p className="text-sm text-muted-foreground italic">The story continues...</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                  
                </div>
              ) : displayedEntries.length === 0 ? (
                <div className="text-muted-foreground text-center py-8">
                  No conversation history yet. Start playing to see your adventure unfold!
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
                stoneCost={actualStoneCost}
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
                  {balance}
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
