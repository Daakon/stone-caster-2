import { describe, it, expect, beforeEach } from 'vitest';
import { AIService } from '../src/services/ai.js';

describe('AI Service Integration', () => {
  let aiService: AIService;

  beforeEach(() => {
    aiService = new AIService();
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
        expect(result.promptData.prompt).toBeDefined();
        expect(result.promptData.prompt.length).toBeGreaterThan(1000);
        
        // Verify it contains actual AI prompt content (not placeholders)
        expect(result.promptData.prompt).toContain('You are the runtime engine');
        expect(result.promptData.prompt).toContain('Return ONE JSON object (AWF)');
        expect(result.promptData.prompt).toContain('TIME_ADVANCE');
        expect(result.promptData.prompt).toContain('essence alignment');
        
        // Should NOT contain placeholder text
        expect(result.promptData.prompt).not.toContain('<<<FILE');
        expect(result.promptData.prompt).not.toContain('>>>');
        expect(result.promptData.prompt).not.toContain('{{world_name}}');
        expect(result.promptData.prompt).not.toContain('{{adventure_name}}');
        
        // Should contain actual world content
        expect(result.promptData.prompt).toContain('Mystika');
        expect(result.promptData.prompt).toContain('Whispercross');
        
        // Should contain proper section delimiters
        expect(result.promptData.prompt).toContain('=== CORE_BEGIN ===');
        expect(result.promptData.prompt).toContain('=== WORLD_BEGIN ===');
        expect(result.promptData.prompt).toContain('=== ADVENTURE_BEGIN ===');
        expect(result.promptData.prompt).toContain('=== PLAYER_BEGIN ===');
        expect(result.promptData.prompt).toContain('=== RNG_BEGIN ===');
        expect(result.promptData.prompt).toContain('=== INPUT_BEGIN ===');

        console.log('AI Service Integration Test - SUCCESS');
        console.log('Prompt length:', result.promptData.prompt.length);
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
        expect(result.promptData.prompt).toBeDefined();
        expect(result.promptData.prompt.length).toBeGreaterThan(500);
        
        // Should contain AI content indicators
        expect(result.promptData.prompt).toContain('You are the runtime engine');
        expect(result.promptData.prompt).toContain('Return ONE JSON object (AWF)');
        expect(result.promptData.prompt).toContain('TIME_ADVANCE');
        
        console.log('Prompt validation test - SUCCESS');
        
      } catch (error) {
        console.error('Prompt validation test - FAILED:', error);
        throw error;
      }
    });
  });
});
