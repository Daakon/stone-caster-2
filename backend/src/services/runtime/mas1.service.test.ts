// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * MAS1 Service Tests
 * Phase 6-B: Real LLM Integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Mas1Service } from './mas1.service';
import { LlmService } from '../llm/llm.service';
import type { GameState } from '@shared/types/chimera-runtime';

describe('Mas1Service', () => {
  let mockLlmService: LlmService;
  let mas1Service: Mas1Service;
  let mockGenerateJSON: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockGenerateJSON = vi.fn();
    mockLlmService = {
      generateJSON: mockGenerateJSON,
    } as unknown as LlmService;
    
    mas1Service = new Mas1Service(mockLlmService);
  });

  describe('resolveIntent - Prompt Construction', () => {
    it('should construct system prompt with correct Allowed Actions list', async () => {
      const gameState: GameState = {
        tier1_mechanical: {
          player: { stats: { hp: 100 } },
        },
        tier0_narrative: {},
      };
      const actionsMap = {
        attack: {},
        inspect: {},
        move: {},
      };

      mockGenerateJSON.mockResolvedValue({
        action_slug: 'attack',
        parameters: { target: 'enemy' },
        sentiment: 'aggressive',
      });

      await mas1Service.resolve('attack the enemy', gameState, actionsMap);

      expect(mockGenerateJSON).toHaveBeenCalled();
      const [systemPrompt] = mockGenerateJSON.mock.calls[0];
      
      expect(systemPrompt).toContain('Game Referee');
      expect(systemPrompt).toContain('Allowed Actions');
      expect(systemPrompt).toContain('attack');
      expect(systemPrompt).toContain('inspect');
      expect(systemPrompt).toContain('move');
    });

    it('should include user input in user prompt', async () => {
      const gameState: GameState = {
        tier1_mechanical: {},
        tier0_narrative: {},
      };
      const actionsMap = { attack: {} };

      mockGenerateJSON.mockResolvedValue({
        action_slug: 'attack',
        parameters: {},
        sentiment: 'aggressive',
      });

      await mas1Service.resolve('attack the goblin', gameState, actionsMap);

      expect(mockGenerateJSON).toHaveBeenCalled();
      const [, userPrompt] = mockGenerateJSON.mock.calls[0];
      
      expect(userPrompt).toContain('attack the goblin');
      expect(userPrompt).toContain('User Input');
    });

    it('should include game state context in user prompt', async () => {
      const gameState: GameState = {
        tier1_mechanical: {
          player: {
            stats: { hp: 50, mana: 20 },
            inventory: ['sword', 'potion'],
          },
          location: { name: 'forest' },
          entities: { goblin: { hp: 30 } },
        },
        tier0_narrative: {},
      };
      const actionsMap = { attack: {} };

      mockGenerateJSON.mockResolvedValue({
        action_slug: 'attack',
        parameters: { target: 'goblin' },
        sentiment: 'aggressive',
      });

      await mas1Service.resolve('attack', gameState, actionsMap);

      expect(mockGenerateJSON).toHaveBeenCalled();
      const [, userPrompt] = mockGenerateJSON.mock.calls[0];
      
      expect(userPrompt).toContain('Current Game State Context');
      expect(userPrompt).toContain('Player Stats');
      expect(userPrompt).toContain('Location');
      expect(userPrompt).toContain('Nearby Entities');
    });
  });

  describe('resolveIntent - Validation', () => {
    it('should validate response matches Mas1ResponseDto schema', async () => {
      const gameState: GameState = {
        tier1_mechanical: {},
        tier0_narrative: {},
      };
      const actionsMap = { attack: {} };

      mockGenerateJSON.mockResolvedValue({
        action_slug: 'attack',
        parameters: { target: 'enemy' },
        sentiment: 'aggressive',
      });

      const result = await mas1Service.resolve('attack', gameState, actionsMap);

      expect(result).toBeDefined();
      expect(result.action_slug).toBe('attack');
      expect(result.parameters).toEqual({ target: 'enemy' });
      expect(result.sentiment).toBe('aggressive');
    });

    it('should handle malformed JSON response', async () => {
      const gameState: GameState = {
        tier1_mechanical: {},
        tier0_narrative: {},
      };
      const actionsMap = { attack: {} };

      mockGenerateJSON.mockRejectedValue(new Error('Invalid JSON'));

      await expect(
        mas1Service.resolve('attack', gameState, actionsMap)
      ).rejects.toThrow();
    });

    it('should correct invalid action_slug to closest match', async () => {
      const gameState: GameState = {
        tier1_mechanical: {},
        tier0_narrative: {},
      };
      const actionsMap = {
        attack_enemy: {},
        inspect_object: {},
      };

      // LLM returns an action that doesn't exist
      mockGenerateJSON.mockResolvedValue({
        action_slug: 'attack', // Not in actionsMap
        parameters: {},
        sentiment: 'aggressive',
      });

      const result = await mas1Service.resolve('attack', gameState, actionsMap);

      // Should be corrected to 'attack_enemy' (closest match)
      expect(result.action_slug).toBe('attack_enemy');
    });

    it('should default to first available action if no match found', async () => {
      const gameState: GameState = {
        tier1_mechanical: {},
        tier0_narrative: {},
      };
      const actionsMap = {
        wait: {},
        rest: {},
      };

      // LLM returns an action that doesn't exist and has no close match
      mockGenerateJSON.mockResolvedValue({
        action_slug: 'unknown_action',
        parameters: {},
        sentiment: 'neutral',
      });

      const result = await mas1Service.resolve('do something', gameState, actionsMap);

      // Should default to first action in map
      expect(result.action_slug).toBe('wait');
    });
  });

  describe('resolveIntent - Flow', () => {
    it('should return correct DTO when LLM returns valid response', async () => {
      const gameState: GameState = {
        tier1_mechanical: {},
        tier0_narrative: {},
      };
      const actionsMap = { attack: {} };

      const expectedResponse = {
        action_slug: 'attack',
        parameters: { target: 'enemy', weapon: 'sword' },
        sentiment: 'aggressive',
      };

      mockGenerateJSON.mockResolvedValue(expectedResponse);

      const result = await mas1Service.resolve('attack the enemy with my sword', gameState, actionsMap);

      expect(result).toEqual(expectedResponse);
    });
  });
});

