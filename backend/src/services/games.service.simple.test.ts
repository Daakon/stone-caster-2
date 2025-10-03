import { describe, it, expect, vi } from 'vitest';
import { GamesService } from './games.service.js';

describe('GamesService - Simple Tests', () => {
  it('should create GamesService instance', () => {
    const gamesService = new GamesService();
    expect(gamesService).toBeDefined();
    expect(gamesService).toBeInstanceOf(GamesService);
  });

  it('should have required methods', () => {
    const gamesService = new GamesService();
    expect(typeof gamesService.spawn).toBe('function');
    expect(typeof gamesService.getGameById).toBe('function');
    expect(typeof gamesService.getGames).toBe('function');
    expect(typeof gamesService.loadGame).toBe('function');
  });
});
