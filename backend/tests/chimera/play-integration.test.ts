/**
 * Integration Tests for Chimera Play Engine
 * Phase 4: The Play Engine
 * 
 * Tests the full end-to-end play loop:
 * 1. Create Story → Rebuild → Start Game
 * 2. Cast Stone (full orchestration)
 * 3. Verify state updates
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock auth middleware
vi.mock('../../src/middleware/auth.js', () => ({
  authenticateToken: vi.fn((req, res, next) => {
    req.ctx = { userId: 'test-user-id' };
    next();
  }),
}));

// Import Zod for validation
import { z } from 'zod';

// Mock validation middleware
vi.mock('../../src/middleware/validation.js', () => ({
  validateRequest: vi.fn((schema: z.ZodSchema, source?: string) => {
    return (req: any, res: any, next: any) => {
      try {
        let data: unknown;
        switch (source) {
          case 'body':
            data = req.body;
            break;
          case 'params':
            data = req.params;
            break;
          case 'query':
            data = req.query;
            break;
          default:
            data = req.body;
        }
        schema.parse(data);
        next();
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            ok: false,
            error: {
              code: 'VALIDATION_FAILED',
              message: 'Request validation failed',
            },
          });
        }
        next();
      }
    };
  }),
}));

// Import routes (after mocks)
import chimeraStoriesRouter from '../../src/routes/chimera-stories.js';
import chimeraPlayRouter from '../../src/routes/chimera-play.js';

const app = express();
app.use(express.json());
app.use('/api/v2/chimera/stories', chimeraStoriesRouter);
app.use('/api/v2/play', chimeraPlayRouter);

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

// Get the mocked from function
const getMockFrom = () => (supabaseAdmin as any).from;

// Helper to create a properly chained Supabase query builder mock
function createQueryBuilder(singleResult?: { data: any; error: any }, orderResult?: { data: any; error: any }, inResult?: { data: any; error: any }) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn(),
    order: vi.fn(),
    single: vi.fn(),
    upsert: vi.fn().mockReturnThis(),
  };

  if (singleResult) {
    chain.single.mockResolvedValue(singleResult);
  } else {
    chain.single.mockResolvedValue({ data: null, error: null });
  }

  if (orderResult) {
    chain.order.mockResolvedValue(orderResult);
  } else {
    chain.order.mockResolvedValue({ data: [], error: null });
  }

  // Handle .in() - it continues chaining, then the final call returns data
  if (inResult) {
    const originalSelect = chain.select;
    chain.select = vi.fn().mockImplementation(() => {
      if (chain._inCalled) {
        return Promise.resolve(inResult);
      }
      return chain;
    });
    chain.in = vi.fn().mockImplementation(() => {
      chain._inCalled = true;
      return chain;
    });
  } else {
    chain.in.mockReturnThis();
  }

  chain.insert.mockReturnValue(chain);
  chain.update.mockReturnValue(chain);
  chain.upsert.mockReturnValue(chain);
  chain.select.mockReturnValue(chain);

  return chain;
}

describe('Chimera Play Engine - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const mockFrom = getMockFrom();
    mockFrom.mockReset();
    mockFrom.mockImplementation(() => createQueryBuilder());
  });

  describe('Full Play Loop: Start → Cast Stone', () => {
    it('should complete the full play loop and update game state', async () => {
      const testStoryId = 'chimera_story_integration_test_123';
      const testGameStateId = '550e8400-e29b-41d4-a716-446655440000';
      const testUserId = 'test-user-id';

      // Mock ruleset template with action_rules
      const mockRulesetTemplate = {
        id: 'test-ruleset-integration',
        rule_type: 'MAIN_SYSTEM',
        main_system_dependency: null,
        version: 1,
        definition: {
          action_rules: {
            pick_lock: {
              type: 'skill_check',
              skill: 'lockpicking',
              dc: 50,
            },
          },
          prompt_rules: {
            parser_prompt_rules: ['Parse user actions'],
            narrative_prompt_rules: ['Generate narrative'],
            narrator_guardrails: ['NEVER control the player'],
          },
          state_schema_contributions: {
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
          },
        },
      };

      // Setup: Create Story
      let callCount = 0;
      const mockFrom = getMockFrom();
      mockFrom.mockImplementation((table: string) => {
        callCount++;
        
        if (table === 'chimera_stories') {
          if (callCount === 1) {
            // First call: fetch story for start endpoint
            return createQueryBuilder({
              data: {
                id: testStoryId,
                owner_user_id: testUserId,
                world_id: null,
              },
              error: null,
            });
          } else if (callCount === 2) {
            // Second call: fetch story for cast-stone (ownership check)
            return createQueryBuilder({
              data: {
                id: testStoryId,
                owner_user_id: testUserId,
                world_id: null,
              },
              error: null,
            });
          }
        }
        
        if (table === 'chimera_story_links') {
          const chain: any = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: [{ ruleset_template_id: 'test-ruleset-integration' }],
              error: null,
            }),
          };
          return chain;
        }
        
        if (table === 'chimera_story_content_pack_links') {
          const chain: any = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          };
          return chain;
        }
        
        if (table === 'chimera_ruleset_templates') {
          const chain: any = {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [mockRulesetTemplate],
              error: null,
            }),
          };
          return chain;
        }
        
        if (table === 'chimera_story_entity_links') {
          const chain: any = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          };
          return chain;
        }
        
        if (table === 'chimera_lore_entries') {
          const chain: any = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          };
          return chain;
        }
        
        if (table === 'chimera_story_compiled_ruleset') {
          if (callCount === 3) {
            // First call: fetch for start endpoint
            return createQueryBuilder({
              data: {
                story_id: testStoryId,
                compiled_json: {
                  action_context_json: {
                    action_rules: {
                      pick_lock: {
                        type: 'skill_check',
                        skill: 'lockpicking',
                        dc: 50,
                      },
                    },
                    elements: {},
                  },
                  narrative_context_json: {
                    prompt_rules_with_guardrails: ['NEVER control the player', 'Generate narrative'],
                    rag_index: [],
                  },
                  parser_context_json: {
                    prompt_rules: ['Parse user actions'],
                    available_actions: ['pick_lock'],
                    available_entities: [],
                  },
                  final_state_schema: {
                    tier0_tracked_state: {},
                    tier1_singular_state: {
                      actor_health: { player: 100 },
                    },
                    tier2_relational_state: {
                      player_skills: { lockpicking: 25 },
                    },
                  },
                },
                source_manifest: [],
                last_compiled_at: new Date().toISOString(),
              },
              error: null,
            });
          } else if (callCount === 4) {
            // Second call: fetch for cast-stone endpoint
            return createQueryBuilder({
              data: {
                story_id: testStoryId,
                compiled_json: {
                  action_context_json: {
                    action_rules: {
                      pick_lock: {
                        type: 'skill_check',
                        skill: 'lockpicking',
                        dc: 50,
                      },
                    },
                    elements: {},
                  },
                  narrative_context_json: {
                    prompt_rules_with_guardrails: ['NEVER control the player', 'Generate narrative'],
                    rag_index: [],
                  },
                  parser_context_json: {
                    prompt_rules: ['Parse user actions'],
                    available_actions: ['pick_lock'],
                    available_entities: [],
                  },
                  final_state_schema: {},
                },
                source_manifest: [],
                last_compiled_at: new Date().toISOString(),
              },
              error: null,
            });
          }
        }
        
        if (table === 'chimera_game_states') {
          if (callCount === 5) {
            // Insert new game state (start endpoint)
            return createQueryBuilder({
              data: {
                id: testGameStateId,
                story_id: testStoryId,
                user_id: testUserId,
                current_game_state: {
                  tier0_tracked_state: {},
                  tier1_singular_state: {
                    actor_health: { player: 100 },
                  },
                  tier2_relational_state: {
                    player_skills: { lockpicking: 25 },
                  },
                },
                turn_count: 0,
                status: 'active',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              error: null,
            });
          } else if (callCount === 6) {
            // Fetch game state (cast-stone endpoint)
            return createQueryBuilder({
              data: {
                id: testGameStateId,
                story_id: testStoryId,
                user_id: testUserId,
                current_game_state: {
                  tier0_tracked_state: {},
                  tier1_singular_state: {
                    actor_health: { player: 100 },
                  },
                  tier2_relational_state: {
                    player_skills: { lockpicking: 25 },
                  },
                },
                turn_count: 0,
                status: 'active',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              error: null,
            });
          } else if (callCount === 7) {
            // Update game state (cast-stone endpoint)
            // For update, we need a chain that returns success
            const updateChain: any = {
              update: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({
                data: {
                  id: testGameStateId,
                  turn_count: 1,
                },
                error: null,
              }),
            };
            return updateChain;
          }
        }
        
        return createQueryBuilder();
      });

      // Step 1: Start a new game
      const startResponse = await request(app)
        .post(`/api/v2/play/${testStoryId}/start`)
        .send();

      expect(startResponse.status).toBe(201);
      expect(startResponse.body.ok).toBe(true);
      expect(startResponse.body.data.id).toBe(testGameStateId);

      // Step 2: Cast a stone
      // Mock Math.random for deterministic skill check
      const originalRandom = Math.random;
      Math.random = vi.fn(() => 0.49); // Roll = 50

      const castResponse = await request(app)
        .post(`/api/v2/play/${testGameStateId}/cast-stone`)
        .send({
          text_input: 'I try to pick the lock',
        });

      // Restore Math.random
      Math.random = originalRandom;

      // Assertions
      expect(castResponse.status).toBe(200);
      expect(castResponse.body.ok).toBe(true);
      expect(castResponse.body.data.ripple_narrative).toBeDefined();
      expect(typeof castResponse.body.data.ripple_narrative).toBe('string');
      expect(castResponse.body.data.ripple_narrative.length).toBeGreaterThan(0);

      // Verify update was called
      // The update should have been called to save the new state
      expect(mockFrom).toHaveBeenCalled();
      
      // Verify the response contains narrative
      expect(castResponse.body.data.ripple_narrative).toBeDefined();
      expect(castResponse.body.data.ripple_narrative.length).toBeGreaterThan(0);
    });
  });

  describe('Security Gate: Player Entity Required', () => {
    it('should return 403 FORBIDDEN when no player entity is linked to the story', async () => {
      const testStoryId = 'chimera_story_no_entity_test_123';
      const testUserId = 'test-user-id';

      const mockFrom = getMockFrom();
      let callCount = 0;
      
      mockFrom.mockImplementation((table: string) => {
        callCount++;
        
        if (table === 'chimera_stories') {
          // Return story that exists
          return createQueryBuilder({
            data: {
              id: testStoryId,
              owner_user_id: testUserId,
              visibility: 'private',
            },
            error: null,
          });
        }
        
        if (table === 'chimera_story_compiled_ruleset') {
          // Return compiled ruleset (story is compiled)
          return createQueryBuilder({
            data: {
              story_id: testStoryId,
              compiled_json: {
                action_context_json: { action_rules: {}, elements: {} },
                narrative_context_json: { prompt_rules_with_guardrails: [], rag_index: [] },
                parser_context_json: { prompt_rules: [], available_actions: [], available_entities: [] },
                final_state_schema: {},
              },
            },
            error: null,
          });
        }
        
        if (table === 'chimera_story_entity_links') {
          // COUNT query: No entity links exist (condition a fails)
          // Returns empty array - no player entities linked
          const chain: any = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: [], // No entity links - count will be 0
              error: null,
            }),
          };
          return chain;
        }
        
        return createQueryBuilder();
      });

      // Attempt to start game without a player entity
      const startResponse = await request(app)
        .post(`/api/v2/play/${testStoryId}/start`)
        .send();

      // Assert 403 FORBIDDEN response
      expect(startResponse.status).toBe(403);
      expect(startResponse.body.ok).toBe(false);
      expect(startResponse.body.error.code).toBe('FORBIDDEN');
      expect(startResponse.body.error.message).toBe('Error: Player character entity is required to start the game.');
    });

    it('should allow game start when player entity (NPC type) is linked and owned by user', async () => {
      const testStoryId = 'chimera_story_with_entity_test_123';
      const testUserId = 'test-user-id';
      const testEntityId = 'test-entity-id-123';
      const testGameStateId = '550e8400-e29b-41d4-a716-446655440001';

      const mockFrom = getMockFrom();
      let callCount = 0;
      
      mockFrom.mockImplementation((table: string) => {
        callCount++;
        
        if (table === 'chimera_stories') {
          return createQueryBuilder({
            data: {
              id: testStoryId,
              owner_user_id: testUserId,
              visibility: 'private',
            },
            error: null,
          });
        }
        
        if (table === 'chimera_story_compiled_ruleset') {
          return createQueryBuilder({
            data: {
              story_id: testStoryId,
              compiled_json: {
                action_context_json: { action_rules: {}, elements: {} },
                narrative_context_json: { prompt_rules_with_guardrails: [], rag_index: [] },
                parser_context_json: { prompt_rules: [], available_actions: [], available_entities: [] },
                final_state_schema: {},
              },
            },
            error: null,
          });
        }
        
        if (table === 'chimera_story_entity_links') {
          if (callCount === 3) {
            // COUNT query: Join query returns entity links with joined entity data
            // The query uses: .select('entity_template_id, entity:chimera_entity_templates!entity_template_id(...)')
            const chain: any = {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({
                data: [{
                  entity_template_id: testEntityId,
                  entity: {
                    id: testEntityId,
                    owner_user_id: testUserId, // Condition (c): owned by user
                    entity_type: 'NPC' // Condition (b): NPC type (player character)
                  }
                }], // All three conditions met: link exists, owned by user, type is NPC
                error: null,
              }),
            };
            return chain;
          }
        }
        
        if (table === 'chimera_game_states') {
          if (callCount === 5) {
            // Check if game state exists (should not)
            return createQueryBuilder({
              data: null,
              error: { code: 'PGRST116' }, // No rows found
            });
          } else if (callCount === 6) {
            // Insert new game state
            return createQueryBuilder({
              data: {
                id: testGameStateId,
                story_id: testStoryId,
                user_id: testUserId,
                current_game_state: {},
                turn_count: 0,
                status: 'active',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              error: null,
            });
          }
        }
        
        return createQueryBuilder();
      });

      // Attempt to start game with a player entity linked
      const startResponse = await request(app)
        .post(`/api/v2/play/${testStoryId}/start`)
        .send();

      // Assert successful response (201 Created for new game state)
      // This verifies that all three conditions were met:
      // (a) Link exists, (b) Entity type is NPC, (c) Entity is owned by user
      expect(startResponse.status).toBe(201);
      expect(startResponse.body.ok).toBe(true);
      expect(startResponse.body.data.id).toBe(testGameStateId);
    });

    it('should return 403 FORBIDDEN when entity is linked but wrong type (not NPC)', async () => {
      const testStoryId = 'chimera_story_wrong_type_test_123';
      const testUserId = 'test-user-id';
      const testEntityId = 'test-entity-item-123';

      const mockFrom = getMockFrom();
      let callCount = 0;
      
      mockFrom.mockImplementation((table: string) => {
        callCount++;
        
        if (table === 'chimera_stories') {
          return createQueryBuilder({
            data: {
              id: testStoryId,
              owner_user_id: testUserId,
              visibility: 'private',
            },
            error: null,
          });
        }
        
        if (table === 'chimera_story_compiled_ruleset') {
          return createQueryBuilder({
            data: {
              story_id: testStoryId,
              compiled_json: {
                action_context_json: { action_rules: {}, elements: {} },
                narrative_context_json: { prompt_rules_with_guardrails: [], rag_index: [] },
                parser_context_json: { prompt_rules: [], available_actions: [], available_entities: [] },
                final_state_schema: {},
              },
            },
            error: null,
          });
        }
        
        if (table === 'chimera_story_entity_links') {
          if (callCount === 3) {
            // COUNT query: Join query returns entity link but entity type is wrong
            // Link exists (condition a met), but entity type is ITEM (not NPC)
            // Condition (b) fails: entity_type is not 'NPC'
            const chain: any = {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({
                data: [{
                  entity_template_id: testEntityId,
                  entity: {
                    id: testEntityId,
                    owner_user_id: testUserId, // Condition (c): owned by user
                    entity_type: 'ITEM' // Condition (b) FAILS: type is ITEM, not NPC
                  }
                }], // Link exists and owned by user, but wrong type
                error: null,
              }),
            };
            return chain;
          }
        }
        
        return createQueryBuilder();
      });

      // Attempt to start game with wrong entity type
      const startResponse = await request(app)
        .post(`/api/v2/play/${testStoryId}/start`)
        .send();

      // Assert 403 FORBIDDEN - entity type check failed (condition b not met)
      expect(startResponse.status).toBe(403);
      expect(startResponse.body.ok).toBe(false);
      expect(startResponse.body.error.code).toBe('FORBIDDEN');
      expect(startResponse.body.error.message).toBe('Error: Player character entity is required to start the game.');
    });
  });
});

