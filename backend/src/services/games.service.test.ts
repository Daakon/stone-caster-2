import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GamesService } from './games.service.js';
import { CharactersService } from './characters.service.js';
import { WalletService } from './wallet.service.js';
import { ContentService } from './content.service.js';
import { configService } from './config.service.js';
import { supabaseAdmin } from './supabase.js';
import { ApiErrorCode } from 'shared';

// Mock dependencies
vi.mock('./supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn()
  }
}));

vi.mock('./characters.service.js', () => ({
  CharactersService: {
    getCharacterById: vi.fn()
  }
}));

vi.mock('./wallet.service.js', () => ({
  WalletService: {
    getWallet: vi.fn(),
    addCastingStones: vi.fn()
  }
}));

vi.mock('./content.service.js', () => ({
  ContentService: {
    getWorldBySlug: vi.fn()
  }
}));

vi.mock('./config.service.js', () => ({
  configService: {
    getPricing: vi.fn()
  }
}));

const mockSupabaseAdmin = vi.mocked(supabaseAdmin);
const mockCharactersService = vi.mocked(CharactersService);
const mockWalletService = vi.mocked(WalletService);
const mockContentService = vi.mocked(ContentService);
const mockConfigService = vi.mocked(configService);

describe('GamesService', () => {
  let gamesService: GamesService;

  beforeEach(() => {
    gamesService = new GamesService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('spawn', () => {
    const mockAdventure = {
      id: 'adventure-123',
      slug: 'mystika-tutorial',
      title: 'The Mystika Tutorial',
      description: 'Learn the basics of magic',
      world_slug: 'mystika'
    };

    const mockCharacter = {
      id: 'character-123',
      name: 'Test Hero',
      worldSlug: 'mystika',
      activeGameId: undefined,
      userId: 'user-123',
      cookieId: undefined,
      race: 'Human',
      class: 'Mage',
      level: 1,
      experience: 0,
      attributes: {
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      },
      skills: [],
      inventory: [],
      currentHealth: 10,
      maxHealth: 10,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    const mockGame = {
      id: 'game-123',
      adventure_id: 'adventure-123',
      character_id: 'character-123',
      user_id: 'user-123',
      world_slug: 'mystika',
      state_snapshot: {},
      turn_count: 0,
      status: 'active',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      last_played_at: '2024-01-01T00:00:00Z',
    };

    it('should successfully spawn a game for authenticated user', async () => {
      // Mock adventure lookup
      mockSupabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockAdventure,
                error: null
              })
            })
          })
        })
      } as any);

      // Mock character validation
      mockCharactersService.getCharacterById.mockResolvedValue(mockCharacter);

      // Mock starter stones grant
      mockConfigService.getPricing.mockReturnValue({
        guestStarterCastingStones: 100,
        turnCostDefault: 10,
        turnCostByWorld: {},
        guestDailyRegen: 5,
        conversionRates: { shard: 1, crystal: 5, relic: 25 }
      });
      mockWalletService.getWallet.mockResolvedValue({
        id: 'wallet-123',
        userId: 'user-123',
        castingStones: 0,
        inventoryShard: 0,
        inventoryCrystal: 0,
        inventoryRelic: 0,
        dailyRegen: 0,
        lastRegenAt: '2024-01-01T00:00:00Z',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      });
      // Mock getGames method
      vi.spyOn(gamesService, 'getGames').mockResolvedValue([]); // No existing games

      // Mock game creation
      mockSupabaseAdmin.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockGame,
              error: null
            })
          })
        })
      } as any);

      // Mock character update
      mockSupabaseAdmin.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: null
          })
        })
      } as any);

      // Mock world lookup
      mockContentService.getWorldBySlug.mockResolvedValue({
        slug: 'mystika',
        name: 'Mystika',
        description: 'A mystical realm',
        rules: [],
        tags: [],
        adventures: []
      });

      const result = await gamesService.spawn({
        adventureSlug: 'mystika-tutorial',
        characterId: 'character-123',
        ownerId: 'user-123',
        isGuest: false
      });

      expect(result.success).toBe(true);
      expect(result.game).toBeDefined();
      expect(result.game?.id).toBe('game-123');
      expect(result.game?.adventureTitle).toBe('The Mystika Tutorial');
    });

    it('should return NOT_FOUND when adventure does not exist', async () => {
      // Mock adventure not found
      mockSupabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' }
              })
            })
          })
        })
      } as any);

      const result = await gamesService.spawn({
        adventureSlug: 'nonexistent-adventure',
        characterId: 'character-123',
        ownerId: 'user-123',
        isGuest: false
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(ApiErrorCode.NOT_FOUND);
      expect(result.message).toBe('Adventure not found');
    });

    it('should return NOT_FOUND when character does not exist', async () => {
      // Mock adventure lookup
      mockSupabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockAdventure,
                error: null
              })
            })
          })
        })
      } as any);

      // Mock character not found
      mockCharactersService.getCharacterById.mockResolvedValue(null);

      const result = await gamesService.spawn({
        adventureSlug: 'mystika-tutorial',
        characterId: 'nonexistent-character',
        ownerId: 'user-123',
        isGuest: false
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(ApiErrorCode.NOT_FOUND);
      expect(result.message).toBe('Character not found');
    });

    it('should return CONFLICT when character is already active in another game', async () => {
      // Mock adventure lookup
      mockSupabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockAdventure,
                error: null
              })
            })
          })
        })
      } as any);

      // Mock character with active game
      const characterWithActiveGame = {
        ...mockCharacter,
        activeGameId: 'existing-game-123'
      };
      mockCharactersService.getCharacterById.mockResolvedValue(characterWithActiveGame);

      const result = await gamesService.spawn({
        adventureSlug: 'mystika-tutorial',
        characterId: 'character-123',
        ownerId: 'user-123',
        isGuest: false
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(ApiErrorCode.CONFLICT);
      expect(result.message).toBe('Character is already active in another game');
    });

    it('should return VALIDATION_FAILED when character and adventure are from different worlds', async () => {
      // Mock adventure lookup
      mockSupabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockAdventure,
                error: null
              })
            })
          })
        })
      } as any);

      // Mock character from different world
      const characterFromDifferentWorld = {
        ...mockCharacter,
        worldSlug: 'aetherium'
      };
      mockCharactersService.getCharacterById.mockResolvedValue(characterFromDifferentWorld);

      const result = await gamesService.spawn({
        adventureSlug: 'mystika-tutorial',
        characterId: 'character-123',
        ownerId: 'user-123',
        isGuest: false
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(ApiErrorCode.VALIDATION_FAILED);
      expect(result.message).toBe('Character and adventure must be from the same world');
    });

    it('should successfully spawn a game for guest user', async () => {
      // Mock adventure lookup
      mockSupabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockAdventure,
                error: null
              })
            })
          })
        })
      } as any);

      // Mock character validation
      mockCharactersService.getCharacterById.mockResolvedValue(mockCharacter);

      // Mock starter stones grant
      mockConfigService.getPricing.mockReturnValue({
        guestStarterCastingStones: 100,
        turnCostDefault: 10,
        turnCostByWorld: {},
        guestDailyRegen: 5,
        conversionRates: { shard: 1, crystal: 5, relic: 25 }
      });
      mockWalletService.getWallet.mockResolvedValue({
        id: 'wallet-123',
        userId: undefined,
        castingStones: 0,
        inventoryShard: 0,
        inventoryCrystal: 0,
        inventoryRelic: 0,
        dailyRegen: 0,
        lastRegenAt: '2024-01-01T00:00:00Z',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      });
      // Mock getGames method
      vi.spyOn(gamesService, 'getGames').mockResolvedValue([]); // No existing games

      // Mock game creation
      mockSupabaseAdmin.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                ...mockGame,
                user_id: undefined,
                cookie_group_id: 'cookie-group-123'
              },
              error: null
            })
          })
        })
      } as any);

      // Mock character update
      mockSupabaseAdmin.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: null
          })
        })
      } as any);

      // Mock world lookup
      mockContentService.getWorldBySlug.mockResolvedValue({
        slug: 'mystika',
        name: 'Mystika',
        description: 'A mystical realm',
        rules: [],
        tags: [],
        adventures: []
      });

      const result = await gamesService.spawn({
        adventureSlug: 'mystika-tutorial',
        characterId: 'character-123',
        ownerId: 'cookie-group-123',
        isGuest: true
      });

      expect(result.success).toBe(true);
      expect(result.game).toBeDefined();
      expect(result.game?.id).toBe('game-123');
    });
  });

  describe('getGameById', () => {
    it('should return game DTO for authenticated user', async () => {
      const mockGameWithJoins = {
        id: 'game-123',
        adventure_id: 'adventure-123',
        character_id: 'character-123',
        user_id: 'user-123',
        world_slug: 'mystika',
        turn_count: 5,
        status: 'active',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        last_played_at: '2024-01-01T00:00:00Z',
        adventures: {
          id: 'adventure-123',
          title: 'The Mystika Tutorial',
          description: 'Learn the basics of magic'
        },
        characters: {
          id: 'character-123',
          name: 'Test Hero'
        }
      };

      // Mock game lookup
      mockSupabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockGameWithJoins,
              error: null
            })
          })
        })
      } as any);

      // Mock world lookup
      mockContentService.getWorldBySlug.mockResolvedValue({
        slug: 'mystika',
        name: 'Mystika',
        description: 'A mystical realm',
        rules: [],
        tags: [],
        adventures: []
      });

      const result = await gamesService.getGameById('game-123', 'user-123', false);

      expect(result).toBeDefined();
      expect(result?.id).toBe('game-123');
      expect(result?.adventureTitle).toBe('The Mystika Tutorial');
      expect(result?.characterName).toBe('Test Hero');
      expect(result?.worldName).toBe('Mystika');
    });

    it('should return null when game is not found', async () => {
      // Mock game not found
      mockSupabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' }
            })
          })
        })
      } as any);

      const result = await gamesService.getGameById('nonexistent-game', 'user-123', false);

      expect(result).toBeNull();
    });
  });

  describe('getGames', () => {
    it('should return games list for authenticated user', async () => {
      const mockGamesList = [
        {
          id: 'game-123',
          turn_count: 5,
          status: 'active',
          last_played_at: '2024-01-01T00:00:00Z',
          adventures: {
            title: 'The Mystika Tutorial',
            world_slug: 'mystika'
          },
          characters: {
            name: 'Test Hero'
          }
        }
      ];

      // Mock games lookup
      mockSupabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            range: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: mockGamesList,
                error: null
              })
            })
          })
        })
      } as any);

      const result = await gamesService.getGames('user-123', false, 20, 0);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('game-123');
      expect(result[0].adventureTitle).toBe('The Mystika Tutorial');
      expect(result[0].characterName).toBe('Test Hero');
    });

    it('should return empty array when no games found', async () => {
      // Mock no games found
      mockSupabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            range: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [],
                error: null
              })
            })
          })
        })
      } as any);

      const result = await gamesService.getGames('user-123', false, 20, 0);

      expect(result).toHaveLength(0);
    });
  });
});