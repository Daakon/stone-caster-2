import { ContentService } from './content.service.js';

export interface WorldValidationResult {
  isValid: boolean;
  world?: {
    slug: string;
    name: string;
    description?: string;
  };
  error?: string;
}

export interface WorldData {
  slug: string;
  name: string;
  description?: string;
  rules?: any[];
  tags?: string[];
  adventures?: any[];
}

/**
 * World Validation Service - validates world slugs against static content
 * Provides caching for performance and handles all world-related validation
 */
export class WorldValidationService {
  private static worldCache: WorldData[] | null = null;
  private static cacheTimestamp: number = 0;
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Validate a world slug against available worlds
   */
  static async validateWorldSlug(worldSlug: string | null | undefined): Promise<WorldValidationResult> {
    try {
      // Check if worldSlug is provided
      if (!worldSlug || typeof worldSlug !== 'string' || worldSlug.trim() === '') {
        return {
          isValid: false,
          error: 'World slug is required'
        };
      }

      // Get worlds (with caching)
      const worlds = await this.getWorlds();
      
      // Find matching world
      const world = worlds.find(w => w.slug === worldSlug);
      
      if (!world) {
        return {
          isValid: false,
          error: `Invalid world slug: ${worldSlug}`
        };
      }

      return {
        isValid: true,
        world: {
          slug: world.slug,
          name: world.name,
          description: world.description
        }
      };
    } catch (error) {
      console.error('WorldValidationService.validateWorldSlug error:', error);
      return {
        isValid: false,
        error: `Failed to validate world slug: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get world data by slug
   */
  static async getWorldData(worldSlug: string): Promise<WorldData | null> {
    try {
      const worlds = await this.getWorlds();
      return worlds.find(w => w.slug === worldSlug) || null;
    } catch (error) {
      console.error('WorldValidationService.getWorldData error:', error);
      return null;
    }
  }

  /**
   * Get all available worlds with caching
   */
  private static async getWorlds(): Promise<WorldData[]> {
    const now = Date.now();
    
    // Return cached data if still valid
    if (this.worldCache && (now - this.cacheTimestamp) < this.CACHE_TTL) {
      return this.worldCache;
    }

    try {
      // Fetch fresh data from content service
      const worlds = await ContentService.getWorlds();
      
      // Update cache
      this.worldCache = worlds;
      this.cacheTimestamp = now;
      
      return worlds;
    } catch (error) {
      console.error('WorldValidationService.getWorlds error:', error);
      
      // Return cached data if available, even if expired
      if (this.worldCache) {
        console.warn('Using expired world cache due to content service error');
        return this.worldCache;
      }
      
      throw error;
    }
  }

  /**
   * Clear the world cache (useful for testing)
   */
  static clearCache(): void {
    this.worldCache = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Get cache status (useful for testing)
   */
  static getCacheStatus(): { hasCache: boolean; isExpired: boolean; age: number } {
    const now = Date.now();
    const hasCache = this.worldCache !== null;
    const isExpired = hasCache && (now - this.cacheTimestamp) >= this.CACHE_TTL;
    const age = hasCache ? now - this.cacheTimestamp : 0;
    
    return { hasCache, isExpired, age };
  }
}
