/**
 * Tests for AWF Admin Rulesets Routes
 * Phase 1: Core vs Rulesets Framework Split - Admin API tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({
            data: null,
            error: null
          }))
        })),
        order: vi.fn(() => ({
          data: [],
          error: null
        }))
      })),
      upsert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            data: null,
            error: null
          }))
        }))
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            data: null,
            error: null
          }))
        }))
      }))
    }))
  }))
}));

// Mock auth middleware
vi.mock('../src/middleware/auth.js', () => ({
  authenticateToken: vi.fn((req, res, next) => {
    req.user = { id: 'test-user' };
    next();
  })
}));

// Mock admin role middleware
vi.mock('../src/middleware/validation.js', () => ({
  validateRequest: vi.fn((req, res, next) => next())
}));

// Import the admin routes
import adminRoutes from '../src/routes/admin.js';

const app = express();
app.use(express.json());
app.use('/api/admin', adminRoutes);

describe('AWF Admin Rulesets Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/admin/awf/rulesets', () => {
    it('should return list of rulesets', async () => {
      const mockRulesets = [
        {
          id: 'core.default',
          version: '1.0.0',
          doc: {
            ruleset: {
              name: 'Default Narrative & Pacing',
              'scn.phases': ['setup', 'play', 'resolution'],
              'txt.policy': '2–6 sentences, cinematic, second-person.',
              'choices.policy': 'Only when a menu is available; 1–5 items.',
              defaults: {
                txt_sentences_min: 2,
                txt_sentences_max: 6
              }
            }
          },
          created_at: '2025-01-29T00:00:00Z',
          updated_at: '2025-01-29T00:00:00Z'
        }
      ];

      const mockSupabase = createClient('', '');
      mockSupabase.from().select().order().order.mockReturnValue({
        data: mockRulesets,
        error: null
      });

      const response = await request(app)
        .get('/api/admin/awf/rulesets')
        .expect(200);

      expect(response.body).toEqual({
        ok: true,
        data: mockRulesets
      });
    });

    it('should handle database errors', async () => {
      const mockSupabase = createClient('', '');
      mockSupabase.from().select().order().order.mockReturnValue({
        data: null,
        error: { message: 'Database error' }
      });

      const response = await request(app)
        .get('/api/admin/awf/rulesets')
        .expect(500);

      expect(response.body).toEqual({
        ok: false,
        error: 'Failed to fetch rulesets',
        details: 'Database error'
      });
    });
  });

  describe('POST /api/admin/awf/rulesets', () => {
    it('should create new ruleset with valid data', async () => {
      const rulesetData = {
        id: 'core.test',
        version: '1.0.0',
        doc: {
          ruleset: {
            name: 'Test Ruleset',
            'scn.phases': ['setup', 'play'],
            'txt.policy': 'Test policy',
            'choices.policy': 'Test choices',
            defaults: {
              txt_sentences_min: 2,
              txt_sentences_max: 6
            }
          }
        }
      };

      const mockSupabase = createClient('', '');
      mockSupabase.from().upsert().select().single.mockReturnValue({
        data: { ...rulesetData, created_at: '2025-01-29T00:00:00Z', updated_at: '2025-01-29T00:00:00Z' },
        error: null
      });

      const response = await request(app)
        .post('/api/admin/awf/rulesets')
        .send(rulesetData)
        .expect(200);

      expect(response.body).toEqual({
        ok: true,
        data: { ...rulesetData, created_at: '2025-01-29T00:00:00Z', updated_at: '2025-01-29T00:00:00Z' }
      });
    });

    it('should reject request with missing required fields', async () => {
      const response = await request(app)
        .post('/api/admin/awf/rulesets')
        .send({ id: 'core.test' })
        .expect(400);

      expect(response.body).toEqual({
        ok: false,
        error: 'Missing required fields: id, version, doc'
      });
    });

    it('should reject request with invalid document structure', async () => {
      const invalidData = {
        id: 'core.test',
        version: '1.0.0',
        doc: {
          invalid: 'document'
        }
      };

      const response = await request(app)
        .post('/api/admin/awf/rulesets')
        .send(invalidData)
        .expect(400);

      expect(response.body).toEqual({
        ok: false,
        error: 'Document validation failed',
        details: expect.any(String)
      });
    });

    it('should handle database errors', async () => {
      const rulesetData = {
        id: 'core.test',
        version: '1.0.0',
        doc: {
          ruleset: {
            name: 'Test Ruleset',
            'scn.phases': ['setup', 'play'],
            'txt.policy': 'Test policy',
            'choices.policy': 'Test choices',
            defaults: {
              txt_sentences_min: 2,
              txt_sentences_max: 6
            }
          }
        }
      };

      const mockSupabase = createClient('', '');
      mockSupabase.from().upsert().select().single.mockReturnValue({
        data: null,
        error: { message: 'Database error' }
      });

      const response = await request(app)
        .post('/api/admin/awf/rulesets')
        .send(rulesetData)
        .expect(500);

      expect(response.body).toEqual({
        ok: false,
        error: 'Failed to save ruleset',
        details: 'Database error'
      });
    });
  });

  describe('DELETE /api/admin/awf/rulesets/:id/:version', () => {
    it('should delete ruleset successfully', async () => {
      const mockSupabase = createClient('', '');
      mockSupabase.from().delete().eq().eq.mockReturnValue({
        data: null,
        error: null
      });

      const response = await request(app)
        .delete('/api/admin/awf/rulesets/core.default/1.0.0')
        .expect(200);

      expect(response.body).toEqual({
        ok: true,
        message: 'Ruleset deleted successfully'
      });
    });

    it('should reject request with missing parameters', async () => {
      const response = await request(app)
        .delete('/api/admin/awf/rulesets/core.default')
        .expect(400);

      expect(response.body).toEqual({
        ok: false,
        error: 'Missing required parameters: id, version'
      });
    });

    it('should handle database errors', async () => {
      const mockSupabase = createClient('', '');
      mockSupabase.from().delete().eq().eq.mockReturnValue({
        data: null,
        error: { message: 'Database error' }
      });

      const response = await request(app)
        .delete('/api/admin/awf/rulesets/core.default/1.0.0')
        .expect(500);

      expect(response.body).toEqual({
        ok: false,
        error: 'Failed to delete ruleset',
        details: 'Database error'
      });
    });
  });
});















