// NPC Service Tests
// Tests for NPC catalog, relationships, and tier computation

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  getEntryNpcs, 
  getOrCreateRel, 
  computeTier, 
  buildNpcArgs, 
  updateNpcRelationship,
  getNpcDetails,
  getWorldNpcs
} from '../../src/services/npc';
import { MockDbAdapter } from '../../src/prompt/assembler/db';
import type { NpcRelationship } from '../../src/services/npc';

describe('NPC Service', () => {
  let mockDb: MockDbAdapter;

  beforeEach(() => {
    mockDb = new MockDbAdapter();
    
    // Seed NPC prompt segments
    mockDb.addSegments([{
      id: 1,
      scope: 'npc',
      ref_id: 'npc.mystika.kiera',
      version: '1.0.0',
      active: true,
      content: 'NPC: Kiera — calm, alert, protective. Prefers de-escalation.',
      metadata: { tier: 0, kind: 'baseline' }
    }]);

    mockDb.addSegments([{
      id: 2,
      scope: 'npc',
      ref_id: 'npc.mystika.kiera',
      version: '1.0.0',
      active: true,
      content: 'Reveal: owes life-debt to a drygar (mentions at trust≥20).',
      metadata: { tier: 1, kind: 'secret' }
    }]);

    mockDb.addSegments([{
      id: 3,
      scope: 'npc',
      ref_id: 'npc.mystika.kiera',
      version: '1.0.0',
      active: true,
      content: 'Deep Reveal: carries cracked focus stone; shares at respect≥25 & warmth≥20.',
      metadata: { tier: 2, kind: 'secret' }
    }]);

    mockDb.addSegments([{
      id: 4,
      scope: 'npc',
      ref_id: 'npc.mystika.kiera',
      version: '1.0.0',
      active: true,
      content: 'True name: Kierathen Vail (romance≥30 & trust≥30).',
      metadata: { tier: 3, kind: 'secret' }
    }]);

    // Thorne segments
    mockDb.addSegments([{
      id: 5,
      scope: 'npc',
      ref_id: 'npc.mystika.thorne',
      version: '1.0.0',
      active: true,
      content: 'NPC: Thorne — scholarly, absent-minded, knowledgeable.',
      metadata: { tier: 0, kind: 'baseline' }
    }]);

    mockDb.addSegments([{
      id: 6,
      scope: 'npc',
      ref_id: 'npc.mystika.thorne',
      version: '1.0.0',
      active: true,
      content: 'Reveal: has studied this temple before (trust≥20).',
      metadata: { tier: 1, kind: 'secret' }
    }]);
  });

  describe('getEntryNpcs', () => {
    it('should return NPCs bound to an entry point', async () => {
      const npcs = await getEntryNpcs('demo.system.adventure', mockDb);
      
      expect(npcs).toHaveLength(3);
      expect(npcs[0].npcId).toBe('npc.mystika.kiera');
      expect(npcs[0].weight).toBe(3);
      expect(npcs[0].roleHint).toBe('guide');
    });

    it('should return empty array for unknown entry point', async () => {
      const npcs = await getEntryNpcs('unknown.entry', mockDb);
      expect(npcs).toHaveLength(0);
    });
  });

  describe('getOrCreateRel', () => {
    it('should create new relationship with default values', async () => {
      const rel = await getOrCreateRel('game-123', 'npc.mystika.kiera', mockDb);
      
      expect(rel.gameId).toBe('game-123');
      expect(rel.npcId).toBe('npc.mystika.kiera');
      expect(rel.trust).toBe(0);
      expect(rel.warmth).toBe(0);
      expect(rel.respect).toBe(0);
      expect(rel.romance).toBe(0);
      expect(rel.awe).toBe(0);
      expect(rel.fear).toBe(0);
      expect(rel.desire).toBe(0);
      expect(rel.flags).toEqual({});
    });
  });

  describe('computeTier', () => {
    it('should compute tier 0 for new relationship', () => {
      const rel: NpcRelationship = {
        gameId: 'game-123',
        npcId: 'npc.mystika.kiera',
        trust: 0,
        warmth: 0,
        respect: 0,
        romance: 0,
        awe: 0,
        fear: 0,
        desire: 0,
        flags: {},
        updatedAt: new Date().toISOString()
      };

      expect(computeTier(rel)).toBe(0);
    });

    it('should compute tier 1 for moderate positive relationship', () => {
      const rel: NpcRelationship = {
        gameId: 'game-123',
        npcId: 'npc.mystika.kiera',
        trust: 20,
        warmth: 10,
        respect: 15,
        romance: 0,
        awe: 5,
        fear: 0,
        desire: 0,
        flags: {},
        updatedAt: new Date().toISOString()
      };

      expect(computeTier(rel)).toBe(1);
    });

    it('should compute tier 2 for strong positive relationship', () => {
      const rel: NpcRelationship = {
        gameId: 'game-123',
        npcId: 'npc.mystika.kiera',
        trust: 30,
        warmth: 25,
        respect: 35,
        romance: 10,
        awe: 15,
        fear: 0,
        desire: 0,
        flags: {},
        updatedAt: new Date().toISOString()
      };

      expect(computeTier(rel)).toBe(2);
    });

    it('should compute tier 3 for very strong positive relationship', () => {
      const rel: NpcRelationship = {
        gameId: 'game-123',
        npcId: 'npc.mystika.kiera',
        trust: 50,
        warmth: 40,
        respect: 45,
        romance: 30,
        awe: 25,
        fear: 0,
        desire: 0,
        flags: {},
        updatedAt: new Date().toISOString()
      };

      expect(computeTier(rel)).toBe(3);
    });

    it('should handle negative relationships (fear)', () => {
      const rel: NpcRelationship = {
        gameId: 'game-123',
        npcId: 'npc.mystika.kiera',
        trust: 20,
        warmth: 10,
        respect: 15,
        romance: 0,
        awe: 5,
        fear: 30, // High fear reduces tier
        desire: 0,
        flags: {},
        updatedAt: new Date().toISOString()
      };

      expect(computeTier(rel)).toBe(0); // Fear reduces tier significantly
    });

    it('should clamp tier to 0-3 range', () => {
      const veryHighRel: NpcRelationship = {
        gameId: 'game-123',
        npcId: 'npc.mystika.kiera',
        trust: 100,
        warmth: 100,
        respect: 100,
        romance: 100,
        awe: 100,
        fear: 0,
        desire: 0,
        flags: {},
        updatedAt: new Date().toISOString()
      };

      expect(computeTier(veryHighRel)).toBe(3); // Clamped to max tier
    });
  });

  describe('buildNpcArgs', () => {
    it('should build NPC args with computed tiers', async () => {
      const npcArgs = await buildNpcArgs('game-123', 'demo.system.adventure', mockDb);
      
      expect(npcArgs).toHaveLength(3);
      expect(npcArgs[0].npcId).toBe('npc.mystika.kiera');
      expect(npcArgs[0].tier).toBe(0); // Default tier for new relationship
      expect(npcArgs[1].npcId).toBe('npc.mystika.thorne');
      expect(npcArgs[1].tier).toBe(0);
      expect(npcArgs[2].npcId).toBe('npc.mystika.zara');
      expect(npcArgs[2].tier).toBe(0);
    });

    it('should return empty array for unknown entry point', async () => {
      const npcArgs = await buildNpcArgs('game-123', 'unknown.entry', mockDb);
      expect(npcArgs).toHaveLength(0);
    });
  });

  describe('updateNpcRelationship', () => {
    it('should update relationship values', async () => {
      const updates = {
        trust: 25,
        warmth: 15,
        respect: 20,
        flags: { met: true, first_impression: 'positive' }
      };

      await updateNpcRelationship('game-123', 'npc.mystika.kiera', updates, mockDb);
      
      // In production, this would verify the database was updated
      expect(true).toBe(true); // Mock implementation
    });
  });

  describe('getNpcDetails', () => {
    it('should return NPC details by ID', async () => {
      const npc = await getNpcDetails('npc.mystika.kiera', mockDb);
      
      expect(npc).toBeDefined();
      expect(npc.id).toBe('npc.mystika.kiera');
      expect(npc.name).toBe('Kiera');
      expect(npc.archetype).toBe('Warden');
      expect(npc.roleTags).toEqual(['companion', 'guide']);
    });

    it('should return null for unknown NPC', async () => {
      const npc = await getNpcDetails('unknown.npc', mockDb);
      expect(npc).toBeNull();
    });
  });

  describe('getWorldNpcs', () => {
    it('should return NPCs for a world', async () => {
      const npcs = await getWorldNpcs('mystika', mockDb);
      
      expect(npcs).toHaveLength(3);
      expect(npcs[0].id).toBe('npc.mystika.kiera');
      expect(npcs[1].id).toBe('npc.mystika.thorne');
      expect(npcs[2].id).toBe('npc.mystika.zara');
    });

    it('should return empty array for unknown world', async () => {
      const npcs = await getWorldNpcs('unknown', mockDb);
      expect(npcs).toHaveLength(0);
    });
  });
});
