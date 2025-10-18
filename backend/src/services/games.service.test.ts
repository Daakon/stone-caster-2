import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GamesService } from './games.service.js';
import { CharactersService } from './characters.service.js';
import { WalletService } from './wallet.service.js';
import { configService } from './config.service.js';
import { supabaseAdmin } from './supabase.js';
import { resolveAdventureByIdentifier, computeAdventureId } from '../utils/adventure-identity.js';
import { ApiErrorCode } from '@shared';

vi.mock('./supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

vi.mock('./characters.service.js', () => ({
  CharactersService: {
    getCharacterById: vi.fn(),
  },
}));

vi.mock('./wallet.service.js', () => ({
  WalletService: {
    getWallet: vi.fn(),
    addCastingStones: vi.fn(),
  },
}));

vi.mock('./config.service.js', () => ({
  configService: {
    getPricing: vi.fn(),
  },
}));

vi.mock('../utils/adventure-identity.js', () => ({
  resolveAdventureByIdentifier: vi.fn(),
  computeAdventureId: vi.fn((slug: string) => `uuid-${slug}`),
}));

const mockSupabaseAdmin = vi.mocked(supabaseAdmin);
const mockCharactersService = vi.mocked(CharactersService);
const mockWalletService = vi.mocked(WalletService);
const mockConfigService = vi.mocked(configService);
const mockResolveAdventure = vi.mocked(resolveAdventureByIdentifier);
const mockComputeAdventureId = vi.mocked(computeAdventureId);

describe('GamesService.spawn', () => {
  let gamesService: GamesService;

  const resolvedAdventure = {
    id: 'uuid-mystika-tutorial',
    slug: 'mystika-tutorial',
    title: 'The Mystika Tutorial',
    description: 'Learn the basics of magic',
    worldSlug: 'mystika',
    tags: ['tutorial'],
    scenarios: ['Awaken to your Crystalborn powers'],
  };

  const mockCharacter = {
    id: 'character-123',
    name: 'Test Hero',
    worldSlug: 'mystika',
    activeGameId: undefined,
  };

  const mockGameRow = {
    id: 'game-123',
    adventure_id: resolvedAdventure.id,
    character_id: mockCharacter.id,
    user_id: 'user-123',
    world_slug: resolvedAdventure.worldSlug,
    state_snapshot: {
      metadata: {
        adventureSlug: resolvedAdventure.slug,
        adventureTitle: resolvedAdventure.title,
        adventureId: resolvedAdventure.id,
      },
    },
    turn_count: 0,
    status: 'active',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    last_played_at: '2025-01-01T00:00:00Z',
  };

  const mockGameDTO = {
    id: mockGameRow.id,
    adventureId: resolvedAdventure.id,
    adventureTitle: resolvedAdventure.title,
    adventureDescription: resolvedAdventure.description,
    characterId: mockCharacter.id,
    characterName: mockCharacter.name,
    worldSlug: resolvedAdventure.worldSlug,
    worldName: 'Mystika',
    turnCount: 0,
    status: 'active' as const,
    createdAt: mockGameRow.created_at,
    updatedAt: mockGameRow.updated_at,
    lastPlayedAt: mockGameRow.last_played_at,
  };

  beforeEach(() => {
    gamesService = new GamesService();
    vi.clearAllMocks();

    mockComputeAdventureId.mockImplementation((slug: string) => `uuid-${slug}`);

    mockConfigService.getPricing.mockReturnValue({
      turnCostDefault: 1,
      turnCostByWorld: {},
      guestStarterCastingStones: 10,
      guestDailyRegen: 0,
      conversionRates: { shard: 1, crystal: 1, relic: 1 },
    });

    mockWalletService.getWallet.mockResolvedValue({ castingStones: 0 });
    mockWalletService.addCastingStones.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  const buildSupabaseInsertChain = (data: any) => {
    const single = vi.fn().mockResolvedValue({ data, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    return { insert, select, single };
  };

  it('spawns a game for an authenticated user when adventure metadata resolves from fallback', async () => {
    mockResolveAdventure.mockResolvedValue(resolvedAdventure);
    mockCharactersService.getCharacterById.mockResolvedValue({
      ...mockCharacter,
    });

    const insertChain = buildSupabaseInsertChain(mockGameRow);
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq: updateEq });

    mockSupabaseAdmin.from.mockImplementation((table: string) => {
      if (table === 'games') {
        return { insert: insertChain.insert } as any;
      }
      if (table === 'characters') {
        return { update } as any;
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      } as any;
    });

    const getGamesSpy = vi.spyOn(gamesService, 'getGames').mockResolvedValue([]);
    const mapSpy = vi.spyOn(gamesService as any, 'mapGameToDTO').mockResolvedValue(mockGameDTO);

    const result = await gamesService.spawn({
      adventureSlug: resolvedAdventure.slug,
      characterId: mockCharacter.id,
      ownerId: 'user-123',
      isGuest: false,
    });

    expect(result.success).toBe(true);
    expect(result.game).toEqual(mockGameDTO);
    expect(mockResolveAdventure).toHaveBeenCalledWith(resolvedAdventure.slug);
    expect(getGamesSpy).toHaveBeenCalled();
    expect(mapSpy).toHaveBeenCalledWith(mockGameRow);
    expect(insertChain.insert).toHaveBeenCalledWith(expect.objectContaining({
      adventure_id: resolvedAdventure.id,
      world_slug: resolvedAdventure.worldSlug,
    }));
  });

  it('returns NOT_FOUND when the adventure slug cannot be resolved', async () => {
    mockResolveAdventure.mockResolvedValue(null);

    const result = await gamesService.spawn({
      adventureSlug: 'unknown-slug',
      ownerId: 'user-123',
      isGuest: false,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(ApiErrorCode.NOT_FOUND);
    expect(mockSupabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('returns VALIDATION_FAILED when character world does not match adventure world', async () => {
    mockResolveAdventure.mockResolvedValue(resolvedAdventure);
    mockCharactersService.getCharacterById.mockResolvedValue({
      ...mockCharacter,
      worldSlug: 'voidreach',
    });

    const result = await gamesService.spawn({
      adventureSlug: resolvedAdventure.slug,
      characterId: mockCharacter.id,
      ownerId: 'user-123',
      isGuest: false,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(ApiErrorCode.VALIDATION_FAILED);
  });

  it('returns CONFLICT when character already has an active game', async () => {
    mockResolveAdventure.mockResolvedValue(resolvedAdventure);
    mockCharactersService.getCharacterById.mockResolvedValue({
      ...mockCharacter,
      activeGameId: 'existing-game',
    });

    const result = await gamesService.spawn({
      adventureSlug: resolvedAdventure.slug,
      characterId: mockCharacter.id,
      ownerId: 'user-123',
      isGuest: false,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(ApiErrorCode.CONFLICT);
  });
});
