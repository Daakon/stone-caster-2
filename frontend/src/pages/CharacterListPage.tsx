import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiService } from '../services/api';

export default function CharacterListPage() {
  const { data: characters, isLoading, refetch } = useQuery({
    queryKey: ['characters'],
    queryFn: () => apiService.getCharacters(),
  });

  useEffect(() => {
    refetch();
  }, [refetch]);

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="spinner" role="status" aria-label="Loading characters">
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="character-list-page">
      <header>
        <h1>My Characters</h1>
        <Link to="/characters/create" className="btn btn-primary">
          Create New Character
        </Link>
      </header>

      <div className="character-grid" role="list" aria-label="Character list">
        {characters && characters.length > 0 ? (
          characters.map((character) => (
            <div key={character.id} className="character-card" role="listitem">
              <h2>{character.name}</h2>
              <p className="character-details">
                Level {character.level} {character.race} {character.class}
              </p>
              <div className="character-stats">
                <span>HP: {character.currentHealth}/{character.maxHealth}</span>
                <span>XP: {character.experience}</span>
              </div>
              <Link
                to="/worlds"
                state={{ characterId: character.id }}
                className="btn btn-secondary"
              >
                Start Adventure
              </Link>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <p>No characters yet. Create your first character to begin!</p>
            <Link to="/characters/create" className="btn btn-primary">
              Create Character
            </Link>
          </div>
        )}
      </div>

      <nav aria-label="Return navigation">
        <Link to="/" className="btn btn-link">
          ← Back to Home
        </Link>
      </nav>
    </div>
  );
}
