import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CharacterCreator } from '../components/character/CharacterCreator';
import { Breadcrumbs } from '../components/layout/Breadcrumbs';
import { Button } from '../components/ui/button';
import { mockDataService } from '../services/mockData';
import type { Character } from '../services/mockData';
import { createGame } from '../lib/api';
import { Loader2 } from 'lucide-react';

export default function CharacterCreatorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isCreatingGame, setIsCreatingGame] = useState(false);
  const [gameCreationError, setGameCreationError] = useState<string | null>(null);
  
  const adventure = id ? mockDataService.getAdventureById(id) : null;
  const world = adventure ? mockDataService.getWorldById(adventure.worldId) : null;
  
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

  const handleCharacterCreated = async (character: Character) => {
    if (!adventure) return;

    setIsCreatingGame(true);
    setGameCreationError(null);

    try {
      // Create a real game with UUID
      const result = await createGame(adventure.id, character.id);
      
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

  const handleCancel = () => {
    navigate(`/adventures/${adventure.id}/characters`);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumbs />
      
      {/* Error Display */}
      {gameCreationError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{gameCreationError}</p>
        </div>
      )}

      {/* Loading Overlay */}
      {isCreatingGame && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Creating your game...</span>
          </div>
        </div>
      )}

      <CharacterCreator
        worldId={world.id}
        onCharacterCreated={handleCharacterCreated}
        onCancel={handleCancel}
      />
    </div>
  );
}
