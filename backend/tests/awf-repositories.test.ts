/**
 * Unit tests for AWF (Adventure World Format) bundle repositories
 * Phase 1: Data Model - Repository testing
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CoreContractsRepository } from '../src/repositories/awf-core-contracts-repository.js';
import { WorldsRepository } from '../src/repositories/awf-worlds-repository.js';
import { AdventuresRepository } from '../src/repositories/awf-adventures-repository.js';
import { AdventureStartsRepository } from '../src/repositories/awf-adventure-starts-repository.js';
import { SessionsRepository } from '../src/repositories/awf-sessions-repository.js';
import { GameStatesRepository } from '../src/repositories/awf-game-states-repository.js';
import { InjectionMapRepository } from '../src/repositories/awf-injection-map-repository.js';

// Mock Supabase client
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
  raw: vi.fn((sql: string) => sql),
} as unknown as {
  from: ReturnType<typeof vi.fn>;
  raw: ReturnType<typeof vi.fn>;
};

describe('AWF Repositories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('CoreContractsRepository', () => {
    it('should validate core contract documents', () => {
      const repo = new CoreContractsRepository({ supabase: mockSupabase });
      
      const validDoc = {
        contract: {
          version: 'v4',
          name: 'Test Contract',
          description: 'A test contract',
        },
        acts: {
          allowed: ['move', 'interact'],
        },
      };

      expect(repo.validate(validDoc)).toBe(true);
    });

    it('should reject invalid core contract documents', () => {
      const repo = new CoreContractsRepository({ supabase: mockSupabase });
      
      const invalidDoc = {
        contract: {
          version: 'v4',
          // Missing name and description
        },
        acts: {
          allowed: ['move', 'interact'],
        },
      };

      expect(repo.validate(invalidDoc)).toBe(false);
    });

    it('should compute document hashes', () => {
      const repo = new CoreContractsRepository({ supabase: mockSupabase });
      
      const doc = {
        contract: {
          version: 'v4',
          name: 'Test Contract',
          description: 'A test contract',
        },
        acts: {
          allowed: ['move', 'interact'],
        },
      };

      const hash = repo.computeHash(doc);
      expect(hash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hash
    });
  });

  describe('WorldsRepository', () => {
    it('should validate world documents', () => {
      const repo = new WorldsRepository({ supabase: mockSupabase });
      
      const validDoc = {
        id: 'world.test.v1',
        name: 'Test World',
        version: 'v1',
        hash: 'abc123',
      };

      expect(repo.validate(validDoc)).toBe(true);
    });

    it('should reject invalid world documents', () => {
      const repo = new WorldsRepository({ supabase: mockSupabase });
      
      const invalidDoc = {
        id: 'world.test.v1',
        // Missing name, version, hash
      };

      expect(repo.validate(invalidDoc)).toBe(false);
    });

    it('should compute document hashes', () => {
      const repo = new WorldsRepository({ supabase: mockSupabase });
      
      const doc = {
        id: 'world.test.v1',
        name: 'Test World',
        version: 'v1',
        hash: 'abc123',
      };

      const hash = repo.computeHash(doc);
      expect(hash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hash
    });
  });

  describe('AdventuresRepository', () => {
    it('should validate adventure documents', () => {
      const repo = new AdventuresRepository({ supabase: mockSupabase });
      
      const validDoc = {
        id: 'adv.test.v1',
        world_ref: 'world.test.v1',
        version: 'v1',
        hash: 'abc123',
      };

      expect(repo.validate(validDoc)).toBe(true);
    });

    it('should reject invalid adventure documents', () => {
      const repo = new AdventuresRepository({ supabase: mockSupabase });
      
      const invalidDoc = {
        id: 'adv.test.v1',
        // Missing world_ref, version, hash
      };

      expect(repo.validate(invalidDoc)).toBe(false);
    });

    it('should compute document hashes', () => {
      const repo = new AdventuresRepository({ supabase: mockSupabase });
      
      const doc = {
        id: 'adv.test.v1',
        world_ref: 'world.test.v1',
        version: 'v1',
        hash: 'abc123',
      };

      const hash = repo.computeHash(doc);
      expect(hash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hash
    });
  });

  describe('AdventureStartsRepository', () => {
    it('should validate adventure start documents', () => {
      const repo = new AdventureStartsRepository({ supabase: mockSupabase });
      
      const validDoc = {
        start: {
          scene: 'loc.forest_clearing',
          description: 'You find yourself in a forest clearing.',
        },
        rules: {
          no_time_advance: true,
        },
      };

      expect(repo.validate(validDoc)).toBe(true);
    });

    it('should reject invalid adventure start documents', () => {
      const repo = new AdventureStartsRepository({ supabase: mockSupabase });
      
      const invalidDoc = {
        start: {
          scene: 'loc.forest_clearing',
          // Missing description
        },
        rules: {
          no_time_advance: true,
        },
      };

      expect(repo.validate(invalidDoc)).toBe(false);
    });

    it('should compute document hashes', () => {
      const repo = new AdventureStartsRepository({ supabase: mockSupabase });
      
      const doc = {
        start: {
          scene: 'loc.forest_clearing',
          description: 'You find yourself in a forest clearing.',
        },
        rules: {
          no_time_advance: true,
        },
      };

      const hash = repo.computeHash(doc);
      expect(hash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hash
    });
  });

  describe('SessionsRepository', () => {
    it('should validate session records', () => {
      const repo = new SessionsRepository({ supabase: mockSupabase });
      
      const validRecord = {
        session_id: '123e4567-e89b-12d3-a456-426614174000',
        player_id: 'player123',
        world_ref: 'world.test.v1',
        adventure_ref: 'adv.test.v1',
        turn_id: 1,
        is_first_turn: true,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      expect(repo.validate(validRecord)).toBe(true);
    });

    it('should reject invalid session records', () => {
      const repo = new SessionsRepository({ supabase: mockSupabase });
      
      const invalidRecord = {
        session_id: '123e4567-e89b-12d3-a456-426614174000',
        // Missing required fields
      };

      expect(repo.validate(invalidRecord)).toBe(false);
    });

    it('should compute document hashes', () => {
      const repo = new SessionsRepository({ supabase: mockSupabase });
      
      const record = {
        session_id: '123e4567-e89b-12d3-a456-426614174000',
        player_id: 'player123',
        world_ref: 'world.test.v1',
        adventure_ref: 'adv.test.v1',
        turn_id: 1,
        is_first_turn: true,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      const hash = repo.computeHash(record);
      expect(hash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hash
    });
  });

  describe('GameStatesRepository', () => {
    it('should validate game state records', () => {
      const repo = new GameStatesRepository({ supabase: mockSupabase });
      
      const validRecord = {
        session_id: '123e4567-e89b-12d3-a456-426614174000',
        hot: { current_scene: 'loc.forest_clearing' },
        warm: { episodic: [], pins: [] },
        cold: { world_data: {} },
        updated_at: '2023-01-01T00:00:00Z',
      };

      expect(repo.validate(validRecord)).toBe(true);
    });

    it('should reject invalid game state records', () => {
      const repo = new GameStatesRepository({ supabase: mockSupabase });
      
      const invalidRecord = {
        session_id: '123e4567-e89b-12d3-a456-426614174000',
        // Missing required fields
      };

      expect(repo.validate(invalidRecord)).toBe(false);
    });

    it('should compute document hashes', () => {
      const repo = new GameStatesRepository({ supabase: mockSupabase });
      
      const record = {
        session_id: '123e4567-e89b-12d3-a456-426614174000',
        hot: { current_scene: 'loc.forest_clearing' },
        warm: { episodic: [], pins: [] },
        cold: { world_data: {} },
        updated_at: '2023-01-01T00:00:00Z',
      };

      const hash = repo.computeHash(record);
      expect(hash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hash
    });
  });

  describe('InjectionMapRepository', () => {
    it('should validate injection map documents', () => {
      const repo = new InjectionMapRepository({ supabase: mockSupabase });
      
      const validDoc = {
        build: {
          'core.contract': '/core/contract',
        },
        acts: {
          'move': '/acts/move',
        },
      };

      expect(repo.validate(validDoc)).toBe(true);
    });

    it('should reject invalid injection map documents', () => {
      const repo = new InjectionMapRepository({ supabase: mockSupabase });
      
      const invalidDoc = {
        build: {
          'core.contract': '/core/contract',
        },
        // Missing acts
      };

      expect(repo.validate(invalidDoc)).toBe(false);
    });

    it('should compute document hashes', () => {
      const repo = new InjectionMapRepository({ supabase: mockSupabase });
      
      const doc = {
        build: {
          'core.contract': '/core/contract',
        },
        acts: {
          'move': '/acts/move',
        },
      };

      const hash = repo.computeHash(doc);
      expect(hash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hash
    });
  });
});
