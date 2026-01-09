// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * Unit Tests for MockLlmProvider Situational Tags
 */

import { describe, it, expect } from 'vitest';
import { MockLlmProvider } from './llm.provider.js';
import { Mas1IntentSchema } from '@shared/types/chimera-runtime';

describe('MockLlmProvider Situational Tags', () => {
  const provider = new MockLlmProvider();

  describe('test_drunk_combat', () => {
    it('should return INTOXICATED situational tag', async () => {
      const systemPrompt = 'You are the Chimera Action Interpreter (MAS-1).';
      const userPrompt = 'test_drunk_combat';

      const response = await provider.generateJson<{ intents: unknown[] }>(
        systemPrompt,
        userPrompt
      );

      expect(response.intents).toBeDefined();
      expect(response.intents.length).toBe(1);

      const intent = Mas1IntentSchema.parse(response.intents[0]);
      expect(intent.situational_tags).toBeDefined();
      expect(intent.situational_tags).toContain('INTOXICATED');
      expect(intent.trigger_id).toBe('combat_action');
    });

    it('should validate against Mas1IntentSchema', () => {
      const intents = provider.generateMas1('test_drunk_combat');
      expect(intents.length).toBe(1);
      
      const intent = intents[0];
      expect(intent.situational_tags).toBeDefined();
      expect(intent.situational_tags).toContain('INTOXICATED');
    });
  });

  describe('test_protective_combat', () => {
    it('should return PROTECTING_ALLY situational tag', async () => {
      const systemPrompt = 'You are the Chimera Action Interpreter (MAS-1).';
      const userPrompt = 'test_protective_combat';

      const response = await provider.generateJson<{ intents: unknown[] }>(
        systemPrompt,
        userPrompt
      );

      expect(response.intents).toBeDefined();
      expect(response.intents.length).toBe(1);

      const intent = Mas1IntentSchema.parse(response.intents[0]);
      expect(intent.situational_tags).toBeDefined();
      expect(intent.situational_tags).toContain('PROTECTING_ALLY');
      expect(intent.trigger_id).toBe('combat_action');
    });

    it('should validate against Mas1IntentSchema', () => {
      const intents = provider.generateMas1('test_protective_combat');
      expect(intents.length).toBe(1);
      
      const intent = intents[0];
      expect(intent.situational_tags).toBeDefined();
      expect(intent.situational_tags).toContain('PROTECTING_ALLY');
    });
  });

  describe('JSON Output Verification', () => {
    it('should include situational_tags in JSON output for test_drunk_combat', () => {
      const intents = provider.generateMas1('test_drunk_combat');
      const json = JSON.stringify(intents[0]);
      const parsed = JSON.parse(json);
      
      expect(parsed.situational_tags).toBeDefined();
      expect(Array.isArray(parsed.situational_tags)).toBe(true);
      expect(parsed.situational_tags).toContain('INTOXICATED');
    });

    it('should include situational_tags in JSON output for test_protective_combat', () => {
      const intents = provider.generateMas1('test_protective_combat');
      const json = JSON.stringify(intents[0]);
      const parsed = JSON.parse(json);
      
      expect(parsed.situational_tags).toBeDefined();
      expect(Array.isArray(parsed.situational_tags)).toBe(true);
      expect(parsed.situational_tags).toContain('PROTECTING_ALLY');
    });
  });
});
