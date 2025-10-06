import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface WorldData {
  slug: string;
  title: string;
  name: string; // Keep for backward compatibility
  tagline?: string;
  description?: string;
  rules?: any[];
  tags?: string[];
  adventures?: any[];
}

export interface AdventureData {
  slug: string;
  title: string;
  name: string; // Keep for backward compatibility
  description?: string;
  worldId?: string;
  tags?: string[];
  scenarios?: Array<{
    slug: string;
    name: string;
  }>;
}

/**
 * Content Service - manages static content loading and transformation
 * Handles loading world and adventure data from static files
 */
export class ContentService {
  private static worldsCache: WorldData[] | null = null;
  private static adventuresCache: AdventureData[] | null = null;

  /**
   * Load static world data from JSON files
   */
  static loadStaticWorlds(): WorldData[] {
    try {
      // Path to the frontend mock data - try multiple possible locations
      const possiblePaths = [
        join(__dirname, '../../../frontend/src/mock/worlds.json'), // From backend/dist/services
        join(__dirname, '../../../../frontend/src/mock/worlds.json'), // From backend/dist
        join(process.cwd(), 'frontend/src/mock/worlds.json'), // From project root
        join(process.cwd(), '../frontend/src/mock/worlds.json'), // From backend directory
      ];
      
      let worldsPath = '';
      for (const path of possiblePaths) {
        try {
          readFileSync(path, 'utf-8');
          worldsPath = path;
          break;
        } catch (e) {
          // Continue to next path
        }
      }
      
      if (!worldsPath) {
        console.warn(`Could not find worlds.json in any of the expected locations: ${possiblePaths.join(', ')}`);
        // Return mock data if file not found
        return [
          {
            slug: 'mystika',
            title: 'Mystika',
            name: 'Mystika',
            tagline: 'Crystalborn Legacy & Veil-Seeped Realms',
            description: 'A realm where the Veil between worlds has grown thin',
            rules: [
              {
                id: 'veil_stability',
                name: 'Veil Stability',
                description: 'The integrity of the barrier between worlds',
                type: 'meter',
                min: 0,
                max: 100,
                current: 65
              }
            ],
            tags: ['high-fantasy', 'shifters', 'elves', 'crystalborn'],
            adventures: []
          }
        ];
      }
      
      const worldsData = readFileSync(worldsPath, 'utf-8');
      const rawWorlds = JSON.parse(worldsData);
      
      // Transform to our expected format
      return rawWorlds.map((world: any) => ({
        slug: world.id,
        title: world.title, // Preserve title field
        name: world.title, // Keep name for backward compatibility
        tagline: world.tagline, // Preserve tagline field
        description: world.description,
        rules: world.rules,
        tags: world.tags,
        adventures: [] // Will be populated by loadStaticAdventures
      }));
    } catch (error) {
      console.error('Error loading static worlds data:', error);
      return [];
    }
  }

  /**
   * Load static adventure data from JSON files
   */
  static loadStaticAdventures(): AdventureData[] {
    try {
      // Path to the frontend mock data - try multiple possible locations
      const possiblePaths = [
        join(__dirname, '../../../frontend/src/mock/adventures.json'), // From backend/dist/services
        join(__dirname, '../../../../frontend/src/mock/adventures.json'), // From backend/dist
        join(process.cwd(), 'frontend/src/mock/adventures.json'), // From project root
        join(process.cwd(), '../frontend/src/mock/adventures.json'), // From backend directory
      ];
      
      let adventuresPath = '';
      for (const path of possiblePaths) {
        try {
          readFileSync(path, 'utf-8');
          adventuresPath = path;
          break;
        } catch (e) {
          // Continue to next path
        }
      }
      
      if (!adventuresPath) {
        console.warn(`Could not find adventures.json in any of the expected locations: ${possiblePaths.join(', ')}`);
        // Return mock data if file not found
        return [
          {
            slug: 'mystika-tutorial',
            title: 'The Mystika Tutorial',
            name: 'The Mystika Tutorial',
            description: 'A young Crystalborn discovers their powers during a Veil-storm',
            worldId: 'mystika',
            tags: ['beginner', 'crystalborn', 'veil-storm'],
            scenarios: [
              { slug: 'mystika-tutorial-scenario-1', name: 'Awaken to your Crystalborn powers' },
              { slug: 'mystika-tutorial-scenario-2', name: 'Choose your allegiance among the three factions' }
            ]
          }
        ];
      }
      
      const adventuresData = readFileSync(adventuresPath, 'utf-8');
      const rawAdventures = JSON.parse(adventuresData);
      
      // Transform to our expected format
      return rawAdventures.map((adventure: any) => ({
        slug: adventure.id,
        title: adventure.title, // Preserve title field
        name: adventure.title, // Keep name for backward compatibility
        description: adventure.description,
        worldId: adventure.worldId,
        tags: adventure.tags,
        scenarios: adventure.scenarios?.map((scenario: string, index: number) => ({
          slug: `${adventure.id}-scenario-${index + 1}`,
          name: scenario,
        })) || []
      }));
    } catch (error) {
      console.error('Error loading static adventures data:', error);
      return [];
    }
  }

  /**
   * Get all worlds with adventures populated
   */
  static async getWorlds(): Promise<WorldData[]> {
    // Return cached data if available
    if (this.worldsCache) {
      return this.worldsCache;
    }

    try {
      const worlds = this.loadStaticWorlds();
      const adventures = this.loadStaticAdventures();
      
      // Populate adventures for each world
      const worldsWithAdventures = worlds.map(world => ({
        ...world,
        adventures: adventures.filter(adventure => 
          adventure.tags?.some((tag: string) => world.tags?.includes(tag))
        )
      }));

      // Cache the result
      this.worldsCache = worldsWithAdventures;
      
      return worldsWithAdventures;
    } catch (error) {
      console.error('Error getting worlds:', error);
      return [];
    }
  }

  /**
   * Get all adventures
   */
  static async getAdventures(): Promise<AdventureData[]> {
    // Return cached data if available
    if (this.adventuresCache) {
      return this.adventuresCache;
    }

    try {
      const adventures = this.loadStaticAdventures();
      
      // Cache the result
      this.adventuresCache = adventures;
      
      return adventures;
    } catch (error) {
      console.error('Error getting adventures:', error);
      return [];
    }
  }

  /**
   * Get a specific world by slug
   */
  static async getWorldBySlug(slug: string): Promise<WorldData | null> {
    const worlds = await this.getWorlds();
    return worlds.find(world => world.slug === slug) || null;
  }

  /**
   * Get a specific adventure by slug
   */
  static async getAdventureBySlug(slug: string): Promise<AdventureData | null> {
    const adventures = await this.getAdventures();
    return adventures.find(adventure => adventure.slug === slug) || null;
  }

  /**
   * Clear caches (useful for testing)
   */
  static clearCaches(): void {
    this.worldsCache = null;
    this.adventuresCache = null;
  }

  /**
   * Get cache status (useful for testing)
   */
  static getCacheStatus(): { worldsCached: boolean; adventuresCached: boolean } {
    return {
      worldsCached: this.worldsCache !== null,
      adventuresCached: this.adventuresCache !== null
    };
  }
}

// Export singleton instance
export const contentService = new ContentService();
