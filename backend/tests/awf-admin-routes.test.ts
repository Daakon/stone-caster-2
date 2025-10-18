/**
 * Unit tests for AWF Admin Routes
 * Phase 2: Admin UI - Backend route testing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import adminRouter from '../src/routes/admin.js';

// Mock Supabase
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
      order: vi.fn(() => ({
        limit: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
    })),
    upsert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
    })),
  })),
  auth: {
    admin: {
      getUserById: vi.fn(() => Promise.resolve({
        data: { user: { user_metadata: { role: 'prompt_admin' } } },
        error: null
      }))
    }
  }
};

// Mock the Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase)
}));

// Mock the validators and hashing
vi.mock('../src/validators/awf-validators.js', () => ({
  CoreContractSchema: {
    parse: vi.fn((doc) => doc)
  },
  WorldSchema: {
    parse: vi.fn((doc) => doc)
  },
  AdventureSchema: {
    parse: vi.fn((doc) => doc)
  },
  AdventureStartSchema: {
    parse: vi.fn((doc) => doc)
  }
}));

vi.mock('../src/utils/awf-hashing.js', () => ({
  computeContentHash: vi.fn(() => 'mock-hash-123')
}));

const app = express();
app.use(express.json());
app.use('/api/admin', adminRouter);

describe('AWF Admin Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Core Contracts', () => {
    it('should get core contracts', async () => {
      const mockData = [
        {
          id: 'core.contract.v4',
          version: 'v4',
          doc: { contract: 'test' },
          hash: 'abc123',
          active: true,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z'
        }
      ];

      mockSupabase.from().select().order().mockResolvedValueOnce({
        data: mockData,
        error: null
      });

      const response = await request(app)
        .get('/api/admin/awf/core-contracts')
        .expect(200);

      expect(response.body).toEqual({
        ok: true,
        data: mockData
      });
    });

    it('should create core contract', async () => {
      const mockData = {
        id: 'core.contract.v4',
        version: 'v4',
        doc: { contract: 'test' },
        hash: 'mock-hash-123',
        active: true
      };

      mockSupabase.from().upsert().select().single().mockResolvedValueOnce({
        data: mockData,
        error: null
      });

      const response = await request(app)
        .post('/api/admin/awf/core-contracts')
        .send({
          id: 'core.contract.v4',
          version: 'v4',
          doc: { contract: 'test' },
          active: true
        })
        .expect(200);

      expect(response.body).toEqual({
        ok: true,
        data: mockData
      });
    });

    it('should activate core contract', async () => {
      const mockData = {
        id: 'core.contract.v4',
        version: 'v4',
        active: true
      };

      mockSupabase.from().update().eq().select().single().mockResolvedValueOnce({
        data: mockData,
        error: null
      });

      const response = await request(app)
        .patch('/api/admin/awf/core-contracts/core.contract.v4/v4/activate')
        .expect(200);

      expect(response.body).toEqual({
        ok: true,
        data: mockData
      });
    });

    it('should validate core contract document', async () => {
      const { CoreContractSchema } = await import('../src/validators/awf-validators.js');
      (CoreContractSchema.parse as any).mockImplementationOnce(() => {
        throw new Error('Invalid document structure');
      });

      const response = await request(app)
        .post('/api/admin/awf/core-contracts')
        .send({
          id: 'core.contract.v4',
          version: 'v4',
          doc: { invalid: 'structure' }
        })
        .expect(400);

      expect(response.body).toEqual({
        ok: false,
        error: 'Document validation failed',
        details: 'Invalid document structure'
      });
    });
  });

  describe('Worlds', () => {
    it('should get worlds', async () => {
      const mockData = [
        {
          id: 'world.mystika',
          version: 'v1',
          doc: { name: 'Mystika' },
          hash: 'abc123',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z'
        }
      ];

      mockSupabase.from().select().order().mockResolvedValueOnce({
        data: mockData,
        error: null
      });

      const response = await request(app)
        .get('/api/admin/awf/worlds')
        .expect(200);

      expect(response.body).toEqual({
        ok: true,
        data: mockData
      });
    });

    it('should create world', async () => {
      const mockData = {
        id: 'world.mystika',
        version: 'v1',
        doc: { name: 'Mystika' },
        hash: 'mock-hash-123'
      };

      mockSupabase.from().upsert().select().single().mockResolvedValueOnce({
        data: mockData,
        error: null
      });

      const response = await request(app)
        .post('/api/admin/awf/worlds')
        .send({
          id: 'world.mystika',
          version: 'v1',
          doc: { name: 'Mystika' }
        })
        .expect(200);

      expect(response.body).toEqual({
        ok: true,
        data: mockData
      });
    });
  });

  describe('Adventures', () => {
    it('should get adventures', async () => {
      const mockData = [
        {
          id: 'adv.whispercross',
          world_ref: 'world.mystika',
          version: 'v1',
          doc: { name: 'Whispercross' },
          hash: 'abc123',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z'
        }
      ];

      mockSupabase.from().select().order().mockResolvedValueOnce({
        data: mockData,
        error: null
      });

      const response = await request(app)
        .get('/api/admin/awf/adventures')
        .expect(200);

      expect(response.body).toEqual({
        ok: true,
        data: mockData
      });
    });

    it('should create adventure', async () => {
      const mockData = {
        id: 'adv.whispercross',
        world_ref: 'world.mystika',
        version: 'v1',
        doc: { name: 'Whispercross' },
        hash: 'mock-hash-123'
      };

      mockSupabase.from().upsert().select().single().mockResolvedValueOnce({
        data: mockData,
        error: null
      });

      const response = await request(app)
        .post('/api/admin/awf/adventures')
        .send({
          id: 'adv.whispercross',
          world_ref: 'world.mystika',
          version: 'v1',
          doc: { name: 'Whispercross' }
        })
        .expect(200);

      expect(response.body).toEqual({
        ok: true,
        data: mockData
      });
    });
  });

  describe('Adventure Starts', () => {
    it('should get adventure starts', async () => {
      const mockData = [
        {
          adventure_ref: 'adv.whispercross',
          doc: { start: { scene: 'intro' } },
          use_once: true,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z'
        }
      ];

      mockSupabase.from().select().order().mockResolvedValueOnce({
        data: mockData,
        error: null
      });

      const response = await request(app)
        .get('/api/admin/awf/adventure-starts')
        .expect(200);

      expect(response.body).toEqual({
        ok: true,
        data: mockData
      });
    });

    it('should create adventure start', async () => {
      const mockData = {
        adventure_ref: 'adv.whispercross',
        doc: { start: { scene: 'intro' } },
        use_once: true
      };

      mockSupabase.from().upsert().select().single().mockResolvedValueOnce({
        data: mockData,
        error: null
      });

      const response = await request(app)
        .post('/api/admin/awf/adventure-starts')
        .send({
          adventure_ref: 'adv.whispercross',
          doc: { start: { scene: 'intro' } },
          use_once: true
        })
        .expect(200);

      expect(response.body).toEqual({
        ok: true,
        data: mockData
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing required fields', async () => {
      const response = await request(app)
        .post('/api/admin/awf/core-contracts')
        .send({
          id: 'core.contract.v4'
          // Missing version and doc
        })
        .expect(400);

      expect(response.body).toEqual({
        ok: false,
        error: 'Missing required fields: id, version, doc'
      });
    });

    it('should handle database errors', async () => {
      mockSupabase.from().upsert().select().single().mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' }
      });

      const response = await request(app)
        .post('/api/admin/awf/core-contracts')
        .send({
          id: 'core.contract.v4',
          version: 'v4',
          doc: { contract: 'test' }
        })
        .expect(500);

      expect(response.body).toEqual({
        ok: false,
        error: 'Failed to save core contract',
        details: 'Database error'
      });
    });
  });
});


