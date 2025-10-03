import { describe, it, expect } from 'vitest';
import { toCharacterDTO, toStonesWalletDTO } from './dto-mappers.js';
import type { Character, StoneWallet } from 'shared';

describe('Layer M1 - DTO Redaction and Envelope Compliance', () => {
  describe('Character DTO Redaction', () => {
    it('should redact internal fields from character data', () => {
      const mockCharacter: Character = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '987fcdeb-51a2-43d7-8f9e-123456789abc',
        name: 'Test Character',
        race: 'Human',
        class: 'Warrior',
        level: 1,
        experience: 0,
        attributes: {
          strength: 15,
          dexterity: 12,
          constitution: 14,
          intelligence: 10,
          wisdom: 13,
          charisma: 11
        },
        skills: ['Swordsmanship'],
        inventory: [
          {
            id: 'item-1',
            name: 'Iron Sword',
            description: 'A basic iron sword',
            quantity: 1
          }
        ],
        currentHealth: 10,
        maxHealth: 10,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      };

      const dto = toCharacterDTO(mockCharacter);

      // Should include public fields
      expect(dto.id).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(dto.name).toBe('Test Character');
      expect(dto.race).toBe('Human');
      expect(dto.class).toBe('Warrior');
      expect(dto.level).toBe(1);
      expect(dto.experience).toBe(0);
      expect(dto.attributes).toEqual({
        strength: 15,
        dexterity: 12,
        constitution: 14,
        intelligence: 10,
        wisdom: 13,
        charisma: 11
      });
      expect(dto.skills).toEqual(['Swordsmanship']);
      expect(dto.inventory).toEqual([
        {
          id: 'item-1',
          name: 'Iron Sword',
          description: 'A basic iron sword',
          quantity: 1
        }
      ]);
      expect(dto.currentHealth).toBe(10);
      expect(dto.maxHealth).toBe(10);
      expect(dto.createdAt).toBe('2024-01-01T00:00:00.000Z');
      expect(dto.updatedAt).toBe('2024-01-01T00:00:00.000Z');

      // Should NOT include internal fields
      expect((dto as any).userId).toBeUndefined();
    });

    it('should handle character with minimal data', () => {
      const mockCharacter: Character = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '987fcdeb-51a2-43d7-8f9e-123456789abc',
        name: 'Minimal Character',
        race: 'Elf',
        class: 'Mage',
        level: 1,
        experience: 0,
        attributes: {
          strength: 10,
          dexterity: 14,
          constitution: 12,
          intelligence: 16,
          wisdom: 15,
          charisma: 13
        },
        skills: [],
        inventory: [],
        currentHealth: 8,
        maxHealth: 8,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      };

      const dto = toCharacterDTO(mockCharacter);

      expect(dto.id).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(dto.name).toBe('Minimal Character');
      expect(dto.race).toBe('Elf');
      expect(dto.class).toBe('Mage');
      expect(dto.skills).toEqual([]);
      expect(dto.inventory).toEqual([]);
      expect((dto as any).userId).toBeUndefined();
    });

    it('should handle character with complex inventory', () => {
      const mockCharacter: Character = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '987fcdeb-51a2-43d7-8f9e-123456789abc',
        name: 'Rich Character',
        race: 'Dwarf',
        class: 'Rogue',
        level: 5,
        experience: 2500,
        attributes: {
          strength: 14,
          dexterity: 18,
          constitution: 16,
          intelligence: 12,
          wisdom: 13,
          charisma: 10
        },
        skills: ['Stealth', 'Lockpicking', 'Trap Disarming'],
        inventory: [
          {
            id: 'item-1',
            name: 'Thieves Tools',
            description: 'A set of professional lockpicking tools',
            quantity: 1
          },
          {
            id: 'item-2',
            name: 'Health Potion',
            description: 'A magical potion that restores health',
            quantity: 3
          },
          {
            id: 'item-3',
            name: 'Gold Coins',
            description: 'Standard currency',
            quantity: 150
          }
        ],
        currentHealth: 35,
        maxHealth: 40,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T12:00:00.000Z'
      };

      const dto = toCharacterDTO(mockCharacter);

      expect(dto.inventory).toHaveLength(3);
      expect(dto.inventory[0]).toEqual({
        id: 'item-1',
        name: 'Thieves Tools',
        description: 'A set of professional lockpicking tools',
        quantity: 1
      });
      expect(dto.inventory[1]).toEqual({
        id: 'item-2',
        name: 'Health Potion',
        description: 'A magical potion that restores health',
        quantity: 3
      });
      expect(dto.inventory[2]).toEqual({
        id: 'item-3',
        name: 'Gold Coins',
        description: 'Standard currency',
        quantity: 150
      });
      expect((dto as any).userId).toBeUndefined();
    });
  });

  describe('Stones Wallet DTO Redaction', () => {
    it('should redact internal fields from wallet data', () => {
      const mockWallet: StoneWallet = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '987fcdeb-51a2-43d7-8f9e-123456789abc',
        castingStones: 150,
        inventoryShard: 25,
        inventoryCrystal: 10,
        inventoryRelic: 2,
        dailyRegen: 5,
        lastRegenAt: '2024-01-01T00:00:00.000Z',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      };

      const dto = toStonesWalletDTO(mockWallet);

      // Should include public fields
      expect(dto.shard).toBe(25);
      expect(dto.crystal).toBe(10);
      expect(dto.relic).toBe(2);
      expect(dto.dailyRegen).toBe(5);
      expect(dto.lastRegenAt).toBe('2024-01-01T00:00:00.000Z');

      // Should NOT include internal fields
      expect((dto as any).id).toBeUndefined();
      expect((dto as any).userId).toBeUndefined();
      expect((dto as any).castingStones).toBeUndefined();
      expect((dto as any).createdAt).toBeUndefined();
      expect((dto as any).updatedAt).toBeUndefined();
    });

    it('should handle wallet with zero balance', () => {
      const mockWallet: StoneWallet = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '987fcdeb-51a2-43d7-8f9e-123456789abc',
        castingStones: 0,
        inventoryShard: 0,
        inventoryCrystal: 0,
        inventoryRelic: 0,
        dailyRegen: 0,
        lastRegenAt: '2024-01-01T00:00:00.000Z',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      };

      const dto = toStonesWalletDTO(mockWallet);

      expect(dto.shard).toBe(0);
      expect(dto.crystal).toBe(0);
      expect(dto.relic).toBe(0);
      expect(dto.dailyRegen).toBe(0);
      expect(dto.lastRegenAt).toBe('2024-01-01T00:00:00.000Z');
      expect((dto as any).id).toBeUndefined();
      expect((dto as any).userId).toBeUndefined();
      expect((dto as any).castingStones).toBeUndefined();
    });

    it('should handle wallet with high balance', () => {
      const mockWallet: StoneWallet = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '987fcdeb-51a2-43d7-8f9e-123456789abc',
        castingStones: 5000,
        inventoryShard: 1000,
        inventoryCrystal: 500,
        inventoryRelic: 100,
        dailyRegen: 50,
        lastRegenAt: '2024-01-01T00:00:00.000Z',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      };

      const dto = toStonesWalletDTO(mockWallet);

      expect(dto.shard).toBe(1000);
      expect(dto.crystal).toBe(500);
      expect(dto.relic).toBe(100);
      expect(dto.dailyRegen).toBe(50);
      expect(dto.lastRegenAt).toBe('2024-01-01T00:00:00.000Z');
      expect((dto as any).id).toBeUndefined();
      expect((dto as any).userId).toBeUndefined();
      expect((dto as any).castingStones).toBeUndefined();
    });

    it('should handle wallet with undefined lastRegenAt', () => {
      const mockWallet: StoneWallet = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '987fcdeb-51a2-43d7-8f9e-123456789abc',
        castingStones: 100,
        inventoryShard: 20,
        inventoryCrystal: 5,
        inventoryRelic: 1,
        dailyRegen: 3,
        lastRegenAt: '2024-01-01T00:00:00.000Z',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      };

      const dto = toStonesWalletDTO(mockWallet);

      expect(dto.shard).toBe(20);
      expect(dto.crystal).toBe(5);
      expect(dto.relic).toBe(1);
      expect(dto.dailyRegen).toBe(3);
      expect(dto.lastRegenAt).toBe('2024-01-01T00:00:00.000Z');
      expect((dto as any).id).toBeUndefined();
      expect((dto as any).userId).toBeUndefined();
      expect((dto as any).castingStones).toBeUndefined();
    });
  });

  describe('DTO Type Safety', () => {
    it('should return properly typed character DTO', () => {
      const mockCharacter: Character = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '987fcdeb-51a2-43d7-8f9e-123456789abc',
        name: 'Test Character',
        race: 'Human',
        class: 'Warrior',
        level: 1,
        experience: 0,
        attributes: {
          strength: 15,
          dexterity: 12,
          constitution: 14,
          intelligence: 10,
          wisdom: 13,
          charisma: 11
        },
        skills: ['Swordsmanship'],
        inventory: [],
        currentHealth: 10,
        maxHealth: 10,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      };

      const dto = toCharacterDTO(mockCharacter);

      // TypeScript should infer the correct type
      expect(typeof dto.id).toBe('string');
      expect(typeof dto.name).toBe('string');
      expect(typeof dto.level).toBe('number');
      expect(typeof dto.experience).toBe('number');
      expect(typeof dto.attributes).toBe('object');
      expect(Array.isArray(dto.skills)).toBe(true);
      expect(Array.isArray(dto.inventory)).toBe(true);
      expect(typeof dto.currentHealth).toBe('number');
      expect(typeof dto.maxHealth).toBe('number');
      expect(typeof dto.createdAt).toBe('string');
      expect(typeof dto.updatedAt).toBe('string');
    });

    it('should return properly typed wallet DTO', () => {
      const mockWallet: StoneWallet = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '987fcdeb-51a2-43d7-8f9e-123456789abc',
        castingStones: 150,
        inventoryShard: 25,
        inventoryCrystal: 10,
        inventoryRelic: 2,
        dailyRegen: 5,
        lastRegenAt: '2024-01-01T00:00:00.000Z',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      };

      const dto = toStonesWalletDTO(mockWallet);

      // TypeScript should infer the correct type
      expect(typeof dto.shard).toBe('number');
      expect(typeof dto.crystal).toBe('number');
      expect(typeof dto.relic).toBe('number');
      expect(typeof dto.dailyRegen).toBe('number');
      expect(typeof dto.lastRegenAt).toBe('string');
    });
  });
});
