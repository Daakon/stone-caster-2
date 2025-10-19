/**
 * Tests for AWF Core Rulesets Repository
 * Phase 1: Core vs Rulesets Framework Split - Repository tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CoreRulesetsRepository } from '../src/repositories/awf-core-rulesets-repository.js';
import { CoreRulesetRecord } from '../src/types/awf-core.js';
import { CoreRulesetV1Schema } from '../src/validators/awf-ruleset.schema.js';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(() => ({
          data: null,
          error: { code: 'PGRST116' }
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
          data: mockRulesetRecord,
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
};

const mockRulesetRecord: CoreRulesetRecord = {
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
};

describe('CoreRulesetsRepository', () => {
  let repository: CoreRulesetsRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new CoreRulesetsRepository({ supabase: mockSupabase as any });
  });

  describe('getByIdVersion', () => {
    it('should return null when ruleset not found', async () => {
      const result = await repository.getByIdVersion('core.default', '1.0.0');
      expect(result).toBeNull();
    });

    it('should return ruleset when found', async () => {
      const mockQuery = {
        data: mockRulesetRecord,
        error: null
      };
      mockSupabase.from().select().eq().single.mockReturnValue(mockQuery);

      const result = await repository.getByIdVersion('core.default', '1.0.0');
      expect(result).toEqual(mockRulesetRecord);
    });

    it('should throw error on database error', async () => {
      const mockQuery = {
        data: null,
        error: { message: 'Database error' }
      };
      mockSupabase.from().select().eq().single.mockReturnValue(mockQuery);

      await expect(repository.getByIdVersion('core.default', '1.0.0'))
        .rejects.toThrow('Database error: Database error');
    });
  });

  describe('list', () => {
    it('should return empty array when no rulesets found', async () => {
      const result = await repository.list();
      expect(result).toEqual([]);
    });

    it('should return rulesets when found', async () => {
      const mockQuery = {
        data: [mockRulesetRecord],
        error: null
      };
      mockSupabase.from().select().order().order.mockReturnValue(mockQuery);

      const result = await repository.list();
      expect(result).toEqual([mockRulesetRecord]);
    });

    it('should throw error on database error', async () => {
      const mockQuery = {
        data: null,
        error: { message: 'Database error' }
      };
      mockSupabase.from().select().order().order.mockReturnValue(mockQuery);

      await expect(repository.list())
        .rejects.toThrow('Database error: Database error');
    });
  });

  describe('upsert', () => {
    it('should upsert valid ruleset', async () => {
      const result = await repository.upsert(mockRulesetRecord);
      expect(result).toEqual(mockRulesetRecord);
    });

    it('should throw error for invalid document', async () => {
      const invalidRecord = {
        ...mockRulesetRecord,
        doc: { invalid: 'document' }
      };

      await expect(repository.upsert(invalidRecord))
        .rejects.toThrow('Invalid core ruleset document');
    });

    it('should throw error on database error', async () => {
      mockSupabase.from().upsert().select().single.mockReturnValue({
        data: null,
        error: { message: 'Database error' }
      });

      await expect(repository.upsert(mockRulesetRecord))
        .rejects.toThrow('Database error: Database error');
    });
  });

  describe('deleteByIdVersion', () => {
    it('should delete ruleset successfully', async () => {
      await expect(repository.deleteByIdVersion('core.default', '1.0.0'))
        .resolves.not.toThrow();
    });

    it('should throw error on database error', async () => {
      mockSupabase.from().delete().eq().eq.mockReturnValue({
        data: null,
        error: { message: 'Database error' }
      });

      await expect(repository.deleteByIdVersion('core.default', '1.0.0'))
        .rejects.toThrow('Database error: Database error');
    });
  });

  describe('validate', () => {
    it('should return true for valid ruleset document', () => {
      const validDoc = {
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
      };

      expect(repository.validate(validDoc)).toBe(true);
    });

    it('should return false for invalid ruleset document', () => {
      const invalidDoc = {
        invalid: 'document'
      };

      expect(repository.validate(invalidDoc)).toBe(false);
    });
  });

  describe('computeHash', () => {
    it('should compute hash for document', () => {
      const doc = { test: 'document' };
      const hash = repository.computeHash(doc);
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });
  });
});
