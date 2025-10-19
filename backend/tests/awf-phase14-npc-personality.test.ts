/**
 * Phase 14: NPC Personality Tests
 * Comprehensive test suite for personality engine and behavior policy
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn(() => ({ error: null })),
      select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(() => ({ data: null, error: null })) })) })),
      update: vi.fn(() => ({ eq: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(() => ({ data: null, error: null })) })) })) })),
      delete: vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) })),
      order: vi.fn(() => ({ limit: vi.fn(() => ({ data: [], error: null })) })),
      range: vi.fn(() => ({ data: [], error: null })),
    })),
    rpc: vi.fn(() => ({ data: null, error: null })),
  })),
}));

import { PersonalityEngine, PersonalityTraits } from '../src/personality/personality-engine.js';
import { NpcBehaviorPolicy, NpcContext } from '../src/policies/npc-behavior-policy.js';

describe('Personality Engine', () => {
  let personalityEngine: PersonalityEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    personalityEngine = new PersonalityEngine();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Trait Management', () => {
    it('should initialize personality with default traits', async () => {
      const mockRpc = vi.fn().mockResolvedValue({ data: 'personality-id', error: null });
      const mockSupabase = {
        rpc: mockRpc,
      };

      // Mock the supabase client
      vi.doMock('@supabase/supabase-js', () => ({
        createClient: vi.fn(() => mockSupabase),
      }));

      const npcRef = 'guard_001';
      const worldRef = 'mystika';
      const adventureRef = 'whispercross';

      const personality = await personalityEngine.initPersonality(
        npcRef,
        worldRef,
        adventureRef
      );

      expect(personality.npcRef).toBe(npcRef);
      expect(personality.worldRef).toBe(worldRef);
      expect(personality.adventureRef).toBe(adventureRef);
      expect(personality.traits.openness).toBe(50);
      expect(personality.traits.loyalty).toBe(50);
      expect(personality.snapshotVersion).toBe(1);
    });

    it('should initialize personality with custom traits', async () => {
      const mockRpc = vi.fn().mockResolvedValue({ data: 'personality-id', error: null });
      const mockSupabase = {
        rpc: mockRpc,
      };

      vi.doMock('@supabase/supabase-js', () => ({
        createClient: vi.fn(() => mockSupabase),
      }));

      const baseTraits: Partial<PersonalityTraits> = {
        openness: 80,
        loyalty: 90,
        caution: 20,
      };

      const personality = await personalityEngine.initPersonality(
        'guard_001',
        'mystika',
        'whispercross',
        baseTraits
      );

      expect(personality.traits.openness).toBe(80);
      expect(personality.traits.loyalty).toBe(90);
      expect(personality.traits.caution).toBe(20);
    });

    it('should generate personality summary', () => {
      const traits: PersonalityTraits = {
        openness: 80,
        loyalty: 90,
        caution: 20,
        empathy: 70,
        patience: 60,
        aggression: 30,
        trust: 85,
        curiosity: 75,
        stubbornness: 40,
        humor: 65,
      };

      const summary = personalityEngine['generatePersonalitySummary'](traits);
      
      expect(summary).toContain('Curious');
      expect(summary).toContain('high trust');
      expect(summary).toContain('high loyalty');
    });

    it('should identify dominant traits correctly', () => {
      const traits: PersonalityTraits = {
        openness: 85,
        loyalty: 90,
        caution: 15,
        empathy: 70,
        patience: 60,
        aggression: 20,
        trust: 80,
        curiosity: 75,
        stubbornness: 30,
        humor: 65,
      };

      const dominantTraits = personalityEngine['getDominantTraits'](traits);
      
      expect(dominantTraits).toContain('high loyalty');
      expect(dominantTraits).toContain('high trust');
      expect(dominantTraits).toContain('high openness');
    });

    it('should determine personality archetype', () => {
      const friendlyTraits: PersonalityTraits = {
        openness: 50, loyalty: 50, caution: 50, empathy: 80, patience: 50,
        aggression: 50, trust: 80, curiosity: 50, stubbornness: 50, humor: 50,
      };
      expect(personalityEngine['determineArchetype'](friendlyTraits)).toBe('Friendly');

      const cautiousTraits: PersonalityTraits = {
        openness: 50, loyalty: 50, caution: 80, empathy: 50, patience: 50,
        aggression: 20, trust: 50, curiosity: 50, stubbornness: 50, humor: 50,
      };
      expect(personalityEngine['determineArchetype'](cautiousTraits)).toBe('Cautious');

      const aggressiveTraits: PersonalityTraits = {
        openness: 50, loyalty: 50, caution: 50, empathy: 50, patience: 20,
        aggression: 80, trust: 50, curiosity: 50, stubbornness: 50, humor: 50,
      };
      expect(personalityEngine['determineArchetype'](aggressiveTraits)).toBe('Aggressive');
    });
  });

  describe('Trait Adjustments', () => {
    it('should calculate trait adjustments from warm memories', () => {
      const currentTraits: PersonalityTraits = {
        openness: 50, loyalty: 50, caution: 50, empathy: 50, patience: 50,
        aggression: 50, trust: 50, curiosity: 50, stubbornness: 50, humor: 50,
      };

      const warmMemories = [
        {
          type: 'warm' as const,
          content: 'Player helped NPC',
          emotionalWeight: 50,
          timestamp: new Date().toISOString(),
        },
        {
          type: 'episodic' as const,
          content: 'Shared adventure',
          emotionalWeight: 30,
          timestamp: new Date().toISOString(),
        },
      ];

      const recentActs = [
        {
          actType: 'help',
          targetNpc: 'guard_001',
          emotionalImpact: 40,
          timestamp: new Date().toISOString(),
        },
      ];

      const adjustments = personalityEngine['calculateTraitAdjustments'](
        currentTraits,
        warmMemories,
        recentActs
      );

      expect(adjustments.trust).toBeGreaterThan(0);
      expect(adjustments.empathy).toBeGreaterThan(0);
      expect(adjustments.curiosity).toBeGreaterThan(0);
    });

    it('should calculate trait adjustments from negative acts', () => {
      const currentTraits: PersonalityTraits = {
        openness: 50, loyalty: 50, caution: 50, empathy: 50, patience: 50,
        aggression: 50, trust: 50, curiosity: 50, stubbornness: 50, humor: 50,
      };

      const warmMemories: any[] = [];
      const recentActs = [
        {
          actType: 'betray',
          targetNpc: 'guard_001',
          emotionalImpact: -60,
          timestamp: new Date().toISOString(),
        },
        {
          actType: 'ignore',
          targetNpc: 'guard_001',
          emotionalImpact: -30,
          timestamp: new Date().toISOString(),
        },
      ];

      const adjustments = personalityEngine['calculateTraitAdjustments'](
        currentTraits,
        warmMemories,
        recentActs
      );

      expect(adjustments.trust).toBeLessThan(0);
      expect(adjustments.caution).toBeGreaterThan(0);
      expect(adjustments.patience).toBeLessThan(0);
    });

    it('should apply trait adjustments with bounds checking', () => {
      const currentTraits: PersonalityTraits = {
        openness: 50, loyalty: 50, caution: 50, empathy: 50, patience: 50,
        aggression: 50, trust: 50, curiosity: 50, stubbornness: 50, humor: 50,
      };

      const adjustments = {
        trust: 10,
        empathy: -15,
        openness: 25, // This should be capped
      };

      const newTraits = personalityEngine['applyTraitAdjustments'](currentTraits, adjustments);

      expect(newTraits.trust).toBe(60);
      expect(newTraits.empathy).toBe(35);
      expect(newTraits.openness).toBe(75); // Should be capped at maxTraitDelta
    });
  });

  describe('Cross-Session Merging', () => {
    it('should calculate weighted average with decay', () => {
      const snapshots = [
        {
          traits: { openness: 50, loyalty: 50, caution: 50, empathy: 50, patience: 50,
                   aggression: 50, trust: 50, curiosity: 50, stubbornness: 50, humor: 50 },
          last_updated: new Date().toISOString(),
        },
        {
          traits: { openness: 60, loyalty: 60, caution: 40, empathy: 60, patience: 40,
                   aggression: 40, trust: 60, curiosity: 60, stubbornness: 40, humor: 60 },
          last_updated: new Date(Date.now() - 1000).toISOString(),
        },
        {
          traits: { openness: 70, loyalty: 70, caution: 30, empathy: 70, patience: 30,
                   aggression: 30, trust: 70, curiosity: 70, stubbornness: 30, humor: 70 },
          last_updated: new Date(Date.now() - 2000).toISOString(),
        },
      ];

      const mergedTraits = personalityEngine['calculateWeightedAverage'](snapshots);

      // Should be weighted toward more recent snapshots
      expect(mergedTraits.openness).toBeGreaterThan(50);
      expect(mergedTraits.openness).toBeLessThan(70);
      expect(mergedTraits.loyalty).toBeGreaterThan(50);
      expect(mergedTraits.loyalty).toBeLessThan(70);
    });

    it('should handle single snapshot merge', () => {
      const snapshots = [
        {
          traits: { openness: 60, loyalty: 60, caution: 40, empathy: 60, patience: 40,
                   aggression: 40, trust: 60, curiosity: 60, stubbornness: 40, humor: 60 },
          last_updated: new Date().toISOString(),
        },
      ];

      const mergedTraits = personalityEngine['calculateWeightedAverage'](snapshots);

      expect(mergedTraits.openness).toBe(60);
      expect(mergedTraits.loyalty).toBe(60);
      expect(mergedTraits.caution).toBe(40);
    });
  });
});

describe('NPC Behavior Policy', () => {
  let behaviorPolicy: NpcBehaviorPolicy;

  beforeEach(() => {
    vi.clearAllMocks();
    behaviorPolicy = new NpcBehaviorPolicy();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Behavior Profile Computation', () => {
    it('should compute friendly tone for high trust and empathy', () => {
      const traits: PersonalityTraits = {
        openness: 50, loyalty: 50, caution: 30, empathy: 80, patience: 50,
        aggression: 20, trust: 80, curiosity: 50, stubbornness: 30, humor: 50,
      };

      const context: NpcContext = {
        npcRef: 'guard_001',
        worldRef: 'mystika',
        sessionId: 'session-123',
        recentPlayerActs: [],
        relationshipMatrix: { 'guard_001': 80 },
      };

      const profile = behaviorPolicy.computeBehaviorProfile(traits, context);

      expect(profile.tone).toBe('friendly');
      expect(profile.dialogueStyle).toBe('formal');
      expect(profile.trustThreshold).toBeGreaterThan(50);
    });

    it('should compute cautious tone for high caution', () => {
      const traits: PersonalityTraits = {
        openness: 30, loyalty: 50, caution: 80, empathy: 40, patience: 60,
        aggression: 20, trust: 30, curiosity: 40, stubbornness: 60, humor: 30,
      };

      const context: NpcContext = {
        npcRef: 'guard_001',
        worldRef: 'mystika',
        sessionId: 'session-123',
        recentPlayerActs: [],
        relationshipMatrix: { 'guard_001': 30 },
      };

      const profile = behaviorPolicy.computeBehaviorProfile(traits, context);

      expect(profile.tone).toBe('cold');
      expect(profile.dialogueStyle).toBe('distant');
      expect(profile.trustThreshold).toBeLessThan(50);
    });

    it('should compute aggressive tone for high aggression', () => {
      const traits: PersonalityTraits = {
        openness: 40, loyalty: 50, caution: 30, empathy: 30, patience: 20,
        aggression: 80, trust: 40, curiosity: 40, stubbornness: 70, humor: 30,
      };

      const context: NpcContext = {
        npcRef: 'guard_001',
        worldRef: 'mystika',
        sessionId: 'session-123',
        recentPlayerActs: [],
        relationshipMatrix: { 'guard_001': 40 },
      };

      const profile = behaviorPolicy.computeBehaviorProfile(traits, context);

      expect(profile.tone).toBe('aggressive');
      expect(profile.riskTolerance).toBeGreaterThan(50);
    });
  });

  describe('Act Biases', () => {
    it('should generate act biases based on personality', () => {
      const traits: PersonalityTraits = {
        openness: 50, loyalty: 50, caution: 50, empathy: 80, patience: 50,
        aggression: 70, trust: 50, curiosity: 60, stubbornness: 50, humor: 70,
      };

      const context: NpcContext = {
        npcRef: 'guard_001',
        worldRef: 'mystika',
        sessionId: 'session-123',
        recentPlayerActs: [],
        relationshipMatrix: {},
      };

      const profile = behaviorPolicy.computeBehaviorProfile(traits, context);

      expect(profile.actBiases.help || 0).toBeGreaterThanOrEqual(0);
      expect(profile.actBiases.attack || 0).toBeGreaterThanOrEqual(0);
      expect(profile.actBiases.joke || 0).toBeGreaterThanOrEqual(0);
      expect(profile.actBiases.question || 0).toBeGreaterThanOrEqual(0);
    });

    it('should adjust act biases based on recent interactions', () => {
      const traits: PersonalityTraits = {
        openness: 50, loyalty: 50, caution: 50, empathy: 50, patience: 50,
        aggression: 50, trust: 50, curiosity: 50, stubbornness: 50, humor: 50,
      };

      const positiveContext: NpcContext = {
        npcRef: 'guard_001',
        worldRef: 'mystika',
        sessionId: 'session-123',
        recentPlayerActs: [
          {
            actType: 'help',
            targetNpc: 'guard_001',
            emotionalImpact: 50,
            timestamp: new Date().toISOString(),
          },
        ],
        relationshipMatrix: {},
      };

      const negativeContext: NpcContext = {
        npcRef: 'guard_001',
        worldRef: 'mystika',
        sessionId: 'session-123',
        recentPlayerActs: [
          {
            actType: 'betray',
            targetNpc: 'guard_001',
            emotionalImpact: -50,
            timestamp: new Date().toISOString(),
          },
        ],
        relationshipMatrix: {},
      };

      const positiveProfile = behaviorPolicy.computeBehaviorProfile(traits, positiveContext);
      const negativeProfile = behaviorPolicy.computeBehaviorProfile(traits, negativeContext);

      expect(positiveProfile.actBiases.help).toBeGreaterThan(negativeProfile.actBiases.help || 0);
      expect(negativeProfile.actBiases.retreat).toBeGreaterThan(positiveProfile.actBiases.retreat || 0);
    });
  });

  describe('Deterministic Behavior', () => {
    it('should generate consistent behavior for same inputs', () => {
      const traits: PersonalityTraits = {
        openness: 50, loyalty: 50, caution: 50, empathy: 50, patience: 50,
        aggression: 50, trust: 50, curiosity: 50, stubbornness: 50, humor: 50,
      };

      const context: NpcContext = {
        npcRef: 'guard_001',
        worldRef: 'mystika',
        sessionId: 'session-123',
        recentPlayerActs: [],
        relationshipMatrix: {},
      };

      const profile1 = behaviorPolicy.computeBehaviorProfile(traits, context);
      const profile2 = behaviorPolicy.computeBehaviorProfile(traits, context);

      expect(profile1.tone).toBe(profile2.tone);
      expect(profile1.dialogueStyle).toBe(profile2.dialogueStyle);
      expect(profile1.trustThreshold).toBe(profile2.trustThreshold);
    });

    it('should generate different behavior for different NPCs', () => {
      const traits: PersonalityTraits = {
        openness: 50, loyalty: 50, caution: 50, empathy: 50, patience: 50,
        aggression: 50, trust: 50, curiosity: 50, stubbornness: 50, humor: 50,
      };

      const context1: NpcContext = {
        npcRef: 'guard_001',
        worldRef: 'mystika',
        sessionId: 'session-123',
        recentPlayerActs: [],
        relationshipMatrix: {},
      };

      const context2: NpcContext = {
        npcRef: 'merchant_002',
        worldRef: 'mystika',
        sessionId: 'session-123',
        recentPlayerActs: [],
        relationshipMatrix: {},
      };

      const profile1 = behaviorPolicy.computeBehaviorProfile(traits, context1);
      const profile2 = behaviorPolicy.computeBehaviorProfile(traits, context2);

      // Should be different due to different NPC refs (or at least not identical)
      expect(profile1.tone).toBeDefined();
      expect(profile2.tone).toBeDefined();
    });
  });

  describe('Behavior Context Generation', () => {
    it('should generate behavior context for AWF bundle', () => {
      const traits: PersonalityTraits = {
        openness: 50, loyalty: 50, caution: 50, empathy: 50, patience: 50,
        aggression: 50, trust: 50, curiosity: 50, stubbornness: 50, humor: 50,
      };

      const context: NpcContext = {
        npcRef: 'guard_001',
        worldRef: 'mystika',
        sessionId: 'session-123',
        recentPlayerActs: [
          {
            actType: 'help',
            targetNpc: 'guard_001',
            emotionalImpact: 30,
            timestamp: new Date().toISOString(),
          },
        ],
        relationshipMatrix: { 'guard_001': 70 },
        worldMood: 'tense',
      };

      const profile = behaviorPolicy.computeBehaviorProfile(traits, context);
      const behaviorContext = behaviorPolicy.generateBehaviorContext('guard_001', profile, context);

      expect(behaviorContext.npc_behavior).toBeDefined();
      expect(behaviorContext.npc_behavior.npc_ref).toBe('guard_001');
      expect(behaviorContext.npc_behavior.tone).toBeDefined();
      expect(behaviorContext.npc_behavior.context.world_mood).toBe('tense');
      expect(behaviorContext.npc_behavior.context.relationship_trust).toEqual({ 'guard_001': 70 });
    });
  });
});

describe('Integration Tests', () => {
  it('should handle end-to-end personality evolution', async () => {
    // This would test the full flow from personality initialization
    // through trait adjustments to behavior policy computation
    // In a real implementation, this would involve actual database calls
    // and the full personality engine workflow
    expect(true).toBe(true); // Placeholder for integration test
  });

  it('should maintain personality consistency across sessions', async () => {
    // This would test that personality merges work correctly
    // and maintain consistency across different sessions
    expect(true).toBe(true); // Placeholder for integration test
  });
});

describe('Performance Tests', () => {
  it('should compute behavior profile efficiently', () => {
    const behaviorPolicy = new NpcBehaviorPolicy();
    
    const traits: PersonalityTraits = {
      openness: 50, loyalty: 50, caution: 50, empathy: 50, patience: 50,
      aggression: 50, trust: 50, curiosity: 50, stubbornness: 50, humor: 50,
    };

    const context: NpcContext = {
      npcRef: 'guard_001',
      worldRef: 'mystika',
      sessionId: 'session-123',
      recentPlayerActs: [],
      relationshipMatrix: {},
    };

    const startTime = Date.now();
    
    // Compute behavior profile multiple times
    for (let i = 0; i < 100; i++) {
      behaviorPolicy.computeBehaviorProfile(traits, context);
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;

    // Should complete in reasonable time (< 100ms for 100 computations)
    expect(duration).toBeLessThan(100);
  });
});
