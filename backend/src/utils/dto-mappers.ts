import type {
  Character,
  GameSave,
  WorldTemplate,
  CharacterDTO,
  GameDTO,
  WorldDTO,
  AdventureDTO,
  UserDTO,
  StonesWalletDTO,
  StonesPackDTO,
  SubscriptionDTO,
  SearchResultDTO,
} from 'shared';

// Character DTO mapper
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
    createdAt: character.createdAt,
    updatedAt: character.updatedAt,
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

// Stones wallet DTO mapper
export function toStonesWalletDTO(wallet: any): StonesWalletDTO {
  return {
    shard: wallet.shard || 0,
    crystal: wallet.crystal || 0,
    relic: wallet.relic || 0,
    dailyRegen: wallet.dailyRegen || 0,
    lastRegenAt: wallet.lastRegenAt,
  };
}

// Stones pack DTO mapper
export function toStonesPackDTO(pack: any): StonesPackDTO {
  return {
    id: pack.id,
    name: pack.name,
    description: pack.description,
    price: pack.price,
    currency: pack.currency,
    stones: {
      shard: pack.stones.shard,
      crystal: pack.stones.crystal,
      relic: pack.stones.relic,
    },
    bonus: pack.bonus ? {
      shard: pack.bonus.shard,
      crystal: pack.bonus.crystal,
      relic: pack.bonus.relic,
    } : undefined,
    isActive: pack.isActive,
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
