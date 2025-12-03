/**
 * Tests for Chimera API CRUD Operations
 * Phase 2: Creator Tools - Backend
 * 
 * Tests the full flow:
 * 1. Create a Story
 * 2. Create Lore for that Story
 * 3. Create an Entity Template
 * 4. Link the Entity to the Story
 * 5. Fetch the Story and ensure the Lore is retrievable
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

// Mock validation middleware - actually validate to catch validation errors
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
import chimeraLoreRouter from '../../src/routes/chimera-lore.js';
import chimeraEntitiesRouter from '../../src/routes/chimera-entities.js';

const app = express();
app.use(express.json());
app.use('/api/v2/chimera/stories', chimeraStoriesRouter);
app.use('/api/v2/chimera/lore', chimeraLoreRouter);
app.use('/api/v2/chimera/entities', chimeraEntitiesRouter);

// Get the global mock from test setup
const mockSupabaseAdmin = (globalThis as any).mockSupabaseAdmin;

// Helper to create a properly chained Supabase query builder mock
function createQueryBuilder(singleResult?: { data: any; error: any }, orderResult?: { data: any; error: any }) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn(),
    single: vi.fn(),
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

  // Make insert and select return the chain for proper chaining
  chain.insert.mockReturnValue(chain);
  chain.select.mockReturnValue(chain);

  return chain;
}

describe('Chimera API CRUD Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the mock implementation
    if (mockSupabaseAdmin) {
      mockSupabaseAdmin.from.mockReset();
      // Set default implementation that returns a basic chain
      mockSupabaseAdmin.from.mockImplementation(() => createQueryBuilder());
    }
  });

  describe('Full Flow: Story → Lore → Entity → Linking', () => {
    it('should complete the full CRUD flow', async () => {
      const testStoryId = 'chimera_story_1234567890_test123';
      const testLoreId = '550e8400-e29b-41d4-a716-446655440000';
      const testEntityId = 'chimera_entity_1234567890_entity123';

      // Step 1: Create a Story
      const storyData = {
        display_name: 'Test Story',
        description_short: 'A test story',
        content_rating: 'safe',
        ruleset_template_ids: [],
        pack_ids: [],
        entity_ids: [],
      };

      // Mock Supabase calls for story creation
      // The route does: insert().select().single() then select(...).eq().single()
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
          // Both calls return the same story data
          return createQueryBuilder({
            data: completeStoryData,
            error: null,
          });
        }
        return createQueryBuilder();
      });

      const storyResponse = await request(app)
        .post('/api/v2/chimera/stories')
        .send(storyData);

      // Debug: log the response if it's not 200
      if (storyResponse.status !== 200) {
        console.log('Story creation failed:', storyResponse.status, storyResponse.body);
      }

      expect(storyResponse.status).toBe(200);
      expect(storyResponse.body.ok).toBe(true);
      expect(storyResponse.body.data).toBeDefined();
      expect(storyResponse.body.data.id).toBe(testStoryId);

      // Step 2: Create Lore for that Story
      const loreData = {
        story_id: testStoryId,
        display_name: 'Test Lore Entry',
        entry_text: 'This is a test lore entry for the Pure RAG system.',
      };

      // Reset and mock for lore creation
      mockSupabaseAdmin.from.mockReset();
      let loreCallCount = 0;
      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'chimera_stories' && loreCallCount === 0) {
          loreCallCount++;
          return createQueryBuilder({
            data: {
              id: testStoryId,
              owner_user_id: 'test-user-id',
            },
            error: null,
          });
        }
        if (table === 'chimera_lore_entries' && loreCallCount === 1) {
          loreCallCount++;
          return createQueryBuilder({
            data: {
              id: testLoreId,
              story_id: testStoryId,
              display_name: loreData.display_name,
              entry_text: loreData.entry_text,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            error: null,
          });
        }
        return createQueryBuilder();
      });

      const loreResponse = await request(app)
        .post('/api/v2/chimera/lore')
        .send(loreData)
        .expect(200);

      expect(loreResponse.body.ok).toBe(true);
      expect(loreResponse.body.data.id).toBe(testLoreId);
      expect(loreResponse.body.data.story_id).toBe(testStoryId);
      expect(loreResponse.body.data.entry_text).toBe(loreData.entry_text);

      // Step 3: Create an Entity Template
      const entityData = {
        display_name: 'Test NPC',
        description_short: 'A test NPC entity',
        entity_type: 'NPC',
        base_state_json: {
          name: 'Test NPC',
          health: 100,
          skills: ['combat', 'stealth'],
          custom_field: 'any value',
        },
      };

      // Reset and mock for entity creation
      mockSupabaseAdmin.from.mockReset();
      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'chimera_entity_templates') {
          return createQueryBuilder({
            data: {
              id: testEntityId,
              owner_user_id: 'test-user-id',
              display_name: entityData.display_name,
              description_short: entityData.description_short,
              entity_type: entityData.entity_type,
              base_state_json: entityData.base_state_json,
              visibility: 'private',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            error: null,
          });
        }
        return createQueryBuilder();
      });

      const entityResponse = await request(app)
        .post('/api/v2/chimera/entities')
        .send(entityData)
        .expect(200);

      expect(entityResponse.body.ok).toBe(true);
      expect(entityResponse.body.data.id).toBe(testEntityId);
      expect(entityResponse.body.data.base_state_json).toEqual(entityData.base_state_json);

      // Step 4: Link the Entity to the Story
      const linkData = {
        entity_template_id: testEntityId,
      };

      // Reset and mock for entity linking
      mockSupabaseAdmin.from.mockReset();
      let linkCallCount = 0;
      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'chimera_stories' && linkCallCount === 0) {
          linkCallCount++;
          return createQueryBuilder({
            data: {
              id: testStoryId,
              owner_user_id: 'test-user-id',
            },
            error: null,
          });
        }
        if (table === 'chimera_entity_templates' && linkCallCount === 1) {
          linkCallCount++;
          return createQueryBuilder({
            data: {
              id: testEntityId,
              owner_user_id: 'test-user-id',
              visibility: 'private',
            },
            error: null,
          });
        }
        if (table === 'chimera_story_entity_links' && linkCallCount === 2) {
          linkCallCount++;
          return createQueryBuilder({
            data: null,
            error: { code: 'PGRST116' }, // Not found
          });
        }
        if (table === 'chimera_story_entity_links' && linkCallCount === 3) {
          linkCallCount++;
          return createQueryBuilder({
            data: {
              story_id: testStoryId,
              entity_template_id: testEntityId,
            },
            error: null,
          });
        }
        return createQueryBuilder();
      });

      const linkResponse = await request(app)
        .post(`/api/v2/chimera/stories/${testStoryId}/links/entities`)
        .send(linkData)
        .expect(200);

      expect(linkResponse.body.ok).toBe(true);
      expect(linkResponse.body.data.story_id).toBe(testStoryId);
      expect(linkResponse.body.data.entity_template_id).toBe(testEntityId);

      // Step 5: Fetch the Story and ensure the Lore is retrievable via the Lore endpoint
      // Reset and mock for lore fetch
      mockSupabaseAdmin.from.mockReset();
      let fetchCallCount = 0;
      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'chimera_stories' && fetchCallCount === 0) {
          fetchCallCount++;
          return createQueryBuilder({
            data: {
              id: testStoryId,
              owner_user_id: 'test-user-id',
            },
            error: null,
          });
        }
        if (table === 'chimera_lore_entries' && fetchCallCount === 1) {
          fetchCallCount++;
          return createQueryBuilder(
            undefined,
            {
              data: [
                {
                  id: testLoreId,
                  story_id: testStoryId,
                  display_name: loreData.display_name,
                  entry_text: loreData.entry_text,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
              ],
              error: null,
            }
          );
        }
        return createQueryBuilder();
      });

      const fetchLoreResponse = await request(app)
        .get(`/api/v2/chimera/lore?story_id=${testStoryId}`)
        .expect(200);

      expect(fetchLoreResponse.body.ok).toBe(true);
      expect(Array.isArray(fetchLoreResponse.body.data)).toBe(true);
      expect(fetchLoreResponse.body.data.length).toBe(1);
      expect(fetchLoreResponse.body.data[0].id).toBe(testLoreId);
      expect(fetchLoreResponse.body.data[0].story_id).toBe(testStoryId);
      expect(fetchLoreResponse.body.data[0].entry_text).toBe(loreData.entry_text);
    });
  });

  describe('Lore CRUD Operations', () => {
    const testStoryId = 'chimera_story_test_123';
    const testLoreId = '550e8400-e29b-41d4-a716-446655440000';

    it('should create a lore entry with valid data', async () => {
      const loreData = {
        story_id: testStoryId,
        display_name: 'Test Lore',
        entry_text: 'This is test lore content.',
      };

      // Mock story ownership check
      let callCount = 0;
      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'chimera_stories' && callCount === 0) {
          callCount++;
          return createQueryBuilder({
            data: {
              id: testStoryId,
              owner_user_id: 'test-user-id',
            },
            error: null,
          });
        }
        if (table === 'chimera_lore_entries' && callCount === 1) {
          callCount++;
          return createQueryBuilder({
            data: {
              id: testLoreId,
              ...loreData,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            error: null,
          });
        }
        return createQueryBuilder();
      });

      const response = await request(app)
        .post('/api/v2/chimera/lore')
        .send(loreData)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data.id).toBe(testLoreId);
      expect(response.body.data.entry_text).toBe(loreData.entry_text);
    });

    it('should reject lore creation with missing required fields', async () => {
      const invalidData = {
        story_id: testStoryId,
        // Missing display_name and entry_text
      };

      // Validation middleware should catch this before it reaches the route
      const response = await request(app)
        .post('/api/v2/chimera/lore')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('should reject lore creation for non-existent story', async () => {
      const loreData = {
        story_id: 'non-existent-story',
        display_name: 'Test Lore',
        entry_text: 'Test content',
      };

      // Mock story not found - when error is set, data should be null
      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'chimera_stories') {
          return createQueryBuilder({
            data: null,
            error: { code: 'PGRST116', message: 'Not found' },
          });
        }
        return createQueryBuilder();
      });

      const response = await request(app)
        .post('/api/v2/chimera/lore')
        .send(loreData);

      expect(response.status).toBe(404);
      expect(response.body.ok).toBe(false);
      expect(response.body.error.message).toContain('Story not found');
    });
  });

  describe('Entity CRUD Operations', () => {
    const testEntityId = 'chimera_entity_test_123';

    it('should create an entity template with generic JSON data', async () => {
      const entityData = {
        display_name: 'Test Entity',
        description_short: 'A test entity',
        entity_type: 'NPC',
        base_state_json: {
          custom_field: 'any value',
          nested: {
            data: 'structure',
            numbers: [1, 2, 3],
          },
        },
      };

      // Mock entity creation
      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'chimera_entity_templates') {
          return createQueryBuilder({
            data: {
              id: testEntityId,
              owner_user_id: 'test-user-id',
              ...entityData,
              visibility: 'private',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            error: null,
          });
        }
        return createQueryBuilder();
      });

      const response = await request(app)
        .post('/api/v2/chimera/entities')
        .send(entityData)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data.id).toBe(testEntityId);
      expect(response.body.data.base_state_json).toEqual(entityData.base_state_json);
    });

    it('should fetch all entities owned by user', async () => {
      const mockEntities = [
        {
          id: 'entity1',
          owner_user_id: 'test-user-id',
          display_name: 'Entity 1',
          entity_type: 'NPC',
          base_state_json: {},
        },
        {
          id: 'entity2',
          owner_user_id: 'test-user-id',
          display_name: 'Entity 2',
          entity_type: 'ITEM',
          base_state_json: {},
        },
      ];

      // Mock entity fetch
      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'chimera_entity_templates') {
          return createQueryBuilder(
            undefined,
            {
              data: mockEntities,
              error: null,
            }
          );
        }
        return createQueryBuilder();
      });

      const response = await request(app)
        .get('/api/v2/chimera/entities')
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(2);
    });
  });

  describe('Entity Linking Operations', () => {
    const testStoryId = 'chimera_story_test_123';
    const testEntityId = 'chimera_entity_test_123';

    it('should link an entity to a story', async () => {
      const linkData = {
        entity_template_id: testEntityId,
      };

      // Mock story ownership check
      let callCount = 0;
      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'chimera_stories' && callCount === 0) {
          callCount++;
          return createQueryBuilder({
            data: {
              id: testStoryId,
              owner_user_id: 'test-user-id',
            },
            error: null,
          });
        }
        if (table === 'chimera_entity_templates' && callCount === 1) {
          callCount++;
          return createQueryBuilder({
            data: {
              id: testEntityId,
              owner_user_id: 'test-user-id',
              visibility: 'private',
            },
            error: null,
          });
        }
        if (table === 'chimera_story_entity_links' && callCount === 2) {
          callCount++;
          return createQueryBuilder({
            data: null,
            error: { code: 'PGRST116' },
          });
        }
        if (table === 'chimera_story_entity_links' && callCount === 3) {
          callCount++;
          return createQueryBuilder({
            data: {
              story_id: testStoryId,
              entity_template_id: testEntityId,
            },
            error: null,
          });
        }
        return createQueryBuilder();
      });

      const response = await request(app)
        .post(`/api/v2/chimera/stories/${testStoryId}/links/entities`)
        .send(linkData)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data.story_id).toBe(testStoryId);
      expect(response.body.data.entity_template_id).toBe(testEntityId);
    });

    it('should delete an entity link from a story', async () => {
      // Mock story ownership check
      let callCount = 0;
      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'chimera_stories' && callCount === 0) {
          callCount++;
          return createQueryBuilder({
            data: {
              id: testStoryId,
              owner_user_id: 'test-user-id',
            },
            error: null,
          });
        }
        if (table === 'chimera_story_entity_links' && callCount === 1) {
          callCount++;
          // For delete().eq().eq(), we need a special chain
          const deleteChain: any = {
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          };
          return {
            delete: vi.fn().mockReturnValue(deleteChain),
            select: vi.fn().mockReturnThis(),
            insert: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return createQueryBuilder();
      });

      const response = await request(app)
        .delete(`/api/v2/chimera/stories/${testStoryId}/links/entities/${testEntityId}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data.deleted).toBe(true);
    });
  });
});
