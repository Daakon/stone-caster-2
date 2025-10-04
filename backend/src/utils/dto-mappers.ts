import type {
  Character,
  GameSave,
  WorldTemplate,
  CharacterDTO,
  GameDTO,
  WorldDTO,
  AdventureDTO,
  UserDTO,
  ProfileDTO,
  StonesWalletDTO,
  StonesPackDTO,
  SubscriptionDTO,
  SearchResultDTO,
  TurnResult,
} from 'shared';
import type { Game } from '../services/games.service.js';

// Character DTO mapper (redacts internal fields)
export function toCharacterDTO(character: Character): CharacterDTO {
  return {
    id: character.id,
    name: character.name,
    worldSlug: character.worldSlug,
    createdAt: character.createdAt,
    updatedAt: character.updatedAt,
    // Generic world-specific data
    worldData: character.worldData,
    // Legacy fields for backward compatibility (with defaults)
    race: character.race || 'Unknown',
    class: character.class || 'Adventurer',
    level: character.level || 1,
    experience: character.experience || 0,
    attributes: {
      strength: character.attributes?.strength || 10,
      dexterity: character.attributes?.dexterity || 10,
      constitution: character.attributes?.constitution || 10,
      intelligence: character.attributes?.intelligence || 10,
      wisdom: character.attributes?.wisdom || 10,
      charisma: character.attributes?.charisma || 10,
    },
    skills: character.skills || [],
    inventory: character.inventory || [],
    currentHealth: character.currentHealth || 100,
    maxHealth: character.maxHealth || 100,
    // Explicitly exclude internal fields:
    // - userId (server-only)
    // - cookieId (server-only)
    // - internalFlags (server-only)
    // - systemMetadata (server-only)
  };
}

// Game DTO mapper (from GameSave) - Legacy support
export function toGameDTO(gameSave: GameSave): GameDTO {
  return {
    id: gameSave.id,
    adventureId: gameSave.worldTemplateId, // Assuming this maps to adventure
    adventureTitle: gameSave.name,
    adventureDescription: undefined,
    characterId: gameSave.characterId,
    characterName: undefined, // Would need to fetch character name
    worldSlug: 'unknown', // Would need to fetch from adventure
    worldName: 'Unknown World', // Would need to fetch from adventure
    turnCount: 0, // Would need to calculate from story history
    status: 'active' as const,
    createdAt: gameSave.createdAt,
    updatedAt: gameSave.updatedAt,
    lastPlayedAt: gameSave.lastPlayedAt,
  };
}

// Game DTO mapper (from Game) - Legacy support
export function toGameDTOFromGame(game: Game): GameDTO {
  return {
    id: game.id,
    adventureId: game.adventure_id,
    adventureTitle: `Game ${game.id.slice(0, 8)}`, // Generate a name from the ID
    adventureDescription: undefined,
    characterId: game.character_id || undefined,
    characterName: undefined, // Would need to fetch character name
    worldSlug: game.world_slug,
    worldName: 'Unknown World', // Would need to fetch from adventure
    turnCount: game.turn_count,
    status: game.status,
    createdAt: game.created_at,
    updatedAt: game.updated_at || game.created_at,
    lastPlayedAt: game.last_played_at,
  };
}

// World DTO mapper (from WorldTemplate)
export function toWorldDTO(worldTemplate: WorldTemplate): WorldDTO {
  return {
    id: worldTemplate.id,
    name: worldTemplate.name,
    description: worldTemplate.description,
    genre: worldTemplate.genre,
    setting: worldTemplate.setting,
    themes: worldTemplate.themes,
    availableRaces: worldTemplate.availableRaces,
    availableClasses: worldTemplate.availableClasses,
    rules: worldTemplate.rules,
    isPublic: worldTemplate.isPublic,
    createdAt: worldTemplate.createdAt,
    updatedAt: worldTemplate.updatedAt,
  };
}

// Adventure DTO mapper (placeholder - would need Adventure entity)
export function toAdventureDTO(adventure: any): AdventureDTO {
  return {
    id: adventure.id,
    slug: adventure.slug,
    title: adventure.title,
    description: adventure.description,
    worldSlug: adventure.world_slug,
    worldName: adventure.world_name || 'Unknown World',
    tags: adventure.tags || [],
    scenarios: adventure.scenarios || [],
  };
}

