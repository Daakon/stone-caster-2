/**
 * NPC Personality Engine
 * Manages persistent, adaptive personality traits that evolve through interactions
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface PersonalityTraits {
  openness: number;      // 0-100: How open to new experiences
  loyalty: number;        // 0-100: Loyalty to friends/allies
  caution: number;        // 0-100: Risk aversion
  empathy: number;        // 0-100: Understanding others' feelings
  patience: number;       // 0-100: Tolerance for delays/frustration
  aggression: number;     // 0-100: Tendency toward conflict
  trust: number;         // 0-100: Trust in others
  curiosity: number;      // 0-100: Desire to learn/explore
  stubbornness: number;   // 0-100: Resistance to change
  humor: number;         // 0-100: Appreciation for humor
}

export interface PersonalitySnapshot {
  id: string;
  npcRef: string;
  worldRef: string;
  adventureRef?: string;
  traits: PersonalityTraits;
  summary: string;
  lastUpdated: string;
  snapshotVersion: number;
  derivedFromSession?: string;
}

export interface MemoryEvent {
  type: 'warm' | 'episodic' | 'cold';
  content: string;
  emotionalWeight: number; // -100 to +100
  timestamp: string;
  relatedNpcs?: string[];
}

export interface ActEvent {
  actType: string;
  targetNpc?: string;
  emotionalImpact: number; // -100 to +100
  timestamp: string;
}

export class PersonalityEngine {
  private readonly maxTraitDelta = 5; // Maximum trait change per adjustment
  private readonly decayFactor = 0.9; // How much older snapshots lose weight
  private readonly minTraitValue = 0;
  private readonly maxTraitValue = 100;

  /**
   * Initialize personality for an NPC
   */
  async initPersonality(
    npcRef: string,
    worldRef: string,
    adventureRef: string | null = null,
    baseTraits?: Partial<PersonalityTraits>
  ): Promise<PersonalitySnapshot> {
    const defaultTraits: PersonalityTraits = {
      openness: 50,
      loyalty: 50,
      caution: 50,
      empathy: 50,
      patience: 50,
      aggression: 50,
      trust: 50,
      curiosity: 50,
      stubbornness: 50,
      humor: 50,
      ...baseTraits,
    };

    const summary = this.generatePersonalitySummary(defaultTraits);

    const { data, error } = await supabase.rpc('update_npc_personality', {
      p_npc_ref: npcRef,
      p_world_ref: worldRef,
      p_adventure_ref: adventureRef,
      p_traits: defaultTraits,
      p_summary: summary,
    });

    if (error) {
      throw new Error(`Failed to initialize personality: ${error.message}`);
    }

    return {
      id: data,
      npcRef,
      worldRef,
      adventureRef: adventureRef || undefined,
      traits: defaultTraits,
      summary,
      lastUpdated: new Date().toISOString(),
      snapshotVersion: 1,
    };
  }

  /**
   * Adjust personality based on warm memories and recent acts
   */
  async adjustFromMemory(
    npcRef: string,
    worldRef: string,
    adventureRef: string | null,
    warmMemories: MemoryEvent[],
    recentActs: ActEvent[],
    sessionId: string
  ): Promise<PersonalitySnapshot> {
    // Get current personality
    const currentPersonality = await this.getPersonality(npcRef, worldRef, adventureRef);
    if (!currentPersonality) {
      throw new Error(`No personality found for NPC ${npcRef}`);
    }

    // Calculate trait adjustments
    const adjustments = this.calculateTraitAdjustments(
      currentPersonality.traits,
      warmMemories,
      recentActs
    );

    // Apply adjustments with bounds checking
    const newTraits = this.applyTraitAdjustments(currentPersonality.traits, adjustments);
    const newSummary = this.generatePersonalitySummary(newTraits);

    // Update personality
    const { data, error } = await supabase.rpc('update_npc_personality', {
      p_npc_ref: npcRef,
      p_world_ref: worldRef,
      p_adventure_ref: adventureRef,
      p_traits: newTraits,
      p_summary: newSummary,
      p_session_id: sessionId,
    });

    if (error) {
      throw new Error(`Failed to adjust personality: ${error.message}`);
    }

    return {
      id: data,
      npcRef,
      worldRef,
      adventureRef: adventureRef || undefined,
      traits: newTraits,
      summary: newSummary,
      lastUpdated: new Date().toISOString(),
      snapshotVersion: currentPersonality.snapshotVersion + 1,
      derivedFromSession: sessionId,
    };
  }

  /**
   * Merge personalities across sessions with weighted averaging
   */
  async mergeCrossSession(
    npcRef: string,
    worldRef: string,
    adventureRef: string | null
  ): Promise<PersonalitySnapshot> {
    // Get all personality snapshots for this NPC
    const { data: snapshots, error } = await supabase
      .from('npc_personalities')
      .select('*')
      .eq('npc_ref', npcRef)
      .eq('world_ref', worldRef)
      .eq('adventure_ref', adventureRef)
      .order('last_updated', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch personality snapshots: ${error.message}`);
    }

    if (!snapshots || snapshots.length === 0) {
      throw new Error(`No personality snapshots found for NPC ${npcRef}`);
    }

    if (snapshots.length === 1) {
      return this.mapSnapshotToPersonality(snapshots[0]);
    }

    // Calculate weighted average with decay
    const mergedTraits = this.calculateWeightedAverage(snapshots);
    const mergedSummary = this.generatePersonalitySummary(mergedTraits);

    // Update with merged personality
    const { data, error: updateError } = await supabase.rpc('update_npc_personality', {
      p_npc_ref: npcRef,
      p_world_ref: worldRef,
      p_adventure_ref: adventureRef,
      p_traits: mergedTraits,
      p_summary: mergedSummary,
    });

    if (updateError) {
      throw new Error(`Failed to merge personality: ${updateError.message}`);
    }

    return {
      id: data,
      npcRef,
      worldRef,
      adventureRef: adventureRef || undefined,
      traits: mergedTraits,
      summary: mergedSummary,
      lastUpdated: new Date().toISOString(),
      snapshotVersion: Math.max(...snapshots.map(s => s.snapshot_version)) + 1,
    };
  }

  /**
   * Generate a textual summary of personality
   */
  generatePersonalitySummary(traits: PersonalityTraits): string {
    const dominantTraits = this.getDominantTraits(traits);
    const archetype = this.determineArchetype(traits);
    
    return `${archetype} personality with ${dominantTraits.join(', ')} tendencies.`;
  }

  /**
   * Get current personality for an NPC
   */
  async getPersonality(
    npcRef: string,
    worldRef: string,
    adventureRef: string | null = null
  ): Promise<PersonalitySnapshot | null> {
    const { data, error } = await supabase.rpc('get_npc_personality', {
      p_npc_ref: npcRef,
      p_world_ref: worldRef,
      p_adventure_ref: adventureRef,
    });

    if (error) {
      throw new Error(`Failed to get personality: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return null;
    }

    const result = data[0];
    return {
      id: '', // Not returned by function
      npcRef,
      worldRef,
      adventureRef: adventureRef || undefined,
      traits: result.traits,
      summary: result.summary,
      lastUpdated: result.last_updated,
      snapshotVersion: result.snapshot_version,
    };
  }

  /**
   * Calculate trait adjustments based on memories and acts
   */
  private calculateTraitAdjustments(
    currentTraits: PersonalityTraits,
    warmMemories: MemoryEvent[],
    recentActs: ActEvent[]
  ): Partial<PersonalityTraits> {
    const adjustments: Partial<PersonalityTraits> = {};

    // Process warm memories
    for (const memory of warmMemories) {
      const weight = memory.emotionalWeight / 100; // Normalize to -1 to +1
      
      if (memory.type === 'warm') {
        // Positive memories increase trust, empathy, openness
        adjustments.trust = (adjustments.trust || 0) + weight * 2;
        adjustments.empathy = (adjustments.empathy || 0) + weight * 1.5;
        adjustments.openness = (adjustments.openness || 0) + weight * 1;
      } else if (memory.type === 'episodic') {
        // Episodic memories affect curiosity and loyalty
        adjustments.curiosity = (adjustments.curiosity || 0) + weight * 1.5;
        adjustments.loyalty = (adjustments.loyalty || 0) + weight * 1;
      }
    }

    // Process recent acts
    for (const act of recentActs) {
      const weight = act.emotionalImpact / 100; // Normalize to -1 to +1
      
      if (act.actType === 'help' || act.actType === 'support') {
        // Helpful acts increase trust and empathy
        adjustments.trust = (adjustments.trust || 0) + weight * 2;
        adjustments.empathy = (adjustments.empathy || 0) + weight * 1.5;
      } else if (act.actType === 'betray' || act.actType === 'harm') {
        // Harmful acts decrease trust and increase caution
        adjustments.trust = (adjustments.trust || 0) + weight * 3;
        adjustments.caution = (adjustments.caution || 0) - weight * 2;
      } else if (act.actType === 'ignore' || act.actType === 'dismiss') {
        // Ignoring decreases patience and empathy
        adjustments.patience = (adjustments.patience || 0) + weight * 2;
        adjustments.empathy = (adjustments.empathy || 0) + weight * 1;
      }
    }

    // Apply bounds to adjustments
    for (const trait in adjustments) {
      adjustments[trait as keyof PersonalityTraits] = Math.max(
        -this.maxTraitDelta,
        Math.min(this.maxTraitDelta, adjustments[trait as keyof PersonalityTraits]!)
      );
    }

    return adjustments;
  }

  /**
   * Apply trait adjustments to current traits
   */
  private applyTraitAdjustments(
    currentTraits: PersonalityTraits,
    adjustments: Partial<PersonalityTraits>
  ): PersonalityTraits {
    const newTraits: PersonalityTraits = { ...currentTraits };

    for (const trait in adjustments) {
      const adjustment = adjustments[trait as keyof PersonalityTraits]!;
      const newValue = currentTraits[trait as keyof PersonalityTraits] + adjustment;
      newTraits[trait as keyof PersonalityTraits] = Math.max(
        this.minTraitValue,
        Math.min(this.maxTraitValue, newValue)
      );
    }

    return newTraits;
  }

  /**
   * Calculate weighted average of personality snapshots
   */
  private calculateWeightedAverage(snapshots: any[]): PersonalityTraits {
    const weights: number[] = [];
    const totalWeight = snapshots.reduce((sum, snapshot, index) => {
      const weight = Math.pow(this.decayFactor, index);
      weights.push(weight);
      return sum + weight;
    }, 0);

    const mergedTraits: PersonalityTraits = {
      openness: 0,
      loyalty: 0,
      caution: 0,
      empathy: 0,
      patience: 0,
      aggression: 0,
      trust: 0,
      curiosity: 0,
      stubbornness: 0,
      humor: 0,
    };

    for (const trait in mergedTraits) {
      let weightedSum = 0;
      for (let i = 0; i < snapshots.length; i++) {
        const snapshot = snapshots[i];
        const traitValue = snapshot.traits[trait] || 50; // Default to neutral
        weightedSum += traitValue * weights[i];
      }
      mergedTraits[trait as keyof PersonalityTraits] = Math.round(weightedSum / totalWeight);
    }

    return mergedTraits;
  }

  /**
   * Get dominant traits from personality
   */
  private getDominantTraits(traits: PersonalityTraits): string[] {
    const traitEntries = Object.entries(traits) as [keyof PersonalityTraits, number][];
    const sorted = traitEntries.sort((a, b) => b[1] - a[1]);
    
    const dominant = sorted.slice(0, 3).map(([trait, value]) => {
      if (value > 70) return `high ${trait}`;
      if (value < 30) return `low ${trait}`;
      return `moderate ${trait}`;
    });

    return dominant;
  }

  /**
   * Determine personality archetype
   */
  private determineArchetype(traits: PersonalityTraits): string {
    if (traits.trust > 70 && traits.empathy > 70) return 'Friendly';
    if (traits.caution > 70 && traits.aggression < 30) return 'Cautious';
    if (traits.aggression > 70 && traits.patience < 30) return 'Aggressive';
    if (traits.curiosity > 70 && traits.openness > 70) return 'Curious';
    if (traits.stubbornness > 70 && traits.openness < 30) return 'Stubborn';
    if (traits.humor > 70 && traits.empathy > 60) return 'Humorous';
    
    return 'Balanced';
  }

  /**
   * Map database snapshot to PersonalitySnapshot
   */
  private mapSnapshotToPersonality(snapshot: any): PersonalitySnapshot {
    return {
      id: snapshot.id,
      npcRef: snapshot.npc_ref,
      worldRef: snapshot.world_ref,
      adventureRef: snapshot.adventure_ref,
      traits: snapshot.traits,
      summary: snapshot.summary,
      lastUpdated: snapshot.last_updated,
      snapshotVersion: snapshot.snapshot_version,
      derivedFromSession: snapshot.derived_from_session,
    };
  }
}

// Singleton instance
export const personalityEngine = new PersonalityEngine();


