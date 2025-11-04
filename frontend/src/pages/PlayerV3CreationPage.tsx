import { useParams, useNavigate } from 'react-router-dom';
import { PlayerV3Wizard } from '../components/character/PlayerV3Wizard';
import type { PlayerV3 } from '@shared';
import { useStoryQuery } from '@/lib/queries';

export default function PlayerV3CreationPage() {
  // Support both legacy and new param names
  const { storyId, adventureId, adventureSlug } = useParams<{
    storyId?: string;
    adventureId?: string;
    adventureSlug?: string;
  }>();
  const navigate = useNavigate();

  const currentId = storyId || adventureId || adventureSlug || '';

  // Load story via catalog API
  const { data: storyResp, isLoading } = useStoryQuery(currentId);
  const adventure = storyResp?.data;

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

  if (!adventure || !currentId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Story Not Found</h1>
          <p className="text-muted-foreground mb-4">
            The requested story could not be found.
          </p>
          <button 
            onClick={() => navigate('/stories')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Back to Stories
          </button>
        </div>
      </div>
    );
  }

  // Prefer joined world.slug, then world_slug field, then safe default
  const worldSlug = adventure.world?.slug || adventure.world_slug || 'mystika';

  const handleCharacterCreated = (_character: PlayerV3) => {
    // Navigate back to character selection
    navigate(`/stories/${currentId}/characters`);
  };

  const handleCancel = () => {
    navigate(`/stories/${currentId}/characters`);
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
