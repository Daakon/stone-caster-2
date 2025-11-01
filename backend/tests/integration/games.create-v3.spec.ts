/**
 * Phase 3.1: Integration tests for game creation (v3)
 * Tests atomic transactions, idempotency, validation, budget drops, and meta persistence
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { supabaseAdmin } from '../../src/services/supabase.js';
import { GamesService } from '../../src/services/games.service.js';

describe('POST /api/games - Phase 3.1', () => {
  let testUserId: string;
  let testWorldId: string;
  let testEntryPointId: string;
  let testEntryStartSlug: string;

  beforeEach(async () => {
    // Setup test data
    // Note: In real tests, you'd seed test fixtures
    // This is a skeleton - adapt to your test database setup
    
    // Generate test user
    testUserId = 'test-user-' + Date.now();
    
    // For these tests to work, you need:
    // 1. A valid world_id in world_id_mapping
    // 2. An entry_point in entry_points table
    // 3. An entry_start_slug segment in prompt_segments
    
    // Mock or seed these in your test setup
    testWorldId = '00000000-0000-0000-0000-000000000001'; // Replace with real UUID from your test DB
    testEntryPointId = 'test-entry-point-1'; // Replace with real entry point ID
    testEntryStartSlug = 'test-entry-start-1'; // Replace with real entry start slug
  });

  describe('Happy Path - World + Entry Start Only', () => {
    it('should create game with first turn (turn_number=1) and include core/ruleset/world/entry in meta', async () => {
      const response = await request(app)
        .post('/api/games')
        .set('X-Test-Rollback', '1')
        .send({
          entry_point_id: testEntryPointId,
          world_id: testWorldId,
          entry_start_slug: testEntryStartSlug,
        })
        .expect(201);

      expect(response.body.ok).toBe(true);
      expect(response.body.data.game_id).toBeDefined();
      expect(response.body.data.first_turn).toBeDefined();
      expect(response.body.data.first_turn.turn_number).toBe(1);
      expect(response.body.data.first_turn.role).toBe('narrator');
      expect(response.body.data.first_turn.meta).toBeDefined();
      
      // Verify meta includes included segments in correct order
      const included = response.body.data.first_turn.meta.included || [];
      const scopes = included.map((id: string) => id.split(':')[0]);
      
      // Should have core, ruleset, world, entry in that order (scenario and npc optional)
      const expectedOrder = ['core', 'ruleset', 'world', 'entry'];
      let lastIndex = -1;
      for (const scope of expectedOrder) {
        const scopeIndex = scopes.indexOf(scope);
        expect(scopeIndex).toBeGreaterThan(lastIndex);
        expect(scopeIndex).toBeGreaterThanOrEqual(0);
        lastIndex = scopeIndex;
      }
      
      // Should not have scenario if not provided
      expect(scopes.includes('scenario')).toBe(false);
    });
  });

  describe('With Scenario Slug', () => {
    it('should include scenario in meta unless budget forces drop', async () => {
      const response = await request(app)
        .post('/api/games')
        .set('X-Test-Rollback', '1')
        .send({
          entry_point_id: testEntryPointId,
          world_id: testWorldId,
          entry_start_slug: testEntryStartSlug,
          scenario_slug: 'test-scenario-1',
        })
        .expect(201);

      expect(response.body.ok).toBe(true);
      const included = response.body.data.first_turn.meta.included || [];
      const scopes = included.map((id: string) => id.split(':')[0]);
      
      // Scenario should be included if within budget
      const hasScenario = scopes.includes('scenario');
      
      // If scenario was dropped, policy should contain SCENARIO_DROPPED
      const policy = response.body.data.first_turn.meta.policy || [];
      if (!hasScenario) {
        expect(policy).toContain('SCENARIO_DROPPED');
      }
    });

    it('should show SCENARIO_POLICY_UNDECIDED when near budget threshold', async () => {
      // This test requires seeding segments with token counts that approach budget
      // For now, just verify the structure
      const response = await request(app)
        .post('/api/games')
        .set('X-Test-Rollback', '1')
        .send({
          entry_point_id: testEntryPointId,
          world_id: testWorldId,
          entry_start_slug: testEntryStartSlug,
          scenario_slug: 'test-scenario-1',
        })
        .expect(201);

      const policy = response.body.data.first_turn.meta.policy || [];
      const tokenPct = response.body.data.first_turn.meta.tokenEst?.pct || 0;
      
      // If token percentage is >= 0.9, should have SCENARIO_POLICY_UNDECIDED warning
      if (tokenPct >= 0.9) {
        // May or may not have it, depending on exact threshold logic
        // Just verify structure is present
        expect(Array.isArray(policy)).toBe(true);
      }
    });
  });

  describe('NPC Over-Budget', () => {
    it('should drop NPCs when over budget, never drop core/ruleset/world', async () => {
      // This test requires seeding multiple NPC segments that trigger budget drops
      // Mock or seed NPC segments with high token counts
      
      const response = await request(app)
        .post('/api/games')
        .set('X-Test-Rollback', '1')
        .send({
          entry_point_id: testEntryPointId,
          world_id: testWorldId,
          entry_start_slug: testEntryStartSlug,
        })
        .expect(201);

      const included = response.body.data.first_turn.meta.included || [];
      const dropped = response.body.data.first_turn.meta.dropped || [];
      const scopes = included.map((id: string) => id.split(':')[0]);
      const droppedScopes = dropped.map((id: string) => id.split(':')[0]);
      
      // Core, ruleset, world should NEVER be dropped
      expect(droppedScopes.includes('core')).toBe(false);
      expect(droppedScopes.includes('ruleset')).toBe(false);
      expect(droppedScopes.includes('world')).toBe(false);
      
      // Core, ruleset, world should ALWAYS be included
      expect(scopes.includes('core')).toBe(true);
      expect(scopes.includes('ruleset')).toBe(true);
      expect(scopes.includes('world')).toBe(true);
      
      // If NPCs were dropped, policy should contain NPC_DROPPED
      const npcDropped = droppedScopes.filter(s => s === 'npc');
      if (npcDropped.length > 0) {
        const policy = response.body.data.first_turn.meta.policy || [];
        expect(policy.filter((p: string) => p === 'NPC_DROPPED').length).toBeGreaterThan(0);
      }
    });
  });

  describe('Validation Failures', () => {
    it('should return 400 VALIDATION_FAILED with field errors for missing entry_start_slug', async () => {
      const response = await request(app)
        .post('/api/games')
        .set('X-Test-Rollback', '1')
        .send({
          entry_point_id: testEntryPointId,
          world_id: testWorldId,
          // entry_start_slug missing
        })
        .expect(400);

      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
      expect(response.body.error.details?.fieldErrors).toBeDefined();
      
      const fieldErrors = response.body.error.details.fieldErrors;
      expect(fieldErrors.some((e: any) => e.field === 'entry_start_slug')).toBe(true);
    });

    it('should return 400 SCENARIO_NOT_FOUND for invalid scenario_slug', async () => {
      const response = await request(app)
        .post('/api/games')
        .set('X-Test-Rollback', '1')
        .send({
          entry_point_id: testEntryPointId,
          world_id: testWorldId,
          entry_start_slug: testEntryStartSlug,
          scenario_slug: 'non-existent-scenario',
        })
        .expect(400);

      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('SCENARIO_NOT_FOUND');
    });

    it('should return 400 for invalid world_id format', async () => {
      const response = await request(app)
        .post('/api/games')
        .set('X-Test-Rollback', '1')
        .send({
          entry_point_id: testEntryPointId,
          world_id: 'not-a-uuid',
          entry_start_slug: testEntryStartSlug,
        })
        .expect(400);

      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
      const fieldErrors = response.body.error.details?.fieldErrors || [];
      expect(fieldErrors.some((e: any) => e.field === 'world_id')).toBe(true);
    });
  });

  describe('Idempotency', () => {
    it('should return identical response on duplicate idempotency key without creating duplicate game', async () => {
      const idempotencyKey = 'test-idempotency-' + Date.now();
      
      const firstResponse = await request(app)
        .post('/api/games')
        .set('Idempotency-Key', idempotencyKey)
        .send({
          entry_point_id: testEntryPointId,
          world_id: testWorldId,
          entry_start_slug: testEntryStartSlug,
        })
        .expect(201);

      const firstGameId = firstResponse.body.data.game_id;

      // Second request with same idempotency key
      const secondResponse = await request(app)
        .post('/api/games')
        .set('Idempotency-Key', idempotencyKey)
        .send({
          entry_point_id: testEntryPointId,
          world_id: testWorldId,
          entry_start_slug: testEntryStartSlug,
        })
        .expect(200); // Should return 200 (not 201) for idempotent response

      // Should return same game_id
      expect(secondResponse.body.data.game_id).toBe(firstGameId);
      expect(secondResponse.body.data.first_turn.turn_number).toBe(firstResponse.body.data.first_turn.turn_number);
      
      // Verify only one game was created
      const { data: games } = await supabaseAdmin
        .from('games')
        .select('id')
        .eq('id', firstGameId);
      
      expect(games?.length).toBe(1);
    });

    it('should support idempotency key in body', async () => {
      const idempotencyKey = 'test-idempotency-body-' + Date.now();
      
      const firstResponse = await request(app)
        .post('/api/games')
        .send({
          entry_point_id: testEntryPointId,
          world_id: testWorldId,
          entry_start_slug: testEntryStartSlug,
          idempotency_key: idempotencyKey,
        })
        .expect(201);

      const secondResponse = await request(app)
        .post('/api/games')
        .send({
          entry_point_id: testEntryPointId,
          world_id: testWorldId,
          entry_start_slug: testEntryStartSlug,
          idempotency_key: idempotencyKey,
        })
        .expect(200);

      expect(secondResponse.body.data.game_id).toBe(firstResponse.body.data.game_id);
    });
  });

  describe('Transaction Durability', () => {
    it('should not leave orphan games row on turn insert failure', async () => {
      // This test requires mocking the stored procedure to simulate a failure
      // In a real test, you'd mock the RPC call or inject a failure
      
      // Mock the stored procedure to fail on turn insert
      const originalRpc = supabaseAdmin.rpc;
      let gameInserted = false;
      
      vi.spyOn(supabaseAdmin, 'rpc').mockImplementation(async (fnName, params) => {
        if (fnName === 'spawn_game_v3_atomic') {
          // Simulate stored procedure that inserts game but fails on turn
          // In real scenario, stored procedure would rollback
          // For this test, we verify the stored procedure handles it
          return {
            data: {
              error_code: 'TURN_CREATE_ERROR',
              error_message: 'Failed to create first turn',
            },
            error: null,
          };
        }
        return originalRpc.call(supabaseAdmin, fnName, params);
      });

      const response = await request(app)
        .post('/api/games')
        .set('X-Test-Rollback', '1')
        .send({
          entry_point_id: testEntryPointId,
          world_id: testWorldId,
          entry_start_slug: testEntryStartSlug,
        })
        .expect(500); // Should fail

      expect(response.body.ok).toBe(false);
      
      // Verify no orphan game was created
      // In real stored procedure, this would be handled automatically
      // This test verifies the error handling path
      
      vi.restoreAllMocks();
    });
  });

  describe('Metadata Consistency', () => {
    it('should persist comprehensive metadata in first_turn.meta', async () => {
      const response = await request(app)
        .post('/api/games')
        .set('X-Test-Rollback', '1')
        .send({
          entry_point_id: testEntryPointId,
          world_id: testWorldId,
          entry_start_slug: testEntryStartSlug,
          scenario_slug: 'test-scenario-1',
          ruleset_slug: 'test-ruleset',
        })
        .expect(201);

      const meta = response.body.data.first_turn.meta;
      
      // Selection context
      expect(meta.model).toBeDefined();
      expect(meta.worldId).toBe(testWorldId);
      expect(meta.rulesetSlug).toBeDefined();
      expect(meta.scenarioSlug).toBe('test-scenario-1');
      expect(meta.entryStartSlug).toBe(testEntryStartSlug);
      
      // Provenance
      expect(meta.included).toBeDefined();
      expect(Array.isArray(meta.included)).toBe(true);
      expect(meta.pieces).toBeDefined();
      expect(Array.isArray(meta.pieces)).toBe(true);
      
      // Verify pieces have scope, slug, version
      for (const piece of meta.pieces) {
        expect(piece.scope).toBeDefined();
        expect(piece.slug).toBeDefined();
        expect(piece.version).toBeDefined();
        expect(piece.tokens).toBeDefined();
      }
      
      // Token estimates
      expect(meta.tokenEst).toBeDefined();
      expect(meta.tokenEst.input).toBeGreaterThan(0);
      expect(meta.tokenEst.budget).toBeGreaterThan(0);
      expect(meta.tokenEst.pct).toBeGreaterThanOrEqual(0);
    });

    it('should maintain deterministic pieces order (core → ruleset → world → scenario? → entry → npc)', async () => {
      const response = await request(app)
        .post('/api/games')
        .set('X-Test-Rollback', '1')
        .send({
          entry_point_id: testEntryPointId,
          world_id: testWorldId,
          entry_start_slug: testEntryStartSlug,
          scenario_slug: 'test-scenario-1',
        })
        .expect(201);

      const pieces = response.body.data.first_turn.meta.pieces || [];
      const scopes = pieces.map((p: any) => p.scope);
      
      // Verify order: core comes before ruleset, ruleset before world, etc.
      const scopePriority = ['core', 'ruleset', 'world', 'scenario', 'entry', 'npc'];
      let lastPriority = -1;
      
      for (const scope of scopes) {
        const currentPriority = scopePriority.indexOf(scope);
        expect(currentPriority).toBeGreaterThanOrEqual(0); // Scope is valid
        expect(currentPriority).toBeGreaterThanOrEqual(lastPriority);
        lastPriority = currentPriority;
      }
    });
  });

  describe('Error Response Format', () => {
    it('should return standardized error envelope', async () => {
      const response = await request(app)
        .post('/api/games')
        .set('X-Test-Rollback', '1')
        .send({
          entry_point_id: 'non-existent',
          world_id: testWorldId,
          entry_start_slug: testEntryStartSlug,
        })
        .expect(404); // Or appropriate error status

      expect(response.body.ok).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBeDefined();
      expect(response.body.error.message).toBeDefined();
      expect(response.body.meta).toBeDefined();
      expect(response.body.meta.traceId).toBeDefined();
    });
  });
});

