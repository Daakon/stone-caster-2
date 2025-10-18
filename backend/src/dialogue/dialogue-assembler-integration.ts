/**
 * Phase 21: Dialogue Assembler Integration
 * Integrates dialogue slice into AWF bundle with token caps
 */

import { z } from 'zod';

// Types
export interface DialogueSlice {
  conv: string;
  speaker_queue: string[];
  candidates: Array<{
    id: string;
    syn: string;
    emotion: string[];
  }>;
  arc: {
    id: string;
    state: string;
    step: string;
  } | null;
  emotions: Record<string, string[]>;
}

export interface AssemblerContext {
  sessionId: string;
  turnId: number;
  nodeId: string;
  worldRef: string;
  adventureRef?: string;
  playerProfile: {
    name: string;
    level: number;
    skills: Record<string, number>;
    resources: Record<string, number>;
  };
  relationships: Record<string, {
    trust: number;
    consent: 'yes' | 'no' | 'later';
    boundaries: Record<string, boolean>;
  }>;
  party: {
    members: string[];
    intents: Record<string, string>;
  };
  sim: {
    weather: string;
    time: string;
    events: string[];
  };
  quest: {
    activeNode: string;
    completedNodes: string[];
    availableNodes: string[];
  };
  arc: {
    activeArcs: string[];
    arcStates: Record<string, string>;
  };
  maxTokens: number;
}

export interface AssemblerResult {
  success: boolean;
  slice: DialogueSlice | null;
  tokenCount: number;
  trimmed: boolean;
  warnings: string[];
  errors: string[];
}

// Schemas
const DialogueSliceSchema = z.object({
  conv: z.string(),
  speaker_queue: z.array(z.string()),
  candidates: z.array(z.object({
    id: z.string(),
    syn: z.string().max(80),
    emotion: z.array(z.string()).max(4),
  })),
  arc: z.object({
    id: z.string(),
    state: z.string(),
    step: z.string(),
  }).nullable(),
  emotions: z.record(z.string(), z.array(z.string()).max(4)),
});

export class DialogueAssemblerIntegration {
  private maxTokens: number = 220;
  private maxCandidates: number = 3;
  private maxEmotions: number = 4;

  constructor() {
    // Initialize with default settings
  }

  /**
   * Assemble dialogue slice for AWF bundle
   */
  assembleDialogueSlice(
    context: AssemblerContext
  ): AssemblerResult {
    try {
      // Check if dialogue is active
      if (!context.arc.activeArcs.length && !context.party.members.length) {
        return {
          success: true,
          slice: null,
          tokenCount: 0,
          trimmed: false,
          warnings: [],
          errors: [],
        };
      }

      // Build dialogue slice
      const slice: DialogueSlice = {
        conv: this.getActiveConversation(context),
        speaker_queue: this.buildSpeakerQueue(context),
        candidates: this.buildCandidates(context),
        arc: this.buildArcInfo(context),
        emotions: this.buildEmotions(context),
      };

      // Calculate token count
      const tokenCount = this.calculateTokenCount(slice);

      // Check token limit
      if (tokenCount > this.maxTokens) {
        const trimmedSlice = this.trimSlice(slice, this.maxTokens);
        const trimmedTokenCount = this.calculateTokenCount(trimmedSlice);
        
        return {
          success: true,
          slice: trimmedSlice,
          tokenCount: trimmedTokenCount,
          trimmed: true,
          warnings: [`Token count reduced from ${tokenCount} to ${trimmedTokenCount}`],
          errors: [],
        };
      }

      return {
        success: true,
        slice,
        tokenCount,
        trimmed: false,
        warnings: [],
        errors: [],
      };

    } catch (error) {
      return {
        success: false,
        slice: null,
        tokenCount: 0,
        trimmed: false,
        warnings: [],
        errors: [`Dialogue assembly failed: ${error}`],
      };
    }
  }

  /**
   * Get active conversation
   */
  private getActiveConversation(context: AssemblerContext): string {
    // This would integrate with dialogue engine
    // For now, return mock conversation
    return 'conv.kiera.intro';
  }

  /**
   * Build speaker queue
   */
  private buildSpeakerQueue(context: AssemblerContext): string[] {
    const speakers: string[] = [];
    
    // Add player
    speakers.push('player');
    
    // Add party members
    for (const member of context.party.members) {
      speakers.push(member);
    }
    
    // Add NPCs from relationships
    for (const npcId of Object.keys(context.relationships)) {
      if (!speakers.includes(npcId)) {
        speakers.push(npcId);
      }
    }
    
    return speakers.slice(0, 6); // Limit to 6 speakers
  }

  /**
   * Build candidate lines
   */
  private buildCandidates(context: AssemblerContext): Array<{
    id: string;
    syn: string;
    emotion: string[];
  }> {
    const candidates: Array<{
      id: string;
      syn: string;
      emotion: string[];
    }> = [];

    // This would integrate with dialogue engine to get actual candidates
    // For now, return mock candidates
    candidates.push({
      id: 'line.kiera.greeting',
      syn: 'Warm greeting by the glade.',
      emotion: ['warm', 'curious'],
    });

    candidates.push({
      id: 'line.kiera.tease',
      syn: 'Playful tease about your gear.',
      emotion: ['playful'],
    });

    candidates.push({
      id: 'line.kiera.trust',
      syn: 'Shares a personal story about the forest.',
      emotion: ['trusting', 'vulnerable'],
    });

    // Limit to max candidates
    return candidates.slice(0, this.maxCandidates);
  }

