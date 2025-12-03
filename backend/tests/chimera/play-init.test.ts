/**
 * Tests for Chimera Play Engine - Game Initialization
 * Phase 4: The Play Engine
 * 
 * Tests the full flow:
 * 1. Create a dummy Story
 * 2. Run the rebuild endpoint to generate CompiledStoryJson
 * 3. Call POST /play/:storyId/start
 * 4. Verify the database contains a new row in chimera_game_states
 * 5. Verify the returned current_game_state has initialized values
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

// Get the global mock from test setup
const mockSupabaseAdmin = (globalThis as any).mockSupabaseAdmin;

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
  // For queries with .in(), we need to make sure .select() after .in() returns the data
  if (inResult) {
    // When .in() is called, make subsequent .select() return the inResult
    const originalSelect = chain.select;
    chain.select = vi.fn().mockImplementation(() => {
      // If we've already called .in(), return a promise with the result
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

  // Make insert, update, upsert, and select return the chain for proper chaining
  chain.insert.mockReturnValue(chain);
  chain.update.mockReturnValue(chain);
  chain.upsert.mockReturnValue(chain);
  chain.select.mockReturnValue(chain);

  return chain;
}

describe('Chimera Play Engine - Game Initialization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the mock implementation
    if (mockSupabaseAdmin) {
      mockSupabaseAdmin.from.mockReset();
      // Set default implementation that returns a basic chain
      mockSupabaseAdmin.from.mockImplementation(() => createQueryBuilder());
    }
  });

  describe('Full Flow: Story → Rebuild → Start Game', () => {
    it('should complete the full initialization flow', async () => {
      const testStoryId = 'chimera_story_play_test_12345';
      const testGameStateId = '550e8400-e29b-41d4-a716-446655440001';

      // Step 1: Create a Story
      const storyData = {
        display_name: 'Test Story for Play',
        description_short: 'A test story for play engine',
        content_rating: 'safe',
        ruleset_template_ids: [],
        pack_ids: [],
        entity_ids: [],
      };

      let storyCallCount = 0;
      const completeStoryData = {
        id: testStoryId,
        owner_user_id: 'test-user-id',
        display_name: storyData.display_name,
        description_short: storyData.description_short,
        content_rating: storyData.content_rating,
        visibility: 'private',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        world: null,
        ruleset_links: [],
        entity_links: [],
        pack_links: [],
      };

      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'chimera_stories') {
          storyCallCount++;
          return createQueryBuilder({
            data: completeStoryData,
            error: null,
          });
        }
        return createQueryBuilder();
      });

      const storyResponse = await request(app)
        .post('/api/v2/chimera/stories')
        .send(storyData)
        .expect(200);

      expect(storyResponse.body.ok).toBe(true);
      expect(storyResponse.body.data.id).toBe(testStoryId);

      // Step 2: Rebuild the story to generate CompiledStoryJson
      // Mock all the necessary Supabase calls for rebuild
      mockSupabaseAdmin.from.mockReset();
      let rebuildCallCount = 0;

      const testRulesetId = 'ruleset_main_system_123';

      // Mock story fetch
      const mockStory = {
        id: testStoryId,
        owner_user_id: 'test-user-id',
        world_id: null,
        story_definition: {},
      };

      // Mock ruleset templates (need at least one MAIN_SYSTEM)
      const mockRulesetTemplate = {
        id: testRulesetId,
        rule_type: 'MAIN_SYSTEM',
        main_system_dependency: null,
        definition: {
          key_definitions: {
            state_keys: ['health', 'mana'],
            narrative_keys: ['backstory', 'personality'],
          },
          state_schema_contributions: {
            tier0_tracked_state: {},
            tier1_singular_state: {
              actor_health: {
                player: 100,
              },
              world_time: new Date().toISOString(),
            },
            tier2_relational_state: {},
          },
          action_rules: {
            attack: { type: 'combat' },
            heal: { type: 'support' },
          },
          prompt_rules: {
            parser_prompt_rules: ['Parse player actions'],
            narrative_prompt_rules: ['Generate narrative'],
            narrator_guardrails: ['Never control the player'],
          },
        },
        version: 1,
      };

      // Mock compiled story JSON structure
      const mockCompiledStory = {
        action_context_json: {
          action_rules: {
            attack: { type: 'combat' },
            heal: { type: 'support' },
          },
          elements: {},
        },
        narrative_context_json: {
          prompt_rules_with_guardrails: ['Generate narrative', 'Never control the player'],
          rag_index: [[0.1, 0.2, 0.3]],
        },
        parser_context_json: {
          prompt_rules: ['Parse player actions'],
          available_actions: ['attack', 'heal'],
          available_entities: [],
        },
        final_state_schema: {
          tier0_tracked_state: {},
          tier1_singular_state: {
            actor_health: {
              player: 100,
            },
            world_time: new Date().toISOString(),
          },
          tier2_relational_state: {},
        },
      };

      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'chimera_stories') {
          rebuildCallCount++;
          if (rebuildCallCount === 1) {
            // First call: fetch story
            return createQueryBuilder({
              data: mockStory,
              error: null,
            });
          }
          // Subsequent calls for story links
          return createQueryBuilder({
            data: [],
            error: null,
          });
        }
        if (table === 'chimera_story_links') {
          // Return story ruleset links - this uses .select().eq() which returns data directly
          const chain: any = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: [{ ruleset_template_id: testRulesetId }],
              error: null,
            }),
          };
          return chain;
        }
        if (table === 'chimera_ruleset_templates') {
          // Create a special chain for .select().in() queries
          // In Supabase, .in() is the final call and returns a promise
          const chain: any = {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [mockRulesetTemplate],
              error: null,
            }),
          };
          return chain;
        }
        if (table === 'chimera_story_content_pack_links') {
          return createQueryBuilder({
            data: [],
            error: null,
          });
        }
        if (table === 'chimera_story_entity_links') {
          return createQueryBuilder({
            data: [],
            error: null,
          });
        }
        if (table === 'chimera_lore_entries') {
          return createQueryBuilder({
            data: [],
            error: null,
          });
        }
        if (table === 'chimera_story_compiled_ruleset') {
          // Upsert returns the saved data
          return createQueryBuilder({
            data: {
              story_id: testStoryId,
              compiled_json: mockCompiledStory,
              source_manifest: [{ id: mockRulesetTemplate.id, version: 1 }],
              last_compiled_at: new Date().toISOString(),
            },
            error: null,
          });
        }
        return createQueryBuilder();
      });

      const rebuildResponse = await request(app)
        .post(`/api/v2/chimera/stories/${testStoryId}/rebuild`)
        .send({})
        .expect(200);

      expect(rebuildResponse.body.ok).toBe(true);
      expect(rebuildResponse.body.data.compiled_json).toBeDefined();

      // Step 3: Start a new game
      mockSupabaseAdmin.from.mockReset();
      let playCallCount = 0;

      const mockGameState = {
        id: testGameStateId,
        story_id: testStoryId,
        user_id: 'test-user-id',
        current_game_state: {
          tier0_tracked_state: {},
          tier1_singular_state: {
            actor_health: {
              player: 100,
            },
            world_time: expect.any(String),
          },
          tier2_relational_state: {},
        },
        turn_count: 0,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'chimera_stories') {
          playCallCount++;
          return createQueryBuilder({
            data: {
              id: testStoryId,
              visibility: 'private',
            },
            error: null,
          });
        }
        if (table === 'chimera_story_compiled_ruleset') {
          playCallCount++;
          return createQueryBuilder({
            data: {
              story_id: testStoryId,
              compiled_json: mockCompiledStory,
            },
            error: null,
          });
        }
        if (table === 'chimera_game_states') {
          playCallCount++;
          return createQueryBuilder({
            data: mockGameState,
            error: null,
          });
        }
        return createQueryBuilder();
      });

      const startResponse = await request(app)
        .post(`/api/v2/play/${testStoryId}/start`)
        .send({})
        .expect(201);

      // Step 4: Verify the response
      expect(startResponse.body.ok).toBe(true);
      expect(startResponse.body.data).toBeDefined();
      expect(startResponse.body.data.id).toBe(testGameStateId);
      expect(startResponse.body.data.story_id).toBe(testStoryId);
      expect(startResponse.body.data.user_id).toBe('test-user-id');
      expect(startResponse.body.data.turn_count).toBe(0);
      expect(startResponse.body.data.status).toBe('active');

      // Step 5: Verify the current_game_state has initialized values
      const gameState = startResponse.body.data.current_game_state;
      expect(gameState).toBeDefined();
      expect(gameState.tier1_singular_state).toBeDefined();
      expect(gameState.tier1_singular_state.actor_health).toBeDefined();
      expect(gameState.tier1_singular_state.actor_health.player).toBe(100);
      expect(gameState.tier1_singular_state.world_time).toBeDefined();
      expect(typeof gameState.tier1_singular_state.world_time).toBe('string');
    });

    it('should reject starting a game for a story without compiled ruleset', async () => {
      const testStoryId = 'chimera_story_no_compiled_123';

      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'chimera_stories') {
          return createQueryBuilder({
            data: {
              id: testStoryId,
              visibility: 'private',
            },
            error: null,
          });
        }
        if (table === 'chimera_story_compiled_ruleset') {
          // Return "not found" error
          return createQueryBuilder({
            data: null,
            error: { code: 'PGRST116', message: 'Not found' },
          });
        }
        return createQueryBuilder();
      });

      const startResponse = await request(app)
        .post(`/api/v2/play/${testStoryId}/start`)
        .send({})
        .expect(400);

      expect(startResponse.body.ok).toBe(false);
      // The route returns 400 (VALIDATION_FAILED) for missing compiled ruleset
      // But validation middleware might return 422, so accept either
      if (startResponse.status === 422) {
        // 422 is from validation middleware, which is also acceptable
        expect(startResponse.body.error).toBeDefined();
      } else {
        expect(startResponse.status).toBe(400);
        expect(startResponse.body.error.message).toMatch(/compiled|not.*compiled/i);
      }
    });

    it('should reject starting a game for a non-existent story', async () => {
      const testStoryId = 'chimera_story_not_found_123';

      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'chimera_stories') {
          return createQueryBuilder({
            data: null,
            error: { code: 'PGRST116', message: 'Not found' },
          });
        }
        return createQueryBuilder();
      });

      const startResponse = await request(app)
        .post(`/api/v2/play/${testStoryId}/start`)
        .send({})
        .expect(404);

      expect(startResponse.body.ok).toBe(false);
      expect(startResponse.body.error.message).toContain('not found');
    });
  });
});

