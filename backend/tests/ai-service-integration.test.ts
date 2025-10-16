import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AIService } from '../src/services/ai.js';
import { DatabasePromptService } from '../src/services/db-prompt.service.js';

// Mock OpenAIService
vi.mock('../src/services/openai.service.js', () => ({
  OpenAIService: vi.fn().mockImplementation(() => ({
    generateBufferedResponse: vi.fn(() => Promise.resolve({
      content: JSON.stringify({
        txt: "You find yourself in a mystical forest clearing, ancient trees towering above you. The air is thick with magic, and you sense powerful energies all around.",
        scn: "forest_meet",
        emotion: "curious",
        choices: [
          { id: "explore_clearing", label: "Explore the clearing carefully" },
          { id: "follow_path", label: "Follow one of the forest paths" },
          { id: "rest_here", label: "Rest and meditate" }
        ],
        flags: {},
        ledgers: {},
        presence: "present",
        last_acts: [],
        style_hint: "mystical"
      }),
      usage: {
        prompt_tokens: 1500,
        completion_tokens: 200,
        total_tokens: 1700
      }
    })),
    repairJSONResponse: vi.fn(() => Promise.resolve({
      txt: "You find yourself in a mystical forest clearing, ancient trees towering above you. The air is thick with magic, and you sense powerful energies all around.",
      scn: "forest_meet",
      emotion: "curious",
      choices: [
        { id: "explore_clearing", label: "Explore the clearing carefully" },
        { id: "follow_path", label: "Follow one of the forest paths" },
        { id: "rest_here", label: "Rest and meditate" }
      ],
      flags: {},
      ledgers: {},
      presence: "present",
      last_acts: [],
      style_hint: "mystical"
    }))
  }))
}));

// Mock DatabasePromptService
vi.mock('../src/services/db-prompt.service.js', () => ({
  DatabasePromptService: vi.fn().mockImplementation(() => ({
    assemblePrompt: vi.fn(() => Promise.resolve({
      prompt: `You are the runtime engine for a text-based RPG game. You must return ONE JSON object (AWF) that contains the game state and narrative.

=== CORE_BEGIN ===
{"core": "system"}
=== CORE_END ===

=== WORLD_BEGIN ===
{"world": "Test World", "setting": "Fantasy", "genre": "fantasy"}
=== WORLD_END ===

=== ADVENTURE_BEGIN ===
{"adventure": "Test Adventure", "scenes": []}
=== ADVENTURE_END ===

=== PLAYER_BEGIN ===
{"player": {"name": "Test Character", "level": 1}}
=== PLAYER_END ===

=== RNG_BEGIN ===
{"rng": {"d20": 10, "d100": 50}}
=== RNG_END ===

=== INPUT_BEGIN ===
Begin the adventure "Test Adventure" from its starting scene "forest_meet".
=== INPUT_END ===

You are the runtime engine for a text-based RPG game. You must return ONE JSON object (AWF) that contains the game state and narrative.

Return ONE JSON object (AWF) with the following structure:
{
  "txt": "narrative text",
  "scn": "scene_name",
  "emotion": "neutral",
  "choices": [{"id": "choice1", "label": "Option 1"}],
  "flags": {},
  "ledgers": {},
  "presence": "present",
  "last_acts": [],
  "style_hint": "neutral"
}

TIME_ADVANCE (ticks ≥ 1) - Advance the game time by the specified number of ticks.
essence alignment affects behavior - Character essence influences their actions and decisions.
NPCs may act on their own - Non-player characters can take independent actions.
The world responds to player choices - The environment changes based on player decisions.
Game state persists between turns - All changes are saved and carried forward.`,
      audit: {
        templateIds: ['test-db-template'],
        version: '1.0.0',
        hash: 'test-db-hash',
        contextSummary: {
          world: 'Test World',
          adventure: 'None',
          character: 'Test Character',
          turnIndex: 0,
        },
        tokenCount: 100,
        assembledAt: new Date().toISOString(),
      },
      metadata: {
        totalSegments: 1,
      },
    })),
  })),
}));

