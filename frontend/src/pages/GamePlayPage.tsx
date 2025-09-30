import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiService } from '../services/api';
import type { StoryAction } from 'shared';

export default function GamePlayPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: gameSave, isLoading, refetch } = useQuery({
    queryKey: ['game', gameId],
    queryFn: () => apiService.getGameSave(gameId!),
    enabled: !!gameId,
  });

  const { data: character } = useQuery({
    queryKey: ['character', gameSave?.characterId],
    queryFn: () => apiService.getCharacter(gameSave!.characterId),
    enabled: !!gameSave?.characterId,
  });

  const storyActionMutation = useMutation({
    mutationFn: (action: StoryAction) => apiService.processStoryAction(gameId!, action),
    onSuccess: () => {
      refetch();
      setInputValue('');
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gameSave?.storyState.history]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const action: StoryAction = {
      type: 'action',
      content: inputValue.trim(),
    };

    storyActionMutation.mutate(action);
  };

  const handleSuggestedAction = (suggestion: string) => {
    setInputValue(suggestion);
  };

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="spinner" role="status" aria-label="Loading game">
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    );
  }

  if (!gameSave) {
    return (
      <div className="error-screen">
        <p>Game not found</p>
        <button onClick={() => navigate('/characters')} className="btn btn-primary">
          Back to Characters
        </button>
      </div>
    );
  }

  return (
    <div className="game-play-page">
      <header className="game-header">
        <div className="game-info">
          <h1>{gameSave.name}</h1>
          {character && (
            <div className="character-summary">
              <span>{character.name}</span>
              <span>Lv {character.level}</span>
              <span>HP: {character.currentHealth}/{character.maxHealth}</span>
            </div>
          )}
        </div>
        <button
          onClick={() => navigate('/characters')}
          className="btn btn-secondary"
          aria-label="Exit game"
        >
          Exit
        </button>
      </header>

      <main className="game-content">
        <div className="story-container" role="log" aria-live="polite" aria-atomic="false">
          {gameSave.storyState.history.length === 0 ? (
            <div className="story-message narrator">
              <p>Welcome to your adventure! What would you like to do?</p>
            </div>
          ) : (
            gameSave.storyState.history.map((entry, index) => (
              <div
                key={index}
                className={`story-message ${entry.role}`}
                role="article"
                aria-label={`${entry.role} message`}
              >
                <div className="message-role">{entry.role}</div>
                <p>{entry.content}</p>
                {entry.emotion && (
                  <span className="emotion-tag" aria-label={`Emotion: ${entry.emotion}`}>
                    {entry.emotion}
                  </span>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="action-suggestions" aria-label="Suggested actions">
          {storyActionMutation.data?.aiResponse?.suggestedActions && (
            <>
              <p className="suggestions-label">Suggested actions:</p>
              <div className="suggestions-grid">
                {storyActionMutation.data.aiResponse.suggestedActions.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestedAction(suggestion)}
                    className="suggestion-btn"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <form onSubmit={handleSubmit} className="action-input-form">
          <label htmlFor="action-input" className="sr-only">
            Enter your action
          </label>
          <input
            id="action-input"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="What do you do?"
            disabled={storyActionMutation.isPending}
            aria-busy={storyActionMutation.isPending}
            autoComplete="off"
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={storyActionMutation.isPending || !inputValue.trim()}
            aria-busy={storyActionMutation.isPending}
          >
            {storyActionMutation.isPending ? 'Processing...' : 'Act'}
          </button>
        </form>

        {storyActionMutation.isError && (
          <div className="error-message" role="alert">
            Failed to process action. Please try again.
          </div>
        )}
      </main>
    </div>
  );
}
