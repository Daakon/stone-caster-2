import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Breadcrumbs } from '../components/layout/Breadcrumbs';
import { mockDataService } from '../services/mockData';
import type { Character } from '../services/mockData';
import { createGame, createCharacter } from '../lib/api';
import { 
  Plus, 
  User, 
  Calendar,
  Sparkles,
  Loader2,
  Zap
} from 'lucide-react';

export default function CharacterCreationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [isInvited] = useState(mockDataService.getInviteStatus().invited);
  const [isCreatingGame, setIsCreatingGame] = useState(false);
  const [gameCreationError, setGameCreationError] = useState<string | null>(null);
  const [userCharacters, setUserCharacters] = useState<Character[]>([]);
  const [premadeCharacters, setPremadeCharacters] = useState<Character[]>([]);
  const [isLoadingCharacters, setIsLoadingCharacters] = useState(true);
  
  const adventure = id ? mockDataService.getAdventureById(id) : null;
  const world = adventure ? mockDataService.getWorldById(adventure.worldId) : null;
  const currentTier = mockDataService.getCurrentTier();
  const limits = mockDataService.getLimitsByTier(currentTier);

  // Load user characters and premade characters
  useEffect(() => {
    const loadCharacters = async () => {
      if (!world) return;
      
      setIsLoadingCharacters(true);
      
      try {
        // Load user's existing characters (from API)
        // For now, using mock data - in real implementation, this would be an API call
        const existingCharacters = mockDataService.getCharactersByWorld(world.id);
        setUserCharacters(existingCharacters);
        
        // Load premade characters for this world
        const premadeData = await import('../mock/premadeCharacters.json');
        const worldPremadeCharacters = premadeData.default.filter(
          (char: any) => char.worldId === world.id
        ) as Character[];
        setPremadeCharacters(worldPremadeCharacters);
        
      } catch (error) {
        console.error('Error loading characters:', error);
      } finally {
        setIsLoadingCharacters(false);
      }
    };

    loadCharacters();
  }, [world]);
  
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

  const handleCharacterSelect = (character: Character) => {
    setSelectedCharacter(character);
  };

  const handleStartGame = async () => {
    if (!isInvited || !adventure || !selectedCharacter) {
      return;
    }

    setIsCreatingGame(true);
    setGameCreationError(null);

    try {
      let characterId = selectedCharacter.id;

      // If it's a premade character, create it first
      if ((selectedCharacter as any).isPremade) {
        const characterData = {
          name: selectedCharacter.name,
          race: selectedCharacter.class, // Using class as race for now
          class: selectedCharacter.class,
          level: 1,
          experience: 0,
          attributes: {
            strength: selectedCharacter.skills?.strength || 50,
            dexterity: selectedCharacter.skills?.dexterity || 50,
            constitution: selectedCharacter.skills?.constitution || 50,
            intelligence: selectedCharacter.skills?.intelligence || 50,
            wisdom: (selectedCharacter.skills as any)?.wisdom || 50,
            charisma: selectedCharacter.skills?.charisma || 50,
          },
          skills: Object.keys(selectedCharacter.skills || {}),
          inventory: [],
          worldSlug: world.id,
        };

        const characterResult = await createCharacter(characterData);
        if (!characterResult.ok) {
          setGameCreationError(characterResult.error.message || 'Failed to create character');
          return;
        }
        characterId = characterResult.data.id;
      }

      // Create a real game with UUID
      const result = await createGame(adventure.id, characterId);
      
      if (!result.ok) {
        setGameCreationError(result.error.message || 'Failed to create game');
        return;
      }

      const game = result.data;
      // Navigate to the real game with UUID
      navigate(`/game/${game.id}`);
      
    } catch (error) {
      console.error('Error creating game:', error);
      setGameCreationError('Failed to create game. Please try again.');
    } finally {
      setIsCreatingGame(false);
    }
  };

  const canCreateCharacter = userCharacters.length < limits.maxCharacters;

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumbs />

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Create Your Character</h1>
          <p className="text-muted-foreground">
            Choose a character to start your adventure in <strong>{adventure.title}</strong>
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
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{gameCreationError}</p>
          </div>
        )}

        {/* Character Selection */}
        <div className="space-y-8">
          {/* User's Existing Characters */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Your Characters</h2>
              <Badge variant="outline">
                {userCharacters.length.toString()}/{limits.maxCharacters.toString()}
              </Badge>
            </div>

            {isLoadingCharacters ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span>Loading characters...</span>
              </div>
            ) : userCharacters.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-medium mb-2">No Characters Yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Create your first character to start this adventure
                  </p>
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
                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                          <User className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium">{character.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {character.class || 'Adventurer'}
                          </p>
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

          {/* Premade Characters */}
          {premadeCharacters.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">Quick Start Characters</h2>
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  Premade
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Choose a premade character to jump right into the adventure
              </p>

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
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center">
                          <Zap className="h-6 w-6 text-secondary-foreground" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium">{character.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {character.class || 'Adventurer'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {character.backstory?.substring(0, 80)}...
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
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Start Game Button */}
          {selectedCharacter && (
            <div className="flex justify-center pt-6">
              <Button
                onClick={handleStartGame}
                disabled={!isInvited || isCreatingGame}
                size="lg"
                className="px-8"
              >
                {isCreatingGame ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Starting Game...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5 mr-2" />
                    {selectedCharacter && (selectedCharacter as any).isPremade 
                      ? `Start Adventure with ${selectedCharacter.name} (Quick Start)`
                      : `Start Adventure with ${selectedCharacter.name}`
                    }
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Create New Character Option */}
          {canCreateCharacter && (
            <div className="text-center pt-4">
              <p className="text-sm text-muted-foreground mb-2">
                Don't see a character you like?
              </p>
              <Button
                variant="outline"
                onClick={() => navigate(`/adventures/${adventure.id}/create-character`)}
                disabled={!isInvited}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create New Character
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}