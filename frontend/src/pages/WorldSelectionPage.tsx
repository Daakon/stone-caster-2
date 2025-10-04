import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { getWorldTemplates, createGameSave } from '../lib/api';

export default function WorldSelectionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const characterId = location.state?.characterId;

  const { data: worlds, isLoading } = useQuery({
    queryKey: ['worlds'],
    queryFn: async () => {
      const result = await getWorldTemplates();
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
  });

  const createGameMutation = useMutation({
    mutationFn: async (worldTemplateId: string) => {
      const result = await createGameSave({
        characterId,
        worldTemplateId,
        name: `New Adventure - ${new Date().toLocaleDateString()}`,
        storyState: {
          currentScene: 'beginning',
          history: [],
          npcs: [],
          worldState: {},
        },
      });
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    onSuccess: (gameSave) => {
      navigate(`/play/${gameSave.id}`);
    },
  });

  const handleWorldSelect = (worldId: string) => {
    if (!characterId) {
      alert('Please select a character first');
      navigate('/characters');
      return;
    }
    createGameMutation.mutate(worldId);
  };

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="spinner" role="status" aria-label="Loading worlds">
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="world-selection-page">
      <header>
        <h1>Choose Your World</h1>
        <p>Select a world template to begin your adventure</p>
      </header>

      <div className="world-grid" role="list" aria-label="World templates">
        {worlds && worlds.map((world) => (
          <div key={world.id} className="world-card" role="listitem">
            <div className="world-genre">{world.genre}</div>
            <h2>{world.name}</h2>
            <p className="world-description">{world.description}</p>
            <div className="world-meta">
              <span>Difficulty: {world.rules.difficultyLevel}</span>
              <span>Combat: {world.rules.combatSystem}</span>
            </div>
            <button
              onClick={() => handleWorldSelect(world.id)}
              className="btn btn-primary"
              disabled={createGameMutation.isPending}
              aria-busy={createGameMutation.isPending}
            >
              {createGameMutation.isPending ? 'Starting...' : 'Start Adventure'}
            </button>
          </div>
        ))}
      </div>

      <nav aria-label="Return navigation">
        <button
          onClick={() => navigate('/characters')}
          className="btn btn-link"
        >
          ← Back to Characters
        </button>
      </nav>
    </div>
  );
}
