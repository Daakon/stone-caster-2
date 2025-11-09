/**
 * Prompt Budget Report Tests
 * Tests for POST /api/admin/prompt-budget-report endpoint
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { supabaseAdmin } from '../src/services/supabase.js';
import budgetRouter from '../src/routes/admin-budget.js';

// Mock auth middleware
vi.mock('../src/middleware/auth.js', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user', role: 'admin' };
    next();
  },
  requireAdminRole: (req: any, res: any, next: any) => {
    next();
  },
}));

describe('Prompt Budget Report Endpoint', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', budgetRouter);

  const testWorldId = 'test-world-budget';
  const testRulesetId = 'test-ruleset-budget';
  const testNpcId = 'test-npc-budget';

  beforeEach(async () => {
    // Create test fixtures
    await supabaseAdmin.from('worlds').upsert({
      id: testWorldId,
      name: 'Test World',
      version: '1.0.0',
      extras: { test_extra: 'world_value' },
    }, { onConflict: 'id' });

    await supabaseAdmin.from('rulesets').upsert({
      id: testRulesetId,
      name: 'Test Ruleset',
      version: '1.0.0',
      extras: { test_extra: 'ruleset_value' },
    }, { onConflict: 'id' });

    await supabaseAdmin.from('npcs').upsert({
      id: testNpcId,
      name: 'Test NPC',
      extras: { test_extra: 'npc_value' },
    }, { onConflict: 'id' });

    // Create templates
    await supabaseAdmin.from('templates').upsert([
      {
        type: 'ruleset',
        slot: 'principles',
        version: 1,
        body: 'Principles: {{principles_text}}',
        status: 'published',
      },
      {
        type: 'world',
        slot: 'tone',
        version: 1,
        body: 'Tone: {{tone_text}}',
        status: 'published',
      },
    ], { onConflict: 'type,slot,version' });
  });

  afterEach(async () => {
    // Cleanup
    await supabaseAdmin.from('worlds').delete().eq('id', testWorldId);
    await supabaseAdmin.from('rulesets').delete().eq('id', testRulesetId);
    await supabaseAdmin.from('npcs').delete().eq('id', testNpcId);
  });

  it('should return budget report with tokens, trims, and warnings', async () => {
    const response = await request(app)
      .post('/api/admin/prompt-budget-report')
      .send({
        worldId: testWorldId,
        rulesetId: testRulesetId,
        maxTokens: 500,
      })
      .expect(200);

    expect(response.body.ok).toBe(true);
    expect(response.body.data).toBeDefined();
    expect(response.body.data.tokens).toBeDefined();
    expect(response.body.data.tokens.before).toBeGreaterThan(0);
    expect(response.body.data.tokens.after).toBeLessThanOrEqual(500);
    expect(Array.isArray(response.body.data.trims)).toBe(true);
    expect(Array.isArray(response.body.data.warnings)).toBe(true);
    expect(Array.isArray(response.body.data.sections)).toBe(true);
  });

  it('should be deterministic with same inputs', async () => {
    const requestBody = {
      worldId: testWorldId,
      rulesetId: testRulesetId,
      maxTokens: 600,
      templatesVersion: 1,
    };

    const response1 = await request(app)
      .post('/api/admin/prompt-budget-report')
      .send(requestBody)
      .expect(200);

    const response2 = await request(app)
      .post('/api/admin/prompt-budget-report')
      .send(requestBody)
      .expect(200);

    // Should produce identical results
    expect(response1.body.data.tokens.before).toBe(response2.body.data.tokens.before);
    expect(response1.body.data.tokens.after).toBe(response2.body.data.tokens.after);
    expect(response1.body.data.trims.length).toBe(response2.body.data.trims.length);
  });

  it('should respect templatesVersion for deterministic results', async () => {
    const response1 = await request(app)
      .post('/api/admin/prompt-budget-report')
      .send({
        worldId: testWorldId,
        rulesetId: testRulesetId,
        maxTokens: 500,
        templatesVersion: 1,
      })
      .expect(200);

    const response2 = await request(app)
      .post('/api/admin/prompt-budget-report')
      .send({
        worldId: testWorldId,
        rulesetId: testRulesetId,
        maxTokens: 500,
        templatesVersion: 1,
      })
      .expect(200);

    // Same version should produce same results
    expect(response1.body.data.tokens.before).toBe(response2.body.data.tokens.before);
  });

  it('should handle preview overrides without persisting', async () => {
    const responseWithOverrides = await request(app)
      .post('/api/admin/prompt-budget-report')
      .send({
        worldId: testWorldId,
        rulesetId: testRulesetId,
        maxTokens: 500,
        extrasOverrides: {
          world: { test_extra: 'overridden_value' },
        },
      })
      .expect(200);

    const responseWithoutOverrides = await request(app)
      .post('/api/admin/prompt-budget-report')
      .send({
        worldId: testWorldId,
        rulesetId: testRulesetId,
        maxTokens: 500,
      })
      .expect(200);

    // Overrides should affect the report
    // (In practice, this might change the content, which affects tokens)
    expect(responseWithOverrides.body.ok).toBe(true);
    expect(responseWithoutOverrides.body.ok).toBe(true);

    // Verify overrides don't persist by checking subsequent call
    const responseAfter = await request(app)
      .post('/api/admin/prompt-budget-report')
      .send({
        worldId: testWorldId,
        rulesetId: testRulesetId,
        maxTokens: 500,
      })
      .expect(200);

    // Should match the original (without overrides)
    expect(responseAfter.body.data.tokens.before).toBe(
      responseWithoutOverrides.body.data.tokens.before
    );
  });

  it('should return 400 for missing worldId', async () => {
    await request(app)
      .post('/api/admin/prompt-budget-report')
      .send({
        rulesetId: testRulesetId,
        maxTokens: 500,
      })
      .expect(400);
  });

  it('should return 400 for missing rulesetId', async () => {
    await request(app)
      .post('/api/admin/prompt-budget-report')
      .send({
        worldId: testWorldId,
        maxTokens: 500,
      })
      .expect(400);
  });

  it('should return 400 for maxTokens < 50', async () => {
    await request(app)
      .post('/api/admin/prompt-budget-report')
      .send({
        worldId: testWorldId,
        rulesetId: testRulesetId,
        maxTokens: 30, // Too small
      })
      .expect(400);
  });

  it('should return 400 for maxTokens > 1_000_000', async () => {
    await request(app)
      .post('/api/admin/prompt-budget-report')
      .send({
        worldId: testWorldId,
        rulesetId: testRulesetId,
        maxTokens: 2_000_000, // Too large
      })
      .expect(400);
  });

  it('should handle npcIds array', async () => {
    const response = await request(app)
      .post('/api/admin/prompt-budget-report')
      .send({
        worldId: testWorldId,
        rulesetId: testRulesetId,
        npcIds: [testNpcId],
        maxTokens: 600,
      })
      .expect(200);

    expect(response.body.ok).toBe(true);
    expect(response.body.data.sections.length).toBeGreaterThan(0);
  });
});

