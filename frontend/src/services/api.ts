import type { Character, GameSave, WorldTemplate, StoryAction, AIResponse, DiceRoll, DiceRollResult } from 'shared';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:3000' : 'https://api.stonecaster.ai');

class ApiService {
  private async fetchWithAuth(url: string, options: RequestInit = {}) {
    const token = localStorage.getItem('supabase.auth.token');
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
      ...(token && { 'Authorization': `Bearer ${token}` }),
    };

    const response = await fetch(`${API_URL}${url}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  }

  // Characters
  async getCharacters(): Promise<Character[]> {
    return this.fetchWithAuth('/api/characters');
  }

  async getCharacter(id: string): Promise<Character> {
    return this.fetchWithAuth(`/api/characters/${id}`);
  }

  async createCharacter(character: Partial<Character>): Promise<Character> {
    return this.fetchWithAuth('/api/characters', {
      method: 'POST',
      body: JSON.stringify(character),
    });
  }

  async updateCharacter(id: string, character: Partial<Character>): Promise<Character> {
    return this.fetchWithAuth(`/api/characters/${id}`, {
      method: 'PUT',
      body: JSON.stringify(character),
    });
  }

  async deleteCharacter(id: string): Promise<void> {
    return this.fetchWithAuth(`/api/characters/${id}`, {
      method: 'DELETE',
    });
  }

  async generateCharacterSuggestions(race: string, characterClass: string): Promise<{
    backstory: string;
    personality: string;
    goals: string[];
  }> {
    return this.fetchWithAuth('/api/characters/suggest', {
      method: 'POST',
      body: JSON.stringify({ race, class: characterClass }),
    });
  }

  // Game Saves
  async getGameSaves(): Promise<GameSave[]> {
    return this.fetchWithAuth('/api/games');
  }

  async getGameSave(id: string): Promise<GameSave> {
    return this.fetchWithAuth(`/api/games/${id}`);
  }

  async createGameSave(gameSave: Partial<GameSave>): Promise<GameSave> {
    return this.fetchWithAuth('/api/games', {
      method: 'POST',
      body: JSON.stringify(gameSave),
    });
  }

  async updateGameSave(id: string, gameSave: Partial<GameSave>): Promise<GameSave> {
    return this.fetchWithAuth(`/api/games/${id}`, {
      method: 'PUT',
      body: JSON.stringify(gameSave),
    });
  }

  async deleteGameSave(id: string): Promise<void> {
    return this.fetchWithAuth(`/api/games/${id}`, {
      method: 'DELETE',
    });
  }

  // World Templates
  async getWorldTemplates(): Promise<WorldTemplate[]> {
    return this.fetchWithAuth('/api/worlds');
  }

  async getWorldTemplate(id: string): Promise<WorldTemplate> {
    return this.fetchWithAuth(`/api/worlds/${id}`);
  }

  async createWorldTemplate(template: Partial<WorldTemplate>): Promise<WorldTemplate> {
    return this.fetchWithAuth('/api/worlds', {
      method: 'POST',
      body: JSON.stringify(template),
    });
  }

  async updateWorldTemplate(id: string, template: Partial<WorldTemplate>): Promise<WorldTemplate> {
    return this.fetchWithAuth(`/api/worlds/${id}`, {
      method: 'PUT',
      body: JSON.stringify(template),
    });
  }

  async deleteWorldTemplate(id: string): Promise<void> {
    return this.fetchWithAuth(`/api/worlds/${id}`, {
      method: 'DELETE',
    });
  }

  // Story
  async processStoryAction(gameSaveId: string, action: StoryAction): Promise<{
    aiResponse: AIResponse;
    skillCheckResult?: unknown;
  }> {
    return this.fetchWithAuth('/api/story', {
      method: 'POST',
      body: JSON.stringify({ ...action, gameSaveId }),
    });
  }

  // Dice
  async rollDice(diceRoll: DiceRoll): Promise<DiceRollResult> {
    return this.fetchWithAuth('/api/dice', {
      method: 'POST',
      body: JSON.stringify(diceRoll),
    });
  }

  async rollMultipleDice(rolls: DiceRoll[]): Promise<DiceRollResult[]> {
    return this.fetchWithAuth('/api/dice/multiple', {
      method: 'POST',
      body: JSON.stringify({ rolls }),
    });
  }
}

export const apiService = new ApiService();
