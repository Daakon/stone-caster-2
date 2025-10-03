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
    race: character.race,
    class: character.class,
    level: character.level,
    experience: character.experience,
    attributes: character.attributes,
    skills: character.skills,
    inventory: character.inventory,
    currentHealth: character.currentHealth,
    maxHealth: character.maxHealth,
    worldSlug: character.worldSlug,
    createdAt: character.createdAt,
    updatedAt: character.updatedAt,
    // Explicitly exclude internal fields:
    // - userId (server-only)
    // - cookieId (server-only)
    // - internalFlags (server-only)
    // - systemMetadata (server-only)
  };
}

// Game DTO mapper (from GameSave)
export function toGameDTO(gameSave: GameSave): GameDTO {
  return {
    id: gameSave.id,
    characterId: gameSave.characterId,
    adventureId: gameSave.worldTemplateId, // Assuming this maps to adventure
    name: gameSave.name,
    currentScene: gameSave.storyState.currentScene,
    storyHistory: gameSave.storyState.history,
    availableOptions: [], // This would come from the current scene state
    npcs: gameSave.storyState.npcs.map(npc => ({
      id: npc.id,
      name: npc.name,
      relationship: npc.relationship,
      lastInteraction: npc.lastInteraction,
    })),
    createdAt: gameSave.createdAt,
    updatedAt: gameSave.updatedAt,
    lastPlayedAt: gameSave.lastPlayedAt,
  };
}

// Game DTO mapper (from Game)
export function toGameDTOFromGame(game: Game): GameDTO {
  return {
    id: game.id,
    characterId: game.character_id || '',
    adventureId: game.adventure_id,
    name: `Game ${game.id.slice(0, 8)}`, // Generate a name from the ID
    currentScene: 'start', // Default scene
    storyHistory: [], // Empty history for new games
    availableOptions: [], // Empty options for new games
    npcs: [], // Empty NPCs for new games
    createdAt: game.created_at,
    updatedAt: game.updated_at || game.created_at,
    lastPlayedAt: game.created_at,
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
    worldId: adventure.worldId,
    name: adventure.name,
    description: adventure.description,
    startingPrompt: adventure.startingPrompt,
    isPublic: adventure.isPublic,
    createdAt: adventure.createdAt,
    updatedAt: adventure.updatedAt,
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
      npcResponses: turnResult.ai_response.npcResponses,
      worldStateChanges: turnResult.ai_response.worldStateChanges,
      suggestedActions: turnResult.ai_response.suggestedActions,
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
