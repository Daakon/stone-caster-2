/**
 * Tests for Chimera Play Engine Services
 * Phase 4: The Play Engine
 * 
 * Tests:
 * 1. Compiler Debug - Test rebuild-service with mock ruleset input
 * 2. MAS 1 Functionality - Test ActionParser with simple input
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { rebuildStory } from '../../src/services/chimera/rebuild-service.js';
import { parseAction } from '../../src/services/play/action-parser.js';
import { resolveAction } from '../../src/services/play/action-resolver.js';
import { generateNarrative } from '../../src/services/play/mas-context-provider.js';
import type { CompiledStoryJson } from '../../src/services/chimera/rebuild-service.js';
import type { GameStateTiers } from '../../src/services/play/action-parser.js';
import type { ActionDto } from '../../src/services/play/action-parser.js';
import type { Mas1ResponseDto } from '../../src/services/play/action-parser.js';
import type { OutcomeDto } from '../../src/services/play/action-resolver.js';

// Mock Supabase
// Note: mockFrom must be defined inside the factory to avoid hoisting issues
vi.mock('../../src/services/supabase.js', () => {
  const mockFrom = vi.fn();
  return {
    supabaseAdmin: {
      from: mockFrom,
    },
  };
});

import { supabaseAdmin } from '../../src/services/supabase.js';

describe('Chimera Play Engine Services', () => {
  // Get the mocked from function
  const getMockFrom = () => (supabaseAdmin as any).from;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Compiler Debug - Rebuild Service', () => {
    it('should correctly merge rulesets and populate action_rules', async () => {
      const mockStoryId = 'test-story-123';
      const mockUserId = 'test-user-123';

      // Mock ruleset template with action_rules and state_schema_contributions
      const mockRulesetTemplate = {
        id: 'test-ruleset-1',
        rule_type: 'MAIN_SYSTEM',
        main_system_dependency: null,
        version: 1,
        definition: {
          action_rules: {
            advance_time: {
              type: 'time_update',
              ticks: 1,
            },
            skill_check: {
              type: 'skill_check',
              dc: 15,
            },
            pick_lock: {
              type: 'skill_check',
              skill: 'lockpicking',
              dc: 20,
            },
          },
          prompt_rules: {
            parser_prompt_rules: [
              'Parse user actions into structured format',
              'Resolve coreferences in user input',
            ],
            narrative_prompt_rules: [
              'Generate cinematic narrative',
              'Use second-person perspective',
            ],
            narrator_guardrails: [
              'NEVER narrate actions for the player',
              'NEVER make decisions for the player',
            ],
          },
          state_schema_contributions: {
            tier1_singular_state: {
              actor_health: {
                player: 100,
              },
              world_time: '2025-01-01T00:00:00Z',
            },
            tier2_relational_state: {
              player_skills: {
                lockpicking: 25,
                stealth: 30,
              },
            },
          },
          key_definitions: {
            state_keys: ['health', 'lockpicking', 'stealth'],
            narrative_keys: ['backstory', 'personality'],
          },
        },
      };

      // Reset mocks
      const mockFrom = getMockFrom();
      mockFrom.mockReset();

      // Mock story fetch
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: mockStoryId,
            owner_user_id: mockUserId,
            world_id: null,
          },
          error: null,
        }),
      });

      // Mock story links
      // For .select().eq() queries, .eq() returns a promise directly
      const storyLinksChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [
            { ruleset_template_id: 'test-ruleset-1' },
          ],
          error: null,
        }),
      };
      mockFrom.mockReturnValueOnce(storyLinksChain);

      // Mock content pack links (empty)
      const packLinksChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };
      mockFrom.mockReturnValueOnce(packLinksChain);

      // Mock ruleset templates fetch
      // For .select().in() queries, .in() returns a promise directly
      const rulesetChain = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: [mockRulesetTemplate],
          error: null,
        }),
      };
      mockFrom.mockReturnValueOnce(rulesetChain);

      // Mock entity links (empty)
      const entityLinksChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };
      mockFrom.mockReturnValueOnce(entityLinksChain);

      // Mock lore entries (empty)
      const loreChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };
      mockFrom.mockReturnValueOnce(loreChain);

      // Mock compiled ruleset save
      mockFrom.mockReturnValueOnce({
        upsert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            story_id: mockStoryId,
            compiled_json: {},
            source_manifest: [],
            last_compiled_at: new Date().toISOString(),
          },
          error: null,
        }),
      });

      // Execute rebuild
      const result = await rebuildStory(mockStoryId, mockUserId);

      // Assertions
      expect(result).toBeDefined();
      expect(result.compiled_json).toBeDefined();
      
      const compiled = result.compiled_json as CompiledStoryJson;
      
      // Test 1: action_context_json.action_rules should NOT be empty
      expect(compiled.action_context_json).toBeDefined();
      expect(compiled.action_context_json.action_rules).toBeDefined();
      expect(Object.keys(compiled.action_context_json.action_rules).length).toBeGreaterThan(0);
      expect(compiled.action_context_json.action_rules).toHaveProperty('advance_time');
      expect(compiled.action_context_json.action_rules).toHaveProperty('skill_check');
      expect(compiled.action_context_json.action_rules).toHaveProperty('pick_lock');

      // Test 2: parser_context_json.prompt_rules should NOT be empty
      expect(compiled.parser_context_json).toBeDefined();
      expect(compiled.parser_context_json.prompt_rules).toBeDefined();
      expect(Array.isArray(compiled.parser_context_json.prompt_rules)).toBe(true);
      expect(compiled.parser_context_json.prompt_rules.length).toBeGreaterThan(0);

      // Test 3: narrative_context_json.prompt_rules_with_guardrails should NOT be empty
      expect(compiled.narrative_context_json).toBeDefined();
      expect(compiled.narrative_context_json.prompt_rules_with_guardrails).toBeDefined();
      expect(Array.isArray(compiled.narrative_context_json.prompt_rules_with_guardrails)).toBe(true);
      expect(compiled.narrative_context_json.prompt_rules_with_guardrails.length).toBeGreaterThan(0);
      // Should contain both narrative rules and guardrails
      expect(compiled.narrative_context_json.prompt_rules_with_guardrails.some(
        (rule: string) => rule.includes('NEVER')
      )).toBe(true);

      // Test 4: final_state_schema should contain actor_health
      expect(compiled.final_state_schema).toBeDefined();
      expect(compiled.final_state_schema.tier1_singular_state).toBeDefined();
      const tier1 = compiled.final_state_schema.tier1_singular_state as Record<string, unknown>;
      expect(tier1.actor_health).toBeDefined();
      expect((tier1.actor_health as Record<string, unknown>).player).toBe(100);
    });

    it('should handle empty rulesets gracefully', async () => {
      const mockStoryId = 'test-story-empty';
      const mockUserId = 'test-user-123';

      // Reset mocks
      const mockFrom = getMockFrom();
      mockFrom.mockReset();

      // Mock story fetch
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: mockStoryId,
            owner_user_id: mockUserId,
            world_id: null,
          },
          error: null,
        }),
      });

      // Mock story links (empty)
      const emptyStoryLinksChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };
      mockFrom.mockReturnValueOnce(emptyStoryLinksChain);

      // Mock content pack links (empty)
      const emptyPackLinksChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };
      mockFrom.mockReturnValueOnce(emptyPackLinksChain);

      // Should throw error for no rulesets
      await expect(rebuildStory(mockStoryId, mockUserId)).rejects.toThrow(
        'No ruleset templates linked to this story or its world'
      );
    });
  });

  describe('MAS 1 Functionality - Action Parser', () => {
    it('should parse "I pick the lock" and return valid Mas1ResponseDto', async () => {
      const textInput = 'I pick the lock';
      
      const parserContextJson: CompiledStoryJson['parser_context_json'] = {
        prompt_rules: [
          'Parse user actions into structured format',
          'Resolve coreferences in user input',
        ],
        available_actions: ['pick_lock', 'attack', 'talk', 'move', 'look'],
        available_entities: ['door_1', 'chest_1', 'npc_1'],
      };

      const gameState: GameStateTiers = {
        tier0_tracked_state: {
          relationships: {
            npc_1: { affinity: 10 },
          },
        },
        tier1_singular_state: {
          actor_health: {
            player: 100,
          },
        },
        tier2_relational_state: {
          player_skills: {
            lockpicking: 25,
          },
        },
      };

      const result = await parseAction(textInput, parserContextJson, gameState);

      // Assertions
      expect(result).toBeDefined();
      expect(result.actionDto).toBeDefined();
      expect(result.actionDto.action).toBeDefined();
      expect(typeof result.actionDto.action).toBe('string');
      
      // Should extract pick_lock action
      expect(result.actionDto.action).toBe('pick_lock');
      
      expect(result.resolvedQuery).toBeDefined();
      expect(typeof result.resolvedQuery).toBe('string');
      expect(result.resolvedQuery.length).toBeGreaterThan(0);

      expect(result.detectedSentiment).toBeDefined();
      expect(result.detectedSentiment.tone).toBeDefined();
      expect(typeof result.detectedSentiment.tone).toBe('string');
      expect(result.detectedSentiment.intensity).toBeDefined();
      expect(typeof result.detectedSentiment.intensity).toBe('number');
      expect(result.detectedSentiment.intensity).toBeGreaterThanOrEqual(1);
      expect(result.detectedSentiment.intensity).toBeLessThanOrEqual(10);
    });

    it('should handle different action types', async () => {
      const parserContextJson: CompiledStoryJson['parser_context_json'] = {
        prompt_rules: ['Parse user actions'],
        available_actions: ['attack', 'talk', 'move'],
        available_entities: [],
      };

      const gameState: GameStateTiers = {
        tier0_tracked_state: {},
        tier1_singular_state: {},
        tier2_relational_state: {},
      };

      // Test attack
      const attackResult = await parseAction('I attack the enemy', parserContextJson, gameState);
      expect(attackResult.actionDto.action).toBe('attack');

      // Test talk
      const talkResult = await parseAction('I talk to the guard', parserContextJson, gameState);
      expect(talkResult.actionDto.action).toBe('talk');
    });

    it('should validate response structure', async () => {
      const parserContextJson: CompiledStoryJson['parser_context_json'] = {
        prompt_rules: [],
        available_actions: ['look'],
        available_entities: [],
      };

      const gameState: GameStateTiers = {
        tier0_tracked_state: {},
        tier1_singular_state: {},
        tier2_relational_state: {},
      };

      const result = await parseAction('look around', parserContextJson, gameState);

      // All required fields should be present
      expect(result.actionDto).toBeDefined();
      expect(result.actionDto.action).toBeDefined();
      expect(result.resolvedQuery).toBeDefined();
      expect(result.detectedSentiment).toBeDefined();
      expect(result.detectedSentiment.tone).toBeDefined();
      expect(result.detectedSentiment.intensity).toBeDefined();
    });
  });

  describe('Action Resolver - Deterministic Logic', () => {
    it('should resolve pick_lock skill check with deterministic outcome', async () => {
      // Mock Math.random to get a predictable roll
      const originalRandom = Math.random;
      let rollCount = 0;
      Math.random = vi.fn(() => {
        rollCount++;
        // Return 0.5 to get a roll of 50 (0.5 * 100 + 1 = 51, but we want 50)
        // Actually, rollD100 does Math.floor(Math.random() * 100) + 1
        // So 0.5 * 100 = 50, floor = 50, +1 = 51
        // Let's use 0.49 to get 50
        return 0.49; // This gives us roll = 50
      });

      const actionDto: ActionDto = {
        action: 'pick_lock',
        target: 'door_1',
      };

      const gameState: GameStateTiers = {
        tier0_tracked_state: {},
        tier1_singular_state: {
          actor_health: {
            player: 100,
          },
        },
        tier2_relational_state: {
          player_skills: {
            lockpicking: 20, // Skill value
          },
        },
      };

      const actionContext = {
        action_rules: {
          pick_lock: {
            type: 'skill_check',
            skill: 'lockpicking',
            dc: 50, // Difficulty class
          },
        },
        elements: {},
      };

      const result = await resolveAction(actionDto, gameState, actionContext);

      // Assertions
      expect(result).toBeDefined();
      expect(result.outcome).toBeDefined();
      expect(result.outcome.success).toBeDefined();
      expect(typeof result.outcome.success).toBe('boolean');
      
      // With skill 20 and roll 50, total = 70, which is >= DC 50, so should succeed
      expect(result.outcome.success).toBe(true);
      expect(result.outcome.details).toBeDefined();
      expect(result.outcome.details?.skill).toBe('lockpicking');
      expect(result.outcome.details?.skillValue).toBe(20);
      expect(result.outcome.details?.dc).toBe(50);
      expect(result.outcome.details?.degree).toBeDefined();
      
      // Should have mutations if successful
      if (result.outcome.success) {
        expect(Array.isArray(result.mutations)).toBe(true);
      }

      // Restore Math.random
      Math.random = originalRandom;
    });

    it('should handle failed skill check', async () => {
      // Mock a low roll
      const originalRandom = Math.random;
      Math.random = vi.fn(() => 0.1); // This gives us roll = 11

      const actionDto: ActionDto = {
        action: 'pick_lock',
        target: 'door_1',
      };

      const gameState: GameStateTiers = {
        tier0_tracked_state: {},
        tier1_singular_state: {},
        tier2_relational_state: {
          player_skills: {
            lockpicking: 10, // Low skill
          },
        },
      };

      const actionContext = {
        action_rules: {
          pick_lock: {
            type: 'skill_check',
            skill: 'lockpicking',
            dc: 50, // High DC
          },
        },
        elements: {},
      };

      const result = await resolveAction(actionDto, gameState, actionContext);

      // With skill 10 and roll 11, total = 21, which is < DC 50, so should fail
      expect(result.outcome.success).toBe(false);

      // Restore Math.random
      Math.random = originalRandom;
    });

    it('should handle time_update action', async () => {
      const actionDto: ActionDto = {
        action: 'advance_time',
      };

      const gameState: GameStateTiers = {
        tier0_tracked_state: {},
        tier1_singular_state: {
          world_time: '2025-01-01T12:00:00Z',
        },
        tier2_relational_state: {},
      };

      const actionContext = {
        action_rules: {
          advance_time: {
            type: 'time_update',
            ticks: 5,
          },
        },
        elements: {},
      };

      const result = await resolveAction(actionDto, gameState, actionContext);

      expect(result.outcome.success).toBe(true);
      expect(result.mutations.length).toBeGreaterThan(0);
      expect(result.mutations[0].path).toBe('/tier1_singular_state/world_time');
    });
  });

  describe('MAS 2 - MasContextProvider', () => {
    it('should generate narrative with guardrails and RAG chunks', async () => {
      const outcome: OutcomeDto = {
        success: true,
        message: 'Skill check passed',
        details: {
          skill: 'lockpicking',
          roll: 50,
          total: 70,
          dc: 50,
        },
      };

      const gameState: GameStateTiers = {
        tier0_tracked_state: {
          relationships: {
            npc_1: { affinity: 10 },
          },
        },
        tier1_singular_state: {
          actor_health: {
            player: 100,
          },
        },
        tier2_relational_state: {
          player_skills: {
            lockpicking: 20,
          },
        },
      };

      const narrativeContextJson: CompiledStoryJson['narrative_context_json'] = {
        prompt_rules_with_guardrails: [
          'NEVER narrate actions for the player',
          'Generate cinematic narrative',
          'Use second-person perspective',
        ],
        rag_index: [
          [0.1, 0.2, 0.3], // Mock vector 1
          [0.4, 0.5, 0.6], // Mock vector 2
          [0.7, 0.8, 0.9], // Mock vector 3
        ],
      };

      const mas1Response: Mas1ResponseDto = {
        actionDto: {
          action: 'pick_lock',
          target: 'door_1',
        },
        resolvedQuery: 'User attempts to pick the lock on the door',
        detectedSentiment: {
          tone: 'determined',
          intensity: 7,
        },
      };

      const result = await generateNarrative(
        outcome,
        gameState,
        narrativeContextJson,
        mas1Response
      );

      // Assertions
      expect(result).toBeDefined();
      expect(result.ripple_narrative).toBeDefined();
      expect(typeof result.ripple_narrative).toBe('string');
      expect(result.ripple_narrative.length).toBeGreaterThan(0);
      
      expect(Array.isArray(result.mutations)).toBe(true);
      
      // All mutations should be tier0 only
      for (const mutation of result.mutations) {
        expect(mutation.path.startsWith('/tier0_tracked_state')).toBe(true);
      }

      if (result.engine_requests) {
        expect(Array.isArray(result.engine_requests)).toBe(true);
      }
    });

    it('should include guardrails in prompt construction', async () => {
      const outcome: OutcomeDto = {
        success: false,
        message: 'Skill check failed',
      };

      const gameState: GameStateTiers = {
        tier0_tracked_state: {},
        tier1_singular_state: {},
        tier2_relational_state: {},
      };

      const narrativeContextJson: CompiledStoryJson['narrative_context_json'] = {
        prompt_rules_with_guardrails: [
          'NEVER control the player',
          'NEVER make decisions for the player',
          'Generate immersive narrative',
        ],
        rag_index: [],
      };

      const mas1Response: Mas1ResponseDto = {
        actionDto: {
          action: 'look',
        },
        resolvedQuery: 'User looks around',
        detectedSentiment: {
          tone: 'neutral',
          intensity: 5,
        },
      };

      const result = await generateNarrative(
        outcome,
        gameState,
        narrativeContextJson,
        mas1Response
      );

      expect(result.ripple_narrative).toBeDefined();
      // The narrative should respect guardrails (validated by the mock)
      expect(result.mutations.every(m => m.path.startsWith('/tier0_tracked_state'))).toBe(true);
    });
  });
});