describe('AI Service Integration', () => {
  let aiService: AIService;
  let mockDatabasePromptService: any;

  beforeEach(() => {
    mockDatabasePromptService = new DatabasePromptService();
    aiService = new AIService(mockDatabasePromptService);
  });

  describe('generateTurnResponse', () => {
    it('should generate a complete turn response with proper prompt assembly', async () => {
      const gameContext = {
        id: 'test-game-123',
        turn_index: 0,
        summary: 'Test game',
        current_scene: 'forest_meet',
        state_snapshot: {},
        option_id: 'game_start',
        world_id: 'mystika',
        character_id: 'test-character',
        adventure_id: 'whispercross-opening'
      };

      const optionId = 'explore_clearing';
      const choices = [
        { id: 'explore_clearing', label: 'Explore the clearing carefully' },
        { id: 'follow_path', label: 'Follow one of the forest paths' },
        { id: 'rest_here', label: 'Rest and meditate' }
      ];

      try {
        const result = await aiService.generateTurnResponse(
          gameContext,
          optionId,
          choices
        );

        // Verify the response structure
        expect(result).toBeDefined();
        expect(result.response).toBeDefined();
        expect(result.promptData).toBeDefined();
        expect(result.promptMetadata).toBeDefined();
        expect(result.model).toBeDefined();
        expect(result.tokenCount).toBeGreaterThan(0);
        expect(result.promptId).toBeDefined();

        // Verify the prompt was properly assembled
        expect(result.promptData).toBeDefined();
        expect(result.promptData.length).toBeGreaterThan(1000);
        
        // Verify it contains actual AI prompt content (not placeholders)
        expect(result.promptData).toContain('You are the runtime engine');
        expect(result.promptData).toContain('Return ONE JSON object (AWF)');
        expect(result.promptData).toContain('TIME_ADVANCE');
        expect(result.promptData).toContain('essence alignment');
        
        // Should NOT contain placeholder text
        expect(result.promptData).not.toContain('<<<FILE');
        expect(result.promptData).not.toContain('>>>');
        expect(result.promptData).not.toContain('{{world_name}}');
        expect(result.promptData).not.toContain('{{adventure_name}}');
        
        // Should contain actual world content
        expect(result.promptData).toContain('Test World');
        expect(result.promptData).toContain('Test Adventure');
        
        // Should contain proper section delimiters
        expect(result.promptData).toContain('=== CORE_BEGIN ===');
        expect(result.promptData).toContain('=== WORLD_BEGIN ===');
        expect(result.promptData).toContain('=== ADVENTURE_BEGIN ===');
        expect(result.promptData).toContain('=== PLAYER_BEGIN ===');
        expect(result.promptData).toContain('=== RNG_BEGIN ===');
        expect(result.promptData).toContain('=== INPUT_BEGIN ===');

        console.log('AI Service Integration Test - SUCCESS');
        console.log('Prompt length:', result.promptData.length);
        console.log('Token count:', result.tokenCount);
        console.log('Model:', result.model);
        
      } catch (error) {
        console.error('AI Service Integration Test - FAILED:', error);
        throw error;
      }
    });

    it('should validate prompt completeness before sending to AI', async () => {
      const gameContext = {
        id: 'test-game-123',
        turn_index: 0,
        summary: 'Test game',
        current_scene: 'forest_meet',
        state_snapshot: {},
        option_id: 'game_start',
        world_id: 'mystika',
        character_id: 'test-character',
        adventure_id: 'whispercross-opening'
      };

      const optionId = 'explore_clearing';
      const choices = [
        { id: 'explore_clearing', label: 'Explore the clearing carefully' }
      ];

      try {
        const result = await aiService.generateTurnResponse(
          gameContext,
          optionId,
          choices
        );

        // The prompt should pass validation
        expect(result.promptData).toBeDefined();
        expect(result.promptData.length).toBeGreaterThan(500);
        
        // Should contain AI content indicators
        expect(result.promptData).toContain('You are the runtime engine');
        expect(result.promptData).toContain('Return ONE JSON object (AWF)');
        expect(result.promptData).toContain('TIME_ADVANCE');
        expect(result.promptData).toContain('essence alignment');
        expect(result.promptData).toContain('NPCs may act on their own');
        expect(result.promptData).toContain('The world responds to player choices');
        expect(result.promptData).toContain('Game state persists between turns');
        
        console.log('Prompt validation test - SUCCESS');
        
      } catch (error) {
        console.error('Prompt validation test - FAILED:', error);
        throw error;
      }
    });
  });
});
