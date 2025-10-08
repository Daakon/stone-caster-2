import { supabaseAdmin } from './supabase.js';
import type { PlayerV3 } from '@shared';

export class PlayerV3Service {
  /**
   * Get a PlayerV3 character by ID from the characters table
   */
  static async getPlayerById(playerId: string): Promise<PlayerV3 | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('characters')
        .select('*')
        .eq('id', playerId)
        .single();

      if (error) {
        console.error('Error fetching character:', error);
        return null;
      }

      // Check if this character has PlayerV3 data
      if (data.world_data?.playerV3) {
        return data.world_data.playerV3;
      }

      return null;
    } catch (error) {
      console.error('PlayerV3Service.getPlayerById error:', error);
      return null;
    }
  }

  /**
   * Get PlayerV3 characters by user and world
   */
  static async getPlayersByUserAndWorld(
    userId: string | null, 
    cookieId: string | null, 
    worldSlug: string
  ): Promise<PlayerV3[]> {
    try {
      const query = supabaseAdmin
        .from('players_v3')
        .select('*')
        .eq('world_slug', worldSlug);

      if (userId) {
        query.eq('user_id', userId);
      } else if (cookieId) {
        query.eq('cookie_id', cookieId);
      } else {
        return [];
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching PlayerV3 players:', error);
        return [];
      }

      return data.map(player => this.mapPlayerFromDb(player));
    } catch (error) {
      console.error('PlayerV3Service.getPlayersByUserAndWorld error:', error);
      return [];
    }
  }

  /**
   * Convert PlayerV3 to prompt-compatible format
   */
  static toPromptFormat(player: PlayerV3): any {
    return {
      id: player.id,
      name: player.name,
      role: player.role,
      race: player.race,
      essence: player.essence,
      age: player.age,
      build: player.build,
      eyes: player.eyes,
      traits: player.traits,
      backstory: player.backstory,
      motivation: player.motivation,
      skills: player.skills,
      inventory: player.inventory,
      relationships: player.relationships,
      goals: player.goals,
      flags: player.flags,
      reputation: player.reputation
    };
  }

  /**
   * Apply adventure start presets to a PlayerV3
   */
  static async applyAdventurePresets(
    player: PlayerV3, 
    adventureStartData: any
  ): Promise<PlayerV3> {
    const updatedPlayer = { ...player };

    // Apply on_start_effects from adventure.start.prompt.json
    if (adventureStartData.on_start_effects) {
      for (const effect of adventureStartData.on_start_effects) {
        switch (effect.act) {
          case 'FLAG_SET':
            updatedPlayer.flags[effect.payload.key] = effect.payload.value;
            break;
            
          case 'REL_DELTA':
            const { who, key, delta, why } = effect.payload;
            if (!updatedPlayer.relationships[who]) {
              updatedPlayer.relationships[who] = {};
            }
            updatedPlayer.relationships[who][key] = 
              (updatedPlayer.relationships[who][key] || 50) + delta;
            break;
            
          case 'STAT_DELTA':
            // Handle stat changes if needed
            break;
            
          default:
            console.warn(`Unknown adventure start effect: ${effect.act}`);
        }
      }
    }

    return updatedPlayer;
  }

  /**
   * Map database record to PlayerV3
   */
  private static mapPlayerFromDb(data: any): PlayerV3 {
    return {
      id: data.id,
      name: data.name,
      role: data.role,
      race: data.race,
      essence: data.essence || [],
      age: data.age,
      build: data.build,
      eyes: data.eyes,
      traits: data.traits || [],
      backstory: data.backstory,
      motivation: data.motivation,
      skills: data.skills || {},
      inventory: data.inventory || [],
      relationships: data.relationships || {},
      goals: data.goals || { short_term: [], long_term: [] },
      flags: data.flags || {},
      reputation: data.reputation || {}
    };
  }
}
