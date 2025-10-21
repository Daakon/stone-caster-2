import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Breadcrumbs } from '../components/layout/Breadcrumbs';
import { ErrorBanner } from '../components/ui/error-banner';
import { mockDataService } from '../services/mockData';
import type { Character } from '../services/mockData';
import { getCharacters, getPremadeCharacters } from '../lib/api';
import { useStartAdventure } from '../hooks/useStartAdventure';
import { useAdventureTelemetry } from '../hooks/useAdventureTelemetry';
import { ApiErrorCode } from '@shared';

// Type for premade characters from API
interface PremadeCharacter {
  id: string;
  worldSlug: string;
  archetypeKey: string;
  displayName: string;
  summary: string;
  avatarUrl?: string;
  baseTraits: Record<string, any>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

import { 
  Plus, 
  User, 
  Calendar,
  Sparkles,
  Loader2,
  Zap,
  Play,
  Users,
  Star,
} from 'lucide-react';
import { CharacterSkills } from '../components/character/CharacterSkills';

function CharacterSelectionPageContent() {
  const { adventureId, worldSlug, adventureSlug } = useParams<{ 
    adventureId?: string; 
    worldSlug?: string; 
    adventureSlug?: string; 
  }>();
  const navigate = useNavigate();
  const [selectedCharacter, setSelectedCharacter] = useState<Character | PremadeCharacter | null>(null);
  const [selectedPath, setSelectedPath] = useState<'premade' | 'existing' | 'new' | null>(null);
  const [isInvited] = useState(mockDataService.getInviteStatus().invited);
  const [gameCreationError, setGameCreationError] = useState<{code: ApiErrorCode; message?: string; existingGameId?: string} | null>(null);
  const [userCharacters, setUserCharacters] = useState<Character[]>([]);
  const [premadeCharacters, setPremadeCharacters] = useState<PremadeCharacter[]>([]);
  
  const { startAdventure, isStarting } = useStartAdventure();
  const telemetry = useAdventureTelemetry();
  
  // Support both legacy and new routing
  const currentAdventureId = adventureId || adventureSlug;
  const adventure = currentAdventureId ? mockDataService.getAdventureById(currentAdventureId) : null;
  const world = adventure ? mockDataService.getWorldById(adventure.worldId) : null;
  const currentTier = mockDataService.getCurrentTier();
  const limits = mockDataService.getLimitsByTier(currentTier);

  // Use React Query to load characters (prevents duplicate calls in StrictMode)
  const currentWorldSlug = worldSlug || world?.id;
  
  const { data: userCharactersData, isLoading: isLoadingUserCharacters } = useQuery({
    queryKey: ['characters', currentWorldSlug],
    queryFn: async () => {
      if (!currentWorldSlug) return [];
      console.log(`[CharacterSelectionPage] React Query: Loading user characters for world: ${currentWorldSlug}`);
      const result = await getCharacters(currentWorldSlug);
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    enabled: !!currentWorldSlug && !!adventure,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: premadeCharactersData, isLoading: isLoadingPremades } = useQuery({
    queryKey: ['premades', currentWorldSlug],
    queryFn: async () => {
      if (!currentWorldSlug) return [];
      console.log(`[CharacterSelectionPage] React Query: Loading premade characters for world: ${currentWorldSlug}`);
      const result = await getPremadeCharacters(currentWorldSlug);
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    enabled: !!currentWorldSlug && !!adventure,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Update state when data changes
  useEffect(() => {
    if (userCharactersData) {
      setUserCharacters(userCharactersData);
    }
  }, [userCharactersData]);

  useEffect(() => {
    if (premadeCharactersData) {
      setPremadeCharacters(premadeCharactersData);
    }
  }, [premadeCharactersData]);

  const isLoadingCharacters = isLoadingUserCharacters || isLoadingPremades;

  // Track character selection start (only once when adventure is available)
  useEffect(() => {
    if (adventure && !isLoadingCharacters) {
      telemetry.trackCharacterSelectionStarted(adventure.id);
    }
  }, [adventure, isLoadingCharacters, telemetry]);
  
  if (!adventure || !world) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Breadcrumbs />
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Adventure Not Found</h1>
          <Button onClick={() => navigate('/adventures')}>
            Back to Adventures
          </Button>
        </div>
      </div>
    );
  }

  const handlePathSelect = (path: 'premade' | 'existing' | 'new') => {
    setSelectedPath(path);
    setSelectedCharacter(null);
    setGameCreationError(null);
  };

  const handleCharacterSelect = (character: Character | PremadeCharacter) => {
    setSelectedCharacter(character);
    setGameCreationError(null);
  };

  const handleStartAdventure = async () => {
    if (!isInvited || !adventure || !selectedCharacter || !selectedPath) {
      return;
    }

    setGameCreationError(null);

    const result = await startAdventure({
      adventureSlug: adventure.id,
      characterType: selectedPath,
      characterId: selectedPath === 'existing' ? selectedCharacter.id : undefined,
      premadeData: selectedPath === 'premade' && 'archetypeKey' in selectedCharacter ? {
        worldSlug: selectedCharacter.worldSlug,
        archetypeKey: selectedCharacter.archetypeKey,
        displayName: selectedCharacter.displayName,
      } : undefined,
    });

    if (!result.success) {
      setGameCreationError({
        ...result.error!,
        existingGameId: result.existingGameId,
      });
    }
  };

  const handleResumeAdventure = async () => {
    if (gameCreationError?.code === ApiErrorCode.CONFLICT && gameCreationError.existingGameId) {
      // Navigate to the existing game
      navigate(`/play/${gameCreationError.existingGameId}`);
    }
  };

  const handleCreateNewCharacter = () => {
    navigate(`/adventures/${adventure.id}/create-character`);
  };

  const canCreateCharacter = userCharacters.length < limits.maxCharacters;

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumbs />

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Start Your Adventure</h1>
          <p className="text-muted-foreground">
            Choose how you'd like to begin <strong>{adventure.title}</strong>
          </p>
        </div>

        {/* Adventure Info */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <img
                src={adventure.cover}
                alt={adventure.title}
                className="w-16 h-16 object-cover rounded-lg"
              />
              <div>
                <h3 className="font-semibold">{adventure.title}</h3>
                <p className="text-sm text-muted-foreground">{adventure.excerpt}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline">{world.title}</Badge>
                  <Badge variant="secondary">{adventure.difficulty}</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error Display */}
        {gameCreationError && (
          <div className="mb-6">
            <ErrorBanner
              error={gameCreationError}
              onResume={gameCreationError.code === ApiErrorCode.CONFLICT ? handleResumeAdventure : undefined}
              onRetry={() => setGameCreationError(null)}
              onDismiss={() => setGameCreationError(null)}
            />
          </div>
        )}

        {/* Three Path Selection */}
        {!selectedPath ? (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-center">How would you like to start?</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Premade Characters Path */}
              {premadeCharacters.length > 0 && (
                <Card 
                  className="cursor-pointer transition-all hover:shadow-lg hover:scale-105"
                  onClick={() => handlePathSelect('premade')}
                >
                  <CardContent className="p-6 text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Zap className="h-8 w-8 text-white" />
                    </div>
                    <h3 className="font-semibold mb-2">Quick Start</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Jump right in with a ready-made character
                    </p>
                    <Badge variant="secondary" className="flex items-center gap-1 w-fit mx-auto">
                      <Star className="h-3 w-3" />
                      {premadeCharacters.length} options
                    </Badge>
                  </CardContent>
                </Card>
              )}

              {/* Existing Characters Path */}
              <Card 
                className="cursor-pointer transition-all hover:shadow-lg hover:scale-105"
                onClick={() => handlePathSelect('existing')}
              >
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="font-semibold mb-2">My Characters</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Use one of your existing characters
                  </p>
                  <Badge variant="outline" className="flex items-center gap-1 w-fit mx-auto">
                    <User className="h-3 w-3" />
                    {userCharacters.length}/{limits.maxCharacters}
                  </Badge>
                </CardContent>
              </Card>

              {/* Create New Character Path */}
              {canCreateCharacter && (
                <Card 
                  className="cursor-pointer transition-all hover:shadow-lg hover:scale-105"
                  onClick={() => handlePathSelect('new')}
                >
                  <CardContent className="p-6 text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Plus className="h-8 w-8 text-white" />
                    </div>
                    <h3 className="font-semibold mb-2">Create New</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Build a custom character from scratch
                    </p>
                    <Badge variant="outline" className="flex items-center gap-1 w-fit mx-auto">
                      <Sparkles className="h-3 w-3" />
                      Custom
                    </Badge>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        ) : (
          /* Character Selection for Chosen Path */
          <div className="space-y-6">
            {/* Path Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedPath(null);
                    setSelectedCharacter(null);
                    setGameCreationError(null);
                  }}
                >
                  ← Back
                </Button>
                <h2 className="text-xl font-semibold">
                  {selectedPath === 'premade' && 'Choose a Quick Start Character'}
                  {selectedPath === 'existing' && 'Choose Your Character'}
                  {selectedPath === 'new' && 'Create New Character'}
                </h2>
              </div>
            </div>

            {/* Character Selection */}
            {isLoadingCharacters ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span>Loading characters...</span>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Premade Characters */}
                {selectedPath === 'premade' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {premadeCharacters.map((character) => (
                      <Card 
                        key={character.id} 
                        className={`cursor-pointer transition-all ${
                          selectedCharacter?.id === character.id 
                            ? 'ring-2 ring-primary shadow-md' 
                            : 'hover:shadow-md'
                        }`}
                        onClick={() => handleCharacterSelect(character)}
                      >
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                                <Zap className="h-6 w-6 text-white" />
                              </div>
                              <div className="flex-1">
                                <h4 className="font-medium">{character.displayName}</h4>
                                <p className="text-sm text-muted-foreground">
                                  {character.archetypeKey}
                                </p>
                              </div>
                              {selectedCharacter?.id === character.id && (
                                <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              <p className="line-clamp-3">
                                {character.summary}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Sparkles className="h-3 w-3" />
                              <span>Ready to play</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Existing Characters */}
                {selectedPath === 'existing' && (
                  <div>
                    {userCharacters.length === 0 ? (
                      <Card>
                        <CardContent className="p-6 text-center">
                          <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                          <h3 className="font-medium mb-2">No Characters Yet</h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            You don't have any characters for this world yet
                          </p>
                          <Button
                            variant="outline"
                            onClick={() => handlePathSelect('new')}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Create Your First Character
                          </Button>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {userCharacters.map((character) => (
                          <Card 
                            key={character.id} 
                            className={`cursor-pointer transition-all ${
                              selectedCharacter?.id === character.id 
                                ? 'ring-2 ring-primary shadow-md' 
                                : 'hover:shadow-md'
                            }`}
                            onClick={() => handleCharacterSelect(character)}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
                                  <User className="h-6 w-6 text-white" />
                                </div>
                                <div className="flex-1">
                                  <h4 className="font-medium">{character.name}</h4>
                                  <p className="text-sm text-muted-foreground">
                                    {character.class || 'Adventurer'}
                                  </p>
                                  {/* Show skills for PlayerV3 characters */}
                                  {(character as any).worldData?.playerV3?.skills && (
                                    <div className="mt-2">
                                      <CharacterSkills 
                                        skills={(character as any).worldData.playerV3.skills} 
                                        maxSkills={2}
                                      />
                                    </div>
                                  )}
                                  <div className="flex items-center gap-2 mt-1">
                                    <Calendar className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">
                                      Created {new Date(character.createdAt).toLocaleDateString()}
                                    </span>
                                  </div>
                                </div>
                                {selectedCharacter?.id === character.id && (
                                  <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Create New Character */}
                {selectedPath === 'new' && (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Plus className="h-8 w-8 text-white" />
                      </div>
                      <h3 className="font-semibold mb-2">Create Your Character</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Design a custom character with unique traits and abilities
                      </p>
                      <Button
                        onClick={handleCreateNewCharacter}
                        disabled={!isInvited}
                        size="lg"
                        className="px-8"
                      >
                        <Plus className="h-5 w-5 mr-2" />
                        Start Creating
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {/* Start Adventure Button */}
                {selectedCharacter && selectedPath !== 'new' && (
                  <div className="flex justify-center pt-6">
                    <Button
                      onClick={handleStartAdventure}
                      disabled={!isInvited || isStarting}
                      size="lg"
                      className="px-8"
                    >
                      {isStarting ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin mr-2" />
                          Starting Adventure...
                        </>
                      ) : (
                        <>
                          <Play className="h-5 w-5 mr-2" />
                          {selectedPath === 'premade' && 'archetypeKey' in selectedCharacter
                            ? `Start with ${selectedCharacter.displayName}`
                            : `Start with ${'name' in selectedCharacter ? selectedCharacter.name : selectedCharacter.displayName}`
                          }
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CharacterSelectionPage() {
  return <CharacterSelectionPageContent />;
}
