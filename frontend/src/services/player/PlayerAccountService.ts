import { authService } from '../auth/AuthService';
import type { PlayerProfile, PlayerCharacter, PlayerSave } from 'shared';

class PlayerAccountService {
  private getAuthHeaders(): Record<string, string> {
    const user = authService.getCurrentUser();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (!user) {
      throw new Error('No authenticated user');
    }

    // Add auth token if authenticated
    if (user.state === 'authenticated' && user.key) {
      headers['Authorization'] = `Bearer ${user.key}`;
    } else {
      // Use guest cookie for guest/cookied users
      headers['X-Guest-Cookie'] = user.id;
    }

    return headers;
  }

  async getProfile(): Promise<PlayerProfile | null> {
    try {
      const headers = this.getAuthHeaders();
      const response = await fetch('/api/profile', { headers });
      
      if (!response.ok) {
        if (response.status === 404) {
          return null; // Profile doesn't exist yet
        }
        throw new Error(`Failed to fetch profile: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('[PlayerAccountService] Error fetching profile:', error);
      return null;
    }
  }

  async updateProfile(updates: Partial<PlayerProfile>): Promise<PlayerProfile | null> {
    try {
      const headers = this.getAuthHeaders();
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers,
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        throw new Error(`Failed to update profile: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('[PlayerAccountService] Error updating profile:', error);
      throw error;
    }
  }

  async getCharacters(): Promise<PlayerCharacter[]> {
    try {
      const headers = this.getAuthHeaders();
      const response = await fetch('/api/characters', { headers });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch characters: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('[PlayerAccountService] Error fetching characters:', error);
      return [];
    }
  }

  async getCharacter(characterId: string): Promise<PlayerCharacter | null> {
    try {
      const headers = this.getAuthHeaders();
      const response = await fetch(`/api/characters/${characterId}`, { headers });
      
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to fetch character: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('[PlayerAccountService] Error fetching character:', error);
      return null;
    }
  }

  async createCharacter(characterData: Partial<PlayerCharacter>): Promise<PlayerCharacter | null> {
    try {
      const headers = this.getAuthHeaders();
      const response = await fetch('/api/characters', {
        method: 'POST',
        headers,
        body: JSON.stringify(characterData)
      });

      if (!response.ok) {
        throw new Error(`Failed to create character: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('[PlayerAccountService] Error creating character:', error);
      throw error;
    }
  }

  async updateCharacter(characterId: string, updates: Partial<PlayerCharacter>): Promise<PlayerCharacter | null> {
    try {
      const headers = this.getAuthHeaders();
      const response = await fetch(`/api/characters/${characterId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        throw new Error(`Failed to update character: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('[PlayerAccountService] Error updating character:', error);
      throw error;
    }
  }

  async deleteCharacter(characterId: string): Promise<boolean> {
    try {
      const headers = this.getAuthHeaders();
      const response = await fetch(`/api/characters/${characterId}`, {
        method: 'DELETE',
        headers
      });

      return response.ok;
    } catch (error) {
      console.error('[PlayerAccountService] Error deleting character:', error);
      return false;
    }
  }

  async getSaves(): Promise<PlayerSave[]> {
    try {
      const headers = this.getAuthHeaders();
      const response = await fetch('/api/saves', { headers });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch saves: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('[PlayerAccountService] Error fetching saves:', error);
      return [];
    }
  }

  async getSave(saveId: string): Promise<PlayerSave | null> {
    try {
      const headers = this.getAuthHeaders();
      const response = await fetch(`/api/saves/${saveId}`, { headers });
      
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to fetch save: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('[PlayerAccountService] Error fetching save:', error);
      return null;
    }
  }

  async createSave(saveData: Partial<PlayerSave>): Promise<PlayerSave | null> {
    try {
      const headers = this.getAuthHeaders();
      const response = await fetch('/api/saves', {
        method: 'POST',
        headers,
        body: JSON.stringify(saveData)
      });

      if (!response.ok) {
        throw new Error(`Failed to create save: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('[PlayerAccountService] Error creating save:', error);
      throw error;
    }
  }

  async updateSave(saveId: string, updates: Partial<PlayerSave>): Promise<PlayerSave | null> {
    try {
      const headers = this.getAuthHeaders();
      const response = await fetch(`/api/saves/${saveId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        throw new Error(`Failed to update save: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('[PlayerAccountService] Error updating save:', error);
      throw error;
    }
  }

  async deleteSave(saveId: string): Promise<boolean> {
    try {
      const headers = this.getAuthHeaders();
      const response = await fetch(`/api/saves/${saveId}`, {
        method: 'DELETE',
        headers
      });

      return response.ok;
    } catch (error) {
      console.error('[PlayerAccountService] Error deleting save:', error);
      return false;
    }
  }

  async getGuestAccountSummary(cookieGroupId: string): Promise<any> {
    try {
      const headers = this.getAuthHeaders();
      const response = await fetch(`/api/profile/guest-summary/${cookieGroupId}`, { headers });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch guest account summary: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('[PlayerAccountService] Error fetching guest account summary:', error);
      return null;
    }
  }
}

export const playerAccountService = new PlayerAccountService();