  /**
   * Build arc information
   */
  private buildArcInfo(context: AssemblerContext): {
    id: string;
    state: string;
    step: string;
  } | null {
    if (context.arc.activeArcs.length === 0) {
      return null;
    }

    const activeArc = context.arc.activeArcs[0];
    const arcState = context.arc.arcStates[activeArc];

    return {
      id: activeArc,
      state: arcState || 'active',
      step: 'earn_trust', // This would come from arc engine
    };
  }

  /**
   * Build emotions
   */
  private buildEmotions(context: AssemblerContext): Record<string, string[]> {
    const emotions: Record<string, string[]> = {};

    // Add player emotions
    emotions.player = ['focused', 'curious'];

    // Add party member emotions
    for (const member of context.party.members) {
      emotions[member] = ['alert', 'ready'];
    }

    // Add NPC emotions from relationships
    for (const [npcId, relationship] of Object.entries(context.relationships)) {
      if (relationship.trust > 70) {
        emotions[npcId] = ['warm', 'trusting'];
      } else if (relationship.trust > 40) {
        emotions[npcId] = ['cautious', 'curious'];
      } else {
        emotions[npcId] = ['distant', 'alert'];
      }
    }

    // Limit emotions per speaker
    for (const speaker of Object.keys(emotions)) {
      emotions[speaker] = emotions[speaker].slice(0, this.maxEmotions);
    }

    return emotions;
  }

  /**
   * Calculate token count for slice
   */
  private calculateTokenCount(slice: DialogueSlice): number {
    let tokens = 0;
    
    // Conversation ID
    tokens += slice.conv.length + 10;
    
    // Speaker queue
    tokens += slice.speaker_queue.join(',').length + 10;
    
    // Candidates
    for (const candidate of slice.candidates) {
      tokens += candidate.id.length + candidate.syn.length + 
                candidate.emotion.join(',').length + 15;
    }
    
    // Arc info
    if (slice.arc) {
      tokens += slice.arc.id.length + slice.arc.state.length + 
                slice.arc.step.length + 10;
    }
    
    // Emotions
    for (const [speaker, emotions] of Object.entries(slice.emotions)) {
      tokens += speaker.length + emotions.join(',').length + 5;
    }
    
    return tokens;
  }

  /**
   * Trim slice to fit token limit
   */
  private trimSlice(slice: DialogueSlice, maxTokens: number): DialogueSlice {
    const trimmed = { ...slice };
    
    // Trim candidates by score (lowest first)
    if (trimmed.candidates.length > 1) {
      trimmed.candidates = trimmed.candidates.slice(0, 1);
    }
    
    // Trim emotions
    for (const speaker of Object.keys(trimmed.emotions)) {
      trimmed.emotions[speaker] = trimmed.emotions[speaker].slice(0, 2);
    }
    
    // Trim synopsis length
    for (const candidate of trimmed.candidates) {
      if (candidate.syn.length > 60) {
        candidate.syn = candidate.syn.substring(0, 57) + '...';
      }
    }
    
    return trimmed;
  }

  /**
   * Set token limits
   */
  setTokenLimits(limits: {
    maxTokens: number;
    maxCandidates: number;
    maxEmotions: number;
  }): void {
    this.maxTokens = limits.maxTokens;
    this.maxCandidates = limits.maxCandidates;
    this.maxEmotions = limits.maxEmotions;
  }

  /**
   * Get current limits
   */
  getTokenLimits(): {
    maxTokens: number;
    maxCandidates: number;
    maxEmotions: number;
  } {
    return {
      maxTokens: this.maxTokens,
      maxCandidates: this.maxCandidates,
      maxEmotions: this.maxEmotions,
    };
  }

  /**
   * Validate dialogue slice
   */
  validateDialogueSlice(slice: DialogueSlice): {
    valid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];
    
    // Check conversation ID
    if (!slice.conv || slice.conv.length === 0) {
      issues.push('Missing conversation ID');
    }
    
    // Check speaker queue
    if (slice.speaker_queue.length === 0) {
      issues.push('Empty speaker queue');
    }
    
    // Check candidates
    if (slice.candidates.length === 0) {
      issues.push('No candidate lines');
    }
    
    for (const candidate of slice.candidates) {
      if (candidate.syn.length > 80) {
        issues.push(`Candidate synopsis too long: ${candidate.syn.length} > 80`);
      }
      
      if (candidate.emotion.length > 4) {
        issues.push(`Too many emotions: ${candidate.emotion.length} > 4`);
      }
    }
    
    // Check emotions
    for (const [speaker, emotions] of Object.entries(slice.emotions)) {
      if (emotions.length > 4) {
        issues.push(`Too many emotions for ${speaker}: ${emotions.length} > 4`);
      }
    }
    
    return {
      valid: issues.length === 0,
      issues,
    };
  }
}

// Singleton instance
export const dialogueAssemblerIntegration = new DialogueAssemblerIntegration();


