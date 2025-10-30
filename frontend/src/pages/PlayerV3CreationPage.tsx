import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PlayerV3Wizard } from '../components/character/PlayerV3Wizard';
import { mockDataService } from '../services/mockData';
import type { PlayerV3 } from '@shared';

export default function PlayerV3CreationPage() {
  const { adventureId } = useParams<{ adventureId: string }>();
  const navigate = useNavigate();

  // Get adventure data to determine world slug
  const { data: adventure, isLoading } = useQuery({
    queryKey: ['adventure', adventureId],
    queryFn: async () => {
      if (!adventureId) return null;
      return mockDataService.getStoryById(adventureId);
    },
    enabled: !!adventureId,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!adventure || !adventureId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Adventure Not Found</h1>
          <p className="text-muted-foreground mb-4">
            The requested adventure could not be found.
          </p>
          <button 
            onClick={() => navigate('/adventures')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Back to Adventures
          </button>
        </div>
      </div>
    );
  }

  const worldSlug = adventure.worldId || 'mystika';

  const handleCharacterCreated = (_character: PlayerV3) => {
    // Navigate back to character selection
    navigate(`/adventures/${adventureId}/characters`);
  };

  const handleCancel = () => {
    navigate(`/adventures/${adventureId}/characters`);
  };

  return (
    <div className="min-h-screen bg-background">
      <PlayerV3Wizard
        worldSlug={worldSlug}
        onCharacterCreated={handleCharacterCreated}
        onCancel={handleCancel}
      />
    </div>
  );
}
