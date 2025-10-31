import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useStoryQuery, useCharactersQuery, useCreateCharacter, useCreateSession, useCreateGuestToken, usePrefetchSessionBundle, useFindExistingSession } from '@/lib/queries';
import CharacterCard from '@/components/play/CharacterCard';
import CharacterModal from '@/components/play/CharacterModal';
import StoryStartSummary from '@/components/play/StoryStartSummary';
import { EmptyState } from '@/components/catalog/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, User, UserPlus, ArrowLeft, Play } from 'lucide-react';
import { 
  trackStartStoryView, 
  trackStartStoryAuthChoice, 
  trackCharacterSelect, 
  trackCharacterCreate, 
  trackSessionCreated, 
  trackStartStoryError,
  trackFunnelStage
} from '@/lib/analytics';
import type { Character } from '@/types/domain';
import { useQueryClient } from '@tanstack/react-query';
import { ensureGuestToken } from '@/lib/auth';
import { makeIdempotencyKey, setStoredSessionId, getStoredSessionId } from '@/lib/idempotency';
import { findExistingSession } from '@/lib/api';

type FlowStep = 'intro' | 'auth' | 'character' | 'confirm' | 'error';

export default function StartStoryPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const storyId = searchParams.get('story');
  
  const [currentStep, setCurrentStep] = useState<FlowStep>('intro');
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [isCharacterModalOpen, setIsCharacterModalOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [beginDisabled, setBeginDisabled] = useState(false);
  const [lastStageTs, setLastStageTs] = useState<number>(Date.now());

  const queryClient = useQueryClient();
  const prefetchSessionBundle = usePrefetchSessionBundle();
  const { lookup } = useFindExistingSession();

  // stage helpers
  const emitStage = (stage: 'view'|'auth'|'character'|'confirm'|'created', extras?: { story_id?: string; character_id?: string; session_id?: string }) => {
    const now = Date.now();
    trackFunnelStage({ stage, ms_since_prev: now - lastStageTs, ...extras });
    setLastStageTs(now);
  };

  // Queries
  const { data: storyData, isLoading: storyLoading, error: storyError } = useStoryQuery(storyId || '');
  const { data: charactersData, isLoading: charactersLoading } = useCharactersQuery();
  const createCharacterMutation = useCreateCharacter();
  const createSessionMutation = useCreateSession();
  const createGuestTokenMutation = useCreateGuestToken();

  const story = storyData?.data;
  const characters = charactersData?.data || [];

  // Check authentication status (runs once on mount)
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setIsAuthenticated(!!user);
        setUserEmail(user?.email || null);
      } catch (error) {
        console.error('Failed to check auth status:', error);
        setIsAuthenticated(false);
        setUserEmail(null);
      }
    };

    checkAuth();
  }, []);

  // Track page view
  useEffect(() => {
    if (storyId) {
      emitStage('view', { story_id: storyId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyId]);

  // Handle story not found
  if (!storyId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <EmptyState
          title="Story Not Found"
          description="No story ID provided. Please select a story to begin playing."
          actionLabel="Browse Stories"
          onAction={() => navigate('/stories')}
        />
      </div>
    );
  }

  // Handle story loading
  if (storyLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin mx-auto" />
            <p className="text-muted-foreground">Loading story...</p>
          </div>
        </div>
      </div>
    );
  }

  // Handle story error
  if (storyError || !story) {
    return (
      <div className="container mx-auto px-4 py-8">
        <EmptyState
          title="Story Not Found"
          description="The story you're looking for doesn't exist or has been removed."
          actionLabel="Browse Stories"
          onAction={() => navigate('/stories')}
        />
      </div>
    );
  }

  // Handle authentication choice
  const handleAuthChoice = async (method: 'guest' | 'authenticated') => {
    try {
      if (method === 'guest') {
        // Ensure token with expiry; silently refresh if needed
        await ensureGuestToken(() => createGuestTokenMutation.mutateAsync() as any);
        setIsGuestMode(true);
        trackStartStoryAuthChoice(story!.id, 'guest');
      } else {
        trackStartStoryAuthChoice(story!.id, 'authenticated');
      }
      emitStage('auth', { story_id: story!.id });
      setCurrentStep('character');
    } catch (error) {
      console.error('Auth choice failed:', error);
      trackStartStoryError('auth', 'Authentication failed');
    }
  };

  // Handle character selection
  const handleCharacterSelect = (character: Character) => {
    setSelectedCharacter(character);
    trackCharacterSelect(character.id, story!.id);
    emitStage('character', { story_id: story!.id, character_id: character.id });
    setCurrentStep('confirm');
  };

  // Handle character creation
  const handleCreateCharacter = async (newCharacter: { name: string; portrait_seed?: string }) => {
    try {
      const result = await createCharacterMutation.mutateAsync(newCharacter);
      if (result.ok) {
        setSelectedCharacter(result.data);
        trackCharacterCreate(result.data.id, story!.id);
        emitStage('character', { story_id: story!.id, character_id: result.data.id });
        setCurrentStep('confirm');
      } else {
        trackStartStoryError('character_creation', 'Failed to create character');
      }
    } catch (error) {
      console.error('Character creation failed:', error);
      trackStartStoryError('character_creation', 'Character creation failed');
    }
  };

  const resumeIfExists = async (storyIdValue: string, characterIdValue: string): Promise<string | null> => {
    // sessionStorage quick hit
    const cached = getStoredSessionId(storyIdValue, characterIdValue);
    if (cached) return cached;
    const res = await lookup(storyIdValue, characterIdValue);
    if ((res as any)?.ok && (res as any).data) {
      const existingId = (res as any).data.id as string;
      setStoredSessionId(storyIdValue, characterIdValue, existingId);
      return existingId;
    }
    return null;
  };

  const handleBeginStory = async () => {
    if (!selectedCharacter || !story) return;
    if (beginDisabled) return; // double-click guard
    setBeginDisabled(true);
    const storyIdValue = story.id;
    const characterIdValue = selectedCharacter.id;

    try {
      // Fast resume if an in-progress session exists
      const existing = await resumeIfExists(storyIdValue, characterIdValue);
      if (existing) {
        emitStage('confirm', { story_id: storyIdValue, character_id: characterIdValue });
        await prefetchAndNavigate(existing);
        return;
      }

      // Create with idempotency header
      const idempotencyKey = makeIdempotencyKey(storyIdValue, characterIdValue);
      const result = await createSessionMutation.mutateAsync({
        body: { story_id: storyIdValue, character_id: characterIdValue },
        opts: { headers: { 'Idempotency-Key': idempotencyKey } },
      });

      // If API leaks 409 via shape, treat as resume (our http client may not expose status here)
      if ((result as any)?.status === 409) {
        const resumed = await resumeIfExists(storyIdValue, characterIdValue);
        if (resumed) {
          await prefetchAndNavigate(resumed);
          return;
        }
      }

      if (result.ok) {
        const sessionId = result.data.id as string;
        setStoredSessionId(storyIdValue, characterIdValue, sessionId);
        trackSessionCreated(storyIdValue, characterIdValue, sessionId);
        emitStage('created', { story_id: storyIdValue, character_id: characterIdValue, session_id: sessionId });
        await prefetchAndNavigate(sessionId);
      } else {
        trackStartStoryError('session_creation', 'Failed to create session');
        setErrorMessage('Failed to start story. Please try again.');
        setCurrentStep('error');
      }
    } catch (error: any) {
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      console.error('Session creation failed:', error);
      trackStartStoryError('session_creation', offline ? 'Offline' : 'Session creation failed');
      setErrorMessage(offline ? 'You appear to be offline. Please retry when online.' : 'Failed to start story. Please try again.');
      setCurrentStep('error');
    } finally {
      setBeginDisabled(false);
    }
  };

  const prefetchAndNavigate = async (sessionId: string) => {
    const timeout = new Promise<void>(resolve => setTimeout(resolve, 500));
    await Promise.race([prefetchSessionBundle(sessionId), timeout]);
    navigate(`/play/${sessionId}`);
  };

  // Render intro step
  if (currentStep === 'intro') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Back button */}
          <Button
            variant="ghost"
            onClick={() => navigate('/stories')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Stories
          </Button>

          {/* Story intro */}
          <Card>
            <CardHeader>
              <div className="flex items-start gap-4">
                {story.hero_url && (
                  <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0">
                    <img
                      src={story.hero_url}
                      alt={story.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-2xl">{story.title}</CardTitle>
                  {story.short_desc && (
                    <p className="text-muted-foreground mt-2">{story.short_desc}</p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Badge variant="secondary">{story.kind}</Badge>
                    {story.tags.map((tag) => (
                      <Badge key={tag} variant="outline">{tag}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => setCurrentStep('auth')}
                size="lg"
                className="w-full"
              >
                <Play className="w-4 h-4 mr-2" />
                Continue
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Render auth step
  if (currentStep === 'auth') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold">Choose How to Play</h1>
            <p className="text-muted-foreground">
              You can play as a guest or sign in to save your progress
            </p>
          </div>

          <div className="space-y-3">
            {isAuthenticated ? (
              <Button
                onClick={() => handleAuthChoice('authenticated')}
                size="lg"
                className="w-full"
              >
                <User className="w-4 h-4 mr-2" />
                Continue as {userEmail || 'User'}
              </Button>
            ) : (
              <Button
                onClick={() => handleAuthChoice('authenticated')}
                size="lg"
                className="w-full"
              >
                <User className="w-4 h-4 mr-2" />
                Sign In to Save Progress
              </Button>
            )}

            <Button
              onClick={() => handleAuthChoice('guest')}
              variant="outline"
              size="lg"
              className="w-full"
              disabled={createGuestTokenMutation.isPending}
            >
              {createGuestTokenMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <User className="w-4 h-4 mr-2" />
              )}
              Continue as Guest
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Guest sessions are temporary and will be lost when you close your browser
          </p>
        </div>
      </div>
    );
  }

  // Render character selection step
  if (currentStep === 'character') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold">Choose Your Character</h1>
            <p className="text-muted-foreground">
              Select an existing character or create a new one
            </p>
          </div>

          {charactersLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Existing Characters */}
              {characters.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-lg font-semibold">Your Characters</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {characters.map((character) => (
                      <CharacterCard
                        key={character.id}
                        character={character}
                        isSelected={false}
                        onSelect={handleCharacterSelect}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Create New Character */}
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">
                  {characters.length > 0 ? 'Or Create New' : 'Create Your First Character'}
                </h2>
                <Button
                  onClick={() => setIsCharacterModalOpen(true)}
                  variant="outline"
                  size="lg"
                  className="w-full"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Create New Character
                </Button>
              </div>
            </div>
          )}

          <CharacterModal
            isOpen={isCharacterModalOpen}
            onClose={() => setIsCharacterModalOpen(false)}
            onSave={handleCreateCharacter}
            isLoading={createCharacterMutation.isPending}
          />
        </div>
      </div>
    );
  }

  // Render confirmation step
  if (currentStep === 'confirm' && selectedCharacter) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <StoryStartSummary
            story={story}
            character={selectedCharacter}
            onBegin={handleBeginStory}
            isLoading={createSessionMutation.isPending || beginDisabled}
          />
        </div>
      </div>
    );
  }

  // Render error step
  if (currentStep === 'error') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-destructive">Error</h1>
            <p className="text-muted-foreground">{errorMessage}</p>
          </div>
          <div className="space-y-3">
            <Button
              onClick={() => setCurrentStep('confirm')}
              className="w-full"
              size="lg"
            >
              Try Again
            </Button>
            <Button
              onClick={() => setCurrentStep('character')}
              variant="outline"
              size="lg"
              className="w-full"
            >
              Back to Character Selection
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