// User DTO mapper
export function toUserDTO(user: any): UserDTO {
  return {
    id: user.id,
    email: user.email,
    isGuest: user.isGuest || false,
    castingStones: {
      shard: user.castingStones?.shard || 0,
      crystal: user.castingStones?.crystal || 0,
      relic: user.castingStones?.relic || 0,
    },
    subscription: user.subscription ? {
      status: user.subscription.status,
      currentPeriodEnd: user.subscription.currentPeriodEnd,
    } : undefined,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

// Stones wallet DTO mapper (redacts internal IDs, exposes balances only)
export function toStonesWalletDTO(wallet: any): StonesWalletDTO {
  if (!wallet) {
    return {
      shard: 0,
      crystal: 0,
      relic: 0,
      dailyRegen: 0,
      lastRegenAt: undefined,
    };
  }
  
  return {
    shard: wallet.inventoryShard || wallet.shard || 0,
    crystal: wallet.inventoryCrystal || wallet.crystal || 0,
    relic: wallet.inventoryRelic || wallet.relic || 0,
    dailyRegen: wallet.dailyRegen || 0,
    lastRegenAt: wallet.lastRegenAt,
    // Explicitly exclude internal fields:
    // - id (server-only)
    // - userId (server-only)
    // - castingStones (server-only)
    // - createdAt/updatedAt (server-only)
  };
}

// Stones pack DTO mapper (redacts internal fields)
export function toStonesPackDTO(pack: any): StonesPackDTO {
  return {
    id: pack.id,
    name: pack.name,
    description: pack.description,
    price: pack.priceCents || pack.price || 0,
    currency: pack.currency,
    stones: {
      shard: pack.stonesShard || pack.stones?.shard || 0,
      crystal: pack.stonesCrystal || pack.stones?.crystal || 0,
      relic: pack.stonesRelic || pack.stones?.relic || 0,
    },
    bonus: (pack.bonusShard || pack.bonusCrystal || pack.bonusRelic || pack.bonus) ? {
      shard: pack.bonusShard || pack.bonus?.shard || 0,
      crystal: pack.bonusCrystal || pack.bonus?.crystal || 0,
      relic: pack.bonusRelic || pack.bonus?.relic || 0,
    } : undefined,
    isActive: pack.isActive,
    // Explicitly exclude internal fields:
    // - sortOrder (server-only)
    // - createdAt/updatedAt (server-only)
  };
}

// Subscription DTO mapper
export function toSubscriptionDTO(subscription: any): SubscriptionDTO {
  return {
    id: subscription.id,
    status: subscription.status,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt,
  };
}

// Search result DTO mapper
export function toSearchResultDTO(
  item: any,
  type: 'character' | 'game' | 'world' | 'adventure',
  relevance: number = 1.0
): SearchResultDTO {
  return {
    type,
    id: item.id,
    name: item.name,
    description: item.description,
    relevance,
  };
}

// Profile DTO mapper (redacts internal fields)
export function toProfileDTO(profile: any): ProfileDTO {
  return {
    id: profile.id,
    displayName: profile.display_name,
    avatarUrl: profile.avatar_url,
    email: profile.email,
    preferences: {
      showTips: profile.preferences?.show_tips ?? true,
      theme: profile.preferences?.theme ?? 'auto',
      notifications: profile.preferences?.notifications ?? {
        email: true,
        push: false,
      },
    },
    createdAt: profile.created_at,
    lastSeen: profile.last_seen,
    // Explicitly exclude internal fields:
    // - provider_id (internal)
    // - access_tokens (internal)
    // - internal_flags (internal)
    // - audit_log (internal)
  };
}

// Turn result DTO mapper (redacts internal fields)
export function toTurnResultDTO(turnResult: any): TurnResult {
  return {
    id: turnResult.id,
    game_id: turnResult.game_id,
    option_id: turnResult.option_id,
    ai_response: {
      narrative: turnResult.ai_response.narrative,
      emotion: turnResult.ai_response.emotion,
      choices: turnResult.ai_response.choices,
      npcResponses: turnResult.ai_response.npcResponses,
      worldStateChanges: turnResult.ai_response.worldStateChanges,
      relationshipDeltas: turnResult.ai_response.relationshipDeltas,
      factionDeltas: turnResult.ai_response.factionDeltas,
    },
    created_at: turnResult.created_at,
    // Explicitly exclude internal fields:
    // - state_snapshot (server-only)
    // - prompt_text (server-only)
    // - internal IDs not needed by UI
    // - audit/ledger internals
    // - policy flags
  };
}
