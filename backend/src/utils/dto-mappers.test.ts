import { describe, it, expect } from 'vitest';
import type { Character, GameSave, WorldTemplate } from 'shared';
import {
  toCharacterDTO,
  toGameDTO,
  toWorldDTO,
  toAdventureDTO,
  toUserDTO,
  toStonesWalletDTO,
  toStonesPackDTO,
  toSubscriptionDTO,
  toSearchResultDTO,
} from './dto-mappers.js';

describe('DTO Mappers', () => {
  describe('toCharacterDTO', () => {
    it('should map Character to CharacterDTO correctly', () => {
      const character: Character = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '456e7890-e89b-12d3-a456-426614174001',
        name: 'Test Character',
        race: 'Human',
        class: 'Fighter',
        level: 5,
        experience: 1250,
        attributes: {
          strength: 16,
          dexterity: 14,
          constitution: 15,
          intelligence: 12,
          wisdom: 13,
          charisma: 10,
        },
        skills: ['Athletics', 'Intimidation'],
        inventory: [
          {
            id: 'item-1',
            name: 'Sword',
            description: 'A sharp blade',
            quantity: 1,
          },
        ],
        currentHealth: 45,
        maxHealth: 50,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      };

      const dto = toCharacterDTO(character);

      expect(dto).toEqual({
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
      });

      // Ensure internal fields are not included
      expect(dto).not.toHaveProperty('userId');
    });
  });

  describe('toGameDTO', () => {
    it('should map GameSave to GameDTO correctly', () => {
      const gameSave: GameSave = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '456e7890-e89b-12d3-a456-426614174001',
        characterId: '789e0123-e89b-12d3-a456-426614174002',
        worldTemplateId: 'abc12345-e89b-12d3-a456-426614174003',
        name: 'Test Adventure',
        storyState: {
          currentScene: 'tavern',
          history: [
            {
              role: 'narrator',
              content: 'You enter a dimly lit tavern.',
              timestamp: '2023-01-01T00:00:00Z',
              emotion: 'mysterious',
            },
          ],
          npcs: [
            {
              id: 'npc-1',
              name: 'Barkeep',
              personality: 'Friendly but cautious',
              relationship: 50,
              lastInteraction: '2023-01-01T00:00:00Z',
            },
          ],
          worldState: {
            tavernVisited: true,
          },
        },
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
        lastPlayedAt: '2023-01-01T00:00:00Z',
      };

      const dto = toGameDTO(gameSave);

      expect(dto).toEqual({
        id: gameSave.id,
        characterId: gameSave.characterId,
        adventureId: gameSave.worldTemplateId,
        name: gameSave.name,
        currentScene: gameSave.storyState.currentScene,
        storyHistory: gameSave.storyState.history,
        availableOptions: [],
        npcs: [
          {
            id: 'npc-1',
            name: 'Barkeep',
            relationship: 50,
            lastInteraction: '2023-01-01T00:00:00Z',
          },
        ],
        createdAt: gameSave.createdAt,
        updatedAt: gameSave.updatedAt,
        lastPlayedAt: gameSave.lastPlayedAt,
      });

      // Ensure internal fields are not included
      expect(dto).not.toHaveProperty('userId');
      expect(dto).not.toHaveProperty('worldState');
    });
  });

  describe('toWorldDTO', () => {
    it('should map WorldTemplate to WorldDTO correctly', () => {
      const worldTemplate: WorldTemplate = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Fantasy Realm',
        description: 'A magical world of adventure',
        genre: 'fantasy',
        setting: 'Medieval fantasy',
        themes: ['magic', 'heroism', 'adventure'],
        availableRaces: ['Human', 'Elf', 'Dwarf'],
        availableClasses: ['Fighter', 'Mage', 'Rogue'],
        startingPrompt: 'You find yourself in a tavern...',
        rules: {
          allowMagic: true,
          allowTechnology: false,
          difficultyLevel: 'medium',
          combatSystem: 'd20',
        },
        isPublic: true,
        createdBy: '456e7890-e89b-12d3-a456-426614174001',
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      };

      const dto = toWorldDTO(worldTemplate);

      expect(dto).toEqual({
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
      });

      // Ensure internal fields are not included
      expect(dto).not.toHaveProperty('createdBy');
      expect(dto).not.toHaveProperty('startingPrompt');
    });
  });

  describe('toUserDTO', () => {
    it('should map user to UserDTO correctly', () => {
      const user = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        isGuest: false,
        castingStones: {
          shard: 10,
          crystal: 5,
          relic: 1,
        },
        subscription: {
          status: 'active',
          currentPeriodEnd: '2023-12-31T23:59:59Z',
        },
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      };

      const dto = toUserDTO(user);

      expect(dto).toEqual({
        id: user.id,
        email: user.email,
        isGuest: false,
        castingStones: user.castingStones,
        subscription: user.subscription,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });
    });

    it('should handle guest user correctly', () => {
      const user = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        isGuest: true,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      };

      const dto = toUserDTO(user);

      expect(dto).toEqual({
        id: user.id,
        email: undefined,
        isGuest: true,
        castingStones: {
          shard: 0,
          crystal: 0,
          relic: 0,
        },
        subscription: undefined,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });
    });
  });

  describe('toStonesWalletDTO', () => {
    it('should map wallet to StonesWalletDTO correctly', () => {
      const wallet = {
        shard: 15,
        crystal: 8,
        relic: 2,
        dailyRegen: 5,
        lastRegenAt: '2023-01-01T00:00:00Z',
      };

      const dto = toStonesWalletDTO(wallet);

      expect(dto).toEqual(wallet);
    });

    it('should handle missing wallet data', () => {
      const wallet = {};

      const dto = toStonesWalletDTO(wallet);

      expect(dto).toEqual({
        shard: 0,
        crystal: 0,
        relic: 0,
        dailyRegen: 0,
        lastRegenAt: undefined,
      });
    });
  });

  describe('toStonesPackDTO', () => {
    it('should map pack to StonesPackDTO correctly', () => {
      const pack = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Starter Pack',
        description: 'A good starting pack',
        price: 999,
        currency: 'USD',
        stones: {
          shard: 100,
          crystal: 50,
          relic: 10,
        },
        bonus: {
          shard: 10,
          crystal: 5,
          relic: 1,
        },
        isActive: true,
      };

      const dto = toStonesPackDTO(pack);

      expect(dto).toEqual(pack);
    });

    it('should handle pack without bonus', () => {
      const pack = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Basic Pack',
        description: 'A basic pack',
        price: 499,
        currency: 'USD',
        stones: {
          shard: 50,
          crystal: 25,
          relic: 5,
        },
        isActive: true,
      };

      const dto = toStonesPackDTO(pack);

      expect(dto).toEqual({
        ...pack,
        bonus: undefined,
      });
    });
  });

  describe('toSubscriptionDTO', () => {
    it('should map subscription to SubscriptionDTO correctly', () => {
      const subscription = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        status: 'active',
        currentPeriodStart: '2023-01-01T00:00:00Z',
        currentPeriodEnd: '2023-02-01T00:00:00Z',
        cancelAtPeriodEnd: false,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      };

      const dto = toSubscriptionDTO(subscription);

      expect(dto).toEqual(subscription);
    });
  });

  describe('toSearchResultDTO', () => {
    it('should map search result correctly', () => {
      const item = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Character',
        description: 'A test character',
      };

      const dto = toSearchResultDTO(item, 'character', 0.95);

      expect(dto).toEqual({
        type: 'character',
        id: item.id,
        name: item.name,
        description: item.description,
        relevance: 0.95,
      });
    });

    it('should use default relevance of 1.0', () => {
      const item = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Item',
      };

      const dto = toSearchResultDTO(item, 'world');

      expect(dto.relevance).toBe(1.0);
    });
  });
});
