import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { CharacterCreator } from '../components/character/CharacterCreator';
import { mockDataService } from '../services/mockData';
import type { Character } from '../services/mockData';
import { 
  ArrowLeft, 
  Plus, 
  User, 
  Calendar,
  Sparkles
} from 'lucide-react';

export default function CharacterSelectionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showCreator, setShowCreator] = useState(false);
  const [isInvited] = useState(mockDataService.getInviteStatus().invited);
  
  const adventure = id ? mockDataService.getAdventureById(id) : null;
  const world = adventure ? mockDataService.getWorldById(adventure.worldId) : null;
  const existingCharacters = world ? mockDataService.getCharactersByWorld(world.id) : [];
  const currentTier = mockDataService.getCurrentTier();
  const limits = mockDataService.getLimitsByTier(currentTier);
  
  if (!adventure || !world) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Adventure Not Found</h1>
          <Button onClick={() => navigate('/adventures')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Adventures
          </Button>
        </div>
      </div>
    );
  }

  const handleSelectCharacter = (character: Character) => {
    if (!isInvited) {
      // Show invite gate
      return;
    }
    // Navigate to game with this character
    navigate(`/game/${adventure.id}-${character.id}`);
  };

  const handleCreateCharacter = () => {
    if (!isInvited) {
      // Show invite gate
      return;
    }
    setShowCreator(true);
  };

  const handleCharacterCreated = (character: Character) => {
    setShowCreator(false);
    // Navigate to game with new character
    navigate(`/game/${adventure.id}-${character.id}`);
  };

  const canCreateCharacter = existingCharacters.length < limits.maxCharacters;

  if (showCreator) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => setShowCreator(false)}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Character Selection
            </Button>
            <h1 className="text-2xl font-bold">Create Character</h1>
            <p className="text-muted-foreground">
              Create a new character for {world.title}
            </p>
          </div>
          
          <CharacterCreator
            worldId={world.id}
            onCharacterCreated={handleCharacterCreated}
            onCancel={() => setShowCreator(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => navigate(`/adventures/${adventure.id}`)}
        className="mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Adventure
      </Button>

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Choose Your Character</h1>
          <p className="text-muted-foreground">
            Select an existing character or create a new one for <strong>{adventure.title}</strong>
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Existing Characters */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Existing Characters</h2>
              <Badge variant="outline">
                {existingCharacters.length.toString()}/{limits.maxCharacters.toString()}
              </Badge>
            </div>

            {existingCharacters.length === 0 ? (
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
              <div className="space-y-3">
                {existingCharacters.map((character) => (
                  <Card key={character.id} className="cursor-pointer hover:shadow-md transition-shadow">
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
                        <Button
                          size="sm"
                          onClick={() => handleSelectCharacter(character)}
                          disabled={!isInvited}
                        >
                          {isInvited ? 'Select' : 'Invite Required'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Create New Character */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Create New Character</h2>
            
            {!canCreateCharacter ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-medium mb-2">Character Limit Reached</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    You've reached your maximum number of characters ({limits.maxCharacters.toString()})
                  </p>
                  <Button variant="outline" onClick={() => navigate('/payments')}>
                    Upgrade to Create More
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Plus className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="font-medium mb-2">Create New Character</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Design a new character specifically for {world.title}
                  </p>
                  <Button
                    onClick={handleCreateCharacter}
                    disabled={!isInvited}
                    className="w-full"
                  >
                    {isInvited ? 'Create Character' : 'Invite Required'}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
