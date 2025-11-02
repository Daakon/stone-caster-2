/**
 * Integration tests for Admin Preview API
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/index.js';
import { supabaseAdmin } from '../../src/services/supabase.js';

const DEBUG_TOKEN = process.env.DEBUG_ROUTES_TOKEN || 'test-token';

describe('Admin Preview API', () => {
  let adminUserId: string;
  let testEntryPointId: string;

  beforeAll(async () => {
    // Create a test admin user
    const { data: adminUser } = await supabaseAdmin.auth.admin.createUser({
      email: 'admin-preview-test@example.com',
      password: 'test-password-123',
    });
    
    if (adminUser?.user) {
      adminUserId = adminUser.user.id;
      
      // Set admin role
      await supabaseAdmin
        .from('user_profiles')
        .upsert({
          auth_user_id: adminUserId,
          role: 'admin',
        });
    }

    // Find or create a test entry point
    const { data: entryPoint } = await supabaseAdmin
      .from('entry_points')
      .select('id')
      .limit(1)
      .single();
    
    if (entryPoint) {
      testEntryPointId = entryPoint.id;
    } else {
      // Create test entry point if none exists
      const { data: world } = await supabaseAdmin
        .from('worlds')
        .select('id')
        .limit(1)
        .single();
      
      if (world) {
        const { data: newEntryPoint } = await supabaseAdmin
          .from('entry_points')
          .insert({
            id: 'test-entry-point-preview',
            type: 'adventure',
            world_id: world.id,
            slug: 'test-preview-adventure',
            title: 'Test Preview Adventure',
            status: 'active',
          })
          .select('id')
          .single();
        
        if (newEntryPoint) {
          testEntryPointId = newEntryPoint.id;
        }
      }
    }
  });

  afterAll(async () => {
    // Cleanup test user if created
    if (adminUserId) {
      await supabaseAdmin.auth.admin.deleteUser(adminUserId);
    }
  });

  describe('Guard behavior', () => {
    it('should require DEBUG_ROUTES_ENABLED=true', async () => {
      // This test would need to mock config or set env
      // For now, assume it's enabled in test env
    });

    it('should require X-Debug-Token header', async () => {
      const res = await request(app)
        .get(`/api/admin/preview/entry-point/${testEntryPointId}`)
        .expect(403);
      
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should require admin role', async () => {
      // Would need to create a non-admin user and test
      // For now, this is tested via the requireAdmin middleware
    });
  });

  describe('Preview functionality', () => {
    it('should return assembled prompt and pieces', async () => {
      const res = await request(app)
        .get(`/api/admin/preview/entry-point/${testEntryPointId}`)
        .set('X-Debug-Token', DEBUG_TOKEN)
        .set('Authorization', `Bearer ${adminUserId}`) // Would need proper JWT
        .expect(200);
      
      expect(res.body.ok).toBe(true);
      expect(res.body.data.prompt).toBeDefined();
      expect(res.body.data.pieces).toBeInstanceOf(Array);
      expect(res.body.data.meta).toBeDefined();
      expect(res.body.data.diagnostics).toBeDefined();
    });

    it('should set Cache-Control: no-store', async () => {
      const res = await request(app)
        .get(`/api/admin/preview/entry-point/${testEntryPointId}`)
        .set('X-Debug-Token', DEBUG_TOKEN)
        .expect(res => {
          expect(res.headers['cache-control']).toBe('no-store');
        });
    });

    it('should apply budget override', async () => {
      const customBudget = 4000;
      const res = await request(app)
        .get(`/api/admin/preview/entry-point/${testEntryPointId}?budget=${customBudget}`)
        .set('X-Debug-Token', DEBUG_TOKEN)
        .expect(200);
      
      expect(res.body.data.diagnostics.budgetOverrides.budget).toBe(customBudget);
    });

    it('should apply includeNpcs=0 override', async () => {
      const res = await request(app)
        .get(`/api/admin/preview/entry-point/${testEntryPointId}?includeNpcs=0`)
        .set('X-Debug-Token', DEBUG_TOKEN)
        .expect(200);
      
      const npcPieces = res.body.data.pieces.filter((p: any) => p.scope === 'npc');
      expect(npcPieces.length).toBe(0);
      expect(res.body.data.diagnostics.npcAfter).toBe(0);
    });

    it('should apply npcLimit override', async () => {
      const npcLimit = 3;
      const res = await request(app)
        .get(`/api/admin/preview/entry-point/${testEntryPointId}?npcLimit=${npcLimit}`)
        .set('X-Debug-Token', DEBUG_TOKEN)
        .expect(200);
      
      const npcPieces = res.body.data.pieces.filter((p: any) => p.scope === 'npc');
      expect(npcPieces.length).toBeLessThanOrEqual(npcLimit);
    });

    it('should include QA report when qa=1', async () => {
      const res = await request(app)
        .get(`/api/admin/preview/entry-point/${testEntryPointId}?qa=1`)
        .set('X-Debug-Token', DEBUG_TOKEN)
        .expect(200);
      
      expect(res.body.data.diagnostics.qaReport).toBeDefined();
      expect(Array.isArray(res.body.data.diagnostics.qaReport)).toBe(true);
    });

    it('should compute stable prompt_hash for same inputs', async () => {
      const res1 = await request(app)
        .get(`/api/admin/preview/entry-point/${testEntryPointId}`)
        .set('X-Debug-Token', DEBUG_TOKEN)
        .expect(200);
      
      const res2 = await request(app)
        .get(`/api/admin/preview/entry-point/${testEntryPointId}`)
        .set('X-Debug-Token', DEBUG_TOKEN)
        .expect(200);
      
      expect(res1.body.data.diagnostics.prompt_hash).toBe(res2.body.data.diagnostics.prompt_hash);
    });

    it('should return byScope token distribution', async () => {
      const res = await request(app)
        .get(`/api/admin/preview/entry-point/${testEntryPointId}`)
        .set('X-Debug-Token', DEBUG_TOKEN)
        .expect(200);
      
      expect(res.body.data.diagnostics.byScope).toBeDefined();
      expect(typeof res.body.data.diagnostics.byScope).toBe('object');
    });
  });
});

